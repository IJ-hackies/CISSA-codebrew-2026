// End-to-end runner for the v2 pipeline (Flint-informed extraction).
//
// ─── Execution model ──────────────────────────────────────────────────────
//
// The pipeline is split into two phases so the HTTP create request doesn't
// block on every Claude call:
//
//   FAST PATH (foreground, awaited by the HTTP route):
//     0. Ingest/Chunk   — mint id, hash, chunk text into source units  (pure code)
//     1. Skeleton        — Claude Code via proxy → knowledge + rels    (Claude)
//                          + dispatch plan (which source units → which topics)
//     4. Layout         — deterministic spatial placement              (pure code)
//
//   BACKGROUND PATH (fire-and-forget, after response):
//     2.  Detail Fan-Out — N parallel Claude agents via proxy           (Claude)
//                          → detail with derivatives (verbatim quotes)
//     2.5 Coverage Audit — word-level coverage check                   (pure code)
//                          + gap audit if < 95%                        (Claude)
//     3.  Narrative      — Claude Code via proxy → canon + arcs        (Claude)
//     5.  Visuals        — Claude Code via proxy → body visuals        (Claude + code)
//
// The fast path alone produces a galaxy that is fully renderable as an
// interactive map (knowledge + relationships + spatial). The background
// path enriches concepts with full bodies + verbatim derivatives.
//
// Stage 6 (scenes) is on-demand per concept landing, not in this runner.

import type { Galaxy, SourceKind, SourcePart, ChapterId } from "@scholarsystem/shared";
import { runChunker } from "./chunker";
import { runSkeletonStage, type SkeletonResult } from "./skeleton";
import { runLayout } from "./layout";
import { runDetailStage } from "./detail";
import { runCoverageAudit } from "./coverage";
import { runNarrativeStage } from "./narrative";
import { runVisualsStage } from "./visuals";
import { destroySession } from "../lib/proxy-client";
import type { DispatchPlan } from "./compile";

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
 * Fast path: runs chunk → skeleton → layout and returns the galaxy.
 * The returned blob is fully renderable but has no `detail` yet.
 *
 * Also kicks off the background path (detail → coverage → narrative → visuals)
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

  let dispatchPlan: DispatchPlan | undefined;

  try {
    // Stage 1: skeleton via proxy (Claude Code).
    // Returns knowledge + relationships + dispatch plan for Stage 2.
    const skeletonResult: SkeletonResult = await runSkeletonStage(galaxy, input.pageImages);
    dispatchPlan = skeletonResult.dispatchPlan;

    // Stage 4: layout (pure code, runs immediately after skeleton).
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
  runBackgroundPath(galaxy, dispatchPlan, callbacks).catch((err) => {
    console.error(`[runner] background path failed:`, err);
  });

  return galaxy;
}

/**
 * Background path: detail (with dispatch plan) → coverage audit → narrative → visuals.
 * Does not throw — each stage handles its own errors gracefully.
 */
async function runBackgroundPath(
  galaxy: Galaxy,
  dispatchPlan: DispatchPlan | undefined,
  callbacks?: {
    onStageComplete?: (galaxy: Galaxy, stage: string) => void | Promise<void>;
  },
): Promise<void> {
  // Stage 2: detail extraction (parallel per-topic Claude calls, dispatch-plan-driven).
  await runDetailStage(galaxy, dispatchPlan);
  await callbacks?.onStageComplete?.(galaxy, "detail");

  // Stage 2.5: coverage audit (word-level coverage + targeted Claude gap audit).
  await runCoverageAudit(galaxy);
  await callbacks?.onStageComplete?.(galaxy, "coverageAudit");

  // Stage 3: narrative (blocks on 2.5 so beats reference real content).
  await runNarrativeStage(galaxy);
  await callbacks?.onStageComplete?.(galaxy, "narrative");

  // Stage 5: visuals (blocks on 3 + 4 — both done by this point).
  await runVisualsStage(galaxy);
  await callbacks?.onStageComplete?.(galaxy, "visuals");
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
