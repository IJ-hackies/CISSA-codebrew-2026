// Stage 0: Ingest.
//
// Accepts raw input (text for now; pdf-parse hook lives here later), mints
// a UUID, hashes the content, writes the `source` scope, and returns a
// blank blob with `pipeline.ingest` marked done. Raw input is NOT stored —
// only its hash + 500-char excerpt, per the blob's "no raw uploads" rule.

import { createHash, randomUUID } from "node:crypto";
import { Galaxy, Source, SourceKind } from "../../../../shared/types";
import { createEmptyGalaxy, stageStart, stageDone } from "../../lib/blob";

export interface IngestInput {
  kind: SourceKind;
  filename: string | null;
  text: string;
  /** Optional override title. If omitted, a title is derived from the first non-blank line. */
  title?: string;
}

export interface IngestResult {
  galaxy: Galaxy;
}

export function runIngest(input: IngestInput): IngestResult {
  const byteSize = Buffer.byteLength(input.text, "utf8");
  const charCount = input.text.length;
  const contentHash = createHash("sha256").update(input.text).digest("hex");
  const excerpt = input.text.slice(0, 500);

  const source: Source = {
    kind: input.kind,
    filename: input.filename,
    byteSize,
    charCount,
    contentHash,
    excerpt,
  };

  const title = input.title?.trim() || deriveTitle(input.text);
  const id = randomUUID();

  const galaxy = createEmptyGalaxy({ id, title, source });

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
