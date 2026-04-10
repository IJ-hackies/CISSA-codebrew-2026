// Compile step: workspace folders → Galaxy blob scopes.
//
// Reads the flat record of { relativePath → content } returned by the
// proxy's GET /session/:id/compile endpoint. Each stage folder contains
// Obsidian-style markdown notes with YAML frontmatter + [[wikilinks]].
//
// This module walks the files, parses frontmatter, extracts wikilinks,
// validates everything against Zod, and returns partial Galaxy scopes
// that the orchestrator merges into the blob.
//
// Intentionally returns scopes individually rather than a full Galaxy —
// the orchestrator decides which scopes to write at each stage boundary.

import {
  Topic,
  Subtopic,
  Concept,
  Knowledge,
  Relationship,
  Relationships,
  ConceptDetail,
  NarrativeCanon,
  ChapterArc,
  ArcBeat,
  Character,
  Slug,
} from "@scholarsystem/shared";
import type {
  ConceptKind,
  ModelTier,
  RelationshipKind,
  ChapterId,
  NarrativeCanon as NarrativeCanonType,
  ChapterArc as ChapterArcType,
} from "@scholarsystem/shared";
import { parseNote, extractWikilinks, type ParsedNote } from "./frontmatter";

// ─── Stage 1 compile: stage1-structure/ → Knowledge + Relationships ───

export interface CompiledStructure {
  knowledge: Knowledge;
  relationships: Relationship[];
}

/**
 * Compile Stage 1 output from workspace markdown files.
 *
 * Expects files under `stage1-structure/` with frontmatter fields:
 *   - id, chapter, type ("topic" | "subtopic" | "concept"), title
 *   - topic/subtopic nodes: summary, sourceRefs
 *   - concept nodes: kind, modelTier, brief, sourceRefs, parentSubtopicId (optional)
 *
 * Wikilinks in body text compile into Relationship edges.
 */
export function compileStructure(
  files: Record<string, string>,
  galaxyTitle: string,
  galaxySummary: string,
): CompiledStructure {
  const notes = pickStageFiles(files, "stage1-structure/");

  const topics: Topic[] = [];
  const subtopics: Subtopic[] = [];
  const concepts: Concept[] = [];
  const relationships: Relationship[] = [];
  const looseConceptIds: Slug[] = [];

  // Track parent references to wire up subtopicIds/conceptIds.
  const subtopicsByTopic = new Map<string, string[]>();
  const conceptsBySubtopic = new Map<string, string[]>();

  // Wikilinks accumulator: source note id → target ids.
  const wikilinkEdges: { from: string; to: string; sourceRefs: string[] }[] = [];

  for (const note of notes) {
    const d = note.data;
    const type = d.type as string;

    switch (type) {
      case "topic": {
        const t = Topic.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          summary: d.summary ?? "",
          subtopicIds: [], // filled below
          sourceRefs: asStringArray(d.sourceRefs),
        });
        topics.push(t);
        break;
      }
      case "subtopic": {
        const s = Subtopic.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          summary: d.summary ?? "",
          conceptIds: [], // filled below
          sourceRefs: asStringArray(d.sourceRefs),
        });
        subtopics.push(s);
        const parentTopic = d.topic as string;
        if (parentTopic) {
          const arr = subtopicsByTopic.get(parentTopic) ?? [];
          arr.push(s.id);
          subtopicsByTopic.set(parentTopic, arr);
        }
        break;
      }
      case "concept": {
        const c = Concept.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          kind: d.kind as ConceptKind,
          brief: d.brief ?? "",
          modelTier: (d.modelTier ?? "standard") as ModelTier,
          sourceRefs: asStringArray(d.sourceRefs),
        });
        concepts.push(c);

        const parentSubtopic = d.subtopic as string | undefined;
        if (parentSubtopic) {
          const arr = conceptsBySubtopic.get(parentSubtopic) ?? [];
          arr.push(c.id);
          conceptsBySubtopic.set(parentSubtopic, arr);
        } else {
          looseConceptIds.push(c.id as Slug);
        }
        break;
      }
    }

    // Extract wikilinks from body → relationship edges.
    const links = extractWikilinks(note.body);
    const noteId = d.id as string;
    const sourceRefs = asStringArray(d.sourceRefs);
    for (const target of links) {
      wikilinkEdges.push({ from: noteId, to: target, sourceRefs });
    }
  }

  // Wire up parent→child id arrays.
  for (const t of topics) {
    t.subtopicIds = (subtopicsByTopic.get(t.id) ?? []) as Slug[];
  }
  for (const s of subtopics) {
    s.conceptIds = (conceptsBySubtopic.get(s.id) ?? []) as Slug[];
  }

  // Build a set of all known ids for filtering valid wikilink edges.
  const allIds = new Set<string>([
    ...topics.map((t) => t.id),
    ...subtopics.map((s) => s.id),
    ...concepts.map((c) => c.id),
  ]);

  // Convert wikilink edges into typed Relationships.
  // Default to "related" — Stage 1 notes can specify relationship kind
  // with syntax like [[target-id|prerequisite]], but "related" is safe default.
  for (const edge of wikilinkEdges) {
    if (!allIds.has(edge.from) || !allIds.has(edge.to)) continue;
    if (edge.from === edge.to) continue;

    // Parse optional relationship kind from wikilink aliases.
    const kind: RelationshipKind = "related";

    const rel = Relationship.parse({
      from: edge.from,
      to: edge.to,
      kind,
      sourceRefs: edge.sourceRefs,
    });
    relationships.push(rel);
  }

  // Deduplicate relationships.
  const seen = new Set<string>();
  const dedupedRels = relationships.filter((r) => {
    const key = `${r.from}→${r.to}→${r.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const knowledge = Knowledge.parse({
    title: galaxyTitle,
    summary: galaxySummary,
    topics,
    subtopics,
    concepts,
    looseConceptIds,
  });

  return { knowledge, relationships: dedupedRels };
}

// ─── Stage 2 compile: stage2-detail/<topic-id>/ → Detail record ───────

export interface CompiledDetail {
  detail: Record<string, ConceptDetail>;
}

/**
 * Compile Stage 2 output from workspace markdown files.
 *
 * Expects files under `stage2-detail/` with frontmatter matching
 * ConceptDetail shape (conceptId, chapter, fullDefinition, etc.).
 */
export function compileDetail(files: Record<string, string>): CompiledDetail {
  const notes = pickStageFiles(files, "stage2-detail/");
  const detail: Record<string, ConceptDetail> = {};

  for (const note of notes) {
    const d = note.data;
    const conceptId = d.conceptId as string ?? d.id as string;

    const entry = ConceptDetail.parse({
      conceptId,
      chapter: d.chapter,
      fullDefinition: d.fullDefinition ?? note.body.trim(),
      formulas: asStringArray(d.formulas),
      workedExamples: asStringArray(d.workedExamples),
      edgeCases: asStringArray(d.edgeCases),
      mnemonics: asStringArray(d.mnemonics),
      emphasisMarkers: asStringArray(d.emphasisMarkers),
      sourceQuotes: asStringArray(d.sourceQuotes),
      sourceRefs: asStringArray(d.sourceRefs),
      extractedAt: typeof d.extractedAt === "number" ? d.extractedAt : Date.now(),
    });

    detail[conceptId] = entry;
  }

  return { detail };
}

// ─── Stage 3 compile: stage3-narrative/ → Narrative scopes ──────────

export interface CompiledNarrative {
  canon: NarrativeCanonType | null;
  arcs: ChapterArcType[];
}

/**
 * Compile Stage 3 output from workspace markdown files.
 *
 * Expects:
 *   - `stage3-narrative/canon.md` with NarrativeCanon frontmatter (first run)
 *   - `stage3-narrative/arcs/<chapter>.md` with ChapterArc frontmatter
 */
export function compileNarrative(
  files: Record<string, string>,
): CompiledNarrative {
  const notes = pickStageFiles(files, "stage3-narrative/");
  let canon: NarrativeCanonType | null = null;
  const arcs: ChapterArcType[] = [];

  for (const note of notes) {
    const type = note.data.type as string;

    if (type === "canon") {
      try {
        const tone = note.data.tone as Record<string, unknown> | undefined;
        const aesthetic = note.data.aesthetic as Record<string, unknown> | undefined;

        // Parse recurring characters — may be a JSON string or array.
        let chars: unknown[] = [];
        if (typeof note.data.recurringCharacters === "string") {
          try {
            chars = JSON.parse(note.data.recurringCharacters);
          } catch {
            chars = [];
          }
        } else if (Array.isArray(note.data.recurringCharacters)) {
          chars = note.data.recurringCharacters;
        }

        canon = NarrativeCanon.parse({
          setting: note.data.setting ?? "",
          protagonist: note.data.protagonist ?? "",
          premise: note.data.premise ?? "",
          stakes: note.data.stakes ?? "",
          tone: {
            primary: tone?.primary ?? "wondrous",
            secondary: tone?.secondary ?? null,
            genre: tone?.genre ?? "exploration",
          },
          aesthetic: {
            paletteDirection: aesthetic?.paletteDirection ?? "",
            atmosphereDirection: aesthetic?.atmosphereDirection ?? "",
            motifKeywords: asStringArray(aesthetic?.motifKeywords),
          },
          recurringCharacters: chars.map((c: any) =>
            Character.parse({
              id: c.id,
              name: c.name ?? "",
              role: c.role ?? "",
              description: c.description ?? "",
              voice: c.voice ?? "",
              arc: c.arc ?? "",
            }),
          ),
          finaleHook: (note.data.finaleHook as string) ?? "",
          hardConstraints: asStringArray(note.data.hardConstraints),
        });
      } catch (err) {
        console.warn(
          `compile: canon validation failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else if (type === "arc") {
      try {
        const beats = Array.isArray(note.data.beats) ? note.data.beats : [];

        const arc = ChapterArc.parse({
          chapter: note.data.chapter ?? "",
          arcSummary: (note.data.arcSummary as string) ?? "",
          beats: beats.map((b: any) =>
            ArcBeat.parse({
              topicId: b.topicId ?? "",
              role: b.role ?? "opening",
              beat: b.beat ?? "",
              emotionalTarget: b.emotionalTarget ?? "",
              connectsTo: asStringArray(b.connectsTo),
            }),
          ),
          chapterHook: (note.data.chapterHook as string) ?? "",
        });

        arcs.push(arc);
      } catch (err) {
        console.warn(
          `compile: arc validation failed for ${note.path}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  return { canon, arcs };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Filter files belonging to a specific stage folder prefix. */
function pickStageFiles(
  files: Record<string, string>,
  prefix: string,
): ParsedNote[] {
  const notes: ParsedNote[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(prefix)) continue;
    if (!path.endsWith(".md")) continue;
    try {
      notes.push(parseNote(content, path));
    } catch {
      // Skip files that fail to parse — don't cascade.
      console.warn(`compile: skipping unparseable file: ${path}`);
    }
  }
  return notes;
}

function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}
