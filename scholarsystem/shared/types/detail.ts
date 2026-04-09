import { z } from "zod";
import { Slug } from "./ids";

// Deep per-concept content produced by Stage 2. Separated from the
// knowledge tree so the galaxy map can render on Stage 1 output alone
// without waiting for detail extraction to finish.
export const ConceptDetail = z.object({
  conceptId: Slug,
  fullDefinition: z.string(),
  formulas: z.array(z.string()),
  workedExamples: z.array(z.string()),
  edgeCases: z.array(z.string()),
  mnemonics: z.array(z.string()),
  emphasisMarkers: z.array(z.string()), // "the lecturer stressed this"
  sourceQuotes: z.array(z.string()),    // verbatim excerpts from input
  extractedAt: z.number().int(),
});

// Keyed by concept id. Missing keys are valid during partial population.
export const Detail = z.record(Slug, ConceptDetail);

export type ConceptDetail = z.infer<typeof ConceptDetail>;
export type Detail = z.infer<typeof Detail>;
