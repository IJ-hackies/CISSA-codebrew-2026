import { z } from "zod";
import { ChapterId, Slug } from "./ids";

export const EntryKind = z.enum([
  "moment",
  "person",
  "place",
  "theme",
  "artifact",
  "milestone",
  "period",
]);

export const Cluster = z.object({
  id: Slug,
  chapter: ChapterId,
  title: z.string(),
  brief: z.string(),
  sourceRefs: z.array(Slug).min(1),
  groupIds: z.array(Slug),
});

export const Group = z.object({
  id: Slug,
  chapter: ChapterId,
  title: z.string(),
  brief: z.string(),
  sourceRefs: z.array(Slug).min(1),
  clusterId: Slug,
  entryIds: z.array(Slug),
});

export const Entry = z.object({
  id: Slug,
  chapter: ChapterId,
  title: z.string(),
  brief: z.string(),
  sourceRefs: z.array(Slug).min(1),
  groupId: Slug.nullable(),
  kind: EntryKind,
});

export const Knowledge = z.object({
  clusters: z.array(Cluster),
  groups: z.array(Group),
  entries: z.array(Entry),
});

export type EntryKind = z.infer<typeof EntryKind>;
export type Cluster = z.infer<typeof Cluster>;
export type Group = z.infer<typeof Group>;
export type Entry = z.infer<typeof Entry>;
export type Knowledge = z.infer<typeof Knowledge>;
