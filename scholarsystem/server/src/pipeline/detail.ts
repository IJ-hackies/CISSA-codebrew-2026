// Stage 2: Detail extraction (parallel sub-session fan-out).
//
// Each concept gets its own isolated proxy sub-session with a focused
// Claude Code agent that creates exactly ONE detail file. Sub-sessions
// run in parallel, bounded by the proxy's worker pool concurrency.
//
// This replaces the old sequential-per-topic model where one agent
// created many files per run (slow, fragile, hit output limits).
//
// ─── Execution model ────────────────────────────────────────────
//
//   1. Build a SubSessionTask per concept (scoped source units + prompt)
//   2. Build one auxiliary task for _structure.md / _etc.md if needed
//   3. fanOutSubSessions() runs them all in parallel
//   4. Merge output files from all sub-sessions
//   5. Compile merged files into Detail scope on the blob
//   6. Retry any missing concepts with fresh sub-sessions
//
// ─── Failure semantics ────────────────────────────────────────────
//
// Best-effort per concept. If one sub-session fails, that concept
// will have skeleton data (brief, kind, sourceRefs) but no detail.
// The galaxy is still renderable. The coverage audit will flag
// uncovered source units.

import type { Galaxy, Knowledge, SourceUnit } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import {
  pushFiles,
  fanOutSubSessions,
  mergeSubSessionFiles,
  type SubSessionTask,
} from "../lib/proxy-client";
import {
  buildConceptDetailPrompt,
  buildAuxiliaryDetailPrompt,
} from "../prompts/detail";
import { compileDetail, type DispatchPlan } from "./compile";

/**
 * Runs Stage 2 via parallel sub-sessions — one per concept.
 * Mutates the blob in place: writes `detail` keyed by concept id.
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

    const knowledge = galaxy.knowledge;
    const concepts = knowledge.concepts;

    if (concepts.length === 0) {
      console.warn("[detail] no concepts in knowledge; stage is a no-op");
      stageDone(galaxy, "detail");
      return galaxy;
    }

    // Build a lookup of source units by ID for scoped pushing.
    const unitById = new Map<string, SourceUnit>(
      chapter.units.map((u) => [u.id, u]),
    );

    // Build neighbor list for wikilink context (all concepts minus self).
    const allNeighbors = concepts.map((c) => ({ id: c.id, title: c.title }));

    // ── Build per-concept sub-session tasks ──

    const tasks: SubSessionTask[] = [];

    for (const concept of concepts) {
      // Determine which source units this concept needs.
      const sourceUnitIds = concept.sourceRefs;

      // Build the scoped files: only the source units this concept references.
      const files: Record<string, string> = {};
      for (const unitId of sourceUnitIds) {
        const unit = unitById.get(unitId);
        if (unit) {
          files[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
        }
      }

      if (Object.keys(files).length === 0) {
        console.warn(
          `[detail] concept ${concept.id} has no resolvable source units, skipping`,
        );
        continue;
      }

      const neighbors = allNeighbors.filter((n) => n.id !== concept.id);

      const prompt = buildConceptDetailPrompt({
        concept: {
          id: concept.id,
          title: concept.title,
          kind: concept.kind,
          brief: concept.brief,
          sourceRefs: [...concept.sourceRefs],
        },
        chapterId: chapter.id,
        neighbors,
      });

      tasks.push({
        sessionId: `${galaxy.meta.id}--d--${concept.id}`,
        files,
        prompt,
        label: concept.id,
      });
    }

    // ── Build auxiliary task for _structure.md / _etc.md ──

    const structureUnitIds = dispatchPlan?.structureUnitIds ?? [];
    const etcUnitIds = dispatchPlan?.etcUnitIds ?? [];

    if (structureUnitIds.length > 0 || etcUnitIds.length > 0) {
      const auxFiles: Record<string, string> = {};
      for (const unitId of [...structureUnitIds, ...etcUnitIds]) {
        const unit = unitById.get(unitId);
        if (unit) {
          auxFiles[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
        }
      }

      if (Object.keys(auxFiles).length > 0) {
        const auxPrompt = buildAuxiliaryDetailPrompt({
          chapterId: chapter.id,
          structureUnitIds,
          etcUnitIds,
        });

        tasks.push({
          sessionId: `${galaxy.meta.id}--d--aux`,
          files: auxFiles,
          prompt: auxPrompt,
          label: "_aux",
        });
      }
    }

    console.log(
      `[detail] dispatching ${tasks.length} parallel sub-sessions ` +
      `(${concepts.length} concepts + ${structureUnitIds.length > 0 || etcUnitIds.length > 0 ? "1 aux" : "0 aux"})`,
    );

    // ── Fan out ──

    const started = Date.now();
    const results = await fanOutSubSessions(tasks);

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(
      `[detail] fan-out complete: ${succeeded} succeeded, ${failed} failed (${Date.now() - started}ms)`,
    );

    // ── Merge, push back to main workspace, and compile ──

    const mergedFiles = mergeSubSessionFiles(results, "stage2-detail/");

    // Push merged files into the main galaxy workspace so the
    // stage2-detail/ folder is populated for downstream stages
    // and the folder-to-folder chain stays inspectable.
    if (Object.keys(mergedFiles).length > 0) {
      await pushFiles(galaxy.meta.id, mergedFiles);
      console.log(
        `[detail] pushed ${Object.keys(mergedFiles).length} files back to main workspace`,
      );
    }

    const { detail } = compileDetail(mergedFiles);

    // Check coverage.
    const knownConceptIds = new Set(concepts.map((c) => c.id));
    let missing = [...knownConceptIds].filter((id) => !(id in detail));

    if (missing.length > 0) {
      console.warn(
        `[detail] ${missing.length}/${knownConceptIds.size} concepts missing after main pass: ` +
        `${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`,
      );
    }

    // ── Retry pass for missing concepts ──

    const MAX_RETRY_ROUNDS = 2;
    for (let round = 0; round < MAX_RETRY_ROUNDS && missing.length > 0; round++) {
      console.log(
        `[detail] retry round ${round + 1}: ${missing.length} concept(s) to fill`,
      );

      const retryTasks: SubSessionTask[] = [];
      for (const missingId of missing) {
        const concept = concepts.find((c) => c.id === missingId);
        if (!concept) continue;

        const files: Record<string, string> = {};
        for (const unitId of concept.sourceRefs) {
          const unit = unitById.get(unitId);
          if (unit) {
            files[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
          }
        }

        if (Object.keys(files).length === 0) continue;

        const neighbors = allNeighbors.filter((n) => n.id !== concept.id);

        retryTasks.push({
          sessionId: `${galaxy.meta.id}--dr${round}--${concept.id}`,
          files,
          prompt: buildConceptDetailPrompt({
            concept: {
              id: concept.id,
              title: concept.title,
              kind: concept.kind,
              brief: concept.brief,
              sourceRefs: [...concept.sourceRefs],
            },
            chapterId: chapter.id,
            neighbors,
          }),
          label: `retry:${concept.id}`,
        });
      }

      const retryResults = await fanOutSubSessions(retryTasks);
      const retryFiles = mergeSubSessionFiles(retryResults, "stage2-detail/");

      // Push retry files back to main workspace too.
      if (Object.keys(retryFiles).length > 0) {
        await pushFiles(galaxy.meta.id, retryFiles);
      }

      const retryCompiled = compileDetail(retryFiles);

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
