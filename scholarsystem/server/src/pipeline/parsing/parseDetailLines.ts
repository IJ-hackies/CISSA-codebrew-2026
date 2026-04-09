// JSONL parser for Stage 2 detail output.
//
// Tolerant on the way in: blank lines, `#` comments, stray ``` fence
// markers, and leading/trailing prose lines are skipped with warnings.
// Strict on the way out: each surviving line must parse as JSON AND
// match the expected shape (conceptId + the seven content fields).
// Schema-level validation against ConceptDetail happens in the
// orchestrator, after extractedAt is stamped on.

export interface RawConceptDetail {
  conceptId: string;
  fullDefinition: string;
  formulas: string[];
  workedExamples: string[];
  edgeCases: string[];
  mnemonics: string[];
  emphasisMarkers: string[];
  sourceQuotes: string[];
}

export interface ParseDetailResult {
  details: RawConceptDetail[];
  warnings: string[];
}

/**
 * Parse Claude's Stage 2 response as JSONL — one concept detail per line.
 * Malformed lines are dropped with a warning; the rest survive. Returns
 * raw shapes only (no extractedAt, no Zod validation) — the orchestrator
 * stamps timestamps and runs the authoritative schema check.
 */
export function parseDetailLines(raw: string): ParseDetailResult {
  const details: RawConceptDetail[] = [];
  const warnings: string[] = [];

  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip blank lines, comments, and fence markers the model sometimes
    // emits despite being told not to.
    if (line === "") continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("```")) continue;

    // A concept line must start with `{` and end with `}`. Anything else
    // is probably prose the model added — log and skip.
    if (!line.startsWith("{") || !line.endsWith("}")) {
      warnings.push(`line ${i + 1}: not a JSON object, skipped: ${truncate(line)}`);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`line ${i + 1}: JSON parse failed (${msg}), skipped: ${truncate(line)}`);
      continue;
    }

    const shaped = coerceToConceptDetail(parsed);
    if (!shaped.ok) {
      warnings.push(`line ${i + 1}: ${shaped.reason}, skipped: ${truncate(line)}`);
      continue;
    }

    details.push(shaped.value);
  }

  return { details, warnings };
}

type CoerceResult =
  | { ok: true; value: RawConceptDetail }
  | { ok: false; reason: string };

/**
 * Shape-check a parsed JSON value against the expected concept detail
 * object. Returns a typed value on success or a reason string on failure.
 * We check presence/type here and defer full semantic validation to Zod
 * in the orchestrator once extractedAt is added.
 */
function coerceToConceptDetail(value: unknown): CoerceResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "not a plain object" };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.conceptId !== "string" || v.conceptId.length === 0) {
    return { ok: false, reason: "missing or empty conceptId" };
  }
  if (typeof v.fullDefinition !== "string") {
    return { ok: false, reason: "missing or non-string fullDefinition" };
  }

  const arrayFields = [
    "formulas",
    "workedExamples",
    "edgeCases",
    "mnemonics",
    "emphasisMarkers",
    "sourceQuotes",
  ] as const;

  for (const field of arrayFields) {
    const arr = v[field];
    if (!Array.isArray(arr)) {
      return { ok: false, reason: `${field} is not an array` };
    }
    if (!arr.every((item) => typeof item === "string")) {
      return { ok: false, reason: `${field} contains non-string items` };
    }
  }

  return {
    ok: true,
    value: {
      conceptId: v.conceptId,
      fullDefinition: v.fullDefinition,
      formulas: v.formulas as string[],
      workedExamples: v.workedExamples as string[],
      edgeCases: v.edgeCases as string[],
      mnemonics: v.mnemonics as string[],
      emphasisMarkers: v.emphasisMarkers as string[],
      sourceQuotes: v.sourceQuotes as string[],
    },
  };
}

function truncate(s: string, max = 120): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}
