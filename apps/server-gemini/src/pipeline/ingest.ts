// Stage 1 — Ingest. For each uploaded source file, produce a structured
// summary via Gemini 2.5 Flash and write a `(Source) Title.md` file to
// the mesh. Files that are natively multimodal (PDFs, images) go through
// inlineData; anything text-like is decoded and sent as a text part.
//
// Parallel fan-out bounded by `p-limit`-style concurrency limiter.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { generateJson, inlineFile, MODEL_FLASH, type LlmPart } from "./gemini";
import { mapLimitedTolerant } from "../lib/concurrency";
import { galaxyPaths } from "../workspace/layout";
import { writeSource } from "../workspace/write";
import type { SourceRow } from "../db/client";
import type { PipelineContext, SourceCtx } from "./context";
import { randomUUID } from "node:crypto";

// ── Schema for structured Flash output ─────────────────────────────

const sourceSummarySchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(100),
  keyThemes: z.array(z.string()).min(2).max(10),
  notableDetails: z.array(z.string()).min(1).max(10),
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
        "A 3-5 paragraph rich summary of the document. Cover what it is, key themes, notable details, and tone. 300+ words.",
    },
    keyThemes: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 10,
      description: "2-10 short theme phrases",
    },
    notableDetails: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 10,
    },
    tone: { type: "string", description: "One short phrase describing the tone" },
  },
};

// ── Mime routing ────────────────────────────────────────────────────
//
// Text-like types: decode bytes and send as a text part. Everything else
// goes through inlineData and lets Gemini handle the multimodal parsing
// (it natively supports PDF, images, and a handful of others).

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

function buildParts(buf: Buffer, mimeType: string, filename: string): LlmPart[] {
  const header: LlmPart = {
    text: [
      `You are summarizing an uploaded source file for a knowledge-galaxy pipeline.`,
      ``,
      `Filename: ${filename}`,
      `Mime type: ${mimeType}`,
      ``,
      `Return a structured JSON summary of this document. Follow the schema exactly. The summary should be rich and substantive (300+ words, multi-paragraph) so later stages have enough material to build planets and concepts from. Preserve concrete details — names, numbers, examples, quotations. Do not hedge. Do not add meta commentary.`,
    ].join("\n"),
  };

  if (isTextMime(mimeType)) {
    // Truncate very long text to keep us well under the Flash context window.
    // ~80k chars ≈ ~20k tokens, leaving plenty of headroom.
    const text = buf.toString("utf8").slice(0, 80_000);
    return [header, { text: `\n\n--- BEGIN SOURCE TEXT ---\n${text}\n--- END SOURCE TEXT ---` }];
  }

  // Multimodal: send the file as inlineData.
  return [header, inlineFile(buf, mimeType)];
}

// ── Stage entry ────────────────────────────────────────────────────

export async function runIngestStage(
  ctx: PipelineContext,
  sourceRows: SourceRow[],
  concurrency = 6,
): Promise<void> {
  const paths = galaxyPaths(ctx.galaxyId);

  const { results, failed } = await mapLimitedTolerant(
    sourceRows,
    concurrency,
    "ingest",
    async (row) => {
      const absPath = join(paths.mediaSources, row.mediaPath);
      const buf = readFileSync(absPath);
      const parts = buildParts(buf, row.mimeType, row.filename);

      const summary = await generateJson({
        model: MODEL_FLASH,
        parts,
        schema: sourceSummarySchema,
        jsonSchema: sourceSummaryJsonSchema,
        temperature: 0.4,
        maxOutputTokens: 8192,
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
