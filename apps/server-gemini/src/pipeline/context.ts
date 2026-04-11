// Shared mutable state threaded through pipeline stages. Each stage reads
// what earlier stages wrote and fills in its own slice.
//
// Every entity gets its UUID the moment we first know it exists (stage 1
// for sources, stage 2b for planets/concepts, stage 3a for stories), so
// cross-entity wikilinks can be written deterministically without
// re-parsing the mesh between stages.

import type { UUID } from "../types";

export interface SourceCtx {
  id: UUID;
  title: string;
  filename: string;
  mediaRef: string;
  summary: string;
  keyThemes: string[];
  notableDetails: string[];
  tone: string;
}

export interface PlanetCtx {
  id: UUID;
  title: string;
  oneLineHook: string;
  sourceIds: UUID[];
  planetConnectionTitles: string[];
  body?: string;
}

export interface ConceptCtx {
  id: UUID;
  title: string;
  oneLineHook: string;
  planetConnectionTitles: string[];
  conceptConnectionTitles: string[];
  body?: string;
}

export interface SolarSystemCtx {
  id: UUID;
  title: string;
  oneLineDescription: string;
  sourceIds: UUID[];
  body?: string;
  planets: PlanetCtx[];
  concepts: ConceptCtx[];
}

export interface StoryCtx {
  id: UUID;
  title: string;
  character: string;
  drivingConceptTitles: string[];
  plannedPlanetTitles: string[];
  arcOutline: string;
  introduction?: string;
  scenes?: { planetTitle: string; markdown: string }[];
  conclusion?: string;
}

export interface PipelineContext {
  galaxyId: string;
  galaxyTitle: string;
  sources: SourceCtx[];
  solarSystems: SolarSystemCtx[];
  stories: StoryCtx[];
}

// Helpers that flatten nested lookups the prompts need a lot.
export function allPlanets(ctx: PipelineContext): PlanetCtx[] {
  return ctx.solarSystems.flatMap((ss) => ss.planets);
}

export function allConcepts(ctx: PipelineContext): ConceptCtx[] {
  return ctx.solarSystems.flatMap((ss) => ss.concepts);
}

export function allPlanetTitles(ctx: PipelineContext): string[] {
  return allPlanets(ctx).map((p) => p.title);
}

export function allConceptTitles(ctx: PipelineContext): string[] {
  return allConcepts(ctx).map((c) => c.title);
}
