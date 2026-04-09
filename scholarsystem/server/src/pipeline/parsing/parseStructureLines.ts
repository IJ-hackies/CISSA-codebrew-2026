// Stage 1 output parser: compact line format → Knowledge + Relationships.
//
// Why this exists: Stage 1 used to ask Claude for a full JSON blob. That's
// wasteful (every field name, quote, brace, comma costs output tokens) and
// fragile (a single trailing comma or unescaped quote torches the whole
// galaxy). The line format is ~40% smaller on output and degrades gracefully
// — a single bad row fails independently instead of cascading.
//
// Format (tab-delimited, one node per line):
//
//   TITLE<TAB>title of the overall material
//   SUMMARY<TAB>2-3 sentence overview
//   T<TAB>id<TAB>title<TAB>summary
//   S<TAB>id<TAB>parentTopicId<TAB>title<TAB>summary
//   C<TAB>id<TAB>parentSubtopicId<TAB>kind<TAB>tier<TAB>title<TAB>brief
//   R<TAB>fromId<TAB>toId<TAB>relationshipKind
//
// Rules:
//   - Blank lines and lines starting with `#` are ignored.
//   - For C rows, parentSubtopicId may be `-` to mark a loose concept
//     (becomes an asteroid in the spatial scope).
//   - The final text field on each row (summary / brief) absorbs any
//     overflow columns, so a stray tab inside prose doesn't tank the row.
//     We also normalise whitespace inside absorbed overflow.
//   - kind/tier must match the Zod enums verbatim. Typos fail per-row,
//     not per-galaxy.
//   - Per-row failures are collected in `warnings` and the row is dropped.
//     The assembled object is then Zod-validated by the caller, which is
//     the authoritative contract with downstream stages.

import {
  Knowledge,
  Relationships,
  Concept,
  Subtopic,
  Topic,
  ConceptKind,
  ModelTier,
  RelationshipKind,
} from "../../../../shared/types";

export interface ParseStructureResult {
  knowledge: Knowledge;
  relationships: Relationships;
  /** Per-row problems encountered while parsing. Non-fatal — logged for debug. */
  warnings: string[];
}

const CONCEPT_KINDS = ConceptKind.options as readonly string[];
const MODEL_TIERS = ModelTier.options as readonly string[];
const RELATIONSHIP_KINDS = RelationshipKind.options as readonly string[];

/**
 * Parse Claude's line-based Stage 1 output into a Knowledge + Relationships
 * pair. Does NOT throw on per-row problems — collects them as warnings and
 * drops the offending row. The caller is expected to run Zod validation +
 * referential-integrity checks on the returned object.
 */
export function parseStructureLines(raw: string): ParseStructureResult {
  const warnings: string[] = [];

  let title = "";
  let summary = "";
  const topics: Topic[] = [];
  const subtopics: Subtopic[] = [];
  const concepts: Concept[] = [];
  const looseConceptIds: string[] = [];
  const relationships: Relationships = [];

  // Temporary maps to build the parent→children id arrays without O(n²)
  // lookups at the end.
  const subtopicsByTopic = new Map<string, string[]>();
  const conceptsBySubtopic = new Map<string, string[]>();

  // Parent-link queues — stitched after all rows are parsed so ordering
  // of T/S/C rows in the input doesn't matter.
  const pendingSubtopicLinks: Array<{ subtopicId: string; parentTopicId: string }> = [];
  const pendingConceptLinks: Array<{ conceptId: string; parentSubtopicId: string }> = [];

  const lines = raw.replace(/\r\n?/g, "\n").split("\n");

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const rawLine = lines[lineNo];
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;

    // Fenced code markers sometimes leak in despite the prompt; skip them.
    if (line.startsWith("```")) continue;

    const parts = line.split("\t");
    const tag = parts[0];

    try {
      switch (tag) {
        case "TITLE": {
          const value = absorbTail(parts, 1);
          if (!value) throw new Error("TITLE is empty");
          title = value;
          break;
        }
        case "SUMMARY": {
          const value = absorbTail(parts, 1);
          if (!value) throw new Error("SUMMARY is empty");
          summary = value;
          break;
        }
        case "T": {
          // T<TAB>id<TAB>title<TAB>summary
          if (parts.length < 4) {
            throw new Error(`T row needs 4 columns, got ${parts.length}`);
          }
          const [, id, tTitle, ...tail] = parts;
          const topicSummary = normaliseWhitespace(tail.join(" "));
          topics.push({
            id,
            title: tTitle,
            summary: topicSummary,
            subtopicIds: [],
          });
          subtopicsByTopic.set(id, []);
          break;
        }
        case "S": {
          // S<TAB>id<TAB>parentTopicId<TAB>title<TAB>summary
          if (parts.length < 5) {
            throw new Error(`S row needs 5 columns, got ${parts.length}`);
          }
          const [, id, parentTopicId, sTitle, ...tail] = parts;
          const subtopicSummary = normaliseWhitespace(tail.join(" "));
          subtopics.push({
            id,
            title: sTitle,
            summary: subtopicSummary,
            conceptIds: [],
          });
          conceptsBySubtopic.set(id, []);
          // Queue the parent link — we'll stitch after all rows are parsed
          // so order of T vs S rows doesn't matter.
          pendingSubtopicLinks.push({ subtopicId: id, parentTopicId });
          break;
        }
        case "C": {
          // C<TAB>id<TAB>parentSubtopicId<TAB>kind<TAB>tier<TAB>title<TAB>brief
          if (parts.length < 7) {
            throw new Error(`C row needs 7 columns, got ${parts.length}`);
          }
          const [, id, parentSubtopicId, kind, tier, cTitle, ...tail] = parts;
          if (!CONCEPT_KINDS.includes(kind)) {
            throw new Error(`unknown concept kind '${kind}'`);
          }
          if (!MODEL_TIERS.includes(tier)) {
            throw new Error(`unknown model tier '${tier}'`);
          }
          const brief = normaliseWhitespace(tail.join(" "));
          concepts.push({
            id,
            title: cTitle,
            kind: kind as Concept["kind"],
            modelTier: tier as Concept["modelTier"],
            brief,
          });
          pendingConceptLinks.push({ conceptId: id, parentSubtopicId });
          break;
        }
        case "R": {
          // R<TAB>from<TAB>to<TAB>kind
          if (parts.length < 4) {
            throw new Error(`R row needs 4 columns, got ${parts.length}`);
          }
          const [, from, to, kind] = parts;
          if (!RELATIONSHIP_KINDS.includes(kind)) {
            throw new Error(`unknown relationship kind '${kind}'`);
          }
          relationships.push({
            from,
            to,
            kind: kind as Relationships[number]["kind"],
          });
          break;
        }
        default:
          // Silently ignore unknown tags — Claude sometimes adds a header
          // comment without a `#`. If something looks suspicious, warn.
          if (/^[A-Z]/.test(tag)) {
            warnings.push(`line ${lineNo + 1}: unknown tag '${tag}', skipped`);
          }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`line ${lineNo + 1}: ${message}`);
    }
  }

  // Stitch parent links now that all topics/subtopics/concepts are known.
  for (const { subtopicId, parentTopicId } of pendingSubtopicLinks) {
    const bucket = subtopicsByTopic.get(parentTopicId);
    if (!bucket) {
      warnings.push(`subtopic '${subtopicId}' references unknown topic '${parentTopicId}'`);
      continue;
    }
    bucket.push(subtopicId);
  }
  for (const topic of topics) {
    topic.subtopicIds = subtopicsByTopic.get(topic.id) ?? [];
  }

  for (const { conceptId, parentSubtopicId } of pendingConceptLinks) {
    if (parentSubtopicId === "-" || parentSubtopicId === "") {
      looseConceptIds.push(conceptId);
      continue;
    }
    const bucket = conceptsBySubtopic.get(parentSubtopicId);
    if (!bucket) {
      warnings.push(
        `concept '${conceptId}' references unknown subtopic '${parentSubtopicId}' — treating as loose`,
      );
      looseConceptIds.push(conceptId);
      continue;
    }
    bucket.push(conceptId);
  }
  for (const subtopic of subtopics) {
    subtopic.conceptIds = conceptsBySubtopic.get(subtopic.id) ?? [];
  }

  const knowledge: Knowledge = {
    title,
    summary,
    topics,
    subtopics,
    concepts,
    looseConceptIds,
  };

  return { knowledge, relationships, warnings };
}

// ─── helpers ───────────────────────────────────────────────────────────────

/**
 * Join everything from column `startIdx` onwards as a single whitespace-
 * normalised string. Used for single-value rows (TITLE, SUMMARY).
 */
function absorbTail(parts: string[], startIdx: number): string {
  if (parts.length <= startIdx) return "";
  return normaliseWhitespace(parts.slice(startIdx).join(" "));
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
