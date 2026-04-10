// PDF extractor — renders pages to PNG images for vision-based processing.
//
// PDFs with rendered math (LaTeX), diagrams, or complex layouts lose
// critical content when extracted as text-only. This extractor:
//   1. Extracts a basic text layer as fallback via pdfjs
//   2. Renders each page as a PNG image
//
// The page images are returned alongside the text. The pipeline pushes
// them into the proxy workspace so Claude Code's Read tool (which
// supports vision) can see the full visual content during Stage 1.
// No metered API calls — the vision happens inside the Claude Code
// session that's already running.

import type { Extracted } from "./types";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

export interface PdfExtracted extends Extracted {
  /** PNG images of each page, for vision-based processing in Claude Code. */
  pageImages: { page: number; png: Buffer }[];
}

export async function extractPdf(buf: Buffer, _filename: string): Promise<PdfExtracted> {
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await getDocumentProxy(data);
  const pageCount = doc.numPages;

  // Render pages to PNG images.
  const pageImages: { page: number; png: Buffer }[] = [];
  for (let i = 1; i <= pageCount; i++) {
    try {
      const result = await renderPageAsImage(doc, i, { scale: 2 });
      pageImages.push({ page: i, png: Buffer.from(result) });
    } catch {
      console.warn(`[pdf] failed to render page ${i}, skipping`);
    }
  }

  // Also extract text layer as fallback / supplement.
  let textContent = "";
  for (let i = 1; i <= pageCount; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: unknown): item is { str: string } => "str" in (item as object))
        .map((item: { str: string }) => item.str)
        .join(" ");
      if (pageText.trim()) {
        textContent += (textContent ? "\n\n" : "") + pageText;
      }
    } catch {
      console.warn(`[pdf] failed to extract text from page ${i}`);
    }
  }

  const title = deriveTitle(textContent);
  return { text: textContent.trim(), title, pageImages };
}

function deriveTitle(text: string): string | undefined {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return undefined;
  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  return cleaned.slice(0, 80) || undefined;
}
