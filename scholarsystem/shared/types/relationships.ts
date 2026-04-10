import { z } from "zod";
import { ChapterId, Slug } from "./ids";

export const EdgeType = z.enum([
  "related",
  "references",
  "temporal",
  "causal",
  "contrasts",
  "involves",
]);

export const RelationshipEdge = z.object({
  id: Slug,
  source: Slug,
  target: Slug,
  type: EdgeType,
  label: z.string().optional(),
  weight: z.number().min(0).max(1),
  sourceRefs: z.array(Slug).min(1),
  chapter: ChapterId,
});

export const Relationships = z.object({
  edges: z.array(RelationshipEdge),
});

export type EdgeType = z.infer<typeof EdgeType>;
export type RelationshipEdge = z.infer<typeof RelationshipEdge>;
export type Relationships = z.infer<typeof Relationships>;
