import { z } from "zod";
import { Slug } from "./ids";

// Flat graph of cross-node edges. Not nested inside knowledge because
// nesting causes ordering/duplication headaches. Powers warp lanes on
// the galaxy map and the feedback loop in scene generation. Edges may
// cross chapters — a week-2 concept linking back to a week-1 concept
// via `[[w1-energy-flow]]` compiles into a relationship edge here and
// is a first-class mechanism for making chapter extensions feel earned.
export const RelationshipKind = z.enum([
  "prerequisite",
  "related",
  "contrasts",
  "example-of",
]);

export const Relationship = z.object({
  from: Slug,
  to: Slug,
  kind: RelationshipKind,
  // Which numbered source units justify this edge. Required, like all
  // derived artifacts, so the coverage auditor sees edges too.
  sourceRefs: z.array(Slug).min(1),
});

export const Relationships = z.array(Relationship);

export type Relationship = z.infer<typeof Relationship>;
export type Relationships = z.infer<typeof Relationships>;
export type RelationshipKind = z.infer<typeof RelationshipKind>;
