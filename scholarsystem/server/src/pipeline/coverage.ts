// Stage 2.5: Coverage Audit.
//
// The accuracy backstop. Pure-code pass computes which source units
// are NOT cited by any knowledge node or detail entry, then a targeted
// Claude call via the proxy decides what to do with each uncited unit:
//   - attach to an existing concept (add sourceRefs)
//   - create a new concept (gap concept)
//   - justify as non-knowledge-bearing (formatting, redundant, etc.)
//
// Loops at most MAX_ROUNDS times until coverage meets threshold.
// The gap-audit Claude call is intentionally small-input (only the
// uncited passages + existing concept list) — don't cheap out on the
// model tier here, this is the accuracy guarantee.

import type {
  Galaxy,
  Knowledge,
  Concept,
  ConceptDetail,
  Slug,
  ChapterId,
} from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { pushFiles, runStage, compileFiles } from "../lib/proxy-client";
import { parseNote } from "./compile/frontmatter";

const MAX_ROUNDS = 3;
const COVERAGE_THRESHOLD = 0.95; // 95% of source units must be cited

/**
 * Run Stage 2.5: coverage audit. Computes uncited source units, then
 * runs a targeted Claude call to close gaps. Mutates the galaxy blob
 * in place. Does NOT throw on failure — the galaxy is renderable
 * without perfect coverage.
 */
export async function runCoverageAudit(galaxy: Galaxy): Promise<Galaxy> {
  if (!galaxy.knowledge) {
    throw new Error("runCoverageAudit: galaxy.knowledge is null");
  }

  stageStart(galaxy, "coverageAudit");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("coverageAudit: no source chapters");

    const allUnitIds = new Set(chapter.units.map((u) => u.id));
    const unitTextById = new Map(chapter.units.map((u) => [u.id, u.text]));

    let round = 0;
    while (round < MAX_ROUNDS) {
      round++;

      // Compute cited units from knowledge + detail.
      const cited = collectCitedUnits(galaxy);
      const uncited = [...allUnitIds].filter((id) => !cited.has(id));

      const coverage = allUnitIds.size > 0
        ? (allUnitIds.size - uncited.length) / allUnitIds.size
        : 1;

      console.log(
        `[coverage] round ${round}: ${cited.size}/${allUnitIds.size} units cited (${(coverage * 100).toFixed(1)}%), ${uncited.length} uncited`,
      );

      if (coverage >= COVERAGE_THRESHOLD || uncited.length === 0) {
        console.log(`[coverage] threshold met (${(coverage * 100).toFixed(1)}% >= ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%)`);
        break;
      }

      // Build the gap-audit prompt with uncited passages.
      const uncitedPassages = uncited
        .map((id) => `### ${id}\n${unitTextById.get(id) ?? "(text not found)"}`)
        .join("\n\n");

      const existingConcepts = galaxy.knowledge.concepts
        .map((c) => `- ${c.id}: "${c.title}" — ${c.brief}`)
        .join("\n");

      const prompt = buildGapAuditPrompt({
        chapterId: chapter.id,
        uncitedPassages,
        existingConcepts,
        uncitedIds: uncited,
        sourceUnitIds: chapter.units.map((u) => u.id),
      });

      // Push the uncited passages as a reference file, then run the audit.
      await pushFiles(galaxy.meta.id, {
        [`stage2-coverage/round-${round}-uncited.md`]: `# Uncited Source Units (Round ${round})\n\n${uncitedPassages}`,
      });

      const result = await runStage({
        galaxyId: galaxy.meta.id,
        prompt,
      });

      if (!result.ok) {
        console.warn(`[coverage] round ${round} Claude call failed (exit ${result.exitCode})`);
        break;
      }

      // Compile workspace files to pick up any new concepts or updated sourceRefs.
      const files = await compileFiles(galaxy.meta.id);
      applyGapAuditResults(galaxy, files, round);
    }

    stageDone(galaxy, "coverageAudit");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[coverage] audit failed: ${message}`);
    stageError(galaxy, "coverageAudit", message);
    return galaxy;
  }
}

// ───────── Cited-unit collector ─────────

function collectCitedUnits(galaxy: Galaxy): Set<string> {
  const cited = new Set<string>();

  if (galaxy.knowledge) {
    for (const t of galaxy.knowledge.topics) {
      for (const ref of t.sourceRefs) cited.add(ref);
    }
    for (const s of galaxy.knowledge.subtopics) {
      for (const ref of s.sourceRefs) cited.add(ref);
    }
    for (const c of galaxy.knowledge.concepts) {
      for (const ref of c.sourceRefs) cited.add(ref);
    }
  }

  for (const entry of Object.values(galaxy.detail)) {
    if (entry && "sourceRefs" in entry) {
      for (const ref of (entry as ConceptDetail).sourceRefs) cited.add(ref);
    }
  }

  for (const rel of galaxy.relationships) {
    for (const ref of rel.sourceRefs) cited.add(ref);
  }

  return cited;
}

// ───────── Gap-audit prompt ─────────

interface GapAuditPromptInput {
  chapterId: string;
  uncitedPassages: string;
  existingConcepts: string;
  uncitedIds: string[];
  sourceUnitIds: string[];
}

function buildGapAuditPrompt(input: GapAuditPromptInput): string {
  const { chapterId, uncitedPassages, existingConcepts, uncitedIds } = input;

  return `You are an accuracy auditor for an educational content pipeline. Some source units were NOT cited by any knowledge node or detail entry. Your job is to close these gaps.

## Context

The following source units are uncited — no concept, topic, subtopic, or detail entry references them:

${uncitedPassages}

## Existing concepts

${existingConcepts}

## Your task

For EACH uncited source unit, do ONE of:

### Option A: Attach to an existing concept
If the uncited passage is covered by an existing concept, write a file to update that concept's citations:

\`stage2-coverage/${chapterId}-attach-<concept-id>.md\`:
\`\`\`yaml
---
action: attach
conceptId: <existing-concept-id>
addSourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

### Option B: Create a new concept
If the uncited passage contains knowledge that doesn't fit any existing concept, create a new concept file:

\`stage2-coverage/${chapterId}-gap-<new-slug>.md\`:
\`\`\`yaml
---
action: new-concept
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: concept
kind: <definition|formula|example|fact|principle|process>
modelTier: <light|standard|heavy>
title: <string>
brief: <1-2 sentence hook>
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

### Option C: Justify as non-knowledge-bearing
If the passage is formatting, boilerplate, redundant repetition, or genuinely contains no learnable content:

\`stage2-coverage/${chapterId}-skip-<unit-id>.md\`:
\`\`\`yaml
---
action: skip
unitId: ${chapterId}-s-NNNN
reason: <brief justification why this unit contains no knowledge>
---
\`\`\`

## Rules

1. Every uncited unit (${uncitedIds.length} total) must be addressed by exactly one file.
2. New concept ids MUST start with \`${chapterId}-\`.
3. \`sourceRefs\` must reference real source unit ids.
4. Prefer Option A (attach) when the content is already covered. Prefer Option C only when the passage genuinely has no learnable content. Option B is for real gaps.
5. Do NOT modify any existing files — only create new files under \`stage2-coverage/\`.

Now audit the uncited passages and create the appropriate files.`;
}

// ───────── Apply gap-audit results ─────────

function applyGapAuditResults(
  galaxy: Galaxy,
  files: Record<string, string>,
  round: number,
): void {
  if (!galaxy.knowledge) return;

  const prefix = "stage2-coverage/";
  let attached = 0;
  let created = 0;
  let skipped = 0;

  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(prefix)) continue;
    if (!path.endsWith(".md")) continue;

    try {
      const note = parseNote(content, path);
      const action = note.data.action as string;

      switch (action) {
        case "attach": {
          const conceptId = note.data.conceptId as string;
          const addRefs = asStringArray(note.data.addSourceRefs);

          // Update knowledge concept sourceRefs.
          const concept = galaxy.knowledge!.concepts.find((c) => c.id === conceptId);
          if (concept && addRefs.length > 0) {
            const existing = new Set(concept.sourceRefs);
            for (const ref of addRefs) {
              if (!existing.has(ref)) {
                concept.sourceRefs.push(ref as Slug);
              }
            }
          }

          // Update detail sourceRefs if detail exists for this concept.
          const detail = galaxy.detail[conceptId];
          if (detail && addRefs.length > 0) {
            const existing = new Set(detail.sourceRefs);
            for (const ref of addRefs) {
              if (!existing.has(ref)) {
                detail.sourceRefs.push(ref as Slug);
              }
            }
          }

          attached++;
          break;
        }

        case "new-concept": {
          const id = note.data.id as string;
          if (!id) break;

          // Add to knowledge.concepts as a loose concept.
          const newConcept: Concept = {
            id: id as Slug,
            chapter: (note.data.chapter ?? galaxy.source.chapters[0].id) as ChapterId,
            title: (note.data.title as string) ?? id,
            kind: (note.data.kind as Concept["kind"]) ?? "fact",
            brief: (note.data.brief as string) ?? "",
            modelTier: (note.data.modelTier as Concept["modelTier"]) ?? "light",
            sourceRefs: asStringArray(note.data.sourceRefs) as Slug[],
          };

          // Only add if not already present.
          if (!galaxy.knowledge!.concepts.some((c) => c.id === id)) {
            galaxy.knowledge!.concepts.push(newConcept);
            galaxy.knowledge!.looseConceptIds.push(id as Slug);
          }

          created++;
          break;
        }

        case "skip": {
          skipped++;
          break;
        }
      }
    } catch {
      console.warn(`[coverage] failed to parse gap-audit file: ${path}`);
    }
  }

  console.log(
    `[coverage] round ${round} results: ${attached} attached, ${created} new concepts, ${skipped} skipped`,
  );
}

function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}
