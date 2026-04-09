import { z } from "zod";
import { Slug } from "./ids";

// Fixed three levels: topic -> subtopic -> concept. Deeper source material
// is flattened into this shape. Stored flat with id references rather than
// nested because flat is easier to traverse, partially populate, and diff.

export const ConceptKind = z.enum([
  "definition",
  "formula",
  "example",
  "fact",
  "principle",
  "process",
]);

// Hint to the scene generator for which model tier to use. Assigned by
// Stage 1 based on inherent reasoning complexity of the concept, not its
// importance. Scene gen may override when archetype changes the calculus.
export const ModelTier = z.enum(["light", "standard", "heavy"]);

export const Concept = z.object({
  id: Slug,
  title: z.string(),
  kind: ConceptKind,
  brief: z.string(),         // one-sentence hook, NOT full content
  modelTier: ModelTier,
});

export const Subtopic = z.object({
  id: Slug,
  title: z.string(),
  summary: z.string(),
  conceptIds: z.array(Slug),
});

export const Topic = z.object({
  id: Slug,
  title: z.string(),
  summary: z.string(),
  subtopicIds: z.array(Slug),
});

export const Knowledge = z.object({
  title: z.string(),
  summary: z.string(),
  topics: z.array(Topic),
  subtopics: z.array(Subtopic),
  concepts: z.array(Concept),
  // Concepts that don't belong to any subtopic. These become asteroids in
  // the spatial scope (loose, free-floating) instead of moons.
  looseConceptIds: z.array(Slug),
});

export type Concept = z.infer<typeof Concept>;
export type Subtopic = z.infer<typeof Subtopic>;
export type Topic = z.infer<typeof Topic>;
export type Knowledge = z.infer<typeof Knowledge>;
export type ConceptKind = z.infer<typeof ConceptKind>;
export type ModelTier = z.infer<typeof ModelTier>;
