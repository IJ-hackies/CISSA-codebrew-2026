import { z } from "zod";
import { ChapterId, Slug } from "./ids";

// Deep per-concept content produced by Stage 2. Separated from the
// knowledge tree so the galaxy map can render on Stage 1 output alone
// without waiting for detail extraction to finish.
//
// `derivatives` is the load-bearing accuracy primitive: every concept
// carries verbatim quoted passages from the source, grouped by source
// unit. The coverage auditor verifies word-level match against the
// original text — a model cannot hallucinate a passage that matches.
//
// `sourceRefs` and `sourceQuotes` are derived from `derivatives` for
// backward compatibility and convenience.

export const Derivative = z.object({
  sourceRef: Slug,     // which source unit this quote comes from
  quote: z.string(),   // verbatim passage from the source
});

export const ConceptDetail = z.object({
  conceptId: Slug,
  chapter: ChapterId,
  fullDefinition: z.string(),
  derivatives: z.array(Derivative).min(1),  // load-bearing traceability
  formulas: z.array(z.string()),
  workedExamples: z.array(z.string()),
  edgeCases: z.array(z.string()),
  mnemonics: z.array(z.string()),
  emphasisMarkers: z.array(z.string()), // "the lecturer stressed this"
  sourceQuotes: z.array(z.string()),    // derived from derivatives
  sourceRefs: z.array(Slug).min(1),     // derived from derivatives
  extractedAt: z.number().int(),
});

// Keyed by concept id. Missing keys are valid during partial population.
export const Detail = z.record(Slug, ConceptDetail);

export type Derivative = z.infer<typeof Derivative>;
export type ConceptDetail = z.infer<typeof ConceptDetail>;
export type Detail = z.infer<typeof Detail>;
