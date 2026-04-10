// Galaxy blob helpers shared by pipeline stages.
//
// Every stage needs the same trio of operations: create an empty blob to
// start from (ingest), flip pipeline stage statuses (every stage), and
// extract JSON from a raw Claude response (any stage that calls the model).
// Centralising them here keeps stage files focused on their actual work.

import {
  Galaxy,
  SCHEMA_VERSION,
  type StageState,
  type Pipeline,
} from "@scholarsystem/shared";

// ───────── Empty blob factory ─────────

const emptyStage = (): StageState => ({
  status: "pending",
  startedAt: null,
  completedAt: null,
  error: null,
});

const emptyPipeline = (): Pipeline => ({
  ingest: emptyStage(),
  structure: emptyStage(),
  wraps: emptyStage(),
  coverage: emptyStage(),
});

export interface EmptyGalaxyInput {
  id: string;
  title: string;
  source: Galaxy["source"];
  chapters: Galaxy["meta"]["chapters"];
  now?: number;
}

/** Build a blank, schema-valid Galaxy with every downstream scope empty. */
export function createEmptyGalaxy(input: EmptyGalaxyInput): Galaxy {
  const now = input.now ?? Date.now();
  const raw: Galaxy = {
    meta: {
      id: input.id,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      title: input.title,
      chapters: input.chapters,
    },
    source: input.source,
    knowledge: null,
    relationships: { edges: [] },
    wraps: {},
    exploration: {
      visited: {},
      bookmarked: [],
    },
    pipeline: emptyPipeline(),
  };
  // Validate at construction so a drift in defaults is caught immediately.
  return Galaxy.parse(raw);
}

// ───────── Stage status transitions ─────────

export type StageName = keyof Pipeline;

/** Mark a stage `running` and stamp `startedAt`. Mutates in place. */
export function stageStart(galaxy: Galaxy, stage: StageName): void {
  galaxy.pipeline[stage] = {
    status: "running",
    startedAt: Date.now(),
    completedAt: null,
    error: null,
  };
  galaxy.meta.updatedAt = Date.now();
}

/** Mark a stage `complete`. Mutates in place. */
export function stageDone(galaxy: Galaxy, stage: StageName): void {
  galaxy.pipeline[stage] = {
    ...galaxy.pipeline[stage],
    status: "complete",
    completedAt: Date.now(),
    error: null,
  };
  galaxy.meta.updatedAt = Date.now();
}

/** Mark a stage `error` with a message. Mutates in place. */
export function stageError(galaxy: Galaxy, stage: StageName, message: string): void {
  galaxy.pipeline[stage] = {
    ...galaxy.pipeline[stage],
    status: "error",
    completedAt: Date.now(),
    error: message,
  };
  galaxy.meta.updatedAt = Date.now();
}

// ───────── JSON extraction from Claude output ─────────

/**
 * Pull a JSON object out of a raw Claude response. Handles:
 *   - bare JSON
 *   - ```json ... ``` fenced blocks
 *   - leading/trailing prose the model added despite being told not to
 *
 * Strategy: if a fenced ```json block exists, use its contents. Otherwise
 * locate the first `{` and its matching closing brace via a string-aware
 * balance scan. Throws with a helpful excerpt on failure.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // Fenced code block — prefer explicit ```json, fall back to any ``` fence.
  const fenced =
    trimmed.match(/```json\s*([\s\S]*?)```/i) ??
    trimmed.match(/```\s*([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  // Balance-scan from the first `{` to its matching `}`, tracking strings
  // so braces inside string literals don't throw off the count.
  const start = trimmed.indexOf("{");
  if (start === -1) {
    throw new Error(`extractJson: no JSON object found in output:\n${trimmed.slice(0, 500)}`);
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(trimmed.slice(start, i + 1));
      }
    }
  }
  throw new Error(`extractJson: unbalanced braces in output:\n${trimmed.slice(0, 500)}`);
}
