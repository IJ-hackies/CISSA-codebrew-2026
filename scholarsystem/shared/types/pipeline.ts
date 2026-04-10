import { z } from "zod";

export const StageStatus = z.enum(["pending", "running", "complete", "error"]);

export const StageState = z.object({
  status: StageStatus,
  startedAt: z.number().int().nullable(),
  completedAt: z.number().int().nullable(),
  error: z.string().nullable(),
});

export const Pipeline = z.object({
  ingest: StageState,
  structure: StageState,
  wraps: StageState,
  coverage: StageState,
});

export type StageStatus = z.infer<typeof StageStatus>;
export type StageState = z.infer<typeof StageState>;
export type Pipeline = z.infer<typeof Pipeline>;
