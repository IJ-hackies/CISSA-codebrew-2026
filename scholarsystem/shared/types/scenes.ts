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

export const ChallengeOption = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
  explanation: z.string(),
});

export const Challenge = z.object({
  prompt: z.string(),
  options: z.array(ChallengeOption).min(2).max(6),
  hint: z.string(),
});

export const DialogueLine = z.object({
  // Character id (references narrative.recurringCharacters) or null for
  // narrator/environmental text.
  speakerId: Slug.nullable(),
  text: z.string(),
});

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
export type ChallengeOption = z.infer<typeof ChallengeOption>;
export type DialogueLine = z.infer<typeof DialogueLine>;
export type SceneArchetype = z.infer<typeof SceneArchetype>;
