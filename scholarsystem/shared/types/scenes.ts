import { z } from "zod";
import { Slug } from "./ids";
import { ModelTier } from "./knowledge";

// Per-concept scenes (one per moon / small planet / asteroid). Generated
// on-demand when the user lands, cached in the galaxy blob so revisits
// are instant. Keyed by the body id being landed on.

export const SceneArchetype = z.enum([
  "guardian-dialogue",
  "exploration-discovery",
  "environmental-puzzle",
  "memory-echo",
  "cooperative-challenge",
]);

// ─── Challenge types (discriminated union on `type`) ──────────────────
//
// Each type matches a frontend minigame component 1:1. Claude generates
// the correct variant; the frontend switches on `type` to render it.

export const MCQOption = z.object({
  text: z.string(),
  correct: z.boolean(),
  explanation: z.string(),
});

export const MCQChallenge = z.object({
  type: z.literal("mcq"),
  question: z.string(),
  options: z.array(MCQOption).min(2).max(6),
});

export const DragSortItem = z.object({
  id: z.string(),
  label: z.string(),
  correctIndex: z.number().int().nonnegative(),
});

export const DragSortChallenge = z.object({
  type: z.literal("drag-sort"),
  instruction: z.string(),
  items: z.array(DragSortItem).min(2).max(8),
});

export const Hotspot = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  revealText: z.string(),
  required: z.boolean(),
});

export const HotspotChallenge = z.object({
  type: z.literal("hotspot"),
  instruction: z.string(),
  hotspots: z.array(Hotspot).min(2).max(8),
});

export const MatchPair = z.object({
  left: z.string(),
  right: z.string(),
});

export const MatchPairsChallenge = z.object({
  type: z.literal("match-pairs"),
  instruction: z.string(),
  pairs: z.array(MatchPair).min(2).max(6),
});

export const FillBlankSegment = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("blank"),
    id: z.string(),
    correctAnswer: z.string(),
    alternatives: z.array(z.string()),
    options: z.array(z.string()).min(2),
  }),
]);

export const FillBlankChallenge = z.object({
  type: z.literal("fill-blank"),
  instruction: z.string(),
  segments: z.array(FillBlankSegment).min(1),
});

export const TimerOption = z.object({
  text: z.string(),
  correct: z.boolean(),
});

export const TimerChallenge = z.object({
  type: z.literal("timer"),
  urgencyNarrative: z.string(),
  timeSeconds: z.number().int().min(10).max(60),
  question: z.string(),
  options: z.array(TimerOption).min(2).max(6),
});

export const PlayerOption = z.object({
  text: z.string(),
  correct: z.boolean(),
  npcReaction: z.string(),
  emotion: z.string(),
});

export const Exchange = z.object({
  npcLine: z.string(),
  playerOptions: z.array(PlayerOption).min(2).max(4),
});

export const DialogueChoiceChallenge = z.object({
  type: z.literal("dialogue-choice"),
  setup: z.string(),
  exchanges: z.array(Exchange).min(1).max(3),
});

export const Challenge = z.discriminatedUnion("type", [
  MCQChallenge,
  DragSortChallenge,
  HotspotChallenge,
  MatchPairsChallenge,
  FillBlankChallenge,
  TimerChallenge,
  DialogueChoiceChallenge,
]);

// ─── Dialogue ─────────────────────────────────────────────────────────

export const DialogueLine = z.object({
  // Character id (references narrative.recurringCharacters) or null for
  // narrator/environmental text.
  speakerId: Slug.nullable(),
  text: z.string(),
});

// ─── Scene ────────────────────────────────────────────────────────────

export const Scene = z.object({
  bodyId: Slug,
  archetype: SceneArchetype,
  modelTierUsed: ModelTier,
  openingNarrative: z.string(),
  dialogue: z.array(DialogueLine),
  challenge: Challenge,
  closingNarrative: z.string(),
  generatedAt: z.number().int(),
  // Hash of (progress state + archetype + narrative revision) at gen time.
  // Lets us decide whether a cached scene is still appropriate if we ever
  // want cache invalidation. For hackathon v1: generate once, keep forever.
  generationContextHash: z.string(),
});

export const Scenes = z.record(Slug, Scene);

export type Scene = z.infer<typeof Scene>;
export type Scenes = z.infer<typeof Scenes>;
export type Challenge = z.infer<typeof Challenge>;
export type MCQChallenge = z.infer<typeof MCQChallenge>;
export type DragSortChallenge = z.infer<typeof DragSortChallenge>;
export type HotspotChallenge = z.infer<typeof HotspotChallenge>;
export type MatchPairsChallenge = z.infer<typeof MatchPairsChallenge>;
export type FillBlankChallenge = z.infer<typeof FillBlankChallenge>;
export type TimerChallenge = z.infer<typeof TimerChallenge>;
export type DialogueChoiceChallenge = z.infer<typeof DialogueChoiceChallenge>;
export type DialogueLine = z.infer<typeof DialogueLine>;
export type SceneArchetype = z.infer<typeof SceneArchetype>;
