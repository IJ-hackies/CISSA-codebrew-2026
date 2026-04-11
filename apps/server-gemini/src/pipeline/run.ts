// Pipeline orchestrator. Runs ingest → cluster → outline → expand-planets
// → expand-concepts → story-pitches → write-stories, persisting GalaxyData
// to SQLite after every stage so the frontend can poll and see progressive
// results. Errors short-circuit the run and record on the galaxy row.
//
// Two orchestrator-level concerns that stage files don't own:
//
//   1. INPUT BUDGET — computed once after ingest and threaded into every
//      downstream stage. Scales counts and word targets to input volume.
//
//   2. SHARED PRO LIMITER — one count-based limiter feeds outline,
//      expand-planets, expand-concepts, and write-stories. Stages that
//      run simultaneously (expand-planets || expand-concepts) share the
//      same slot pool, so we never blow past Pro per-minute quota by
//      double-counting across stages.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PipelineContext } from "./context";
import { runIngestStage } from "./ingest";
import {
  runClusterStage,
  runOutlineStage,
  runExpandPlanetsStage,
  runExpandConceptsStage,
} from "./structure";
import { runStoryPitchesStage, runWriteStoriesStage } from "./stories";
import { computeInputBudget } from "./budget";
import { createLimiter } from "../lib/concurrency";
import {
  listSourceRows,
  updateGalaxyStatus,
  cacheGalaxyData,
  getGalaxyRow,
} from "../db/client";
import { parseWorkspace } from "../workspace/parse";
import { galaxyPaths } from "../workspace/layout";
import type { JobStatus } from "../types";

function setStage(galaxyId: string, status: JobStatus, detail = ""): void {
  updateGalaxyStatus(galaxyId, status, detail);
  console.log(`[pipeline:${galaxyId}] ${status}${detail ? " — " + detail : ""}`);
}

// After each stage: re-parse the mesh, cache the GalaxyData in SQLite,
// AND drop a `galaxy-data.json` file at the root of the workspace so the
// folder is fully self-contained.
function persist(galaxyId: string): void {
  const galaxy = parseWorkspace(galaxyId);
  cacheGalaxyData(galaxyId, galaxy);
  const jsonPath = join(galaxyPaths(galaxyId).root, "galaxy-data.json");
  writeFileSync(jsonPath, JSON.stringify(galaxy, null, 2), "utf8");
}

// Total concurrent Pro calls across all Pro-backed stages. Gemini Pro
// per-minute quota is the ceiling; 8 is a safe default that leaves
// headroom for retries. Override via PRO_CONCURRENCY env.
function proConcurrency(): number {
  return Math.max(1, Number(process.env.PRO_CONCURRENCY ?? 8));
}

export async function runPipeline(galaxyId: string): Promise<void> {
  const row = getGalaxyRow(galaxyId);
  if (!row) throw new Error(`galaxy ${galaxyId} not found`);

  const sourceRows = listSourceRows(galaxyId);
  if (sourceRows.length === 0) {
    updateGalaxyStatus(galaxyId, "error", "", "no sources uploaded");
    return;
  }

  const ctx: PipelineContext = {
    galaxyId,
    galaxyTitle: row.title,
    sources: [],
    solarSystems: [],
    stories: [],
  };

  // Shared Pro limiter — outline, expand-planets, expand-concepts and
  // write-stories all run through this, so simultaneous stages can't
  // exceed the global Pro-quota budget.
  const proLimiter = createLimiter(proConcurrency());

  try {
    setStage(galaxyId, "ingest", `${sourceRows.length} source(s)`);
    await runIngestStage(ctx, sourceRows);
    persist(galaxyId);

    // Input budget is computed ONCE, right after ingest, from the total
    // volume of source summaries. Every downstream stage reads counts
    // and word targets from this. Logged for debugging.
    const budget = computeInputBudget(ctx);
    console.log(
      `[pipeline:${galaxyId}] budget=${budget.tier} sources=${budget.sourceCount} chars=${budget.totalSourceChars}`,
    );

    setStage(galaxyId, "cluster", `tier=${budget.tier}`);
    await runClusterStage(ctx, budget);

    setStage(galaxyId, "outline", `${ctx.solarSystems.length} solar system(s)`);
    await runOutlineStage(ctx, budget, proLimiter);
    persist(galaxyId);

    const planetCount = ctx.solarSystems.reduce((n, s) => n + s.planets.length, 0);
    const conceptCount = ctx.solarSystems.reduce((n, s) => n + s.concepts.length, 0);
    setStage(galaxyId, "expand", `${planetCount} planets, ${conceptCount} concepts`);

    // Planets and concepts both feed into the shared Pro limiter, so
    // `Promise.all` here does NOT double the in-flight slot count —
    // the limiter keeps total Pro calls at <= PRO_CONCURRENCY.
    await Promise.all([
      runExpandPlanetsStage(ctx, budget, proLimiter),
      runExpandConceptsStage(ctx, budget, proLimiter),
    ]);
    persist(galaxyId);

    setStage(galaxyId, "stories", "pitching");
    await runStoryPitchesStage(ctx, budget);

    setStage(galaxyId, "stories", `writing ${ctx.stories.length} stor${ctx.stories.length === 1 ? "y" : "ies"}`);
    await runWriteStoriesStage(ctx, budget, proLimiter);
    persist(galaxyId);

    setStage(galaxyId, "complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline:${galaxyId}] failed:`, err);
    try {
      persist(galaxyId);
    } catch {
      // ignore — parser may hate a half-written mesh
    }
    updateGalaxyStatus(galaxyId, "error", "", msg);
  }
}
