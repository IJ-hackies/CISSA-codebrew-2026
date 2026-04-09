import { z } from "zod";
import { Meta } from "./meta";
import { Source } from "./source";
import { Knowledge } from "./knowledge";
import { Detail } from "./detail";
import { Relationships } from "./relationships";
import { Narrative } from "./narrative";
import { Spatial } from "./spatial";
import { Visuals } from "./visuals";
import { Scenes } from "./scenes";
import { Conversations } from "./conversations";
import { Progress } from "./progress";
import { Pipeline } from "./pipeline";

// The top-level galaxy blob. Single object stored as a JSON value in
// SQLite keyed by meta.id. Every field is always present in the shape
// sense — inner scopes may be null (not yet produced) or empty (valid
// empty state). The `pipeline` scope is the source of truth for what is
// ready to render; never derive readiness from whether a scope is null.
//
// Mutability zones:
//   write-once: meta.id/createdAt, source, knowledge, detail,
//               relationships, narrative, spatial, visuals
//   append-only: scenes, conversations (turns appended, never mutated)
//   mutable:    progress, pipeline, meta.updatedAt, meta.title
export const Galaxy = z.object({
  meta: Meta,
  source: Source,
  knowledge: Knowledge.nullable(),   // Stage 1
  detail: Detail,                     // Stage 2 — starts {}
  relationships: Relationships,       // Stage 1 — starts []
  narrative: Narrative.nullable(),   // Stage 3
  spatial: Spatial.nullable(),       // Stage 4
  visuals: Visuals,                   // Stage 5 — starts {}
  scenes: Scenes,                     // on-demand — starts {}
  conversations: Conversations,       // on-demand — starts {} (reserved; chat not yet implemented)
  progress: Progress,                 // mutable throughout
  pipeline: Pipeline,
});

export type Galaxy = z.infer<typeof Galaxy>;
