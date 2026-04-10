import { z } from "zod";
import { ChapterId, Slug } from "./ids";

// Galaxy-wide story spine. Split into two parts so that chapter
// extensions behave correctly:
//
//   canon  — setting, cast, tone, aesthetic. FROZEN after first
//            generation. Subsequent chapter uploads treat canon as
//            immutable input; they may read it but never rewrite it.
//            This is what prevents tonal drift when week 2 arrives.
//
//   arcs[] — per-chapter story beats. APPEND-ONLY. First ingest
//            writes arcs[0]; every extension appends a new ChapterArc
//            that references the frozen canon (cast, tone) and only
//            introduces new beats for the chapter's new topics.

export const TonePrimary = z.enum([
  "mysterious",
  "heroic",
  "investigative",
  "comedic",
  "melancholic",
  "wondrous",
  "ominous",
  "reverent",
]);

export const Genre = z.enum([
  "hard-sf",
  "space-opera",
  "cosmic-horror",
  "archaeological",
  "exploration",
  "mythic",
]);

export const Tone = z.object({
  primary: TonePrimary,
  secondary: z.string().nullable(), // free-text nuance
  genre: Genre,
});

// Aesthetic direction for Stage 5 (visuals). Kept intentionally
// high-level — specific colors/terrains are the visual engine's call.
export const Aesthetic = z.object({
  paletteDirection: z.string(),
  atmosphereDirection: z.string(),
  motifKeywords: z.array(z.string()).min(3).max(12),
});

export const BeatRole = z.enum([
  "opening",
  "rising-action",
  "complication",
  "midpoint",
  "deepening",
  "climax",
  "resolution",
  "epilogue",
]);

// One beat per topic (solar system). Not per-subtopic — that would
// bloat context and over-constrain per-planet scenes.
export const ArcBeat = z.object({
  topicId: Slug,
  role: BeatRole,
  beat: z.string(),
  emotionalTarget: z.string(),
  connectsTo: z.array(Slug),
});

export const Character = z.object({
  id: Slug,
  name: z.string(),
  role: z.string(),
  description: z.string(),
  // Voice is the single most important field for keeping NPCs distinct
  // across independently-generated scenes. Without it, Claude produces
  // interchangeable dialogue every time.
  voice: z.string(),
  arc: z.string(),
});

// The immutable spine. Written once, on first-chapter ingest. Every
// subsequent chapter extension reads this as input and MUST NOT
// modify it.
export const NarrativeCanon = z.object({
  setting: z.string(),
  protagonist: z.string(),
  premise: z.string(),
  stakes: z.string(),
  tone: Tone,
  aesthetic: Aesthetic,
  recurringCharacters: z.array(Character),
  finaleHook: z.string(),
  // Soft guidance — appended to the scene gen prompt as "avoid these".
  hardConstraints: z.array(z.string()),
});

// Per-chapter story content. First ingest produces arcs[0]; each
// extension appends. Existing entries are frozen.
export const ChapterArc = z.object({
  chapter: ChapterId,
  arcSummary: z.string(),
  beats: z.array(ArcBeat),
  chapterHook: z.string(),
});

export const Narrative = z.object({
  canon: NarrativeCanon.nullable(), // null until first generation
  arcs: z.array(ChapterArc),
});

export type Narrative = z.infer<typeof Narrative>;
export type NarrativeCanon = z.infer<typeof NarrativeCanon>;
export type ChapterArc = z.infer<typeof ChapterArc>;
export type Tone = z.infer<typeof Tone>;
export type Aesthetic = z.infer<typeof Aesthetic>;
export type ArcBeat = z.infer<typeof ArcBeat>;
export type Character = z.infer<typeof Character>;
export type TonePrimary = z.infer<typeof TonePrimary>;
export type Genre = z.infer<typeof Genre>;
export type BeatRole = z.infer<typeof BeatRole>;
