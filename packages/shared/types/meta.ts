import { z } from "zod";
import { ChapterId, Slug } from "./ids";

export const SCHEMA_VERSION = 3;

export const ChapterEntry = z.object({
  id: ChapterId,
  uploadedAt: z.number().int(),
  filename: z.string().nullable(),
  addedNodeIds: z.array(Slug),
});

export const Meta = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  title: z.string(),
  chapters: z.array(ChapterEntry),
});

export type Meta = z.infer<typeof Meta>;
export type ChapterEntry = z.infer<typeof ChapterEntry>;
