// Stage 1: Structure.
//
// Single Claude call that produces the hierarchical knowledge outline plus
// the cross-concept relationship graph. This is the "minimum viable galaxy"
// stage — as soon as it lands, the layout engine can run (Stage 4) and the
// frontend can render a usable map even with no detail/narrative/visuals.

import { z } from "zod";
import { Galaxy, Knowledge, Relationships } from "../../../../shared/types";
import { runClaude } from "../../lib/spawner";
import { extractJson, stageStart, stageDone, stageError } from "../../lib/blob";
import { buildStructurePrompt } from "../../prompts/parsing/structure";

// Wrapper matching what the Stage 1 prompt is instructed to output.
const StructureResponse = z.object({
  knowledge: Knowledge,
  relationships: Relationships,
});

export interface RunStructureOptions {
  /**
   * If true, validate knowledge/relationships referential integrity after
   * Zod parsing (every subtopicId points at a real subtopic, etc.). Defaults
   * to true — turning it off is only useful for debugging prompt drift.
   */
  validateRefs?: boolean;
}

/**
 * Runs Stage 1 against the given galaxy blob. Mutates the blob in place:
 * writes `knowledge` + `relationships`, and flips `pipeline.structure`
 * through running → done/error. Returns the same galaxy for chaining.
 */
export async function runStructure(
  galaxy: Galaxy,
  opts: RunStructureOptions = {},
): Promise<Galaxy> {
  stageStart(galaxy, "structure");

  try {
    const prompt = buildStructurePrompt(galaxy.source.excerpt + maybeRest(galaxy));

    // For now we feed the full input via the prompt itself (the excerpt
    // field only holds the first 500 chars — we pass the full text through
    // the pipeline runner via a separate path; see runStructureFromText).
    // When called with a galaxy that already has an excerpt only, that's
    // all we have. The test-pipeline script uses runStructureFromText to
    // pass the full text without losing it to the 500-char excerpt.
    const res = await runClaude({ prompt });

    if (!res.ok) {
      throw new Error(
        `claude exited ${res.exitCode}: ${res.stderr || "(no stderr)"}`,
      );
    }

    const parsed = StructureResponse.parse(extractJson(res.output));

    if (opts.validateRefs !== false) {
      assertReferentialIntegrity(parsed.knowledge, parsed.relationships);
    }

    galaxy.knowledge = parsed.knowledge;
    galaxy.relationships = parsed.relationships;
    // Title the galaxy from the knowledge summary if ingest derived a
    // placeholder — knowledge.title is usually more descriptive.
    if (parsed.knowledge.title && parsed.knowledge.title.length > 0) {
      galaxy.meta.title = parsed.knowledge.title;
    }

    stageDone(galaxy, "structure");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "structure", message);
    throw err;
  }
}

/**
 * Convenience for the test pipeline: run structure against raw text
 * directly, without relying on the excerpt field of an existing blob.
 */
export async function runStructureFromText(
  galaxy: Galaxy,
  fullText: string,
  opts: RunStructureOptions = {},
): Promise<Galaxy> {
  stageStart(galaxy, "structure");

  try {
    const prompt = buildStructurePrompt(fullText);
    const res = await runClaude({ prompt });

    if (!res.ok) {
      throw new Error(
        `claude exited ${res.exitCode}: ${res.stderr || "(no stderr)"}`,
      );
    }

    const parsed = StructureResponse.parse(extractJson(res.output));

    if (opts.validateRefs !== false) {
      assertReferentialIntegrity(parsed.knowledge, parsed.relationships);
    }

    galaxy.knowledge = parsed.knowledge;
    galaxy.relationships = parsed.relationships;
    if (parsed.knowledge.title && parsed.knowledge.title.length > 0) {
      galaxy.meta.title = parsed.knowledge.title;
    }

    stageDone(galaxy, "structure");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "structure", message);
    throw err;
  }
}

// Catch model sloppiness that passes Zod shape checks but violates the
// referential contract (e.g. subtopicIds pointing at a non-existent id).
// Surface these at the stage boundary, not at layout time.
function assertReferentialIntegrity(
  knowledge: Knowledge,
  relationships: Relationships,
): void {
  const topicIds = new Set(knowledge.topics.map((t) => t.id));
  const subtopicIds = new Set(knowledge.subtopics.map((s) => s.id));
  const conceptIds = new Set(knowledge.concepts.map((c) => c.id));

  // Id uniqueness across all three tiers.
  const all = new Set<string>();
  for (const id of [...topicIds, ...subtopicIds, ...conceptIds]) {
    if (all.has(id)) {
      throw new Error(`structure: duplicate id across knowledge: ${id}`);
    }
    all.add(id);
  }

  for (const t of knowledge.topics) {
    for (const id of t.subtopicIds) {
      if (!subtopicIds.has(id)) {
        throw new Error(`structure: topic '${t.id}' references missing subtopic '${id}'`);
      }
    }
  }
  for (const s of knowledge.subtopics) {
    for (const id of s.conceptIds) {
      if (!conceptIds.has(id)) {
        throw new Error(`structure: subtopic '${s.id}' references missing concept '${id}'`);
      }
    }
  }
  for (const id of knowledge.looseConceptIds) {
    if (!conceptIds.has(id)) {
      throw new Error(`structure: looseConceptIds references missing concept '${id}'`);
    }
  }
  for (const r of relationships) {
    if (!conceptIds.has(r.from)) {
      throw new Error(`structure: relationship.from '${r.from}' is not a concept id`);
    }
    if (!conceptIds.has(r.to)) {
      throw new Error(`structure: relationship.to '${r.to}' is not a concept id`);
    }
    if (r.from === r.to) {
      throw new Error(`structure: self-loop relationship on '${r.from}'`);
    }
  }
}

// Stub: eventually we may want to stream chunks through the blob for very
// large inputs. Placeholder left so the call site in runStructure compiles.
function maybeRest(_galaxy: Galaxy): string {
  return "";
}
