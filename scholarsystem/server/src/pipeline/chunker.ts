// Stage 0: Ingest & Chunk.
//
// Pure code — no Claude calls. Takes extracted text + metadata and produces:
//   1. A SourceChapter with stable numbered units (w1-s-0001, w1-s-0002, …)
//   2. A fresh Galaxy blob with `source`, `meta`, and all other scopes empty
//
// Chunking strategy: split on double-newlines (paragraphs), then merge
// small fragments until each unit is ≥ MIN_UNIT_CHARS. This keeps units
// semantically meaningful (paragraph-aligned) while preventing tiny slivers
// that waste source-unit IDs and bloat the coverage auditor.

import { createHash, randomUUID } from "node:crypto";
import type {
  Galaxy,
  SourceChapter,
  SourceKind,
  SourcePart,
  SourceUnit,
  ChapterId,
} from "@scholarsystem/shared";
import { createEmptyGalaxy, stageStart, stageDone } from "../lib/blob";

const MIN_UNIT_CHARS = 80;

export interface ChunkerInput {
  chapterId: ChapterId;
  kind: SourceKind;
  filename: string | null;
  text: string;
  title?: string;
  parts?: SourcePart[];
}

export interface ChunkerResult {
  galaxy: Galaxy;
}

/** Run Stage 0: chunk source text into numbered units and mint a Galaxy blob. */
export function runChunker(input: ChunkerInput): ChunkerResult {
  const { chapterId, text, kind, filename, parts } = input;

  const units = chunkText(text, chapterId);

  const byteSize = Buffer.byteLength(text, "utf8");
  const charCount = text.length;
  const contentHash = createHash("sha256").update(text).digest("hex");
  const excerpt = text.slice(0, 500);

  const chapter: SourceChapter = {
    id: chapterId,
    kind,
    filename,
    byteSize,
    charCount,
    contentHash,
    excerpt,
    ...(parts && parts.length > 0 ? { parts } : {}),
    units,
  };

  const title = input.title?.trim() || deriveTitle(text);
  const id = randomUUID();
  const now = Date.now();

  const galaxy = createEmptyGalaxy({
    id,
    title,
    source: { chapters: [chapter] },
    chapters: [
      {
        id: chapterId,
        uploadedAt: now,
        filename,
        addedKnowledgeIds: [],
        addedBodyIds: [],
        structureNote: null,
        thematicGroups: [],
        etcContent: null,
      },
    ],
    now,
  });

  stageStart(galaxy, "ingest");
  stageDone(galaxy, "ingest");

  return { galaxy };
}

/**
 * Split text into paragraph-aligned source units with stable IDs.
 *
 * Strategy:
 *   1. Split on double-newlines (paragraph boundaries).
 *   2. Merge consecutive fragments until the merged unit ≥ MIN_UNIT_CHARS.
 *   3. Assign IDs: `<chapter>-s-0001`, `<chapter>-s-0002`, …
 *   4. Track char offsets for future "jump to source" UX.
 */
function chunkText(text: string, chapterId: ChapterId): SourceUnit[] {
  if (text.trim().length === 0) return [];

  // Split on two or more consecutive newlines (paragraph breaks).
  const rawParagraphs = text.split(/\n{2,}/);

  // Merge small fragments.
  const merged: { text: string; charStart: number; charEnd: number }[] = [];
  let cursor = 0;

  for (const raw of rawParagraphs) {
    // Find the actual position of this paragraph in the original text.
    const start = text.indexOf(raw, cursor);
    const end = start + raw.length;

    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      cursor = end;
      continue;
    }

    if (
      merged.length > 0 &&
      merged[merged.length - 1].text.length < MIN_UNIT_CHARS
    ) {
      // Merge into previous unit.
      const prev = merged[merged.length - 1];
      prev.text += "\n\n" + trimmed;
      prev.charEnd = end;
    } else {
      merged.push({ text: trimmed, charStart: start, charEnd: end });
    }

    cursor = end;
  }

  // Convert to SourceUnit with padded sequential IDs.
  return merged.map((m, i): SourceUnit => ({
    id: `${chapterId}-s-${String(i + 1).padStart(4, "0")}` as SourceUnit["id"],
    text: m.text,
    charStart: m.charStart,
    charEnd: m.charEnd,
  }));
}

function deriveTitle(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "Untitled Galaxy";
  const cleaned = firstLine.replace(/^#+\s*/, "").trim();
  return cleaned.slice(0, 80) || "Untitled Galaxy";
}
