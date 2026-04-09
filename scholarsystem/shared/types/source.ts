import { z } from "zod";

// Provenance of the input. Not the raw input itself — that is discarded
// after extraction per ABOUT.md. Kept so that debugging a bad pipeline
// run doesn't require digging through logs to find what went in.
// "text" = plain-text file upload (.txt)
// "paste" = inline textarea paste (no file)
// "markdown" / "pdf" / "docx" / "pptx" = format-specific file uploads,
// extracted to plain text by the extractor module before Stage 0 sees them.
// "mixed" = multi-file upload (possibly plus pasted text) concatenated
//           into a single blob at the route boundary; per-part provenance
//           lives in `Source.parts`.
// Widening this enum is non-breaking per SCHEMA.md — existing blobs with
// kind "text" | "pdf" | "paste" still validate.
export const SourceKind = z.enum([
  "text",
  "paste",
  "markdown",
  "pdf",
  "docx",
  "pptx",
  "mixed",
]);

// Per-part provenance for multi-input uploads. Optional — single-input
// ingests leave `Source.parts` undefined and keep the top-level
// `kind`/`filename`/`contentHash` fields as the whole story. When present,
// every element describes one file (or the inline "paste" pseudo-part)
// that was concatenated into the final input blob.
export const SourcePart = z.object({
  kind: SourceKind,
  filename: z.string().nullable(),
  byteSize: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  contentHash: z.string(),
});

export const Source = z.object({
  kind: SourceKind,
  filename: z.string().nullable(),
  byteSize: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  contentHash: z.string(), // sha256 hex, enables dedup later
  excerpt: z.string(),     // first ~500 chars, for debugging only
  // Populated only for multi-input ("mixed") ingests. Optional field —
  // adding it is non-breaking; existing blobs parse unchanged.
  parts: z.array(SourcePart).optional(),
});

export type Source = z.infer<typeof Source>;
export type SourceKind = z.infer<typeof SourceKind>;
export type SourcePart = z.infer<typeof SourcePart>;
