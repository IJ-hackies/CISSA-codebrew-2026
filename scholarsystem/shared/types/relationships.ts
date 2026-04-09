import { z } from "zod";
import { Slug } from "./ids";

// Flat graph of cross-node edges. Not nested inside knowledge because
// nesting causes ordering/duplication headaches. Powers warp lanes on
// the galaxy map and the feedback loop in scene generation.
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
});

export const Relationships = z.array(Relationship);

export type Relationship = z.infer<typeof Relationship>;
export type Relationships = z.infer<typeof Relationships>;
export type RelationshipKind = z.infer<typeof RelationshipKind>;
