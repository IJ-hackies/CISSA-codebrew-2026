// Extractor dispatcher.
//
// One entry point for turning an uploaded file buffer into plain text +
// optional title + a `source.kind` tag. Stage 0 (`runIngest`) remains pure
// text-in; extraction happens here, one step upstream, so the pipeline
// itself doesn't need to know anything about file formats.
//
// Allowlist lives in `types.ts` as EXTENSION_TO_KIND. To add a new format:
//   1. Add an extractor file in this directory.
//   2. Register its extension in EXTENSION_TO_KIND.
//   3. Add a dispatch case below.
//   4. Mirror the extension in `client/src/lib/fileTypes.ts`.

import type { SourceKind } from "@scholarsystem/shared";
import type { Extracted } from "./types";
import { EXTENSION_TO_KIND, UnsupportedFormatError } from "./types";
import { extractMarkdown } from "./markdown";
import { extractPdf, type PdfExtracted } from "./pdf";
import { extractDocx } from "./docx";
import { extractPptx } from "./pptx";

export { UnsupportedFormatError, EXTENSION_TO_KIND } from "./types";
export type { Extracted } from "./types";
export type { PdfExtracted } from "./pdf";

export interface ExtractResult extends Extracted {
  kind: SourceKind;
  /** Present only for PDF extractions — PNG images of each page. */
  pageImages?: PdfExtracted["pageImages"];
}

export interface FileInput {
  buf: Buffer;
  name: string;
}

/**
 * Run `extractFile` across a batch in parallel. Order of the returned
 * array matches the order of `files`, so callers can zip with per-file
 * metadata (size, index) afterwards. Any single extraction failure
 * rejects the whole batch — partial extraction is not a useful state
 * for the pipeline and hiding some files would mislead the user.
 */
export async function extractFiles(files: FileInput[]): Promise<ExtractResult[]> {
  return Promise.all(files.map((f) => extractFile(f.buf, f.name)));
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i).toLowerCase();
}

/**
 * Extract a file's text content. Throws `UnsupportedFormatError` if the
 * extension isn't in the allowlist. Individual extractors may throw their
 * own errors (corrupt file, parser failure) — callers should surface
 * those as 4xx at the HTTP boundary.
 */
export async function extractFile(buf: Buffer, filename: string): Promise<ExtractResult> {
  const ext = extOf(filename);
  const kind = EXTENSION_TO_KIND[ext];
  if (!kind) throw new UnsupportedFormatError(filename);

  let out: Extracted;
  switch (kind) {
    case "text":
      out = { text: buf.toString("utf8") };
      break;
    case "markdown":
      out = await extractMarkdown(buf, filename);
      break;
    case "pdf":
      out = await extractPdf(buf, filename);
      break;
    case "docx":
      out = await extractDocx(buf, filename);
      break;
    case "pptx":
      out = await extractPptx(buf, filename);
      break;
    // "paste" is an inline-textarea path; it never reaches the extractor.
    default:
      throw new UnsupportedFormatError(filename);
  }

  return { ...out, kind };
}
