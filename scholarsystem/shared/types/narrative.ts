import { z } from "zod";
import { Slug } from "./ids";

// Galaxy-wide story spine. Produced by Stage 3 after detail extraction
// (option B) so beats can be grounded in specific content. Read by
// Stage 5 (visuals, for tone-matched theming) and on-demand scene gen
// (so every scene is a beat within the arc, not an isolated story).

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

export const Narrative = z.object({
  setting: z.string(),
  protagonist: z.string(),
  premise: z.string(),
  stakes: z.string(),
  tone: Tone,
  aesthetic: Aesthetic,
  arcSummary: z.string(),
  arcBeats: z.array(ArcBeat),
  recurringCharacters: z.array(Character),
  finaleHook: z.string(),
  // Soft guidance — appended to the scene gen prompt as "avoid these".
  // No post-hoc validator runs against them (hackathon scope).
  hardConstraints: z.array(z.string()),
});

export type Narrative = z.infer<typeof Narrative>;
export type Tone = z.infer<typeof Tone>;
export type Aesthetic = z.infer<typeof Aesthetic>;
export type ArcBeat = z.infer<typeof ArcBeat>;
export type Character = z.infer<typeof Character>;
export type TonePrimary = z.infer<typeof TonePrimary>;
export type Genre = z.infer<typeof Genre>;
export type BeatRole = z.infer<typeof BeatRole>;
