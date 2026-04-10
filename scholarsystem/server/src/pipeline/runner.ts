// End-to-end runner for the v2 pipeline.
//
// ─── Execution model ──────────────────────────────────────────────────────
//
// The pipeline is split into two phases so the HTTP create request doesn't
// block on every Claude call:
//
//   FAST PATH (foreground, awaited by the HTTP route):
//     0. Ingest/Chunk   — mint id, hash, chunk text into source units  (pure code)
//     1. Structure      — Claude Code via proxy → knowledge + rels     (Claude)
//     4. Layout         — deterministic spatial placement              (pure code)
//
//   BACKGROUND PATH (fire-and-forget, after response):
//     2.  Detail         — Claude Code via proxy → per-concept content (Claude, parallel)
//     2.5 Coverage Audit — pure code + targeted Claude → accuracy backstop
//     3.  Narrative      — Claude Code via proxy → canon + arcs        (Claude)
//
// The fast path alone produces a galaxy that is fully renderable as an
// interactive map (knowledge + relationships + spatial). The background
// path enriches concepts for downstream scene generation.
//
// Stages 5 and 6 are not yet wired through this runner.

import type { Galaxy, SourceKind, SourcePart, ChapterId } from "@scholarsystem/shared";
import { runChunker } from "./chunker";
import { runStructureStage } from "./structure";
import { runLayout } from "./layout";
import { runDetailStage } from "./detail";
import { runCoverageAudit } from "./coverage";
import { runNarrativeStage } from "./narrative";
import { destroySession } from "../lib/proxy-client";

export interface RunPipelineInput {
  chapterId: ChapterId;
  kind: SourceKind;
  filename: string | null;
  text: string;
  title?: string;
  parts?: SourcePart[];
  /** PDF page images for vision-based content extraction in Claude Code. */
  pageImages?: { page: number; png: Buffer }[];
}

/**
 * Fast path: runs chunk → structure → layout and returns the galaxy.
 * The returned blob is fully renderable but has no `detail` yet.
 *
 * Also kicks off the background path (detail → coverage → narrative)
 * which mutates the galaxy blob after the fast path returns. The caller
 * is expected to persist the galaxy to SQLite and update it as the
 * background stages complete.
 */
export async function runPipeline(
  input: RunPipelineInput,
  callbacks?: {
    /** Called after each background stage completes with the updated galaxy. */
    onStageComplete?: (galaxy: Galaxy, stage: string) => void | Promise<void>;
  },
): Promise<Galaxy> {
  // Stage 0: chunk text into source units + mint blob.
  const { galaxy } = runChunker({
    chapterId: input.chapterId,
    kind: input.kind,
    filename: input.filename,
    text: input.text,
    title: input.title,
    parts: input.parts,
  });

  try {
    // Stage 1: structure via proxy (Claude Code).
    await runStructureStage(galaxy, input.pageImages);

    // Stage 4: layout (pure code, runs immediately after structure).
    runLayout(galaxy);
  } finally {
    // Clean up proxy workspace — best-effort, don't fail the pipeline.
    // TODO: re-enable once pipeline is stable; leave workspaces for
    // inspection during development.
    // destroySession(galaxy.meta.id).catch((err) => {
    //   console.warn(`[runner] workspace cleanup failed: ${err}`);
    // });
  }

  // Fire-and-forget: background path runs after the galaxy is returned.
  // The galaxy blob is mutated in place — the caller should re-persist
  // after each stage callback.
  runBackgroundPath(galaxy, callbacks).catch((err) => {
    console.error(`[runner] background path failed:`, err);
  });

  return galaxy;
}

/**
 * Background path: detail → coverage audit → narrative.
 * Does not throw — each stage handles its own errors gracefully.
 */
async function runBackgroundPath(
  galaxy: Galaxy,
  callbacks?: {
    onStageComplete?: (galaxy: Galaxy, stage: string) => void | Promise<void>;
  },
): Promise<void> {
  // Stage 2: detail extraction (parallel per-topic Claude calls).
  await runDetailStage(galaxy);
  await callbacks?.onStageComplete?.(galaxy, "detail");

  // Stage 2.5: coverage audit (pure code + targeted Claude call).
  await runCoverageAudit(galaxy);
  await callbacks?.onStageComplete?.(galaxy, "coverageAudit");

  // Stage 3: narrative (blocks on 2.5 so beats reference real content).
  await runNarrativeStage(galaxy);
  await callbacks?.onStageComplete?.(galaxy, "narrative");
}

/**
 * Sanitize a user-supplied chapter label into a valid ChapterId.
 * Lowercases, replaces non-alphanumeric runs with hyphens, trims edges.
 * Falls back to "w1" if the result is empty.
 */
export function sanitizeChapterId(label?: string): ChapterId {
  if (!label) return "w1" as ChapterId;
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "w1") as ChapterId;
}
