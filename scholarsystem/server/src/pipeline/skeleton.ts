// Stage 1: Structure pass (map-reduce).
//
// Phase 1a (map): Fan out parallel per-chunk "extract" agents that each
// read one source unit and produce a short structured digest (~200 words).
// Runs N agents in parallel via the proxy sub-session pool.
//
// Phase 1b (reduce): A single Claude Code session reads ALL digests
// (~10-15K chars instead of ~300K raw) and produces the full
// cluster/group/entry hierarchy + relationships + dispatch plan.
//
// This is dramatically faster than the old single-session approach
// because the expensive "read 300K chars" step is replaced by many
// cheap parallel reads + one cheap reduce over summaries.
//
// When page images are available (PDF uploads), they are pushed to the
// workspace so Claude Code can read them with its vision capability.

import type { Galaxy, SourceUnit } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import {
  pushFiles,
  runStage,
  compileFiles,
  fanOutSubSessions,
  mergeSubSessionFiles,
  type SubSessionTask,
} from "../lib/proxy-client";
import { buildSkeletonPrompt } from "../prompts/structure";
import { buildExtractPrompt } from "../prompts/extract";
import { compileStructure, type DispatchPlan } from "./compile";
import { parseNote } from "./compile/frontmatter";

export interface SkeletonResult {
  galaxy: Galaxy;
  dispatchPlan: DispatchPlan;
}

/** Threshold: skip the map phase for small inputs. */
const MAP_REDUCE_THRESHOLD = 8;

/** How many source chunks per extract sub-session.
 *  Balances parallelism vs Claude Code cold-start overhead. */
const EXTRACT_BATCH_SIZE = 6;

/**
 * Run Stage 1 structure pass against the proxy workspace.
 *
 * For small inputs (< MAP_REDUCE_THRESHOLD chunks), runs a single
 * Claude Code session (old behavior). For larger inputs, uses the
 * map-reduce approach for dramatically faster processing.
 *
 * Returns the galaxy (with knowledge + relationships written) and a
 * DispatchPlan that Stage 2 uses to fan out parallel wrap agents.
 */
export async function runSkeletonStage(
  galaxy: Galaxy,
  pageImages?: { page: number; png: Buffer }[],
): Promise<SkeletonResult> {
  stageStart(galaxy, "structure");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("skeleton: no source chapters");

    const useMapReduce = chapter.units.length >= MAP_REDUCE_THRESHOLD;

    if (useMapReduce) {
      console.log(
        `[skeleton] ${chapter.units.length} chunks — using map-reduce (parallel extract → reduce)`,
      );
      return await runMapReduce(galaxy, chapter, pageImages);
    } else {
      console.log(
        `[skeleton] ${chapter.units.length} chunks — using single-session (below threshold)`,
      );
      return await runSingleSession(galaxy, chapter, pageImages);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "structure", message);
    throw err;
  }
}

// ─── Map-reduce path ──────────────────────────────────────────────

async function runMapReduce(
  galaxy: Galaxy,
  chapter: Galaxy["source"]["chapters"][0],
  pageImages?: { page: number; png: Buffer }[],
): Promise<SkeletonResult> {
  // ── Phase 1a: batched parallel extract ──

  // Split source units into batches to reduce Claude Code cold-start overhead.
  const batches: typeof chapter.units[] = [];
  for (let i = 0; i < chapter.units.length; i += EXTRACT_BATCH_SIZE) {
    batches.push(chapter.units.slice(i, i + EXTRACT_BATCH_SIZE));
  }

  const tasks: SubSessionTask[] = batches.map((batch, batchIdx) => {
    const files: Record<string, string> = {};
    for (const unit of batch) {
      files[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
    }

    const unitIds = batch.map((u) => u.id);
    return {
      sessionId: `${galaxy.meta.id}--ex--batch${batchIdx}`,
      files,
      prompt: buildExtractPrompt({ chapterId: chapter.id, unitIds }),
      label: `batch${batchIdx}(${unitIds[0]}..${unitIds[unitIds.length - 1]})`,
    };
  });

  console.log(
    `[skeleton] phase 1a: dispatching ${tasks.length} batched extract agents ` +
    `(${chapter.units.length} chunks in batches of ${EXTRACT_BATCH_SIZE})`,
  );
  const extractStarted = Date.now();
  const results = await fanOutSubSessions(tasks);

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `[skeleton] phase 1a complete: ${succeeded}/${tasks.length} batches ok (${Date.now() - extractStarted}ms)`,
  );

  // Collect digests from the extract sub-sessions.
  const digestFiles = mergeSubSessionFiles(results, "stage1-structure/");
  const digestEntries: string[] = [];
  const digestedUnitIds = new Set<string>();

  for (const [path, content] of Object.entries(digestFiles)) {
    if (path.endsWith("-digest.md")) {
      digestEntries.push(content);
      // Extract unitId from the content to track coverage.
      const unitIdMatch = content.match(/unitId:\s*(\S+)/);
      if (unitIdMatch) digestedUnitIds.add(unitIdMatch[1]);
    }
  }

  // For any chunks that weren't digested (failed batches), use raw text fallback.
  for (const unit of chapter.units) {
    if (!digestedUnitIds.has(unit.id)) {
      console.warn(`[skeleton] no digest for ${unit.id}, using raw text fallback`);
      digestEntries.push(
        `---\nunitId: ${unit.id}\nsummary: "${unit.text.slice(0, 200).replace(/"/g, '\\"').replace(/\n/g, " ")}"\nentities: []\nthemes: []\ndates: []\nkeyFacts: []\nmood: curious\n---`,
      );
    }
  }

  console.log(`[skeleton] collected ${digestEntries.length} digests`);

  // ── Phase 1b: single reduce session ──

  // Build the digests as inline text for the reduce prompt.
  const digestsText = digestEntries
    .map((d, i) => `### Digest ${i + 1}\n\`\`\`yaml\n${d.trim()}\n\`\`\``)
    .join("\n\n");

  // Push source files to the main workspace (needed for the reduce session
  // to write stage1-structure/ files, and for downstream stages).
  const sourceFiles: Record<string, string> = {};
  for (const unit of chapter.units) {
    sourceFiles[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
  }
  const manifest = chapter.units
    .map((u: SourceUnit) => `- ${u.id}: ${u.text.slice(0, 80).replace(/\n/g, " ")}…`)
    .join("\n");
  sourceFiles[`sources/${chapter.id}/_manifest.md`] =
    `# Source Units for ${chapter.id}\n\n${manifest}`;

  // Push page images if available.
  const binaryFiles: Record<string, string> | undefined =
    pageImages && pageImages.length > 0
      ? Object.fromEntries(
          pageImages.map((img) => [
            `sources/${chapter.id}/pages/page-${String(img.page).padStart(3, "0")}.png`,
            img.png.toString("base64"),
          ]),
        )
      : undefined;

  await pushFiles(galaxy.meta.id, sourceFiles, undefined, binaryFiles);

  const prompt = buildSkeletonPrompt({
    chapterId: chapter.id,
    sourceUnitIds: chapter.units.map((u: SourceUnit) => u.id),
    hasPageImages: !!(binaryFiles && Object.keys(binaryFiles).length > 0),
    pageCount: pageImages?.length ?? 0,
    digests: digestsText,
  });

  console.log(`[skeleton] phase 1b: running reduce session (prompt ~${Math.round(prompt.length / 1000)}k chars)`);
  const reduceStarted = Date.now();
  const result = await runStage({
    galaxyId: galaxy.meta.id,
    prompt,
  });

  console.log(`[skeleton] phase 1b finished: ok=${result.ok}, exitCode=${result.exitCode}, duration=${result.durationMs}ms`);

  if (!result.ok) {
    if (result.stderr) {
      console.error(`[skeleton] phase 1b stderr:\n${result.stderr}`);
    }
    throw new Error(`skeleton: Claude Code exited with code ${result.exitCode}`);
  }

  return compileAndFinalize(galaxy, chapter);
}

// ─── Single-session path (small inputs) ───────────────────────────

async function runSingleSession(
  galaxy: Galaxy,
  chapter: Galaxy["source"]["chapters"][0],
  pageImages?: { page: number; png: Buffer }[],
): Promise<SkeletonResult> {
  // Push source unit files to the workspace.
  const sourceFiles: Record<string, string> = {};
  for (const unit of chapter.units) {
    sourceFiles[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
  }

  const manifest = chapter.units
    .map((u: SourceUnit) => `- ${u.id}: ${u.text.slice(0, 80).replace(/\n/g, " ")}…`)
    .join("\n");
  sourceFiles[`sources/${chapter.id}/_manifest.md`] =
    `# Source Units for ${chapter.id}\n\n${manifest}`;

  const binaryFiles: Record<string, string> | undefined =
    pageImages && pageImages.length > 0
      ? Object.fromEntries(
          pageImages.map((img) => [
            `sources/${chapter.id}/pages/page-${String(img.page).padStart(3, "0")}.png`,
            img.png.toString("base64"),
          ]),
        )
      : undefined;

  console.log(`[skeleton] pushing ${Object.keys(sourceFiles).length} source files to workspace`);
  await pushFiles(galaxy.meta.id, sourceFiles, undefined, binaryFiles);

  const prompt = buildSkeletonPrompt({
    chapterId: chapter.id,
    sourceUnitIds: chapter.units.map((u: SourceUnit) => u.id),
    hasPageImages: !!(binaryFiles && Object.keys(binaryFiles).length > 0),
    pageCount: pageImages?.length ?? 0,
  });

  console.log(`[skeleton] running Claude Code (prompt ~${Math.round(prompt.length / 1000)}k chars)`);
  const result = await runStage({
    galaxyId: galaxy.meta.id,
    prompt,
  });

  console.log(`[skeleton] Claude Code finished: ok=${result.ok}, exitCode=${result.exitCode}, duration=${result.durationMs}ms`);

  if (!result.ok) {
    throw new Error(`skeleton: Claude Code exited with code ${result.exitCode}`);
  }

  return compileAndFinalize(galaxy, chapter);
}

// ─── Shared compile + finalize ────────────────────────────────────

async function compileAndFinalize(
  galaxy: Galaxy,
  chapter: Galaxy["source"]["chapters"][0],
): Promise<SkeletonResult> {
  const files = await compileFiles(galaxy.meta.id);

  // Diagnostic: log what the workspace contains.
  const allPaths = Object.keys(files);
  const stage1Paths = allPaths.filter((p) => p.startsWith("stage1-structure/"));
  console.log(
    `[skeleton] workspace has ${allPaths.length} files total, ${stage1Paths.length} in stage1-structure/. Prefixes: ${[...new Set(allPaths.map((p) => p.split("/")[0]))].join(", ")}`,
  );
  if (stage1Paths.length === 0) {
    console.warn(
      `[skeleton] no stage1-structure/ files found! All paths:\n  ${allPaths.slice(0, 30).join("\n  ")}`,
    );
  }

  const compiled = compileStructure(files);

  if (compiled.knowledge.entries.length === 0) {
    console.warn(
      `[skeleton] compileStructure produced 0 entries from ${stage1Paths.length} files. ` +
        `Clusters: ${compiled.knowledge.clusters.length}, Groups: ${compiled.knowledge.groups.length}`,
    );
    for (const p of stage1Paths.slice(0, 5)) {
      console.warn(`[skeleton] sample file "${p}" (first 300 chars): ${files[p].slice(0, 300)}`);
    }
    if (stage1Paths.length === 0) {
      throw new Error(
        "skeleton: Claude produced no stage1-structure/ files — check proxy workspace and prompt",
      );
    }
  }

  // Check if a _summary.md was produced and use its title.
  const summaryFile = Object.entries(files).find(
    ([p]) => p.includes("_summary.md"),
  );
  if (summaryFile) {
    const summary = parseNote(summaryFile[1], summaryFile[0]);
    if (summary.data.title) {
      galaxy.meta.title = summary.data.title as string;
    }
  }

  // Write scopes to the blob.
  galaxy.knowledge = compiled.knowledge;
  galaxy.relationships = { edges: compiled.relationships };

  // Update meta.chapters with all node IDs from this chapter.
  const chapterEntry = galaxy.meta.chapters.find((c) => c.id === chapter.id);
  if (chapterEntry) {
    chapterEntry.addedNodeIds = [
      ...compiled.knowledge.clusters.map((c) => c.id),
      ...compiled.knowledge.groups.map((g) => g.id),
      ...compiled.knowledge.entries.map((e) => e.id),
    ];
  }

  stageDone(galaxy, "structure");

  return { galaxy, dispatchPlan: compiled.dispatchPlan };
}
