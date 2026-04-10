import { z } from "zod";
import { Meta } from "./meta";
import { Source } from "./source";
import { Knowledge } from "./knowledge";
import { Relationships } from "./relationships";
import { Wraps } from "./wraps";
import { Exploration } from "./exploration";
import { Pipeline } from "./pipeline";

// The top-level galaxy blob. Single object stored as a JSON value in
// SQLite keyed by meta.id. Every field is always present in the shape
// sense — inner scopes may be null (not yet produced) or empty (valid
// empty state). The `pipeline` scope is the source of truth for what is
// ready to render; never derive readiness from whether a scope is null.
//
// Mutability zones:
//   immutable:    meta.id, meta.createdAt, existing source units
//   append-only:  meta.chapters[], knowledge.clusters/groups/entries,
//                 relationships.edges[], wraps (existing wraps frozen)
//   mutable:      exploration, pipeline, meta.updatedAt, meta.title
export const Galaxy = z.object({
  meta: Meta,
  source: Source,
  knowledge: Knowledge.nullable(),
  relationships: Relationships,
  wraps: Wraps,
  exploration: Exploration,
  pipeline: Pipeline,
});

export type Galaxy = z.infer<typeof Galaxy>;
