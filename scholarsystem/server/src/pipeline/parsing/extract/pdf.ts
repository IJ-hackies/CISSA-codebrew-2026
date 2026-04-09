// PDF extractor.
//
// Uses `pdf-parse` v2's class-based API — we instantiate `PDFParse` with
// the raw buffer and call `.getText()` to get the concatenated per-page
// text. (v1's smoke-test-on-import issue and the `lib/pdf-parse.js`
// workaround no longer apply: v2 is a clean ESM rewrite.)
//
// Stage 1 is tolerant of messy whitespace, so we don't re-flow.

import type { Extracted } from "./types";
import { PDFParse } from "pdf-parse";

export async function extractPdf(buf: Buffer, _filename: string): Promise<Extracted> {
  // PDFParse expects a Uint8Array; a Node Buffer IS one, but we pass
  // through a fresh view so no `.subarray` sharing surprises occur.
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").trim();

    // Pull a title from the PDF's /Info metadata if present — purely a
    // nicety; the pipeline will fall back to deriving from the first
    // line when absent.
    let title: string | undefined;
    try {
      const info = await parser.getInfo();
      const metaTitle = (info as unknown as { info?: { Title?: string } }).info?.Title;
      if (typeof metaTitle === "string" && metaTitle.trim()) {
        title = metaTitle.trim().slice(0, 80);
      }
    } catch {
      // Metadata is optional — extraction succeeds without it.
    }

    return { text, title };
  } finally {
    await parser.destroy().catch(() => {});
  }
}
