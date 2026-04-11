// Stage 1 — Ingest. For each uploaded source file, produce a structured
// summary via Gemini and write `(Source) Title.md` file(s) to the mesh.
// Files that are natively multimodal (PDFs, images) go through inlineData;
// anything text-like is decoded and sent as a text part.
//
// Four improvements over the original fixed-concurrency design:
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
//
//   4. TOPIC SEGMENTATION — sources over a size threshold go through a
//      segmented-summary call that returns 2-8 thematic segments instead
//      of a single summary. Each segment becomes its own virtual SourceCtx
//      (sharing parent filename/mediaRef), so the cluster stage sees real
//      topic structure and can split a single hefty file across multiple
//      solar systems. Short files stay on the single-summary path.

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

// ── Segmented summary schema ───────────────────────────────────────
// Long sources get a single call that returns N topic segments instead
// of one summary. Each segment behaves like a standalone SourceCtx
// downstream — the cluster stage partitions over segments, so a single
// 50-page PDF covering five topics can fan out into five solar systems.

const segmentedSummarySchema = z.object({
  overallTitle: z.string().min(1).max(200),
  tone: z.string().min(1).max(200),
  segments: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        summary: z.string().min(30),
        keyThemes: z.array(z.string()).min(1).max(8),
        notableDetails: z.array(z.string()).max(6).default([]),
      }),
    )
    .min(2)
    .max(8),
});

const segmentedSummaryJsonSchema = {
  type: "object",
  required: ["overallTitle", "tone", "segments"],
  properties: {
    overallTitle: {
      type: "string",
      description: "Short descriptive title for the document as a whole (2-8 words).",
    },
    tone: {
      type: "string",
      description: "One short phrase describing the overall tone.",
    },
    segments: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      description:
        "2-8 thematic segments of the document. Each covers a DIFFERENT topic or section. Segments should partition the content — together they cover the whole document, but each one is tightly scoped to a single theme. Do not produce overlapping segments that restate the same material.",
      items: {
        type: "object",
        required: ["title", "summary", "keyThemes", "notableDetails"],
        properties: {
          title: {
            type: "string",
            description:
              "Specific topic title for this segment (2-6 words). Describes the segment's subject, not the whole document.",
          },
          summary: {
            type: "string",
            description:
              "A focused summary of this segment only. Preserve concrete details (names, numbers, examples) from the segment's portion of the source.",
          },
          keyThemes: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "1-8 short theme phrases specific to this segment.",
          },
          notableDetails: {
            type: "array",
            items: { type: "string" },
            maxItems: 6,
          },
        },
      },
    },
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

// Size thresholds for fanning a source into multiple topic segments.
// Images never segment (they're one frame). Text segments at 15KB because
// that's ~2500 words — enough content to plausibly have 2+ distinct
// topics. PDFs get a higher threshold (150KB) because PDF byte overhead
// (fonts, images, structure) inflates the size well beyond the text
// density the model actually sees.
function shouldSegment(size: number, mime: string): boolean {
  if (mime.startsWith("image/")) return false;
  if (isTextMime(mime))          return size >= 15 * 1024;
  if (mime === "application/pdf") return size >= 150 * 1024;
  return size >= 200 * 1024;
}

// Segmented calls always use the preview model — they handle the big
// files, and they need to fit the whole doc in one context window to
// produce coherent non-overlapping segments.
function segmentModel(mime: string, size: number): string {
  // Very big PDFs definitely need the preview's input window.
  if (mime === "application/pdf" && size > 2 * 1024 * 1024) return MODEL_FLASH_PREVIEW;
  // Everything else in the segment path is already "big enough" — pick
  // based on mime/size. Keep symmetry with pickModel's upper tier.
  if (isTextMime(mime) && size > 200 * 1024) return MODEL_FLASH_PREVIEW;
  return MODEL_FLASH;
}

// Per-segment output token budget — each segment is basically a small
// summary, so N segments × per-segment budget + wrapper overhead.
function segmentedOutputTokens(size: number): number {
  // Rough: 8 segments × ~250 words × 1.6 tokens/word + 1KB wrapper/headers.
  // Scale a bit with input size for very large files.
  if (size < 50 * 1024)  return 4096;
  if (size < 200 * 1024) return 6144;
  return 8192;
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

// Segmented variant — same file content, different instruction. Asks the
// model to partition the source into 2-8 thematic segments so downstream
// clustering has real topic structure to work with.
function buildSegmentedParts(
  buf: Buffer,
  mimeType: string,
  filename: string,
): LlmPart[] {
  const header: LlmPart = {
    text: [
      `You are ingesting a long source file for a knowledge-galaxy pipeline.`,
      ``,
      `Filename: ${filename}`,
      `Mime type: ${mimeType}`,
      ``,
      `This document is large enough that it likely covers MULTIPLE distinct topics. Your job is to partition it into 2-8 thematic SEGMENTS and return each segment as a standalone mini-summary. Downstream code treats every segment as a separate source, so they must NOT overlap — each segment covers one clearly-scoped sub-topic of the document.`,
      ``,
      `How to choose segments:`,
      `- Follow the document's natural structure (chapters, sections, topic shifts) when it has one.`,
      `- If the document is unstructured, partition by subject matter — group paragraphs that discuss the same topic, separate paragraphs that shift topic.`,
      `- Aim for segments of roughly similar importance. Don't produce one giant "everything else" segment.`,
      `- Each segment title should describe ITS topic specifically (e.g. "Quantum Tunneling", not "Chapter 3").`,
      `- A document covering truly just one topic is rare in files this size, but if it happens, 2 tightly-scoped segments is the minimum — never return 1.`,
      ``,
      `Return a structured JSON response matching the schema. Preserve concrete details (names, numbers, examples, quotations) in each segment's summary. Do not hedge. Do not add meta commentary.`,
    ].join("\n"),
  };

  if (isTextMime(mimeType)) {
    const text = buf.toString("utf8").slice(0, 500_000);
    return [header, { text: `\n\n--- BEGIN SOURCE TEXT ---\n${text}\n--- END SOURCE TEXT ---` }];
  }

  return [header, inlineFile(buf, mimeType)];
}

// Filename → stem for prefixing segment titles. `physics-notes.pdf` →
// `physics-notes`. Keeps segment titles from two different files from
// colliding when both files happen to name a segment "Introduction".
function fileStem(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stem.length > 0 ? stem : filename;
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
    async ({ row, buf, size }): Promise<SourceCtx[]> => {
      const mediaRef = `sources/${row.mediaPath}`;
      if (shouldSegment(size, row.mimeType)) {
        return await ingestSegmented(ctx.galaxyId, row, buf, size, mediaRef);
      }
      return [await ingestSingle(ctx.galaxyId, row, buf, size, mediaRef)];
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
  // results is SourceCtx[][] — one entry per file, each entry holding
  // 1 (non-segmented) or N (segmented) virtual sources. Flatten into ctx.
  const flat = results.flat();
  console.log(
    `[ingest] ${sourceRows.length} file(s) → ${flat.length} source(s) (${flat.length - sourceRows.length + failed} via segmentation)`,
  );
  ctx.sources.push(...flat);
}

// Single-summary path — one Gemini call per file, one SourceCtx out.
// Used for short files that don't need topic partitioning.
async function ingestSingle(
  galaxyId: string,
  row: SourceRow,
  buf: Buffer,
  size: number,
  mediaRef: string,
): Promise<SourceCtx> {
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
    mediaRef,
    summary: summary.summary,
    keyThemes: summary.keyThemes,
    notableDetails: summary.notableDetails,
    tone: summary.tone,
  };

  writeSource(galaxyId, {
    id: sourceCtx.id,
    title: sourceCtx.title,
    filename: sourceCtx.filename,
    mediaRef: sourceCtx.mediaRef,
    body: sourceCtx.summary,
  });

  return sourceCtx;
}

// Segmented path — one Gemini call per file, but the call returns 2-8
// thematic segments. Each segment becomes its own SourceCtx (same
// parent filename/mediaRef, distinct id + title), so the cluster stage
// sees real topic structure and can partition across them.
//
// Segment titles are prefixed with the file stem so identical chapter
// titles from different files (e.g. "Introduction") don't collide on
// the filesystem or in the wikiLinkIndex.
//
// If segmentation comes back with fewer than 2 valid segments (model
// misbehaving, truncation, etc.) we fall back to the single-summary
// path rather than failing the file entirely — better a monolithic
// source than a missing one.
async function ingestSegmented(
  galaxyId: string,
  row: SourceRow,
  buf: Buffer,
  size: number,
  mediaRef: string,
): Promise<SourceCtx[]> {
  const model = segmentModel(row.mimeType, size);
  const parts = buildSegmentedParts(buf, row.mimeType, row.filename);

  let segResult: z.infer<typeof segmentedSummarySchema>;
  try {
    segResult = await generateJson({
      model,
      parts,
      schema: segmentedSummarySchema,
      jsonSchema: segmentedSummaryJsonSchema,
      temperature: 0.4,
      maxOutputTokens: segmentedOutputTokens(size),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ingest] segmentation failed for ${row.filename} (${msg}) — falling back to single summary`);
    return [await ingestSingle(galaxyId, row, buf, size, mediaRef)];
  }

  if (!segResult.segments || segResult.segments.length < 2) {
    console.warn(`[ingest] segmentation returned <2 segments for ${row.filename} — falling back to single summary`);
    return [await ingestSingle(galaxyId, row, buf, size, mediaRef)];
  }

  const stem = fileStem(row.filename);
  const tone = segResult.tone;
  const seenTitles = new Set<string>();

  const out: SourceCtx[] = [];
  for (const seg of segResult.segments) {
    // Prefix segment titles with the parent file stem. Dedupe against
    // prior segments from this same file — if the model repeats a
    // segment title, skip the duplicate.
    const prefixed = `${stem} — ${seg.title}`.slice(0, 200);
    if (seenTitles.has(prefixed)) continue;
    seenTitles.add(prefixed);

    const sourceCtx: SourceCtx = {
      id: randomUUID(),
      title: prefixed,
      filename: row.filename,
      mediaRef,
      summary: seg.summary,
      keyThemes: seg.keyThemes,
      notableDetails: seg.notableDetails ?? [],
      tone,
    };

    writeSource(galaxyId, {
      id: sourceCtx.id,
      title: sourceCtx.title,
      filename: sourceCtx.filename,
      mediaRef: sourceCtx.mediaRef,
      body: sourceCtx.summary,
    });

    out.push(sourceCtx);
  }

  if (out.length === 0) {
    console.warn(`[ingest] all segments deduped for ${row.filename} — falling back to single summary`);
    return [await ingestSingle(galaxyId, row, buf, size, mediaRef)];
  }

  console.log(`[ingest] ${row.filename} → ${out.length} segments`);
  return out;
}
