// Stage 2: Detail extraction (proxy-based).
//
// Reads the Stage 1 knowledge outline plus the source units already in
// the proxy workspace, runs the detail prompt via Claude Code, then
// compiles the resulting Obsidian markdown files into the Detail scope.
//
// ─── Parallel fan-out ─────────────────────────────────────────────────
//
// Work is split into CHUNKS and dispatched concurrently:
//   - one chunk per topic (containing every concept under that topic's
//     subtopics), and
//   - one additional chunk for loose concepts if any exist.
//
// Each chunk runs its own Claude Code session via the proxy. All chunks
// see the FULL knowledge outline for cross-reference context but are
// told to only emit files for the subset they own. Results are merged
// into a single `detail` record keyed by concept id.
//
// We use `Promise.allSettled` so a single chunk failing does NOT abort
// the others. Failed chunks are logged as warnings; their concept ids
// just end up missing from `detail`, surfaced by the coverage auditor.
//
// ─── Failure semantics ────────────────────────────────────────────────
//
// This stage is best-effort. On TOTAL failure (every chunk errored, or
// the planning step threw), it marks `pipeline.detail.status = "error"`
// but does NOT throw, because the galaxy is still fully renderable from
// knowledge + relationships + spatial alone.

import type { Galaxy, Knowledge, ConceptDetail } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { runStage, compileFiles } from "../lib/proxy-client";
import { buildDetailPrompt } from "../prompts/detail";
import { compileDetail } from "./compile";

/**
 * Runs Stage 2 against the proxy workspace. Mutates the blob in place:
 * writes `detail` keyed by concept id, and flips `pipeline.detail`
 * through running → done/error. Returns the same galaxy for chaining.
 *
 * Requires `galaxy.knowledge` to be populated (Stage 1 must have run).
 * Requires source files to already be in the proxy workspace (Stage 1
 * pushed them).
 */
export async function runDetailStage(galaxy: Galaxy): Promise<Galaxy> {
  if (!galaxy.knowledge) {
    throw new Error("runDetailStage: galaxy.knowledge is null — Stage 1 must run first");
  }

  stageStart(galaxy, "detail");

  try {
    const chunks = planChunks(galaxy.knowledge);
    if (chunks.length === 0) {
      console.warn("[detail] no concepts in knowledge; stage is a no-op");
      stageDone(galaxy, "detail");
      return galaxy;
    }

    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("detail: no source chapters");
    const sourceUnitIds = chapter.units.map((u) => u.id);

    console.log(
      `[detail] dispatching ${chunks.length} parallel chunk(s): ${chunks.map((c) => `${c.label}(${c.conceptIds.length})`).join(", ")}`,
    );

    const started = Date.now();
    const results = await Promise.allSettled(
      chunks.map((chunk) =>
        runOneChunk(galaxy, galaxy.knowledge!, chunk, chapter.id, sourceUnitIds),
      ),
    );
    const elapsed = Date.now() - started;

    // After all chunks complete, compile the workspace files.
    let anyChunkSucceeded = false;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chunk = chunks[i];
      if (result.status === "fulfilled") {
        anyChunkSucceeded = true;
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        console.warn(
          `[detail] chunk '${chunk.label}' failed (${chunk.conceptIds.length} concepts will be missing): ${message}`,
        );
      }
    }

    if (!anyChunkSucceeded) {
      throw new Error("all detail chunks failed — see warnings above");
    }

    // Compile all stage2-detail/ files from the workspace into Detail.
    const files = await compileFiles(galaxy.meta.id);
    const { detail } = compileDetail(files);

    // Log coverage.
    const knownConceptIds = new Set(galaxy.knowledge.concepts.map((c) => c.id));
    const missing = [...knownConceptIds].filter((id) => !(id in detail));
    if (missing.length > 0) {
      console.warn(
        `[detail] ${missing.length}/${knownConceptIds.size} concepts missing detail: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`,
      );
    }

    galaxy.detail = detail;
    console.log(
      `[detail] ${Object.keys(detail).length}/${knownConceptIds.size} concepts populated in ${elapsed}ms`,
    );
    stageDone(galaxy, "detail");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[detail] stage failed, galaxy remains renderable: ${message}`);
    stageError(galaxy, "detail", message);
    return galaxy;
  }
}

// ───────── Chunk planning ─────────

interface DetailChunk {
  label: string;
  conceptIds: string[];
}

function planChunks(knowledge: Knowledge): DetailChunk[] {
  const subtopicsById = new Map(knowledge.subtopics.map((s) => [s.id, s]));
  const chunks: DetailChunk[] = [];

  for (const topic of knowledge.topics) {
    const ids: string[] = [];
    for (const sid of topic.subtopicIds) {
      const sub = subtopicsById.get(sid);
      if (!sub) continue;
      ids.push(...sub.conceptIds);
    }
    if (ids.length > 0) {
      chunks.push({ label: `topic:${topic.id}`, conceptIds: ids });
    }
  }

  if (knowledge.looseConceptIds.length > 0) {
    chunks.push({
      label: "loose",
      conceptIds: [...knowledge.looseConceptIds],
    });
  }

  return chunks;
}

// ───────── Single-chunk execution ─────────

async function runOneChunk(
  galaxy: Galaxy,
  knowledge: Knowledge,
  chunk: DetailChunk,
  chapterId: string,
  sourceUnitIds: string[],
): Promise<void> {
  const prompt = buildDetailPrompt(knowledge, {
    inScopeConceptIds: chunk.conceptIds,
    chapterId,
    sourceUnitIds,
  });

  const result = await runStage({
    galaxyId: galaxy.meta.id,
    prompt,
  });

  if (!result.ok) {
    throw new Error(
      `chunk '${chunk.label}' claude exited ${result.exitCode}`,
    );
  }
}
