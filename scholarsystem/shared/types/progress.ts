import { z } from "zod";
import { Slug } from "./ids";

// User progress state. The ONLY frequently-mutable scope — every other
// scope is write-once or append-only. If we ever need to scale beyond a
// single-blob-per-galaxy storage model, progress is the clean split point.
// Only knowledge-bearing bodies are tracked; decorative bodies have no
// progress state.

export const Attempt = z.object({
  at: z.number().int(),
  score: z.number().min(0).max(1),
  chosenOptionId: z.string(),
});

export const BodyProgress = z.object({
  visited: z.boolean(),
  attemptCount: z.number().int().nonnegative(),
  bestScore: z.number().min(0).max(1).nullable(),
  lastScore: z.number().min(0).max(1).nullable(),
  hintsUsed: z.number().int().nonnegative(),
  timeSpentMs: z.number().int().nonnegative(),
  masteryEstimate: z.number().min(0).max(1),
  // Full history so the feedback loop can see which distractors were
  // picked, not just the final score.
  attempts: z.array(Attempt),
});

export const Progress = z.object({
  bodies: z.record(Slug, BodyProgress),
  totalBodies: z.number().int().nonnegative(),
  visitedCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  overallMastery: z.number().min(0).max(1),
});

export type Progress = z.infer<typeof Progress>;
export type BodyProgress = z.infer<typeof BodyProgress>;
export type Attempt = z.infer<typeof Attempt>;
