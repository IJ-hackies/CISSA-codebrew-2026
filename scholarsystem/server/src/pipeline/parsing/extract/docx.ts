// DOCX extractor.
//
// Uses mammoth's `convertToHtml` to preserve heading structure, then does
// a minimal HTML → markdown pass for just the tags we care about (h1-h6,
// p, li). Stage 1's structural analysis leans heavily on heading cues, so
// `extractRawText` (which flattens everything) would throw away signal
// Claude would then have to re-infer. We deliberately avoid pulling in a
// full HTML-to-markdown dependency — the tag set we need is tiny.

import type { Extracted } from "./types";
import mammoth from "mammoth";

export async function extractDocx(buf: Buffer, _filename: string): Promise<Extracted> {
  const result = await mammoth.convertToHtml({ buffer: buf });
  const html = result.value;

  // Tag-by-tag rewrite. Order matters: handle headings before generic <p>.
  let md = html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip every remaining tag.
    .replace(/<[^>]+>/g, "")
    // Decode the HTML entities mammoth actually emits.
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse runs of blank lines.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const headingMatch = md.match(/^#\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1].trim().slice(0, 80) : undefined;

  return { text: md, title };
}
