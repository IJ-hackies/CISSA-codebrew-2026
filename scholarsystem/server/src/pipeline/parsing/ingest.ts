// Stage 0: Ingest.
//
// Accepts raw input (text for now; pdf-parse hook lives here later), mints
// a UUID, hashes the content, writes the `source` scope, and returns a
// blank blob with `pipeline.ingest` marked done. Raw input is NOT stored —
// only its hash + 500-char excerpt, per the blob's "no raw uploads" rule.
//
// NOTE: This is transitional v1→v2 code. The real v2 chunker
// (`pipeline/chunker.ts`) will produce proper numbered source units. For
// now we emit a single unit per chapter so the schema validates.

import { createHash, randomUUID } from "node:crypto";
import { Galaxy, SourceKind, SourcePart } from "../../../../shared/types";
import { createEmptyGalaxy, stageStart, stageDone } from "../../lib/blob";

export interface IngestInput {
  kind: SourceKind;
  filename: string | null;
  text: string;
  /** Optional override title. If omitted, a title is derived from the first non-blank line. */
  title?: string;
  /**
   * Per-part provenance for multi-input ingests. When provided, the parts
   * are recorded verbatim on `source.parts`; the top-level `kind`/
   * `filename`/hash still describe the concatenated blob as a whole.
   * Passing a single part is equivalent to a single-file ingest.
   */
  parts?: SourcePart[];
}

export interface IngestResult {
  galaxy: Galaxy;
}

export function runIngest(input: IngestInput): IngestResult {
  const byteSize = Buffer.byteLength(input.text, "utf8");
  const charCount = input.text.length;
  const contentHash = createHash("sha256").update(input.text).digest("hex");
  const excerpt = input.text.slice(0, 500);

  const chapterId = "w1";

  const source: Galaxy["source"] = {
    chapters: [
      {
        id: chapterId,
        kind: input.kind,
        filename: input.filename,
        byteSize,
        charCount,
        contentHash,
        excerpt,
        ...(input.parts && input.parts.length > 0 ? { parts: input.parts } : {}),
        // Transitional: emit the whole text as a single source unit so the
        // schema validates. The real chunker will split properly.
        units: [
          {
            id: `${chapterId}-s-0001`,
            text: input.text,
            charStart: 0,
            charEnd: charCount,
          },
        ],
      },
    ],
  };

  const title = input.title?.trim() || deriveTitle(input.text);
  const id = randomUUID();

  const chapters: Galaxy["meta"]["chapters"] = [
    {
      id: chapterId,
      uploadedAt: Date.now(),
      filename: input.filename,
      addedNodeIds: [],
    },
  ];

  const galaxy = createEmptyGalaxy({ id, title, source, chapters });

  // Stage 0 is synchronous and trivial — flip start and done back-to-back
  // so the pipeline scope reflects that ingest has actually run.
  stageStart(galaxy, "ingest");
  stageDone(galaxy, "ingest");

  return { galaxy };
}

function deriveTitle(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "Untitled Galaxy";
  // Strip markdown headings and trim to a reasonable length.
  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  return cleaned.slice(0, 80) || "Untitled Galaxy";
}
