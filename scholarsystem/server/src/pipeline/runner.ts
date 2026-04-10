// End-to-end runner for the v3 pipeline (wrap-based memory galaxy).
//
// ─── Execution model ──────────────────────────────────────────────────────
//
// All stages run sequentially in a single pipeline call — no background path.
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
  // Stage 0: chunk text into source units + mint blob.
  const { galaxy } = runChunker({
    chapterId: input.chapterId,
    kind: input.kind,
    filename: input.filename,
    text: input.text,
    title: input.title,
    parts: input.parts,
  });
  await callbacks?.onStageComplete?.(galaxy, "ingest");

  try {
    // Stage 1: skeleton via proxy (Claude Code).
    // Returns knowledge + relationships + dispatch plan for Stage 2.
    const skeletonResult = await runSkeletonStage(galaxy, input.pageImages);
    await callbacks?.onStageComplete?.(galaxy, "structure");

    // Stage 2: wraps (parallel per-node Claude agents via proxy).
    await runWrapsStage(galaxy, skeletonResult.dispatchPlan);
    await callbacks?.onStageComplete?.(galaxy, "wraps");

    // Stage 2.5: coverage audit (unit-level + word-level + gap audit).
    await runCoverageAudit(galaxy);
    await callbacks?.onStageComplete?.(galaxy, "coverage");
  } finally {
    // Clean up proxy workspace — best-effort, don't fail the pipeline.
    destroySession(galaxy.meta.id).catch((err) => {
      console.warn(`[runner] workspace cleanup failed: ${err}`);
    });
  }

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
