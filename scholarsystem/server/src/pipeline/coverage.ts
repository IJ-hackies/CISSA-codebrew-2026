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
  Derivative,
  Slug,
  ChapterId,
} from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { pushFiles, runStage, compileFiles } from "../lib/proxy-client";
import { parseNote, extractDerivatives } from "./compile/frontmatter";

const MAX_ROUNDS = 3;
const COVERAGE_THRESHOLD = 0.95; // 95% of source words must be covered

// ───────── Word-level coverage ─────────

export interface CoverageReport {
  totalWords: number;
  coveredWords: number;
  coveragePercent: number;
  uncoveredGaps: {
    wordIndex: number;
    wordCount: number;
    preview: string;
    sourceUnitId: string;
  }[];
}

/** Normalize text to lowercase words, stripping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Normalize common OCR/PDF artifacts before stripping.
    .replace(/[\u201C\u201D]/g, '"')   // smart double quotes
    .replace(/[\u2018\u2019]/g, "'")   // smart single quotes
    .replace(/[\u2013\u2014]/g, "-")   // en-dash, em-dash → hyphen
    .replace(/\uFB01/g, "fi")          // fi ligature
    .replace(/\uFB02/g, "fl")          // fl ligature
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Find the best matching position of a quote's word sequence within the
 * source words, allowing a small gap tolerance (1-2 word mismatches from
 * cleaning artifacts). Returns [startIndex, endIndex) or null.
 */
function findWordRun(
  sourceWords: string[],
  quoteWords: string[],
  startFrom: number = 0,
): [number, number] | null {
  if (quoteWords.length === 0) return null;

  const minMatchRatio = 0.6; // at least 60% of quote words must match in sequence
  let bestStart = -1;
  let bestEnd = -1;
  let bestScore = 0;

  for (let i = startFrom; i <= sourceWords.length - Math.min(3, quoteWords.length); i++) {
    if (sourceWords[i] !== quoteWords[0]) continue;

    // Try to match quote words starting at position i in source.
    let si = i;
    let qi = 0;
    let matched = 0;
    let gaps = 0;

    while (si < sourceWords.length && qi < quoteWords.length && gaps <= 3) {
      if (sourceWords[si] === quoteWords[qi]) {
        matched++;
        si++;
        qi++;
        gaps = 0;
      } else {
        gaps++;
        si++;
      }
    }

    // Skip remaining quote words with tolerance.
    const score = matched / quoteWords.length;
    if (score >= minMatchRatio && matched > bestScore) {
      bestScore = matched;
      bestStart = i;
      bestEnd = si;
    }
  }

  if (bestStart >= 0) return [bestStart, bestEnd];
  return null;
}

/**
 * Compute word-level coverage of source text by derivative quotes.
 * Ported from flint-comp90054 check-coverage.js algorithm.
 */
export function computeWordCoverage(
  sourceUnits: { id: string; text: string }[],
  derivatives: { sourceRef: string; quote: string }[],
): CoverageReport {
  // Build a flat array of source words with unit-id tracking.
  const sourceWords: string[] = [];
  const wordUnitId: string[] = [];

  for (const unit of sourceUnits) {
    const words = tokenize(unit.text);
    for (const w of words) {
      sourceWords.push(w);
      wordUnitId.push(unit.id);
    }
  }

  const covered = new Uint8Array(sourceWords.length); // 0 = uncovered

  // Match each derivative quote against source words.
  for (const d of derivatives) {
    const quoteWords = tokenize(d.quote);
    if (quoteWords.length === 0) continue;

    const run = findWordRun(sourceWords, quoteWords);
    if (run) {
      for (let i = run[0]; i < run[1]; i++) {
        covered[i] = 1;
      }
    }
  }

  // Compute coverage stats and find gaps.
  let coveredCount = 0;
  for (let i = 0; i < covered.length; i++) {
    if (covered[i]) coveredCount++;
  }

  const uncoveredGaps: CoverageReport["uncoveredGaps"] = [];
  let i = 0;
  while (i < sourceWords.length) {
    if (!covered[i]) {
      const gapStart = i;
      while (i < sourceWords.length && !covered[i]) i++;
      const gapEnd = i;
      const gapWords = sourceWords.slice(gapStart, gapEnd);
      uncoveredGaps.push({
        wordIndex: gapStart,
        wordCount: gapEnd - gapStart,
        preview: gapWords.slice(0, 20).join(" ").slice(0, 80),
        sourceUnitId: wordUnitId[gapStart],
      });
    } else {
      i++;
    }
  }

  return {
    totalWords: sourceWords.length,
    coveredWords: coveredCount,
    coveragePercent: sourceWords.length > 0 ? coveredCount / sourceWords.length : 1,
    uncoveredGaps,
  };
}

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

    const unitTextById = new Map(chapter.units.map((u) => [u.id, u.text]));

    const allUnitIds = new Set(chapter.units.map((u) => u.id));

    let round = 0;
    while (round < MAX_ROUNDS) {
      round++;

      // ── Primary gate: unit-level coverage (every source unit cited) ──
      const citedUnitIds = collectCitedUnits(galaxy);
      const uncitedUnits = [...allUnitIds].filter((id) => !citedUnitIds.has(id));
      const unitCoverage = allUnitIds.size > 0
        ? (allUnitIds.size - uncitedUnits.length) / allUnitIds.size
        : 1;

      // ── Supplementary: word-level coverage from derivatives ──
      const allDerivatives: { sourceRef: string; quote: string }[] = [];
      for (const entry of Object.values(galaxy.detail)) {
        if (entry && "derivatives" in entry) {
          for (const d of (entry as ConceptDetail).derivatives) {
            allDerivatives.push({ sourceRef: d.sourceRef, quote: d.quote });
          }
        }
      }
      const wordReport = computeWordCoverage(chapter.units, allDerivatives);

      console.log(
        `[coverage] round ${round}: unit-level ${citedUnitIds.size}/${allUnitIds.size} (${(unitCoverage * 100).toFixed(1)}%), ` +
        `word-level ${wordReport.coveredWords}/${wordReport.totalWords} (${(wordReport.coveragePercent * 100).toFixed(1)}%), ` +
        `${uncitedUnits.length} uncited units`,
      );

      // Pass if unit-level coverage meets threshold.
      if (unitCoverage >= COVERAGE_THRESHOLD || uncitedUnits.length === 0) {
        console.log(`[coverage] unit threshold met (${(unitCoverage * 100).toFixed(1)}% >= ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%)`);
        break;
      }

      // Build passages for Claude from uncited units.
      const uncitedPassages = uncitedUnits
        .map((id) => `### ${id}\n${unitTextById.get(id) ?? "(text not found)"}`)
        .join("\n\n");

      const existingConcepts = galaxy.knowledge.concepts
        .map((c) => `- ${c.id}: "${c.title}" — ${c.brief}`)
        .join("\n");

      const prompt = buildGapAuditPrompt({
        chapterId: chapter.id,
        uncitedPassages,
        existingConcepts,
        uncitedIds: uncitedUnits,
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
If the uncited passage is covered by an existing concept, write a file to update that concept's citations. Include a verbatim derivative quote so coverage can be verified at word level:

\`stage2-coverage/${chapterId}-attach-<concept-id>.md\`:
\`\`\`yaml
---
action: attach
conceptId: <existing-concept-id>
addSourceRefs: [${chapterId}-s-NNNN, ...]
derivatives:
  - sourceRef: ${chapterId}-s-NNNN
    quote: "exact verbatim passage from the source unit"
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
kind: <definition|formula|example|fact|principle|process|framework|trade-off|distinction|paradigm|property>
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

          // Update detail sourceRefs and derivatives if detail exists.
          const detail = galaxy.detail[conceptId];
          if (detail && addRefs.length > 0) {
            const existing = new Set(detail.sourceRefs);
            for (const ref of addRefs) {
              if (!existing.has(ref)) {
                detail.sourceRefs.push(ref as Slug);
              }
            }

            // Merge derivative quotes from the gap audit.
            const newDerivatives = note.data.derivatives as unknown;
            if (Array.isArray(newDerivatives)) {
              for (const d of newDerivatives) {
                if (d && typeof d === "object" && "sourceRef" in d && "quote" in d) {
                  detail.derivatives.push({
                    sourceRef: String(d.sourceRef) as Slug,
                    quote: String(d.quote),
                  });
                  detail.sourceQuotes.push(String(d.quote));
                }
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
