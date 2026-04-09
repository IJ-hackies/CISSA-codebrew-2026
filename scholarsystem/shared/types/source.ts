import { z } from "zod";

// Provenance of the input. Not the raw input itself — that is discarded
// after extraction per ABOUT.md. Kept so that debugging a bad pipeline
// run doesn't require digging through logs to find what went in.
export const SourceKind = z.enum(["text", "pdf", "paste"]);

export const Source = z.object({
  kind: SourceKind,
  filename: z.string().nullable(),
  byteSize: z.number().int().nonnegative(),
  charCount: z.number().int().nonnegative(),
  contentHash: z.string(), // sha256 hex, enables dedup later
  excerpt: z.string(),     // first ~500 chars, for debugging only
});

export type Source = z.infer<typeof Source>;
export type SourceKind = z.infer<typeof SourceKind>;
