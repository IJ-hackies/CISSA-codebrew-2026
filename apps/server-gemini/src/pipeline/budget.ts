// Input-proportional sizing. Computes a single galaxy-wide "budget" once
// after ingest, from the total volume of source summaries, and every
// downstream stage reads counts + word targets from it. Replaces the old
// hardcoded "1500-3000 words per planet, 3-7 systems" regardless of input.
//
// Tier is chosen by BOTH source count and total summary char count, so a
// 2-file upload of huge PDFs ends up "medium", not "tiny".
//
// The tier also carries a `model` hint: tiny/small stages run on Flash
// (Pro's quality edge is invisible on small input), medium/large stay on
// Pro. `pickTierFromRows` does a cheap byte-based pre-tier on raw source
// rows so the pipeline can branch into the one-shot path BEFORE ingest.

import type { PipelineContext } from "./context";
import type { SourceRow } from "../db/client";
import { MODEL_FLASH, MODEL_PRO } from "./gemini";

export type Tier = "tiny" | "small" | "medium" | "large";
export type ModelTier = "flash" | "pro";

export interface Range {
  min: number;
  max: number;
}

export interface InputBudget {
  tier: Tier;
  model: ModelTier;
  sourceCount: number;
  totalSourceChars: number;

  // Counts
  solarSystems: Range;        // whole-galaxy
  planetsPerSystem: Range;
  conceptsPerSystem: Range;
  stories: Range;             // whole-galaxy
  storyScenes: Range;         // per story

  // Word targets
  planetBodyWords: Range;
  conceptBodyWords: Range;
  solarSystemBodyWords: Range;
  storyIntroWords: Range;
  sceneWords: Range;
  conclusionWords: Range;
}

// Tier definitions. `large` mirrors the old hardcoded behavior so 500-file
// runs don't regress. Smaller tiers collapse toward a single tight galaxy.
// The `model` field is a global default for every staged Pro call on that
// tier — Flash for tiny/small (Pro's edge is wasted on a couple pages),
// Pro for medium/large where quality matters.
const TIERS: Record<Tier, Omit<InputBudget, "sourceCount" | "totalSourceChars">> = {
  tiny: {
    tier: "tiny",
    model: "flash",
    solarSystems:         { min: 1, max: 1 },
    planetsPerSystem:     { min: 2, max: 4 },
    conceptsPerSystem:    { min: 1, max: 3 },
    stories:              { min: 1, max: 1 },
    storyScenes:          { min: 2, max: 3 },
    planetBodyWords:      { min: 170, max: 240 },
    conceptBodyWords:     { min: 130, max: 170 },
    solarSystemBodyWords: { min: 70,  max: 95  },
    storyIntroWords:      { min: 130, max: 145 },
    sceneWords:           { min: 130, max: 145 },
    conclusionWords:      { min: 85,  max: 95  },
  },
  small: {
    tier: "small",
    model: "flash",
    solarSystems:         { min: 1, max: 2 },
    planetsPerSystem:     { min: 3, max: 6 },
    conceptsPerSystem:    { min: 2, max: 4 },
    stories:              { min: 1, max: 2 },
    storyScenes:          { min: 3, max: 5 },
    planetBodyWords:      { min: 300, max: 400 },
    conceptBodyWords:     { min: 200, max: 300 },
    solarSystemBodyWords: { min: 120, max: 280 },
    storyIntroWords:      { min: 250, max: 500 },
    sceneWords:           { min: 250, max: 500 },
    conclusionWords:      { min: 150, max: 300 },
  },
  medium: {
    tier: "medium",
    model: "pro",
    solarSystems:         { min: 2, max: 5 },
    planetsPerSystem:     { min: 5, max: 8 },
    conceptsPerSystem:    { min: 3, max: 5 },
    stories:              { min: 2, max: 4 },
    storyScenes:          { min: 4, max: 7 },
    planetBodyWords:      { min: 680, max: 865 },
    conceptBodyWords:     { min: 425, max: 480 },
    solarSystemBodyWords: { min: 155, max: 185 },
    storyIntroWords:      { min: 280, max: 335 },
    sceneWords:           { min: 260, max: 290 },
    conclusionWords:      { min: 200, max: 216 },
  },
  large: {
    tier: "large",
    model: "pro",
    solarSystems:         { min: 3, max: 7 },
    planetsPerSystem:     { min: 5, max: 10 },
    conceptsPerSystem:    { min: 4, max: 7 },
    stories:              { min: 3, max: 6 },
    storyScenes:          { min: 5, max: 10 },
    planetBodyWords:      { min: 1275, max: 1440 },
    conceptBodyWords:     { min: 510,  max: 720  },
    solarSystemBodyWords: { min: 190,  max: 240  },
    storyIntroWords:      { min: 340,  max: 430  },
    sceneWords:           { min: 340,  max: 385  },
    conclusionWords:      { min: 255,  max: 290  },
  },
};

export function computeInputBudget(ctx: PipelineContext): InputBudget {
  const sourceCount = ctx.sources.length;
  const totalSourceChars = ctx.sources.reduce((n, s) => n + s.summary.length, 0);

  const tier = pickTier(sourceCount, totalSourceChars);
  return {
    ...TIERS[tier],
    sourceCount,
    totalSourceChars,
  };
}

// Build a budget directly from a tier + rough char count. Used by the
// one-shot path, which branches before ingest has produced any summaries
// so `computeInputBudget` can't run yet.
export function budgetForTier(
  tier: Tier,
  sourceCount: number,
  totalSourceChars = 0,
): InputBudget {
  return {
    ...TIERS[tier],
    sourceCount,
    totalSourceChars,
  };
}

// Tier by the tighter of (count, chars) — a 2-source upload of 200KB of
// summary is "medium", not "tiny". Thresholds are picked so the 500-file
// test (which lands in "large") matches pre-pivot behavior exactly.
function pickTier(count: number, chars: number): Tier {
  if (count <= 3  && chars <  6_000)  return "tiny";
  if (count <= 15 && chars < 40_000)  return "small";
  if (count <= 80 && chars < 250_000) return "medium";
  return "large";
}

// Pre-ingest tier check based purely on raw row metadata. Uses file bytes
// as a proxy for char count. Bytes threshold is a touch looser than the
// post-ingest char threshold because raw files carry wrapper overhead
// (PDF structure, image metadata, etc) that doesn't survive summarisation.
//
// The one-shot router uses this to decide tiny/small BEFORE any Gemini
// calls run, so it can skip ingest entirely on the hot path. The agreed
// one-shot envelope is `rows <= 5 AND bytes <= 50KB` — everything inside
// that goes through a single Flash call; anything bigger stays staged.
// Inside the envelope we still distinguish tiny from small so the budget
// scales the output size appropriately.
export function pickTierFromRows(rows: SourceRow[]): Tier {
  const count = rows.length;
  const bytes = rows.reduce((n, r) => n + r.byteSize, 0);
  if (count <= 2  && bytes <=  15_000)  return "tiny";
  if (count <= 5  && bytes <=  50_000)  return "small";
  if (count <= 80 && bytes < 1_500_000) return "medium";
  return "large";
}

// Convert a word target to a generateContent output-token budget. Rule of
// thumb: 1 token ≈ 0.75 words, plus overhead for JSON wrapping, wikilinks,
// and Flash/Pro padding. Rounds up to a 1024 multiple for tidiness and
// clamps to Pro's 8192 hard ceiling on our existing call sites.
export function wordsToOutputTokens(maxWords: number, overhead = 512): number {
  const raw = Math.ceil(maxWords * 1.6) + overhead;
  const rounded = Math.ceil(raw / 1024) * 1024;
  return Math.max(1024, Math.min(8192, rounded));
}

// Map a budget's model tier to the actual Gemini model id. Single place
// to toggle the tiny/small → Flash routing (Lever 3). Imported by every
// Pro-call site in structure.ts, stories.ts, and oneshot.ts.
export function modelForBudget(budget: InputBudget): string {
  return budget.model === "flash" ? MODEL_FLASH : MODEL_PRO;
}
