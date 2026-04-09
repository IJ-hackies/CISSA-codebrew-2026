// Markdown extractor.
//
// Markdown is already plain text that Claude reads natively, so we pass it
// through untouched — heading levels (`#`, `##`, ...) are actively useful
// to Stage 1's structural analysis. We only:
//   1. Strip a YAML frontmatter block if present (Jekyll/Obsidian habit).
//   2. Pull a title from the first `# heading` if one exists.
//
// Do NOT flatten to plain text. Preserving the markdown gives Stage 1
// stronger topic/subtopic signals than a sea of bare paragraphs.

import type { Extracted } from "./types";

export async function extractMarkdown(buf: Buffer, _filename: string): Promise<Extracted> {
  let text = buf.toString("utf8");

  // Strip YAML frontmatter: `---\n...\n---\n` at the very top.
  if (text.startsWith("---")) {
    const end = text.indexOf("\n---", 3);
    if (end !== -1) {
      const afterFence = text.indexOf("\n", end + 4);
      text = afterFence === -1 ? "" : text.slice(afterFence + 1);
    }
  }

  // First `# heading` on its own line becomes the title, if present.
  const headingMatch = text.match(/^#\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1].trim().slice(0, 80) : undefined;

  return { text, title };
}
