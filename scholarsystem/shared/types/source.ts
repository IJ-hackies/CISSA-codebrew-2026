import { z } from "zod";
import { ChapterId, SourceUnitId } from "./ids";

// Provenance of the input plus the stable numbered chunks every
// downstream artifact cites. Raw uploaded bytes are discarded after
// extraction; what survives is: (a) enough metadata to debug a bad
// run and (b) immutable numbered units so the coverage auditor can
// verify "no content silently dropped" mechanically.
//
// A galaxy may ingest many chapters over its lifetime (extensions),
// so this scope is an array of chapters keyed by ChapterId. Existing
// chapter entries and their units are immutable once written; new
// chapters append.

export const SourceKind = z.enum([
  "text",
  "paste",
  "markdown",
  "pdf",
  "docx",
  "pptx",
  "mixed",
]);

// Per-part provenance for multi-input uploads (e.g. several PDFs
// concatenated into one chapter ingest). Single-file ingests leave
// this undefined and let the chapter-level provenance tell the story.
export const SourcePart = z.object({
  kind: SourceKind,
  filename: z.string().nullable(),
  byteSize: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  contentHash: z.string(),
});

// A stable numbered chunk of source text. Minted at Stage 0, cited by
// every derived artifact (knowledge / detail / relationships) via
// `sourceRefs`. The coverage auditor unions those refs and compares
// against the full unit set to prove no content was silently dropped.
//
// Units are immutable once written. Their ids are deterministic:
// `<chapter>-s-<4-digit-seq>`, assigned in document order at ingest.
export const SourceUnit = z.object({
  id: SourceUnitId,
  text: z.string(),
  // Character offsets into the extracted plaintext of the chapter,
  // for future "jump to source" UX and debugging.
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().nonnegative(),
});

// One ingested chapter's worth of provenance + numbered units.
export const SourceChapter = z.object({
  id: ChapterId,
  kind: SourceKind,
  filename: z.string().nullable(),
  byteSize: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  contentHash: z.string(), // sha256 hex of the full concatenated input
  excerpt: z.string(),     // first ~500 chars, debug only
  parts: z.array(SourcePart).optional(), // populated on "mixed" ingests
  units: z.array(SourceUnit),
});

export const Source = z.object({
  chapters: z.array(SourceChapter),
});

export type Source = z.infer<typeof Source>;
export type SourceKind = z.infer<typeof SourceKind>;
export type SourcePart = z.infer<typeof SourcePart>;
export type SourceUnit = z.infer<typeof SourceUnit>;
export type SourceChapter = z.infer<typeof SourceChapter>;
