// End-to-end runner for the v3 pipeline (wrap-based memory galaxy).
//
// ─── Execution model ──────────────────────────────────────────────────────
//
// Stage 0 (ingest) runs synchronously and the galaxy is returned to the
// client immediately. Stages 1–2.5 run in the background — the client
// polls GET /api/galaxy/:id to pick up progress as each stage completes.
//
//   0. Ingest/Chunk  — mint id, hash, chunk text into source units   (pure code)
//   1. Structure     — Claude Code via proxy → knowledge + rels      (Claude)
//   2. Wraps         — parallel Claude agents via proxy → wraps      (Claude)
//   2.5 Coverage     — word-level check + gap audit if < 95%         (code + Claude)
//
// The caller should persist the galaxy after each stage callback for
// crash resilience.

import type { Galaxy, SourceKind, SourcePart, ChapterId } from "@scholarsystem/shared";
import { runChunker } from "./chunker";
import { runSkeletonStage } from "./skeleton";
import { runWrapsStage } from "./wraps";
import { runCoverageAudit } from "./coverage";
import { destroySession } from "../lib/proxy-client";
import { saveGalaxy } from "../db/store";

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
 * Run Stage 0 only: chunk text into source units and mint a Galaxy blob.
 * Returns immediately — use `runBackgroundStages` to continue the pipeline.
 */
export function runIngestStage(input: RunPipelineInput): Galaxy {
  const { galaxy } = runChunker({
    chapterId: input.chapterId,
    kind: input.kind,
    filename: input.filename,
    text: input.text,
    title: input.title,
    parts: input.parts,
  });
  return galaxy;
}

/**
 * Persist the galaxy so the polling client sees "running" status
 * immediately after a stage begins (not just after it completes).
 */
function persistQuietly(galaxy: Galaxy, label: string): void {
  try {
    saveGalaxy(galaxy);
    console.log(`[runner] persisted: ${label}`);
  } catch (err) {
    console.error(`[runner] failed to persist ${label}:`, err);
  }
}

/**
 * Run stages 1–2.5 in the background. Persists after each stage starts
 * AND completes so the polling client sees real-time status. Errors are
 * caught per-stage and recorded on the galaxy blob via `stageError`.
 */
export async function runBackgroundStages(
  galaxy: Galaxy,
  pageImages?: { page: number; png: Buffer }[],
  callbacks?: {
    onStageComplete?: (galaxy: Galaxy, stage: string) => void | Promise<void>;
  },
): Promise<void> {
  try {
    // Stage 1: structure. stageStart is called inside runSkeletonStage —
    // persist immediately after it starts so the client sees "running".
    // We do this by saving on a microtask after the stage function begins.
    const skeletonPromise = runSkeletonStage(galaxy, pageImages);
    // stageStart was called synchronously at the top of runSkeletonStage
    persistQuietly(galaxy, "structure started");

    const skeletonResult = await skeletonPromise;
    await callbacks?.onStageComplete?.(galaxy, "structure");

    // Stage 2: wraps
    const wrapsPromise = runWrapsStage(galaxy, skeletonResult.dispatchPlan);
    persistQuietly(galaxy, "wraps started");

    await wrapsPromise;
    await callbacks?.onStageComplete?.(galaxy, "wraps");

    // Stage 2.5: coverage
    const coveragePromise = runCoverageAudit(galaxy);
    persistQuietly(galaxy, "coverage started");

    await coveragePromise;
    await callbacks?.onStageComplete?.(galaxy, "coverage");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] background pipeline failed: ${message}`);
    // Stage-level errors are already recorded by individual stage functions.
    // Persist the error state so the client can display it.
    persistQuietly(galaxy, "error state");
  } finally {
    destroySession(galaxy.meta.id).catch((err) => {
      console.warn(`[runner] workspace cleanup failed: ${err}`);
    });
  }
}

/**
 * Run the full v3 pipeline: chunk → structure → wraps → coverage.
 *
 * All stages run sequentially. After each stage completes, the
 * `onStageComplete` callback fires so the caller can persist to SQLite.
 */
export async function runPipeline(
  input: RunPipelineInput,
  callbacks?: {
    /** Called after each stage completes with the updated galaxy. */
    onStageComplete?: (galaxy: Galaxy, stage: string) => void | Promise<void>;
  },
): Promise<Galaxy> {
  const galaxy = runIngestStage(input);
  await callbacks?.onStageComplete?.(galaxy, "ingest");

  await runBackgroundStages(galaxy, input.pageImages, callbacks);

  return galaxy;
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
