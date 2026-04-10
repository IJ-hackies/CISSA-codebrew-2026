import { z } from "zod";
import { Slug } from "./ids";

export const Mood = z.enum([
  "joyful",
  "melancholic",
  "energetic",
  "peaceful",
  "tense",
  "nostalgic",
  "triumphant",
  "curious",
  "bittersweet",
  "determined",
]);

export const WrapStat = z.object({
  label: z.string(),
  value: z.string(),
});

export const WrapFact = z.object({
  label: z.string(),
  value: z.string(),
});

export const WrapConnection = z.object({
  targetId: Slug,
  reason: z.string(),
});

export const Derivative = z.object({
  sourceRef: Slug,
  quote: z.string(),
});

const WrapBase = z.object({
  nodeId: Slug,
  level: z.enum(["cluster", "group", "entry"]),
  headline: z.string(),
  summary: z.string(),
  mood: Mood,
  color: z.string(),
  stats: z.array(WrapStat),
  highlights: z.array(z.string()),
  derivatives: z.array(Derivative),
  sourceRefs: z.array(Slug),
});

export const ClusterWrap = WrapBase.extend({
  level: z.literal("cluster"),
  dateRange: z.string().optional(),
  topEntries: z.array(Slug),
  themes: z.array(z.string()),
});

export const GroupWrap = WrapBase.extend({
  level: z.literal("group"),
  theme: z.string(),
});

export const EntryWrap = WrapBase.extend({
  level: z.literal("entry"),
  body: z.string(),
  keyFacts: z.array(WrapFact),
  connections: z.array(WrapConnection),
});

export const Wrap = z.discriminatedUnion("level", [
  ClusterWrap,
  GroupWrap,
  EntryWrap,
]);

export const Wraps = z.record(Slug, Wrap);

export type Mood = z.infer<typeof Mood>;
export type WrapStat = z.infer<typeof WrapStat>;
export type WrapFact = z.infer<typeof WrapFact>;
export type WrapConnection = z.infer<typeof WrapConnection>;
export type Derivative = z.infer<typeof Derivative>;
export type ClusterWrap = z.infer<typeof ClusterWrap>;
export type GroupWrap = z.infer<typeof GroupWrap>;
export type EntryWrap = z.infer<typeof EntryWrap>;
export type Wrap = z.infer<typeof Wrap>;
export type Wraps = z.infer<typeof Wraps>;
