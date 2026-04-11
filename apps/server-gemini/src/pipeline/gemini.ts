// Single Gemini client. Two entry points:
//   - generateJson({model, parts, schema})  → parsed + zod-validated object
//   - generateText({model, parts})          → raw string
//
// Input "parts" is our lightweight alias for the SDK's Part[]: text chunks
// and inlineData blobs (PDFs, images, etc). That keeps the call sites from
// importing SDK types directly, and lets us swap implementations if we
// replace Gemini with Alibaba Wanx or another vendor later.
//
// Resilience layers on top of a raw SDK call:
//   1. Disable thinking on Flash by default (it silently eats output
//      tokens and causes mid-string truncation on chatty responses).
//   2. On MAX_TOKENS truncation, retry once with 2× the output budget.
//   3. On zod schema failure, salvage by truncating over-long strings
//      if those are the *only* issues.

import { GoogleGenAI, type Content, type GenerateContentResponse } from "@google/genai";
import type { ZodType } from "zod";

export type LlmPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

export const MODEL_FLASH_LITE = "gemini-2.5-flash-lite";
export const MODEL_FLASH = "gemini-2.5-flash";
export const MODEL_FLASH_PREVIEW = "gemini-3-flash-preview";
export const MODEL_PRO = "gemini-2.5-pro";

// Default ceilings when the caller doesn't pass one. Flash needs a lot
// of headroom on ingest summaries; Pro needs even more for planet bodies.
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

let _client: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Create apps/server-gemini/.env with GOOGLE_API_KEY=...",
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

interface GenerateOpts {
  model: string;
  parts: LlmPart[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * Thinking budget in output tokens. `0` disables thinking entirely
   * (Gemini 2.5 Flash default ships with thinking ON, which silently
   * eats maxOutputTokens and causes truncated JSON). If omitted we
   * disable thinking on Flash and leave it auto on Pro — thinking is
   * Pro's entire value prop, but Flash's JSON calls rarely benefit.
   */
  thinkingBudget?: number;
}

interface GenerateJsonOpts<T> extends GenerateOpts {
  schema: ZodType<T>;
  // Hint for the model: a JSON-schema-ish object describing the desired
  // shape. Passed through responseJsonSchema. We deliberately do NOT try
  // to auto-convert zod → JSON schema — we write the schema by hand per
  // stage so the model sees the exact constraints (min/max counts, etc).
  jsonSchema: unknown;
}

function toContents(parts: LlmPart[]): Content[] {
  return [{ role: "user", parts: parts as Content["parts"] }];
}

function resolveThinkingBudget(
  model: string,
  explicit: number | undefined,
): number | undefined {
  if (explicit !== undefined) return explicit;
  // Default: disable thinking on Flash, let Pro decide for itself.
  if (model.includes("flash")) return 0;
  return undefined;
}

function wasTruncated(response: GenerateContentResponse): boolean {
  return response.candidates?.some((c) => c.finishReason === "MAX_TOKENS") ?? false;
}

function formatUsage(response: GenerateContentResponse): string {
  const u = response.usageMetadata;
  if (!u) return "(no usage metadata)";
  const parts: string[] = [];
  if (u.promptTokenCount != null) parts.push(`prompt=${u.promptTokenCount}`);
  if (u.candidatesTokenCount != null) parts.push(`output=${u.candidatesTokenCount}`);
  if (u.thoughtsTokenCount != null) parts.push(`thoughts=${u.thoughtsTokenCount}`);
  if (u.totalTokenCount != null) parts.push(`total=${u.totalTokenCount}`);
  return parts.join(" ");
}

// Single raw call. Returns the response plus the effective budget used,
// so callers can retry with a bigger one on truncation.
async function rawCall(
  opts: GenerateOpts,
  budget: number,
  thinkingBudget: number | undefined,
  jsonOpts?: { jsonSchema: unknown },
): Promise<GenerateContentResponse> {
  return client().models.generateContent({
    model: opts.model,
    contents: toContents(opts.parts),
    config: {
      systemInstruction: opts.systemInstruction,
      temperature: opts.temperature,
      maxOutputTokens: budget,
      thinkingConfig: thinkingBudget === undefined ? undefined : { thinkingBudget },
      responseMimeType: jsonOpts ? "application/json" : undefined,
      responseJsonSchema: jsonOpts?.jsonSchema,
    },
  });
}

export async function generateText(opts: GenerateOpts): Promise<string> {
  const thinkingBudget = resolveThinkingBudget(opts.model, opts.thinkingBudget);
  const initialBudget = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const attempt = async (budget: number) => {
    const response = await rawCall(opts, budget, thinkingBudget);
    if (wasTruncated(response)) {
      throw new Error(`MAX_TOKENS at ${budget} tokens (${formatUsage(response)})`);
    }
    const text = response.text;
    if (!text) throw new Error(`empty response (${formatUsage(response)})`);
    return text;
  };

  try {
    return await attempt(initialBudget);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryBudget = initialBudget * 2;
    console.warn(
      `[gemini:${opts.model}] first attempt failed (${msg.slice(0, 180)}). Retrying at ${retryBudget} tokens.`,
    );
    return attempt(retryBudget);
  }
}

export async function generateJson<T>(opts: GenerateJsonOpts<T>): Promise<T> {
  const thinkingBudget = resolveThinkingBudget(opts.model, opts.thinkingBudget);
  const initialBudget = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  try {
    return await callAndParseJson(opts, initialBudget, thinkingBudget);
  } catch (err) {
    // Retry once at double budget. Covers three failure modes in one
    // shot: MAX_TOKENS finishReason, soft truncation (Gemini's
    // responseJsonSchema mode auto-closes the JSON when it runs out of
    // tokens, producing a valid object with missing required fields),
    // and transient parse hiccups. Any schema mismatch that isn't a
    // truncation artifact will fail the same way the second time and
    // still throw — we're not masking real bugs.
    const msg = err instanceof Error ? err.message : String(err);
    const retryBudget = initialBudget * 2;
    console.warn(
      `[gemini:${opts.model}] first attempt failed (${msg.slice(0, 180)}). Retrying at ${retryBudget} tokens.`,
    );
    try {
      return await callAndParseJson(opts, retryBudget, thinkingBudget);
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      throw new Error(
        `[gemini:${opts.model}] failed after retry at ${retryBudget} tokens: ${msg2}`,
      );
    }
  }
}

// Single attempt: call, check truncation, parse, validate, salvage
// string-length overruns. Throws on any failure so the caller can
// decide whether to retry at a higher budget.
async function callAndParseJson<T>(
  opts: GenerateJsonOpts<T>,
  budget: number,
  thinkingBudget: number | undefined,
): Promise<T> {
  const response = await rawCall(opts, budget, thinkingBudget, { jsonSchema: opts.jsonSchema });
  if (wasTruncated(response)) {
    throw new Error(`MAX_TOKENS at ${budget} tokens (${formatUsage(response)})`);
  }
  const text = response.text;
  if (!text) {
    throw new Error(`empty JSON response (${formatUsage(response)})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `JSON parse failed (${formatUsage(response)}): ${msg}\n--- raw ---\n${text.slice(0, 300)}`,
    );
  }

  const validated = opts.schema.safeParse(parsed);
  if (validated.success) return validated.data;

  // Salvage pass: if the only issues are `too_big` on strings, truncate
  // the offending fields in-place and re-validate. Anything else falls
  // through to the outer retry (missing required fields is a common
  // soft-truncation symptom and a bigger budget will usually fix it).
  if (truncateOverLongStrings(parsed, validated.error.issues)) {
    const retry = opts.schema.safeParse(parsed);
    if (retry.success) {
      console.warn(
        `[gemini:${opts.model}] salvaged by truncating ${validated.error.issues.length} over-long string(s)`,
      );
      return retry.data;
    }
  }

  throw new Error(
    `schema mismatch (${formatUsage(response)}): ${JSON.stringify(validated.error.issues.slice(0, 3))}\n--- raw ---\n${text.slice(0, 300)}`,
  );
}

// Walk a list of zod issues and, for every `too_big` on a string, slice
// the string at its max inside the parsed object. Returns true if any
// fix was applied. Returns false (without mutating) if any issue is not
// a string-length overrun — the caller should throw in that case.
function truncateOverLongStrings(obj: unknown, issues: readonly unknown[]): boolean {
  let touched = false;
  for (const raw of issues) {
    const issue = raw as {
      code?: string;
      origin?: string;
      maximum?: number;
      path?: ReadonlyArray<string | number>;
    };
    if (issue.code !== "too_big" || issue.origin !== "string") return false;
    if (typeof issue.maximum !== "number" || !issue.path) return false;

    // Walk to the parent container so we can mutate the final key.
    let parent: unknown = obj;
    for (let i = 0; i < issue.path.length - 1; i++) {
      if (parent == null || typeof parent !== "object") return false;
      parent = (parent as Record<string | number, unknown>)[issue.path[i]];
    }
    if (parent == null || typeof parent !== "object") return false;

    const lastKey = issue.path[issue.path.length - 1];
    const container = parent as Record<string | number, unknown>;
    const current = container[lastKey];
    if (typeof current !== "string") return false;

    // Trim to max, then cut back to the previous word boundary if the
    // hard cut lands mid-word — avoids awkward half-words in UI copy.
    let trimmed = current.slice(0, issue.maximum);
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > issue.maximum * 0.7) trimmed = trimmed.slice(0, lastSpace);
    container[lastKey] = trimmed.trimEnd();
    touched = true;
  }
  return touched;
}

// Convenience: build an inlineData Part from a file buffer + mime type.
export function inlineFile(buf: Buffer, mimeType: string): LlmPart {
  return { inlineData: { data: buf.toString("base64"), mimeType } };
}
