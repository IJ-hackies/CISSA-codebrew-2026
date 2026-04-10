// Stage 2: Wrap generation (parallel sub-session fan-out).
//
// Every node in the galaxy (cluster, group, entry) gets its own isolated
// proxy sub-session with a focused Claude Code agent that creates exactly
// ONE wrap file. Sub-sessions run in parallel, bounded by the proxy's
// worker pool concurrency.
//
// ─── Execution model ────────────────────────────────────────────
//
//   1. Build SubSessionTasks for all nodes:
//      a. Cluster wraps first (they see the big picture)
//      b. Group wraps next
//      c. Entry wraps last (highest count, fully parallel)
//   2. fanOutSubSessions() runs them in parallel waves
//   3. Merge output files from all sub-sessions
//   4. Compile merged files into Wraps scope on the blob
//   5. Retry any missing wraps with fresh sub-sessions
//
// ─── Failure semantics ────────────────────────────────────────────
//
// Best-effort per node. If one sub-session fails, that node will have
// skeleton data (brief, kind) but no wrap. The galaxy is still
// renderable. The coverage audit will flag uncovered source units.

import type { Galaxy, SourceUnit } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import {
  pushFiles,
  fanOutSubSessions,
  mergeSubSessionFiles,
  type SubSessionTask,
} from "../lib/proxy-client";
import { buildNodeWrapPrompt, type WrapNodeInfo } from "../prompts/wraps";
import { compileWraps, type DispatchPlan } from "./compile";

/**
 * Runs Stage 2 via parallel sub-sessions — one per node.
 * Mutates the blob in place: writes `wraps` keyed by node id.
 */
export async function runWrapsStage(
  galaxy: Galaxy,
  _dispatchPlan?: DispatchPlan,
): Promise<Galaxy> {
  if (!galaxy.knowledge) {
    throw new Error("runWrapsStage: galaxy.knowledge is null — Stage 1 must run first");
  }

  stageStart(galaxy, "wraps");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("wraps: no source chapters");

    const knowledge = galaxy.knowledge;
    const { clusters, groups, entries } = knowledge;

    const totalNodes = clusters.length + groups.length + entries.length;
    if (totalNodes === 0) {
      console.warn("[wraps] no nodes in knowledge; stage is a no-op");
      stageDone(galaxy, "wraps");
      return galaxy;
    }

    // Build a lookup of source units by ID for scoped pushing.
    const unitById = new Map<string, SourceUnit>(
      chapter.units.map((u) => [u.id, u]),
    );

    // Build neighbor list for wikilink context (all nodes).
    const allNeighbors = [
      ...clusters.map((c) => ({ id: c.id, title: c.title })),
      ...groups.map((g) => ({ id: g.id, title: g.title })),
      ...entries.map((e) => ({ id: e.id, title: e.title })),
    ];

    // Lookup maps for parent/child context.
    const clusterById = new Map(clusters.map((c) => [c.id, c]));
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const entriesByGroup = new Map<string, typeof entries>();
    for (const e of entries) {
      if (e.groupId) {
        const arr = entriesByGroup.get(e.groupId) ?? [];
        arr.push(e);
        entriesByGroup.set(e.groupId, arr);
      }
    }

    // ── Build all sub-session tasks ──

    function buildTask(node: WrapNodeInfo): SubSessionTask | null {
      const files: Record<string, string> = {};
      for (const unitId of node.sourceRefs) {
        const unit = unitById.get(unitId);
        if (unit) {
          files[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
        }
      }

      if (Object.keys(files).length === 0) {
        console.warn(`[wraps] node ${node.id} has no resolvable source units, skipping`);
        return null;
      }

      const neighbors = allNeighbors.filter((n) => n.id !== node.id);

      const prompt = buildNodeWrapPrompt({
        node,
        chapterId: chapter.id,
        neighbors,
      });

      return {
        sessionId: `${galaxy.meta.id}--w--${node.id}`,
        files,
        prompt,
        label: node.id,
      };
    }

    // Build tasks in waves: clusters → groups → entries.
    // All run through the same fanOut call (the proxy pool handles ordering).
    const tasks: SubSessionTask[] = [];

    // Cluster wraps.
    for (const cluster of clusters) {
      const clusterGroups = groups.filter((g) => g.clusterId === cluster.id);
      const clusterEntries = entries.filter((e) => {
        const group = e.groupId ? groupById.get(e.groupId) : null;
        return group ? group.clusterId === cluster.id : false;
      });

      const node: WrapNodeInfo = {
        id: cluster.id,
        level: "cluster",
        title: cluster.title,
        brief: cluster.brief,
        sourceRefs: [...cluster.sourceRefs],
        childTitles: clusterGroups.map((g) => g.title),
      };

      const task = buildTask(node);
      if (task) tasks.push(task);
    }

    // Group wraps.
    for (const group of groups) {
      const parentCluster = clusterById.get(group.clusterId);
      const groupEntries = entriesByGroup.get(group.id) ?? [];

      const node: WrapNodeInfo = {
        id: group.id,
        level: "group",
        title: group.title,
        brief: group.brief,
        sourceRefs: [...group.sourceRefs],
        parentTitle: parentCluster?.title,
        childTitles: groupEntries.map((e) => e.title),
      };

      const task = buildTask(node);
      if (task) tasks.push(task);
    }

    // Entry wraps.
    for (const entry of entries) {
      const parentGroup = entry.groupId ? groupById.get(entry.groupId) : null;

      const node: WrapNodeInfo = {
        id: entry.id,
        level: "entry",
        title: entry.title,
        brief: entry.brief,
        kind: entry.kind,
        sourceRefs: [...entry.sourceRefs],
        parentTitle: parentGroup?.title,
      };

      const task = buildTask(node);
      if (task) tasks.push(task);
    }

    console.log(
      `[wraps] dispatching ${tasks.length} parallel sub-sessions ` +
      `(${clusters.length} clusters + ${groups.length} groups + ${entries.length} entries)`,
    );

    // ── Fan out ──

    const started = Date.now();
    const results = await fanOutSubSessions(tasks);

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log(
      `[wraps] fan-out complete: ${succeeded} succeeded, ${failed} failed (${Date.now() - started}ms)`,
    );

    // ── Merge, push back to main workspace, and compile ──

    const mergedFiles = mergeSubSessionFiles(results, "stage2-wraps/");

    // Push merged files into the main galaxy workspace so the
    // stage2-wraps/ folder is populated for downstream stages.
    if (Object.keys(mergedFiles).length > 0) {
      await pushFiles(galaxy.meta.id, mergedFiles);
      console.log(
        `[wraps] pushed ${Object.keys(mergedFiles).length} files back to main workspace`,
      );
    }

    const { wraps } = compileWraps(mergedFiles);

    // Check coverage.
    const allNodeIds = new Set([
      ...clusters.map((c) => c.id),
      ...groups.map((g) => g.id),
      ...entries.map((e) => e.id),
    ]);
    let missing = [...allNodeIds].filter((id) => !(id in wraps));

    if (missing.length > 0) {
      console.warn(
        `[wraps] ${missing.length}/${allNodeIds.size} nodes missing after main pass: ` +
        `${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`,
      );
    }

    // ── Retry pass for missing wraps ──

    const MAX_RETRY_ROUNDS = 2;
    for (let round = 0; round < MAX_RETRY_ROUNDS && missing.length > 0; round++) {
      console.log(
        `[wraps] retry round ${round + 1}: ${missing.length} node(s) to fill`,
      );

      const retryTasks: SubSessionTask[] = [];
      for (const missingId of missing) {
        // Find the node in any of the three arrays.
        const cluster = clusters.find((c) => c.id === missingId);
        const group = groups.find((g) => g.id === missingId);
        const entry = entries.find((e) => e.id === missingId);
        const found = cluster ?? group ?? entry;
        if (!found) continue;

        const level: WrapNodeInfo["level"] =
          cluster ? "cluster" : group ? "group" : "entry";

        const node: WrapNodeInfo = {
          id: found.id,
          level,
          title: found.title,
          brief: found.brief,
          kind: entry?.kind,
          sourceRefs: [...found.sourceRefs],
        };

        const task = buildTask(node);
        if (!task) continue;

        task.sessionId = `${galaxy.meta.id}--wr${round}--${found.id}`;
        task.label = `retry:${found.id}`;
        retryTasks.push(task);
      }

      const retryResults = await fanOutSubSessions(retryTasks);
      const retryFiles = mergeSubSessionFiles(retryResults, "stage2-wraps/");

      if (Object.keys(retryFiles).length > 0) {
        await pushFiles(galaxy.meta.id, retryFiles);
      }

      const retryCompiled = compileWraps(retryFiles);

      for (const [id, wrap] of Object.entries(retryCompiled.wraps)) {
        if (!(id in wraps)) {
          wraps[id] = wrap;
        }
      }

      missing = [...allNodeIds].filter((id) => !(id in wraps));
      if (missing.length === 0) {
        console.log(`[wraps] retry round ${round + 1} closed all gaps`);
        break;
      }
    }

    if (missing.length > 0) {
      console.warn(
        `[wraps] ${missing.length}/${allNodeIds.size} nodes still missing after retries: ${missing.join(", ")}`,
      );
    }

    galaxy.wraps = wraps;
    console.log(
      `[wraps] ${Object.keys(wraps).length}/${allNodeIds.size} nodes wrapped in ${Date.now() - started}ms`,
    );
    stageDone(galaxy, "wraps");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[wraps] stage failed, galaxy remains renderable: ${message}`);
    stageError(galaxy, "wraps", message);
    return galaxy;
  }
}
