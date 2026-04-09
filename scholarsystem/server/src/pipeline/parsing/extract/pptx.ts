// PPTX extractor.
//
// Uses officeparser's AST. Slide boundaries are the most important
// structural cue in a deck — each slide is typically one idea — so we
// walk the content tree, group nodes by their slide metadata, and emit a
// "## Slide N" markdown section per slide. Stage 1's structural analysis
// sees real topic/subtopic boundaries instead of one flat blob.
//
// If the AST doesn't expose slide metadata (unlikely but defensive), we
// fall back to `ast.toText()` unchanged.

import type { Extracted } from "./types";
import { parseOffice } from "officeparser";

export async function extractPptx(buf: Buffer, _filename: string): Promise<Extracted> {
  const ast = await parseOffice(buf);

  // Group nodes by slide number via their metadata. We treat the AST as
  // loose structured data because officeparser's node-typing is broad and
  // we only need one field per node.
  const bySlide = new Map<number, string[]>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as { metadata?: { slideNumber?: number }; text?: string; content?: unknown[] };
    const slide = n.metadata?.slideNumber;
    if (typeof slide === "number" && typeof n.text === "string" && n.text.trim()) {
      if (!bySlide.has(slide)) bySlide.set(slide, []);
      bySlide.get(slide)!.push(n.text.trim());
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk((ast as unknown as { content: unknown[] }).content);

  if (bySlide.size === 0) {
    const fallback = String((ast as unknown as { toText?: () => string }).toText?.() ?? "").trim();
    return { text: fallback };
  }

  const slideNumbers = [...bySlide.keys()].sort((a, b) => a - b);
  const sections = slideNumbers.map((n) => {
    const body = bySlide.get(n)!.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return `## Slide ${n}\n\n${body}`;
  });
  const text = sections.join("\n\n");

  // Title: first line of slide 1 if present.
  const firstSlideText = bySlide.get(slideNumbers[0])?.[0] ?? "";
  const title = firstSlideText ? firstSlideText.slice(0, 80) : undefined;

  return { text, title };
}
