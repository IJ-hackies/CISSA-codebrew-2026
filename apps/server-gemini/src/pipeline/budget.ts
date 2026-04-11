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
//
// solarSystems ranges were widened in 2026-04-12 after segmentation-during-
// ingest landed — a single large PDF now fans out into multiple virtual
// sources, so even "small" tier uploads deserve 2+ systems.
const TIERS: Record<Tier, Omit<InputBudget, "sourceCount" | "totalSourceChars">> = {
  tiny: {
    tier: "tiny",
    model: "flash",
    solarSystems:         { min: 1, max: 2 },
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
    model: "flash",
    solarSystems:         { min: 2, max: 4 },
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
    model: "pro",
    solarSystems:         { min: 3, max: 6 },
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
    model: "pro",
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

// totalInputBytes is the raw on-disk size of the uploaded source files
// (NOT summary length — summaries compress a 50-page PDF into ~1KB of
// text and would mis-tier the galaxy into "tiny"). Callers compute it
// from SourceRow.byteSize in runStagedPipeline and thread it in.
export function computeInputBudget(
  ctx: PipelineContext,
  totalInputBytes: number,
): InputBudget {
  const sourceCount = ctx.sources.length;
  const totalSourceChars = ctx.sources.reduce((n, s) => n + s.summary.length, 0);

  const tier = pickTier(sourceCount, totalInputBytes);
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

// Tier by raw INPUT BYTES (not summary length). The previous version
// used summary.length which is a terrible proxy — a 50-page PDF summarizes
// down to ~1KB of text and used to land in "tiny" regardless of its
// actual content weight. Bytes is the honest signal.
//
// count is the post-segmentation virtual source count (long files have
// already fanned out into multiple ctx.sources entries by the time this
// runs), so an N-segment PDF counts as N here.
function pickTier(count: number, bytes: number): Tier {
  if (count <= 2  && bytes <    20_000) return "tiny";
  if (count <= 8  && bytes <   200_000) return "small";
  if (count <= 30 && bytes < 1_500_000) return "medium";
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
