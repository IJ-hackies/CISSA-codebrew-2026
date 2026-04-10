import { z } from "zod";

// Per-stage status for the streaming UI. Frontend reads this to drive
// "watch your galaxy form" — stars appear as structure completes, planets
// texture as visuals complete, etc. Also the source of truth for what
// scopes are ready to render — never derive completeness from scope
// contents, always check here.
//
// Scene generation is on-demand (not a stage) so it doesn't appear here.

export const StageStatus = z.enum(["pending", "running", "done", "error"]);

export const StageState = z.object({
  status: StageStatus,
  progress: z.number().min(0).max(1),
  startedAt: z.number().int().nullable(),
  finishedAt: z.number().int().nullable(),
  error: z.string().nullable(),
});

// Stage names mirror the pipeline in SCHEMA.md. `coverageAudit` is the
// pure-code uncited-unit diff plus targeted gap-audit Claude call that
// runs between detail and narrative — it's the accuracy backstop, so
// it gets its own status entry rather than being hidden inside detail.
export const Pipeline = z.object({
  ingest: StageState,
  structure: StageState,
  detail: StageState,
  coverageAudit: StageState,
  narrative: StageState,
  layout: StageState,
  visuals: StageState,
});

export type Pipeline = z.infer<typeof Pipeline>;
export type StageState = z.infer<typeof StageState>;
export type StageStatus = z.infer<typeof StageStatus>;
