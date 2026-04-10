import { z } from "zod";
import { ChapterId, Slug } from "./ids";

// Deep per-concept content produced by Stage 2. Separated from the
// knowledge tree so the galaxy map can render on Stage 1 output alone
// without waiting for detail extraction to finish.
//
// `sourceRefs` is mandatory (`.min(1)`): every detail entry must cite
// the numbered source units it was drawn from. The Stage 2.5 coverage
// auditor reads these to compute uncited units and close gaps.
export const ConceptDetail = z.object({
  conceptId: Slug,
  chapter: ChapterId,
  fullDefinition: z.string(),
  formulas: z.array(z.string()),
  workedExamples: z.array(z.string()),
  edgeCases: z.array(z.string()),
  mnemonics: z.array(z.string()),
  emphasisMarkers: z.array(z.string()), // "the lecturer stressed this"
  sourceQuotes: z.array(z.string()),    // verbatim excerpts from input
  sourceRefs: z.array(Slug).min(1),
  extractedAt: z.number().int(),
});

// Keyed by concept id. Missing keys are valid during partial population.
export const Detail = z.record(Slug, ConceptDetail);

export type ConceptDetail = z.infer<typeof ConceptDetail>;
export type Detail = z.infer<typeof Detail>;
