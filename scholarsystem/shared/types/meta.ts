import { z } from "zod";
import { ChapterId, Slug } from "./ids";

// Bump when the schema shape changes in a way old blobs can't satisfy.
// Migrations live next to the version they migrate from.
//
// v1 → v2 (2026-04-10): workspace-proxy + Obsidian-markdown rewrite.
//   - Slug now requires a chapter prefix
//   - source restructured into chapters[] with stable numbered units
//   - knowledge/detail/relationships carry sourceRefs (.min(1))
//   - narrative split into canon (frozen) + arcs[] (append per chapter)
//   - meta gains chapters[] upload history
//   - pipeline gains coverageAudit stage
export const SCHEMA_VERSION = 2;

// One row in the upload-history table. Recorded every time a chapter
// is ingested — first upload and every subsequent extension. Powers
// provenance queries ("which bodies came from week 2?") and the
// "new constellation unlocked" UX on extension.
export const ThematicGroup = z.object({
  name: z.string(),
  conceptIds: z.array(Slug),
});

export const ChapterEntry = z.object({
  id: ChapterId,
  uploadedAt: z.number().int(),
  filename: z.string().nullable(),
  addedKnowledgeIds: z.array(Slug),
  addedBodyIds: z.array(Slug),
  // Flint-style metadata — informational, not load-bearing.
  structureNote: z.string().nullable().default(null),
  thematicGroups: z.array(ThematicGroup).default([]),
  etcContent: z.string().nullable().default(null),
});

export const Meta = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  title: z.string(),
  // Upload history. First-chapter ingest appends entry #0; every
  // extension appends another. Existing entries are immutable — this
  // is provenance, not mutable state.
  chapters: z.array(ChapterEntry),
});

export type Meta = z.infer<typeof Meta>;
export type ChapterEntry = z.infer<typeof ChapterEntry>;
export type ThematicGroup = z.infer<typeof ThematicGroup>;
