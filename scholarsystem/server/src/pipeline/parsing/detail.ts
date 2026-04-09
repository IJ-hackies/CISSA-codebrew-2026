// Stage 2: Detail extraction.
//
// Reads the Stage 1 knowledge outline plus the original raw text and
// produces deep per-concept content (full definitions, formulas, worked
// examples, edge cases, mnemonics, emphasis markers, verbatim source
// quotes). Writes into the `detail` scope keyed by concept id.
//
// ─── Parallel fan-out ─────────────────────────────────────────────────────
//
// Work is split into CHUNKS and dispatched concurrently:
//   - one chunk per topic (containing every concept under that topic's
//     subtopics), and
//   - one additional chunk for loose concepts if any exist.
//
// Each chunk runs its own `claude -p` spawn via {@link runClaude}. All
// chunks see the FULL knowledge outline in their prompt so they can
// cross-reference neighbours, but each is told (via
// `inScopeConceptIds`) to only emit JSONL lines for the subset it owns.
// The results are merged into a single `detail` record keyed by
// concept id.
//
// Tradeoffs worth knowing:
//   - Parallel chunks send the full raw text N times (once per chunk),
//     which is cheap in wall-clock but expensive in input tokens. Fine
//     for the current workload; revisit if inputs get huge, at which
//     point we'd want to chunk the source text itself.
//   - We use `Promise.allSettled`, not `Promise.all`, so a single chunk
//     failing does NOT abort the others. Failed chunks are logged as
//     warnings; their concept ids just end up missing from `detail`,
//     and the existing coverage warning surfaces it.
//   - If the outline has only one chunk's worth of work (e.g. a single
//     topic with no loose concepts), we just run one call and skip the
//     fan-out bookkeeping — keeps the small-input path cheap.
//
// ─── Failure semantics ────────────────────────────────────────────────────
//
// This stage is best-effort. On TOTAL failure (every chunk errored, or
// the planning step threw), it marks `pipeline.detail.status = "error"`
// but does NOT throw, because the galaxy is still fully renderable from
// knowledge + relationships + spatial alone. Downstream stages that
// actually need detail are responsible for checking
// `pipeline.detail.status` before consuming it.

import {
  ConceptDetail,
  Galaxy,
  type Detail,
  type Knowledge,
} from "../../../../shared/types";
import { runClaude } from "../../lib/spawner";
import { stageStart, stageDone, stageError } from "../../lib/blob";
import { buildDetailPrompt } from "../../prompts/parsing/detail";
import {
  parseDetailLines,
  type RawConceptDetail,
} from "./parseDetailLines";

/**
 * Runs Stage 2 against the given galaxy blob. Mutates the blob in place:
 * writes `detail` keyed by concept id, and flips `pipeline.detail` through
 * running → done/error. Returns the same galaxy for chaining.
 *
 * Requires `galaxy.knowledge` to be populated (Stage 1 must have run).
 */
export async function runDetail(
  galaxy: Galaxy,
  rawText: string,
): Promise<Galaxy> {
  if (!galaxy.knowledge) {
    throw new Error("runDetail: galaxy.knowledge is null — Stage 1 must run first");
  }

  stageStart(galaxy, "detail");

  try {
    const chunks = planChunks(galaxy.knowledge);
    if (chunks.length === 0) {
      // No concepts at all — nothing to do, but not an error.
      console.warn("[detail] no concepts in knowledge; stage is a no-op");
      stageDone(galaxy, "detail");
      return galaxy;
    }

    console.log(
      `[detail] dispatching ${chunks.length} parallel chunk(s): ${chunks.map((c) => `${c.label}(${c.conceptIds.length})`).join(", ")}`,
    );

    const started = Date.now();
    const results = await Promise.allSettled(
      chunks.map((chunk) => runOneChunk(galaxy.knowledge!, rawText, chunk)),
    );
    const elapsed = Date.now() - started;

    const allRawDetails: RawConceptDetail[] = [];
    let anyChunkSucceeded = false;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const chunk = chunks[i];
      if (result.status === "fulfilled") {
        anyChunkSucceeded = true;
        allRawDetails.push(...result.value);
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

    applyDetailResults(galaxy, allRawDetails);
    console.log(`[detail] all chunks settled in ${elapsed}ms`);
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
  /** Human-readable label for logs ("topic:solar-system" or "loose"). */
  label: string;
  /** Concept ids this chunk is responsible for. */
  conceptIds: string[];
}

/**
 * Split the knowledge tree into parallel chunks:
 *   - one per topic (flattening all concepts under its subtopics), and
 *   - one for loose concepts if present.
 * Topics that somehow have zero concepts are skipped (Stage 1 shouldn't
 * produce those, but we don't want to dispatch an empty Claude call).
 */
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

/**
 * Run one Claude call for a single chunk and return the parsed raw
 * concept details. Throws on spawner failure so `Promise.allSettled`
 * can surface it as a rejected result. Per-line parser warnings are
 * logged but do NOT throw.
 */
async function runOneChunk(
  knowledge: Knowledge,
  rawText: string,
  chunk: DetailChunk,
): Promise<RawConceptDetail[]> {
  const prompt = buildDetailPrompt(knowledge, rawText, {
    inScopeConceptIds: chunk.conceptIds,
  });
  const res = await runClaude({ prompt });

  if (!res.ok) {
    throw new Error(
      `chunk '${chunk.label}' claude exited ${res.exitCode}: ${res.stderr || "(no stderr)"}`,
    );
  }

  const { details, warnings } = parseDetailLines(res.output);
  for (const w of warnings) {
    console.warn(`[detail parser][${chunk.label}] ${w}`);
  }

  // Drop any line the chunk emitted outside its declared scope. Stage 2
  // prompts explicitly forbid this, but enforcing it here keeps merge
  // semantics clean and stops one chunk stepping on another's concepts.
  const scope = new Set(chunk.conceptIds);
  const inScope: RawConceptDetail[] = [];
  for (const d of details) {
    if (scope.has(d.conceptId)) {
      inScope.push(d);
    } else {
      console.warn(
        `[detail][${chunk.label}] dropping out-of-scope conceptId '${d.conceptId}' (chunk owns ${chunk.conceptIds.length} ids)`,
      );
    }
  }

  return inScope;
}

// ───────── Merge & validate ─────────

/**
 * Merge the parsed raw details from every chunk into the galaxy's
 * `detail` scope. Stamps `extractedAt`, Zod-validates per concept, drops
 * unknown and duplicate concept ids with warnings, and logs a coverage
 * summary if concepts ended up missing detail. Mutates the galaxy.
 *
 * Exported (as `applyDetailResponse`) so tests and alternate entry
 * points can reuse it with a hand-built rawDetails array.
 */
export function applyDetailResults(
  galaxy: Galaxy,
  rawDetails: RawConceptDetail[],
): void {
  if (!galaxy.knowledge) {
    throw new Error("applyDetailResults: galaxy.knowledge is null");
  }

  const knownConceptIds = new Set(galaxy.knowledge.concepts.map((c) => c.id));
  const now = Date.now();
  const detail: Detail = {};
  const seen = new Set<string>();

  for (const raw of rawDetails) {
    if (!knownConceptIds.has(raw.conceptId)) {
      console.warn(
        `[detail] dropping unknown conceptId '${raw.conceptId}' (not in knowledge.concepts)`,
      );
      continue;
    }
    if (seen.has(raw.conceptId)) {
      console.warn(`[detail] duplicate conceptId '${raw.conceptId}', keeping first`);
      continue;
    }

    const parsed = ConceptDetail.safeParse({ ...raw, extractedAt: now });
    if (!parsed.success) {
      console.warn(
        `[detail] Zod validation failed for '${raw.conceptId}': ${parsed.error.message}`,
      );
      continue;
    }

    detail[raw.conceptId] = parsed.data;
    seen.add(raw.conceptId);
  }

  const missing = [...knownConceptIds].filter((id) => !seen.has(id));
  if (missing.length > 0) {
    console.warn(
      `[detail] ${missing.length}/${knownConceptIds.size} concepts missing detail: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`,
    );
  }

  galaxy.detail = detail;
}
