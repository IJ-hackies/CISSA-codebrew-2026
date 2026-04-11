// Append pipeline — adds new content to an existing galaxy without
// modifying or removing any existing solar systems, planets, or concepts.
//
// Flow:
//   1. Ingest new source rows → SourceCtx[]
//   2. Build structure summary from existing GalaxyData
//   3. Append-decision AI call → { newSystems[], additions[] }
//   4. For new solar systems: outline + expand (same as main pipeline)
//   5. For additions to existing systems: expand new entities, update SS file
//   6. Persist

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generateJson, generateText, MODEL_FLASH } from "./gemini";
import { runIngestStage } from "./ingest";
import {
  runOutlineStage,
  runExpandPlanetsStage,
  runExpandConceptsStage,
} from "./structure";
import { runStoryPitchesStage, runWriteStoriesStage } from "./stories";
import { computeInputBudget, wordsToOutputTokens, modelForBudget } from "./budget";
import { createLimiter, mapViaLimiterTolerant } from "../lib/concurrency";
import { canonicalizeGeneratedWikilinks } from "../lib/wikilinks";
import {
  listSourceRows,
  updateGalaxyStatus,
  cacheGalaxyData,
  getGalaxyRow,
  type SourceRow,
} from "../db/client";
import { parseWorkspace } from "../workspace/parse";
import { galaxyPaths } from "../workspace/layout";
import { writeSolarSystem, writePlanet, writeConcept } from "../workspace/write";
import type { GalaxyData, JobStatus } from "../types";
import type { PipelineContext, SolarSystemCtx, PlanetCtx, ConceptCtx } from "./context";
import { loadCachedGalaxyData } from "../db/client";
import { emptyGalaxy } from "../types";

// First sentence of a markdown string — used as a one-line hook for existing entities.
function firstSentence(text: string): string {
  const m = text.match(/[^.!?\n]{10,}[.!?]/);
  return m ? m[0].trim().slice(0, 200) : text.slice(0, 200);
}

// Build a PipelineContext whose solarSystems covers the entire galaxy (existing + new).
// The story stages only need title, oneLineHook, and body — markdown covers all three.
function buildFullCtxForStories(
  base: PipelineContext,
  existingData: GalaxyData,
): PipelineContext {
  const existingSystems: SolarSystemCtx[] = Object.values(existingData.solarSystems).map((ss) => {
    const planets: PlanetCtx[] = ss.planets
      .map((id) => existingData.planets[id])
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        title: p.title,
        oneLineHook: firstSentence(p.markdown ?? ""),
        sourceIds: [],
        planetConnectionTitles: [],
        body: p.markdown,
      }));

    const concepts: ConceptCtx[] = ss.concepts
      .map((id) => existingData.concepts[id])
      .filter(Boolean)
      .map((c) => ({
        id: c.id,
        title: c.title,
        oneLineHook: firstSentence(c.markdown ?? ""),
        planetConnectionTitles: [],
        conceptConnectionTitles: [],
        body: c.markdown,
      }));

    return {
      id: ss.id,
      title: ss.title,
      oneLineDescription: firstSentence(ss.markdown ?? ""),
      sourceIds: [],
      body: ss.markdown,
      planets,
      concepts,
    };
  });

  return {
    ...base,
    solarSystems: [...existingSystems, ...base.solarSystems],
    stories: [],
  };
}

function extractWikilinksFromBody(body: string): { planetTitles: string[]; conceptTitles: string[] } {
  const planetTitles = [...body.matchAll(/\[\[\(Planet\)\s+([^\]]+)\]\]/g)].map((m) => m[1].trim());
  const conceptTitles = [...body.matchAll(/\[\[\(Concept\)\s+([^\]]+)\]\]/g)].map((m) => m[1].trim());
  return { planetTitles: [...new Set(planetTitles)], conceptTitles: [...new Set(conceptTitles)] };
}

function setStage(galaxyId: string, status: JobStatus, detail = ""): void {
  updateGalaxyStatus(galaxyId, status, detail);
  console.log(`[append:${galaxyId}] ${status}${detail ? " — " + detail : ""}`);
}

function persist(galaxyId: string): void {
  const galaxy = parseWorkspace(galaxyId);
  cacheGalaxyData(galaxyId, galaxy);
  const jsonPath = join(galaxyPaths(galaxyId).root, "galaxy-data.json");
  writeFileSync(jsonPath, JSON.stringify(galaxy, null, 2), "utf8");
}

function proConcurrency(): number {
  return Math.max(1, Number(process.env.PRO_CONCURRENCY ?? 8));
}

// ── Append decision schema ─────────────────────────────────────────

const appendDecisionSchema = z.object({
  newSolarSystems: z.array(z.object({
    title: z.string().min(1).max(200),
    oneLineDescription: z.string().min(10).max(600),
    sourceIndices: z.array(z.number().int().nonnegative()),
  })).max(6),
  additions: z.array(z.object({
    existingSystemTitle: z.string().min(1),
    sourceIndices: z.array(z.number().int().nonnegative()),
    newPlanets: z.array(z.object({
      title: z.string().min(1).max(200),
      oneLineHook: z.string().min(5).max(400),
    })).max(8),
    newConcepts: z.array(z.object({
      title: z.string().min(1).max(200),
      oneLineHook: z.string().min(5).max(400),
    })).max(5),
  })),
});

const appendDecisionJsonSchema = {
  type: "object",
  required: ["newSolarSystems", "additions"],
  properties: {
    newSolarSystems: {
      type: "array",
      description: "New solar systems to create for genuinely new major topics",
      items: {
        type: "object",
        required: ["title", "oneLineDescription", "sourceIndices"],
        properties: {
          title: { type: "string" },
          oneLineDescription: { type: "string" },
          sourceIndices: { type: "array", items: { type: "integer", minimum: 0 } },
        },
      },
    },
    additions: {
      type: "array",
      description: "New planets/concepts to add to existing solar systems",
      items: {
        type: "object",
        required: ["existingSystemTitle", "sourceIndices", "newPlanets", "newConcepts"],
        properties: {
          existingSystemTitle: { type: "string" },
          sourceIndices: { type: "array", items: { type: "integer", minimum: 0 } },
          newPlanets: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "oneLineHook"],
              properties: { title: { type: "string" }, oneLineHook: { type: "string" } },
            },
          },
          newConcepts: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "oneLineHook"],
              properties: { title: { type: "string" }, oneLineHook: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

async function runAppendDecisionStage(
  ctx: PipelineContext,
  existingData: GalaxyData,
): Promise<z.infer<typeof appendDecisionSchema>> {
  const existingSummary = Object.values(existingData.solarSystems)
    .map((ss) => {
      const planetTitles = ss.planets.map((id) => existingData.planets[id]?.title).filter(Boolean);
      const conceptTitles = ss.concepts.map((id) => existingData.concepts[id]?.title).filter(Boolean);
      return `- "${ss.title}"\n  planets: ${planetTitles.join(", ") || "(none)"}\n  concepts: ${conceptTitles.join(", ") || "(none)"}`;
    })
    .join("\n");

  const newSourceDigest = ctx.sources
    .map((s, i) => `[${i}] "${s.title}"\n    themes: ${s.keyThemes.join(", ")}\n    summary: ${s.summary.slice(0, 300)}`)
    .join("\n\n");

  const prompt = [
    `You are expanding an existing knowledge galaxy. Your job is to decide where new content belongs.`,
    ``,
    `EXISTING SOLAR SYSTEMS (do NOT rename, remove, or modify these):`,
    existingSummary || "(none yet)",
    ``,
    `NEW CONTENT (${ctx.sources.length} new source(s)):`,
    newSourceDigest,
    ``,
    `RULES:`,
    `- For each new source, assign it to EITHER an existing solar system OR a new one.`,
    `- Create a NEW solar system only if the new content covers a genuinely different major topic not represented above.`,
    `- For ADDITIONS to existing systems: propose 2–5 specific new planet titles and 1–3 concept titles that this new source adds to that system.`,
    `- Never propose planet or concept titles that already exist in the existing structure above.`,
    `- Planet titles should be specific and evocative. Not generic.`,
    `- Every source index must appear in exactly one newSolarSystems entry or one additions entry.`,
  ].join("\n");

  return generateJson({
    model: MODEL_FLASH,
    parts: [{ text: prompt }],
    schema: appendDecisionSchema,
    jsonSchema: appendDecisionJsonSchema,
    temperature: 0.7,
    maxOutputTokens: 4096,
  });
}

// Expand new planets for an existing system addition and write the files.
async function expandAdditionEntities(
  galaxyId: string,
  existingData: GalaxyData,
  systemTitle: string,
  newPlanets: Array<{ title: string; oneLineHook: string }>,
  newConcepts: Array<{ title: string; oneLineHook: string }>,
  sourceCtxs: PipelineContext["sources"],
  allPlanetTitles: string[],
  allConceptTitles: string[],
  proLimiter: ReturnType<typeof createLimiter>,
  budget: ReturnType<typeof computeInputBudget>,
): Promise<{ planets: PlanetCtx[]; concepts: ConceptCtx[] }> {
  const model = modelForBudget(budget);
  const planetOutputBudget = wordsToOutputTokens(budget.planetBodyWords.max);
  const sourceDigest = sourceCtxs
    .map((s) => `- ${s.title}\n  ${s.summary}`)
    .join("\n\n");

  const planetCtxs: PlanetCtx[] = newPlanets.map((p) => ({
    id: randomUUID(),
    title: p.title,
    oneLineHook: p.oneLineHook,
    sourceIds: sourceCtxs.map((s) => s.id),
    planetConnectionTitles: [],
  }));

  const conceptCtxs: ConceptCtx[] = newConcepts.map((c) => ({
    id: randomUUID(),
    title: c.title,
    oneLineHook: c.oneLineHook,
    planetConnectionTitles: [],
    conceptConnectionTitles: [],
  }));

  const { failed: pFailed } = await mapViaLimiterTolerant(
    planetCtxs,
    proLimiter,
    "append-expand-planet",
    async (planet) => {
      const prompt = [
        `You are writing the body of a knowledge PLANET for an interactive 3D galaxy.`,
        `Planet title: "${planet.title}"`,
        `Hook: "${planet.oneLineHook}"`,
        `Inside solar system: "${systemTitle}"`,
        ``,
        `Source material:`,
        sourceDigest,
        ``,
        `Other planet titles you may wikilink to: ${allPlanetTitles.join(" | ")}`,
        `Concept titles you may wikilink to: ${allConceptTitles.join(" | ")}`,
        ``,
        `Write a dense markdown body of ${budget.planetBodyWords.min}-${budget.planetBodyWords.max} words. Concrete details. Use [[(Planet) Title]] and [[(Concept) Name]] wikilinks where helpful. Return ONLY markdown body — no heading, no fences.`,
      ].join("\n");

      const raw = await generateText({ model, parts: [{ text: prompt }], temperature: 0.85, maxOutputTokens: planetOutputBudget });
      planet.body = canonicalizeGeneratedWikilinks(raw.trim(), { planets: allPlanetTitles, concepts: allConceptTitles });
      const { planetTitles: linkedPlanets } = extractWikilinksFromBody(planet.body);

      writePlanet(galaxyId, {
        id: planet.id,
        title: planet.title,
        planetConnections: linkedPlanets,
        body: planet.body,
      });
      return planet;
    },
  );

  const { failed: cFailed } = await mapViaLimiterTolerant(
    conceptCtxs,
    proLimiter,
    "append-expand-concept",
    async (concept) => {
      const prompt = [
        `You are writing the body of a knowledge CONCEPT (theme/pattern/person) for a 3D galaxy.`,
        `Concept title: "${concept.title}"`,
        `Hook: "${concept.oneLineHook}"`,
        `Inside solar system: "${systemTitle}"`,
        ``,
        `Source material:`,
        sourceDigest,
        ``,
        `Planet titles you may wikilink to: ${allPlanetTitles.join(" | ")}`,
        ``,
        `Write ${budget.conceptBodyWords.min}-${budget.conceptBodyWords.max} words of thematic prose. Use [[(Planet) Title]] wikilinks. Return ONLY markdown body — no heading, no fences.`,
      ].join("\n");

      const raw = await generateText({ model, parts: [{ text: prompt }], temperature: 0.85, maxOutputTokens: wordsToOutputTokens(budget.conceptBodyWords.max) });
      concept.body = canonicalizeGeneratedWikilinks(raw.trim(), { planets: allPlanetTitles, concepts: allConceptTitles });
      const { planetTitles: linkedPlanets, conceptTitles: linkedConcepts } = extractWikilinksFromBody(concept.body);

      writeConcept(galaxyId, {
        id: concept.id,
        title: concept.title,
        planetConnections: linkedPlanets,
        conceptConnections: linkedConcepts,
        body: concept.body,
      });
      return concept;
    },
  );

  if (pFailed > 0) console.warn(`[append] ${pFailed} planet(s) failed to expand`);
  if (cFailed > 0) console.warn(`[append] ${cFailed} concept(s) failed to expand`);

  return {
    planets: planetCtxs.filter((p) => p.body !== undefined),
    concepts: conceptCtxs.filter((c) => c.body !== undefined),
  };
}

// ── Main append entry point ────────────────────────────────────────

export async function runAppendPipeline(galaxyId: string): Promise<void> {
  const row = getGalaxyRow(galaxyId);
  if (!row) throw new Error(`galaxy ${galaxyId} not found`);

  const existingData: GalaxyData = loadCachedGalaxyData(galaxyId) ?? emptyGalaxy();

  // New sources = those NOT already referenced in the existing galaxy data
  const existingSourceIds = new Set(Object.keys(existingData.sources));
  const allSourceRows = listSourceRows(galaxyId);
  const newSourceRows: SourceRow[] = allSourceRows.filter((r) => !existingSourceIds.has(r.id));

  if (newSourceRows.length === 0) {
    updateGalaxyStatus(galaxyId, "complete", "no new sources to process");
    return;
  }

  const ctx: PipelineContext = {
    galaxyId,
    galaxyTitle: row.title,
    sources: [],
    solarSystems: [],
    stories: [],
  };

  const proLimiter = createLimiter(proConcurrency());

  try {
    // 1. Ingest
    setStage(galaxyId, "ingest", `${newSourceRows.length} new source(s)`);
    await runIngestStage(ctx, newSourceRows);
    persist(galaxyId);

    const totalInputBytes = newSourceRows.reduce((n, r) => n + r.byteSize, 0);
    const budget = computeInputBudget(ctx, totalInputBytes);

    // 2. Append decision
    setStage(galaxyId, "cluster", "deciding where new content fits");
    const decisions = await runAppendDecisionStage(ctx, existingData);
    console.log(`[append:${galaxyId}] decision: ${decisions.newSolarSystems.length} new system(s), ${decisions.additions.length} addition(s)`);

    // Collect all known titles (existing + from new systems) for wikilink resolution
    const existingPlanetTitles = Object.values(existingData.planets).map((p) => p.title);
    const existingConceptTitles = Object.values(existingData.concepts).map((c) => c.title);

    // 3. Handle new solar systems via the standard outline + expand flow
    if (decisions.newSolarSystems.length > 0) {
      ctx.solarSystems = decisions.newSolarSystems.map((ns) => ({
        id: randomUUID(),
        title: ns.title,
        oneLineDescription: ns.oneLineDescription,
        sourceIds: ns.sourceIndices.map((i) => ctx.sources[i]?.id).filter(Boolean) as string[],
        planets: [],
        concepts: [],
      }));

      setStage(galaxyId, "outline", `${ctx.solarSystems.length} new solar system(s)`);
      await runOutlineStage(ctx, budget, proLimiter);
      persist(galaxyId);

      const newPlanetCount = ctx.solarSystems.reduce((n, s) => n + s.planets.length, 0);
      const newConceptCount = ctx.solarSystems.reduce((n, s) => n + s.concepts.length, 0);
      setStage(galaxyId, "expand", `${newPlanetCount} new planets, ${newConceptCount} new concepts`);

      await Promise.all([
        runExpandPlanetsStage(ctx, budget, proLimiter),
        runExpandConceptsStage(ctx, budget, proLimiter),
      ]);
      persist(galaxyId);
    }

    // 4. Handle additions to existing solar systems
    for (const addition of decisions.additions) {
      const existingSS = Object.values(existingData.solarSystems).find(
        (ss) => ss.title.toLowerCase() === addition.existingSystemTitle.toLowerCase(),
      );
      if (!existingSS) {
        console.warn(`[append] could not find existing system "${addition.existingSystemTitle}" — skipping`);
        continue;
      }

      const sourceCtxs = addition.sourceIndices
        .map((i) => ctx.sources[i])
        .filter(Boolean);

      const allPlanetTitles = [
        ...existingPlanetTitles,
        ...ctx.solarSystems.flatMap((ss) => ss.planets.map((p) => p.title)),
        ...addition.newPlanets.map((p) => p.title),
      ];
      const allConceptTitles = [
        ...existingConceptTitles,
        ...ctx.solarSystems.flatMap((ss) => ss.concepts.map((c) => c.title)),
        ...addition.newConcepts.map((c) => c.title),
      ];

      setStage(galaxyId, "expand", `adding to "${existingSS.title}"`);
      const { planets: newPlanets, concepts: newConcepts } = await expandAdditionEntities(
        galaxyId,
        existingData,
        existingSS.title,
        addition.newPlanets,
        addition.newConcepts,
        sourceCtxs,
        allPlanetTitles,
        allConceptTitles,
        proLimiter,
        budget,
      );

      // Update the solar system file to include the new entities
      const updatedPlanetTitles = [
        ...existingSS.planets.map((id) => existingData.planets[id]?.title).filter(Boolean),
        ...newPlanets.map((p) => p.title),
      ] as string[];
      const updatedConceptTitles = [
        ...existingSS.concepts.map((id) => existingData.concepts[id]?.title).filter(Boolean),
        ...newConcepts.map((c) => c.title),
      ] as string[];

      writeSolarSystem(galaxyId, {
        id: existingSS.id,
        title: existingSS.title,
        planetTitles: updatedPlanetTitles,
        conceptTitles: updatedConceptTitles,
        body: existingSS.markdown,
      });

      persist(galaxyId);
    }

    // 5. Generate new stories covering the full galaxy (existing + new entities)
    const storyCtx = buildFullCtxForStories(ctx, loadCachedGalaxyData(galaxyId) ?? existingData);
    const totalPlanets = storyCtx.solarSystems.reduce((n, s) => n + s.planets.length, 0);
    if (totalPlanets > 0) {
      setStage(galaxyId, "stories", "pitching");
      await runStoryPitchesStage(storyCtx, budget);
      setStage(galaxyId, "stories", `writing ${storyCtx.stories.length} stor${storyCtx.stories.length === 1 ? "y" : "ies"}`);
      await runWriteStoriesStage(storyCtx, budget, proLimiter);
      persist(galaxyId);
    }

    setStage(galaxyId, "complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[append:${galaxyId}] failed:`, err);
    try { persist(galaxyId); } catch { /* ignore */ }
    updateGalaxyStatus(galaxyId, "error", "", msg);
  }
}
