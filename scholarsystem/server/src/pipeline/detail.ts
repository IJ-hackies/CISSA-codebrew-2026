// Stage 2: Detail extraction (proxy-based, dispatch-plan-driven).
//
// Receives a DispatchPlan from the Stage 1 skeleton pass and fans out
// parallel Claude Code agents — one per topic. Each agent receives only
// its topic's source units and the full skeleton for cross-reference.
//
// Key changes from v1:
//   - Dispatch driven by DispatchPlan (source units scoped per topic)
//   - Agents produce 200-300 word bodies + verbatim derivative quotes
//   - Structure and ETC source units distributed to adjacent topic agents
//   - compileDetail now extracts derivatives for word-level coverage
//
// ─── Failure semantics ────────────────────────────────────────────────
//
// Best-effort per topic. If one agent fails, its concepts will have
// skeleton data (brief, kind, sourceRefs) but no detail (no body, no
// derivatives). The galaxy is still renderable. The coverage audit will
// flag the uncovered source units.

import type { Galaxy, Knowledge, ConceptDetail } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { pushFiles, runStage, compileFiles } from "../lib/proxy-client";
import { buildTopicDetailPrompt } from "../prompts/detail";
import { compileDetail, type DispatchPlan } from "./compile";

/**
 * Runs Stage 2 against the proxy workspace using the dispatch plan from
 * the skeleton stage. Mutates the blob in place: writes `detail` keyed
 * by concept id. Returns the same galaxy for chaining.
 *
 * If no dispatchPlan is provided, falls back to the simple topic-based
 * chunking (backward compat for tests or manual runs).
 */
export async function runDetailStage(
  galaxy: Galaxy,
  dispatchPlan?: DispatchPlan,
): Promise<Galaxy> {
  if (!galaxy.knowledge) {
    throw new Error("runDetailStage: galaxy.knowledge is null — Stage 1 must run first");
  }

  stageStart(galaxy, "detail");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("detail: no source chapters");

    // Build chunks from dispatch plan or fall back to simple planning.
    const chunks = dispatchPlan
      ? buildChunksFromPlan(dispatchPlan, galaxy.knowledge)
      : buildFallbackChunks(galaxy.knowledge, chapter.units.map((u) => u.id));

    if (chunks.length === 0) {
      console.warn("[detail] no concepts in knowledge; stage is a no-op");
      stageDone(galaxy, "detail");
      return galaxy;
    }

    // ── Validate dispatch plan completeness ──
    const allChunkedIds = new Set(chunks.flatMap((c) => c.conceptIds));
    const allKnownIds = galaxy.knowledge.concepts.map((c) => c.id);
    const orphans = allKnownIds.filter((id) => !allChunkedIds.has(id));
    if (orphans.length > 0) {
      console.warn(
        `[detail] ${orphans.length} orphaned concept(s) not in any chunk: ${orphans.join(", ")}`,
      );
      // Add orphans to the chunk whose sourceUnitIds best overlap their sourceRefs.
      for (const orphanId of orphans) {
        const concept = galaxy.knowledge!.concepts.find((c) => c.id === orphanId);
        if (!concept) continue;
        const orphanRefs = new Set(concept.sourceRefs);
        let bestChunk = chunks[0];
        let bestOverlap = 0;
        for (const chunk of chunks) {
          const overlap = chunk.sourceUnitIds.filter((u) => orphanRefs.has(u)).length;
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestChunk = chunk;
          }
        }
        bestChunk.conceptIds.push(orphanId);
      }
      console.log(`[detail] orphans distributed into existing chunks`);
    }

    console.log(
      `[detail] dispatching ${chunks.length} sequential chunk(s): ${chunks.map((c) => `${c.label}(${c.conceptIds.length}c, ${c.sourceUnitIds.length}u)`).join(", ")}`,
    );

    // Run chunks SEQUENTIALLY — the proxy enforces single-writer per
    // galaxy session, so concurrent runs against the same session fail
    // with 409 "session already has an active run". True parallelism
    // requires separate session IDs per topic (future optimization).
    const started = Date.now();
    let anyChunkSucceeded = false;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        await runOneChunk(galaxy, galaxy.knowledge!, chunk, chapter.id);
        anyChunkSucceeded = true;
        console.log(
          `[detail] chunk '${chunk.label}' completed (${chunk.conceptIds.length} concepts)`,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        console.warn(
          `[detail] chunk '${chunk.label}' failed (${chunk.conceptIds.length} concepts will be missing): ${message}`,
        );
      }
    }

    const elapsed = Date.now() - started;

    if (!anyChunkSucceeded) {
      throw new Error("all detail chunks failed — see warnings above");
    }

    // Compile all stage2-detail/ files from the workspace into Detail.
    const files = await compileFiles(galaxy.meta.id);
    const { detail } = compileDetail(files);

    // Log coverage.
    const knownConceptIds = new Set(galaxy.knowledge.concepts.map((c) => c.id));
    let missing = [...knownConceptIds].filter((id) => !(id in detail));
    if (missing.length > 0) {
      console.warn(
        `[detail] ${missing.length}/${knownConceptIds.size} concepts missing detail after main pass: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`,
      );
    }

    // ── Retry pass for missing concepts ──
    // Run up to 3 rounds of single-concept retries.
    const MAX_RETRY_ROUNDS = 3;
    for (let round = 0; round < MAX_RETRY_ROUNDS && missing.length > 0; round++) {
      console.log(
        `[detail] retry round ${round + 1}: ${missing.length} concept(s) to fill`,
      );

      // Build a small chunk per missing concept with its own sourceRefs.
      for (const missingId of missing) {
        const concept = galaxy.knowledge!.concepts.find((c) => c.id === missingId);
        if (!concept) continue;

        const retryChunk: DetailChunk = {
          label: `retry:${missingId}`,
          conceptIds: [missingId],
          sourceUnitIds: [...concept.sourceRefs],
          structureUnitIds: [],
          etcUnitIds: [],
        };

        try {
          await runOneChunk(galaxy, galaxy.knowledge!, retryChunk, chapter.id);
          console.log(`[detail] retry succeeded for ${missingId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[detail] retry failed for ${missingId}: ${msg}`);
        }
      }

      // Re-compile and recheck.
      const retryFiles = await compileFiles(galaxy.meta.id);
      const retryCompiled = compileDetail(retryFiles);
      // Merge retry results into detail.
      for (const [id, entry] of Object.entries(retryCompiled.detail)) {
        if (!(id in detail)) {
          detail[id] = entry;
        }
      }
      missing = [...knownConceptIds].filter((id) => !(id in detail));
      if (missing.length === 0) {
        console.log(`[detail] retry round ${round + 1} closed all gaps`);
        break;
      }
    }

    if (missing.length > 0) {
      console.warn(
        `[detail] ${missing.length}/${knownConceptIds.size} concepts still missing after retries: ${missing.join(", ")}`,
      );
    }

    galaxy.detail = detail;
    console.log(
      `[detail] ${Object.keys(detail).length}/${knownConceptIds.size} concepts populated in ${Date.now() - started}ms`,
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

// ───────── Chunk types and planning ─────────

interface DetailChunk {
  label: string;
  conceptIds: string[];
  sourceUnitIds: string[];
  structureUnitIds: string[];
  etcUnitIds: string[];
}

/**
 * Build chunks from the skeleton's DispatchPlan.
 * Each topic becomes one chunk with its assigned source units.
 * Structure/ETC units are distributed to the nearest topic.
 */
function buildChunksFromPlan(
  plan: DispatchPlan,
  knowledge: Knowledge,
): DetailChunk[] {
  const chunks: DetailChunk[] = [];

  for (const topicChunk of plan.topicChunks) {
    // Merge primary and shared source units.
    const allSourceUnits = new Set([
      ...topicChunk.sourceUnitIds,
      ...topicChunk.sharedSourceUnitIds,
    ]);

    chunks.push({
      label: `topic:${topicChunk.topicId}`,
      conceptIds: topicChunk.conceptIds,
      sourceUnitIds: [...allSourceUnits],
      structureUnitIds: [], // distributed below
      etcUnitIds: [],       // distributed below
    });
  }

  // Distribute structure/ETC units to the first topic chunk
  // (simple heuristic — these are small and just need derivatives).
  if (chunks.length > 0) {
    chunks[0].structureUnitIds = plan.structureUnitIds;
    chunks[0].etcUnitIds = plan.etcUnitIds;
  }

  // Handle loose concepts as their own chunk.
  if (knowledge.looseConceptIds.length > 0) {
    const looseSourceRefs = new Set<string>();
    for (const cid of knowledge.looseConceptIds) {
      const concept = knowledge.concepts.find((c) => c.id === cid);
      if (concept) {
        for (const ref of concept.sourceRefs) looseSourceRefs.add(ref);
      }
    }
    chunks.push({
      label: "loose",
      conceptIds: [...knowledge.looseConceptIds],
      sourceUnitIds: [...looseSourceRefs],
      structureUnitIds: [],
      etcUnitIds: [],
    });
  }

  return chunks;
}

/**
 * Fallback chunking when no dispatch plan is available.
 * Groups concepts by topic and uses all source units.
 */
function buildFallbackChunks(
  knowledge: Knowledge,
  allSourceUnitIds: string[],
): DetailChunk[] {
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
      chunks.push({
        label: `topic:${topic.id}`,
        conceptIds: ids,
        sourceUnitIds: allSourceUnitIds, // all units for fallback
        structureUnitIds: [],
        etcUnitIds: [],
      });
    }
  }

  if (knowledge.looseConceptIds.length > 0) {
    chunks.push({
      label: "loose",
      conceptIds: [...knowledge.looseConceptIds],
      sourceUnitIds: allSourceUnitIds,
      structureUnitIds: [],
      etcUnitIds: [],
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
): Promise<void> {
  const prompt = buildTopicDetailPrompt(knowledge, {
    inScopeConceptIds: chunk.conceptIds,
    chapterId,
    sourceUnitIds: chunk.sourceUnitIds,
    structureUnitIds: chunk.structureUnitIds.length > 0 ? chunk.structureUnitIds : undefined,
    etcUnitIds: chunk.etcUnitIds.length > 0 ? chunk.etcUnitIds : undefined,
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
