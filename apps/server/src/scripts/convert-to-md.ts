#!/usr/bin/env bun
/**
 * convert-to-md.ts — Convert any supported file to markdown.
 *
 * Usage:
 *   bun run src/scripts/convert-to-md.ts <file-path>
 *   bun run src/scripts/convert-to-md.ts <file-path> --out <output-path>
 *
 * Supports: .md, .txt, .docx, .pptx, .pdf, .png, .jpg, .jpeg, .gif, .webp
 *
 * For PDF and images, uses Mistral OCR API (requires MISTRAL_API_KEY env var).
 * For DOCX, uses mammoth. For PPTX, uses officeparser.
 *
 * Without --out, prints markdown to stdout.
 */

import { readFile, writeFile } from "fs/promises";
import { extname, basename } from "path";
import { Mistral } from "@mistralai/mistralai";
import mammoth from "mammoth";
import { parseOffice } from "officeparser";

// ---------------------------------------------------------------------------
// DOCX → Markdown (reuses existing extractor logic)
// ---------------------------------------------------------------------------

async function convertDocx(buf: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer: buf });
  return result.value
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n")
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n")
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// PPTX → Markdown (reuses existing extractor logic)
// ---------------------------------------------------------------------------

async function convertPptx(buf: Buffer): Promise<string> {
  const ast = await parseOffice(buf);
  const bySlide = new Map<number, string[]>();

  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as {
      metadata?: { slideNumber?: number };
      text?: string;
      content?: unknown[];
    };
    const slide = n.metadata?.slideNumber;
    if (typeof slide === "number" && typeof n.text === "string" && n.text.trim()) {
      if (!bySlide.has(slide)) bySlide.set(slide, []);
      bySlide.get(slide)!.push(n.text.trim());
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk((ast as unknown as { content: unknown[] }).content);

  if (bySlide.size === 0) {
    return String((ast as unknown as { toText?: () => string }).toText?.() ?? "").trim();
  }

  const slideNumbers = [...bySlide.keys()].sort((a, b) => a - b);
  return slideNumbers
    .map((n) => {
      const body = bySlide.get(n)!.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      return `## Slide ${n}\n\n${body}`;
    })
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// PDF → Markdown (Mistral OCR)
// ---------------------------------------------------------------------------

function getMistralClient(): Mistral {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    console.error("Error: MISTRAL_API_KEY environment variable is required for PDF/image conversion.");
    process.exit(1);
  }
  return new Mistral({ apiKey: key });
}

async function convertPdfWithMistral(buf: Buffer, filename: string): Promise<string> {
  const client = getMistralClient();
  const base64 = buf.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const result = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "document_url",
      documentUrl: dataUrl,
      documentName: filename,
    },
    includeImageBase64: false,
  });

  return result.pages.map((page) => page.markdown).join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Image → Markdown (Mistral OCR)
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

async function convertImageWithMistral(buf: Buffer, filename: string, ext: string): Promise<string> {
  const client = getMistralClient();
  const base64 = buf.toString("base64");
  const mime = MIME_TYPES[ext] ?? "image/png";
  const dataUrl = `data:${mime};base64,${base64}`;

  const result = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "image_url",
      imageUrl: dataUrl,
    },
    includeImageBase64: false,
  });

  return result.pages.map((page) => page.markdown).join("\n\n");
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

async function convertToMarkdown(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);
  const buf = await readFile(filePath);

  switch (ext) {
    case ".md":
    case ".markdown": {
      let text = buf.toString("utf8");
      // Strip YAML frontmatter if present
      if (text.startsWith("---")) {
        const end = text.indexOf("\n---", 3);
        if (end !== -1) {
          const afterFence = text.indexOf("\n", end + 4);
          text = afterFence === -1 ? "" : text.slice(afterFence + 1);
        }
      }
      return text.trim();
    }
    case ".txt":
      return buf.toString("utf8").trim();

    case ".docx":
      return convertDocx(buf);

    case ".pptx":
      return convertPptx(buf);

    case ".pdf":
      return convertPdfWithMistral(buf, name);

    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".webp":
      return convertImageWithMistral(buf, name, ext);

    default:
      // Try as text
      console.error(`Warning: unknown extension "${ext}", treating as plain text`);
      return buf.toString("utf8").trim();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const filePath = args[0];
const outIdx = args.indexOf("--out");
const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

if (!filePath) {
  console.error("Usage: bun run convert-to-md.ts <file-path> [--out <output-path>]");
  process.exit(1);
}

const markdown = await convertToMarkdown(filePath);

if (outPath) {
  await writeFile(outPath, markdown, "utf8");
  console.log(`Converted → ${outPath} (${markdown.length} chars)`);
} else {
  console.log(markdown);
}
