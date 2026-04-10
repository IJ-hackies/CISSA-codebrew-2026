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
//     2. Detail         — Claude Code via proxy → per-concept content  (not yet wired)
//
// The fast path alone produces a galaxy that is fully renderable as an
// interactive map (knowledge + relationships + spatial). Detail enriches
// concepts for downstream narrative and scene generation.
//
// Stages 2, 2.5, 3, 5, 6 are not yet wired through this runner.

import type { Galaxy, SourceKind, SourcePart, ChapterId } from "@scholarsystem/shared";
import { runChunker } from "./chunker";
import { runStructureStage } from "./structure";
import { runLayout } from "./layout";
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
 */
export async function runPipeline(input: RunPipelineInput): Promise<Galaxy> {
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
