// Stage 1 — Ingest. For each uploaded source file, produce a structured
// summary via Gemini and write a `(Source) Title.md` file to the mesh.
// Files that are natively multimodal (PDFs, images) go through inlineData;
// anything text-like is decoded and sent as a text part.
//
// Three improvements over the original fixed-concurrency design:
//
//   1. MODEL TIERING — each file picks its model by mime + size:
//        tiny text        → gemini-2.5-flash-lite  (cheapest/fastest)
//        normal text      → gemini-2.5-flash       (default)
//        big text / big PDF→ gemini-3-flash-preview (big input window)
//      so a 500-file run of small text files doesn't pay Flash prices.
//
//   2. WEIGHTED CONCURRENCY — admission goes through a byte-budget
//      limiter. Small files pack densely; a handful of huge PDFs are
//      bounded by total in-flight weight instead of a fixed count.
//      Tunable via INGEST_BYTE_BUDGET_MB and INGEST_MAX_CONCURRENT env.
//
//   3. SIZE-PROPORTIONAL SUMMARY TARGETS — the prompt and maxOutputTokens
//      scale with the file's own size, so a 1KB text file doesn't get a
//      300-word novella summary with a 8192-token budget.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  generateJson,
  inlineFile,
  MODEL_FLASH,
  MODEL_FLASH_LITE,
  MODEL_FLASH_PREVIEW,
  type LlmPart,
} from "./gemini";
import { createWeightedLimiter, mapWeightedTolerant } from "../lib/weighted-limiter";
import { galaxyPaths } from "../workspace/layout";
import { writeSource } from "../workspace/write";
import type { SourceRow } from "../db/client";
import type { PipelineContext, SourceCtx } from "./context";

// ── Schema for structured summary output ───────────────────────────

const sourceSummarySchema = z.object({
  title: z.string().min(1).max(200),
  // Lowered from 100 → 30 so tiny files don't trip schema validation.
  // Prompt still targets size-appropriate length per-file.
  summary: z.string().min(30),
  keyThemes: z.array(z.string()).min(1).max(10),
  notableDetails: z.array(z.string()).min(0).max(10),
  tone: z.string().min(1).max(200),
});

const sourceSummaryJsonSchema = {
  type: "object",
  required: ["title", "summary", "keyThemes", "notableDetails", "tone"],
  properties: {
    title: { type: "string", description: "Short descriptive title for the source (2-8 words)" },
    summary: {
      type: "string",
      description:
        "A rich summary of the document. Cover what it is, key themes, notable details, and tone. Length should match the document — very short inputs get short summaries, long inputs get multi-paragraph summaries.",
    },
    keyThemes: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 10,
      description: "1-10 short theme phrases",
    },
    notableDetails: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    tone: { type: "string", description: "One short phrase describing the tone" },
  },
};

// ── Mime routing ────────────────────────────────────────────────────

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
  "text/xml",
  "application/xml",
]);

function isTextMime(mime: string): boolean {
  return TEXT_MIMES.has(mime) || mime.startsWith("text/");
}

// Per-file model selection. Keeps the big-input-window preview model for
// the files that actually need it and routes everything else to cheaper
// tiers.
function pickModel(size: number, mime: string): string {
  if (isTextMime(mime)) {
    if (size < 5 * 1024)         return MODEL_FLASH_LITE;
    if (size > 200 * 1024)       return MODEL_FLASH_PREVIEW;
    return MODEL_FLASH;
  }
  // Multimodal: images stay on Flash (cheap, no real size pressure).
  // PDFs over ~2MB get the preview model's big input window.
  if (mime === "application/pdf" && size > 2 * 1024 * 1024) return MODEL_FLASH_PREVIEW;
  return MODEL_FLASH;
}

// Scale the summary word target with the file size. A 1KB file gets a
// 30-80 word summary, a 200KB+ file gets a multi-paragraph summary.
// Returned targets flow into both the prompt text and maxOutputTokens.
interface SummaryTarget {
  minWords: number;
  maxWords: number;
  maxOutputTokens: number;
}

function summaryTarget(size: number): SummaryTarget {
  if (size < 2 * 1024)    return { minWords: 30,  maxWords: 80,  maxOutputTokens: 512  };
  if (size < 20 * 1024)   return { minWords: 80,  maxWords: 200, maxOutputTokens: 1024 };
  if (size < 200 * 1024)  return { minWords: 180, maxWords: 400, maxOutputTokens: 2048 };
  return                       { minWords: 300, maxWords: 700, maxOutputTokens: 4096 };
}

// Weight function for the byte-budget limiter. Bytes-on-disk lies for
// multimodal (Gemini charges per token, not per byte), so we use flat
// floors for images and PDFs. Text is the one case where byte size
// roughly tracks token cost.
function ingestWeight(size: number, mime: string): number {
  if (isTextMime(mime))          return Math.max(2 * 1024, size);
  if (mime.startsWith("image/")) return 64 * 1024;           // flat — image cost is ~fixed
  if (mime === "application/pdf") return Math.max(256 * 1024, size);
  return Math.max(64 * 1024, size);
}

// Env-driven concurrency dials. Defaults chosen for ~500 tiny text files:
// the 24MB budget is never the binding constraint, so the 32 count cap
// wins — 32-parallel on small Flash calls is a big speedup over 6 without
// tripping per-minute quota. For a heavy PDF batch the 24MB budget kicks
// in and holds in-flight weight down naturally.
function ingestLimiterOpts() {
  const maxMB = Number(process.env.INGEST_BYTE_BUDGET_MB ?? 24);
  const maxConcurrent = Number(process.env.INGEST_MAX_CONCURRENT ?? 32);
  return {
    maxWeight: Math.max(1, Math.floor(maxMB * 1024 * 1024)),
    maxConcurrent: Math.max(1, Math.floor(maxConcurrent)),
  };
}

function buildParts(
  buf: Buffer,
  mimeType: string,
  filename: string,
  target: SummaryTarget,
): LlmPart[] {
  const header: LlmPart = {
    text: [
      `You are summarizing an uploaded source file for a knowledge-galaxy pipeline.`,
      ``,
      `Filename: ${filename}`,
      `Mime type: ${mimeType}`,
      ``,
      `Return a structured JSON summary of this document. Follow the schema exactly.`,
      ``,
      `TARGET LENGTH: ${target.minWords}-${target.maxWords} words. Match the density of the input — do NOT pad short documents into long summaries. Preserve concrete details — names, numbers, examples, quotations. Do not hedge. Do not add meta commentary.`,
    ].join("\n"),
  };

  if (isTextMime(mimeType)) {
    // Truncate very long text to keep us well under the context window.
    const text = buf.toString("utf8").slice(0, 200_000);
    return [header, { text: `\n\n--- BEGIN SOURCE TEXT ---\n${text}\n--- END SOURCE TEXT ---` }];
  }

  return [header, inlineFile(buf, mimeType)];
}

// ── Stage entry ────────────────────────────────────────────────────

export async function runIngestStage(
  ctx: PipelineContext,
  sourceRows: SourceRow[],
): Promise<void> {
  const paths = galaxyPaths(ctx.galaxyId);
  const limiter = createWeightedLimiter(ingestLimiterOpts());

  // Resolve file sizes up-front so weight + model + target can all key
  // off the same number without re-stat'ing inside the fan-out.
  const prepared = sourceRows.map((row) => {
    const absPath = join(paths.mediaSources, row.mediaPath);
    const buf = readFileSync(absPath);
    return { row, buf, size: buf.length };
  });

  const { results, failed } = await mapWeightedTolerant(
    prepared,
    limiter,
    "ingest",
    (item) => ingestWeight(item.size, item.row.mimeType),
    async ({ row, buf, size }) => {
      const target = summaryTarget(size);
      const model = pickModel(size, row.mimeType);
      const parts = buildParts(buf, row.mimeType, row.filename, target);

      const summary = await generateJson({
        model,
        parts,
        schema: sourceSummarySchema,
        jsonSchema: sourceSummaryJsonSchema,
        temperature: 0.4,
        maxOutputTokens: target.maxOutputTokens,
      });

      const sourceCtx: SourceCtx = {
        id: randomUUID(),
        title: summary.title,
        filename: row.filename,
        mediaRef: `sources/${row.mediaPath}`,
        summary: summary.summary,
        keyThemes: summary.keyThemes,
        notableDetails: summary.notableDetails,
        tone: summary.tone,
      };

      writeSource(ctx.galaxyId, {
        id: sourceCtx.id,
        title: sourceCtx.title,
        filename: sourceCtx.filename,
        mediaRef: sourceCtx.mediaRef,
        body: sourceCtx.summary,
      });

      return sourceCtx;
    },
  );

  if (failed > 0) {
    console.warn(
      `[ingest] ${failed}/${sourceRows.length} file(s) failed after retry — continuing with ${results.length} successful source(s)`,
    );
  }
  if (results.length === 0) {
    throw new Error(`ingest: all ${sourceRows.length} sources failed`);
  }
  ctx.sources.push(...results);
}
