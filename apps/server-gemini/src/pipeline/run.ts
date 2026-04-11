// Pipeline orchestrator. Runs ingest → cluster → outline → expand-planets
// → expand-concepts → story-pitches → write-stories, persisting GalaxyData
// to SQLite after every stage so the frontend can poll and see progressive
// results. Errors short-circuit the run and record on the galaxy row.

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
// folder is fully self-contained. Byte shape matches `galaxy-data 1.json`
// at the repo root — feed it straight to the frontend.
function persist(galaxyId: string): void {
  const galaxy = parseWorkspace(galaxyId);
  cacheGalaxyData(galaxyId, galaxy);
  const jsonPath = join(galaxyPaths(galaxyId).root, "galaxy-data.json");
  writeFileSync(jsonPath, JSON.stringify(galaxy, null, 2), "utf8");
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

  try {
    setStage(galaxyId, "ingest", `${sourceRows.length} source(s)`);
    await runIngestStage(ctx, sourceRows);
    persist(galaxyId);

    setStage(galaxyId, "cluster");
    await runClusterStage(ctx);

    setStage(galaxyId, "outline", `${ctx.solarSystems.length} solar system(s)`);
    await runOutlineStage(ctx);
    persist(galaxyId);

    const planetCount = ctx.solarSystems.reduce((n, s) => n + s.planets.length, 0);
    const conceptCount = ctx.solarSystems.reduce((n, s) => n + s.concepts.length, 0);
    setStage(galaxyId, "expand", `${planetCount} planets, ${conceptCount} concepts`);

    // Planets and concepts can run concurrently — they don't depend on
    // each other, and Gemini quota is the only limiter they share.
    await Promise.all([
      runExpandPlanetsStage(ctx),
      runExpandConceptsStage(ctx),
    ]);
    persist(galaxyId);

    setStage(galaxyId, "stories", "pitching");
    await runStoryPitchesStage(ctx);

    setStage(galaxyId, "stories", `writing ${ctx.stories.length} stor${ctx.stories.length === 1 ? "y" : "ies"}`);
    await runWriteStoriesStage(ctx);
    persist(galaxyId);

    setStage(galaxyId, "complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline:${galaxyId}] failed:`, err);
    // Persist whatever made it to disk before the failure.
    try {
      persist(galaxyId);
    } catch {
      // ignore — parser may hate a half-written mesh
    }
    updateGalaxyStatus(galaxyId, "error", "", msg);
  }
}
