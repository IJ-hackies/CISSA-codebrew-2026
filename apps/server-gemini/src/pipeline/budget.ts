// Input-proportional sizing. Computes a single galaxy-wide "budget" once
// after ingest, from the total volume of source summaries, and every
// downstream stage reads counts + word targets from it. Replaces the old
// hardcoded "1500-3000 words per planet, 3-7 systems" regardless of input.
//
// Tier is chosen by BOTH source count and total summary char count, so a
// 2-file upload of huge PDFs ends up "medium", not "tiny".

import type { PipelineContext } from "./context";

export type Tier = "tiny" | "small" | "medium" | "large";

export interface Range {
  min: number;
  max: number;
}

export interface InputBudget {
  tier: Tier;
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
const TIERS: Record<Tier, Omit<InputBudget, "sourceCount" | "totalSourceChars">> = {
  tiny: {
    tier: "tiny",
    solarSystems:         { min: 1, max: 1 },
    planetsPerSystem:     { min: 2, max: 4 },
    conceptsPerSystem:    { min: 1, max: 3 },
    stories:              { min: 1, max: 1 },
    storyScenes:          { min: 2, max: 3 },
    planetBodyWords:      { min: 200, max: 500 },
    conceptBodyWords:     { min: 150, max: 350 },
    solarSystemBodyWords: { min: 80,  max: 200 },
    storyIntroWords:      { min: 150, max: 300 },
    sceneWords:           { min: 150, max: 300 },
    conclusionWords:      { min: 100, max: 200 },
  },
  small: {
    tier: "small",
    solarSystems:         { min: 1, max: 2 },
    planetsPerSystem:     { min: 3, max: 6 },
    conceptsPerSystem:    { min: 2, max: 4 },
    stories:              { min: 1, max: 2 },
    storyScenes:          { min: 3, max: 5 },
    planetBodyWords:      { min: 400, max: 900 },
    conceptBodyWords:     { min: 250, max: 600 },
    solarSystemBodyWords: { min: 120, max: 280 },
    storyIntroWords:      { min: 250, max: 500 },
    sceneWords:           { min: 250, max: 500 },
    conclusionWords:      { min: 150, max: 300 },
  },
  medium: {
    tier: "medium",
    solarSystems:         { min: 2, max: 5 },
    planetsPerSystem:     { min: 5, max: 8 },
    conceptsPerSystem:    { min: 3, max: 5 },
    stories:              { min: 2, max: 4 },
    storyScenes:          { min: 4, max: 7 },
    planetBodyWords:      { min: 800, max: 1800 },
    conceptBodyWords:     { min: 500, max: 1000 },
    solarSystemBodyWords: { min: 180, max: 380 },
    storyIntroWords:      { min: 350, max: 700 },
    sceneWords:           { min: 350, max: 600 },
    conclusionWords:      { min: 250, max: 450 },
  },
  large: {
    tier: "large",
    solarSystems:         { min: 3, max: 7 },
    planetsPerSystem:     { min: 5, max: 10 },
    conceptsPerSystem:    { min: 4, max: 7 },
    stories:              { min: 3, max: 6 },
    storyScenes:          { min: 5, max: 10 },
    planetBodyWords:      { min: 1500, max: 3000 },
    conceptBodyWords:     { min: 600, max: 1500 },
    solarSystemBodyWords: { min: 220, max: 500 },
    storyIntroWords:      { min: 400, max: 900 },
    sceneWords:           { min: 400, max: 800 },
    conclusionWords:      { min: 300, max: 600 },
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

// Tier by the tighter of (count, chars) — a 2-source upload of 200KB of
// summary is "medium", not "tiny". Thresholds are picked so the 500-file
// test (which lands in "large") matches pre-pivot behavior exactly.
function pickTier(count: number, chars: number): Tier {
  if (count <= 3  && chars <  6_000)  return "tiny";
  if (count <= 15 && chars < 40_000)  return "small";
  if (count <= 80 && chars < 250_000) return "medium";
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
