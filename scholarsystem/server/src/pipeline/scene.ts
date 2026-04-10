// Stage 6: On-demand scene generation per concept.
//
// NOT part of the main pipeline runner — scenes generate when the
// user lands on a moon/asteroid and are cached in the galaxy blob.
//
// Uses a single proxy sub-session per scene. Model is routed by
// the concept's modelTier:
//   - light   → haiku
//   - standard → (default, no override — uses proxy default sonnet)
//   - heavy   → opus
//
// The archetype and challenge type are pre-selected by deterministic
// code (same hash logic as the frontend's mockScene.ts). Claude fills
// content slots — it doesn't pick the template.

import type {
  Galaxy,
  Scene,
  Challenge,
  Concept,
  ConceptDetail,
  Body,
  SceneArchetype,
} from "@scholarsystem/shared";
import { Scene as SceneSchema } from "@scholarsystem/shared";
import {
  pushFiles,
  runStage,
  compileFiles,
  destroySession,
} from "../lib/proxy-client";
import {
  buildScenePrompt,
  pickArchetype,
  pickChallengeType,
  type ScenePromptInput,
} from "../prompts/scenes";
import { parseNote, type ParsedNote } from "./compile/frontmatter";
import { saveGalaxy } from "../db/store";
import { createHash } from "node:crypto";

const MODEL_MAP: Record<string, string | undefined> = {
  light: "haiku",
  standard: undefined, // proxy default (sonnet)
  heavy: "opus",
};

export interface GenerateSceneResult {
  scene: Scene;
  durationMs: number;
}

/**
 * Generate a scene for a single concept/body. Returns the validated
 * Scene object. Also writes it into the galaxy blob and persists.
 *
 * If a cached scene already exists for this bodyId, returns it
 * immediately without calling Claude.
 */
export async function generateScene(
  galaxy: Galaxy,
  bodyId: string,
): Promise<GenerateSceneResult> {
  // Check cache first.
  const cached = galaxy.scenes[bodyId];
  if (cached) {
    return { scene: cached, durationMs: 0 };
  }

  const started = Date.now();

  // Look up body → concept.
  const body = galaxy.spatial?.bodies.find((b) => b.id === bodyId);
  if (!body || !("knowledgeRef" in body) || !body.knowledgeRef) {
    throw new Error(`scene: body ${bodyId} not found or not knowledge-bearing`);
  }

  const concept = galaxy.knowledge?.concepts.find(
    (c) => c.id === body.knowledgeRef,
  );
  if (!concept) {
    throw new Error(`scene: concept not found for body ${bodyId}`);
  }

  // Gather context.
  const detail: ConceptDetail | undefined = galaxy.detail[concept.id] as ConceptDetail | undefined;
  const archetype = pickArchetype(concept.id, concept.kind);
  const challengeType = pickChallengeType(concept.id, archetype);

  // Get narrative context.
  const canon = galaxy.narrative?.canon;
  const narrativeCtx = canon
    ? {
        setting: canon.setting,
        protagonist: canon.protagonist,
        premise: canon.premise,
        tone: canon.tone.primary,
        genre: canon.tone.genre,
      }
    : undefined;

  // Get arc beat for this concept's topic.
  const parentSubtopic = galaxy.knowledge?.subtopics.find((s) =>
    s.conceptIds.includes(concept.id),
  );
  const parentTopic = parentSubtopic
    ? galaxy.knowledge?.topics.find((t) =>
        t.subtopicIds.includes(parentSubtopic.id),
      )
    : null;
  const arc = parentTopic
    ? galaxy.narrative?.arcs?.find((a) => a.chapter === concept.chapter)
    : null;
  const beat = arc?.beats?.find((b) => b.topicId === parentTopic?.id);
  const arcBeat = beat
    ? { beat: beat.beat, emotionalTarget: beat.emotionalTarget }
    : undefined;

  // Get visual context.
  const vis = galaxy.visuals?.[bodyId] as any;
  const visualCtx = vis
    ? { biome: vis.biome, character: vis.character, mood: vis.mood }
    : undefined;

  // Get neighbours (sibling concepts in same subtopic, plus others).
  const siblingIds = parentSubtopic?.conceptIds ?? [];
  const siblings = (galaxy.knowledge?.concepts ?? []).filter(
    (c) => c.id !== concept.id && siblingIds.includes(c.id),
  );
  const others = (galaxy.knowledge?.concepts ?? []).filter(
    (c) => c.id !== concept.id && !siblingIds.includes(c.id),
  );
  const neighbours = [...siblings, ...others].slice(0, 6).map((c) => ({
    id: c.id,
    title: c.title,
    brief: c.brief,
  }));

  // Get progress for this body.
  const bodyProgress = galaxy.progress.bodies[bodyId];
  const progressCtx = bodyProgress
    ? {
        visitCount: bodyProgress.attemptCount,
        masteryEstimate: bodyProgress.masteryEstimate,
      }
    : undefined;

  // Build prompt.
  const promptInput: ScenePromptInput = {
    bodyId,
    concept: {
      id: concept.id,
      title: concept.title,
      kind: concept.kind,
      brief: concept.brief,
      modelTier: concept.modelTier,
    },
    fullDefinition: detail?.fullDefinition,
    archetype,
    challengeType,
    narrative: narrativeCtx,
    arcBeat,
    visual: visualCtx,
    neighbours,
    progress: progressCtx,
  };
  const prompt = buildScenePrompt(promptInput);
  const model = MODEL_MAP[concept.modelTier];

  // Run via proxy sub-session.
  const sessionId = `${galaxy.meta.id}--scene--${bodyId}`;
  let scene: Scene;

  try {
    // Push minimal context files.
    const files: Record<string, string> = {};

    // Push the concept's detail file if available (so Claude can reference it).
    if (detail?.fullDefinition) {
      files[`context/concept.md`] = [
        `---`,
        `conceptId: ${concept.id}`,
        `title: "${concept.title}"`,
        `kind: ${concept.kind}`,
        `brief: "${concept.brief}"`,
        `---`,
        ``,
        detail.fullDefinition,
      ].join("\n");
    }

    await pushFiles(sessionId, files);

    const result = await runStage({
      galaxyId: sessionId,
      prompt,
      model,
      onProgress: (line) => {
        // Could stream to client in future
      },
    });

    if (!result.ok) {
      throw new Error(`scene generation failed: exit code ${result.exitCode}`);
    }

    // Collect and parse output.
    const outputFiles = await compileFiles(sessionId);
    scene = parseSceneFromFiles(outputFiles, bodyId, concept.modelTier, archetype, challengeType);
  } catch (err) {
    // On failure, generate a fallback scene from concept data.
    console.warn(
      `[scene] Claude generation failed for ${bodyId}, using fallback:`,
      err instanceof Error ? err.message : err,
    );
    scene = buildFallbackScene(bodyId, concept, archetype, challengeType, neighbours);
  } finally {
    destroySession(sessionId).catch(() => {});
  }

  // Cache in blob and persist.
  galaxy.scenes[bodyId] = scene;
  galaxy.meta.updatedAt = Date.now();

  try {
    saveGalaxy(galaxy);
  } catch (err) {
    console.warn(`[scene] failed to persist scene for ${bodyId}:`, err);
  }

  return { scene, durationMs: Date.now() - started };
}

// ─── Parse scene output from workspace files ────────────────────────

function parseSceneFromFiles(
  files: Record<string, string>,
  bodyId: string,
  modelTier: string,
  archetype: SceneArchetype,
  challengeType: Challenge["type"],
): Scene {
  // Find the scene file.
  const sceneFile = Object.entries(files).find(
    ([path]) => path.startsWith("stage6-scenes/") && path.endsWith(".md"),
  );

  if (!sceneFile) {
    throw new Error("no scene file found in output");
  }

  const [, content] = sceneFile;
  const note = parseNote(content, sceneFile[0]);
  const d = note.data;

  // Build the challenge object from frontmatter.
  const rawChallenge = d.challenge as Record<string, unknown>;
  if (!rawChallenge || !rawChallenge.type) {
    throw new Error("scene file missing challenge data");
  }

  // Parse dialogue.
  const rawDialogue = Array.isArray(d.dialogue) ? d.dialogue : [];
  const dialogue = rawDialogue.map((line: any) => ({
    speakerId: line.speakerId ?? null,
    text: String(line.text ?? ""),
  }));

  const contextHash = createHash("md5")
    .update(`${bodyId}-${archetype}-${Date.now()}`)
    .digest("hex")
    .slice(0, 12);

  const scene = SceneSchema.parse({
    bodyId,
    archetype: d.archetype ?? archetype,
    modelTierUsed: modelTier,
    openingNarrative: String(d.openingNarrative ?? ""),
    dialogue,
    challenge: rawChallenge,
    closingNarrative: String(d.closingNarrative ?? ""),
    generatedAt: Date.now(),
    generationContextHash: contextHash,
  });

  return scene;
}

// ─── Fallback scene (no Claude call) ────────────────────────────────
//
// When Claude fails, produce a minimal but valid scene from the
// concept data alone — same approach as the frontend's mockScene.ts.

function buildFallbackScene(
  bodyId: string,
  concept: Concept,
  archetype: SceneArchetype,
  challengeType: Challenge["type"],
  neighbours: { id: string; title: string; brief: string }[],
): Scene {
  const challenge = buildFallbackChallenge(concept, challengeType, neighbours);

  const contextHash = createHash("md5")
    .update(`fallback-${bodyId}-${Date.now()}`)
    .digest("hex")
    .slice(0, 12);

  return SceneSchema.parse({
    bodyId,
    archetype,
    modelTierUsed: concept.modelTier,
    openingNarrative: `You arrive at a strange place. The air shimmers with knowledge of ${concept.title}.`,
    dialogue: [
      { speakerId: null, text: `Let me tell you about ${concept.title}.` },
      { speakerId: null, text: concept.brief },
      { speakerId: null, text: "Now, demonstrate your understanding." },
    ],
    challenge,
    closingNarrative: `You have explored ${concept.title}. The knowledge settles into memory.`,
    generatedAt: Date.now(),
    generationContextHash: contextHash,
  });
}

function buildFallbackChallenge(
  concept: Concept,
  type: Challenge["type"],
  neighbours: { id: string; title: string; brief: string }[],
): Challenge {
  const distractors = neighbours.slice(0, 3);

  switch (type) {
    case "mcq":
      return {
        type: "mcq",
        question: `Which best describes "${concept.title}"?`,
        options: [
          {
            text: concept.brief,
            correct: true,
            explanation: `Correct — ${concept.brief}`,
          },
          ...distractors.map((d) => ({
            text: d.brief,
            correct: false,
            explanation: `This describes "${d.title}", not "${concept.title}".`,
          })),
        ],
      };

    case "match-pairs":
      return {
        type: "match-pairs",
        instruction: "Match each concept to its description.",
        pairs: [concept, ...distractors]
          .slice(0, 4)
          .map((c) => ({ left: c.title, right: c.brief })),
      };

    case "fill-blank":
      return {
        type: "fill-blank",
        instruction: "Fill in the missing term.",
        segments: [
          { kind: "blank" as const, id: "b1", correctAnswer: concept.title, alternatives: [], options: [concept.title, ...distractors.map((d) => d.title)] },
          { kind: "text" as const, value: ` — ${concept.brief}` },
        ],
      };

    case "dialogue-choice":
      return {
        type: "dialogue-choice",
        setup: `Your companion asks about ${concept.title}.`,
        exchanges: [
          {
            npcLine: `How would you describe ${concept.title}?`,
            playerOptions: [
              {
                text: concept.brief,
                correct: true,
                npcReaction: "Exactly right.",
                emotion: "encouraging",
              },
              ...distractors.slice(0, 2).map((d) => ({
                text: d.brief,
                correct: false,
                npcReaction: `That describes "${d.title}", not what I asked.`,
                emotion: "stern",
              })),
            ],
          },
        ],
      };

    case "drag-sort": {
      const items = [concept, ...distractors].slice(0, 4);
      return {
        type: "drag-sort",
        instruction: "Arrange these concepts in logical order.",
        items: items.map((c, i) => ({
          id: c.id,
          label: c.title,
          correctIndex: i,
        })),
      };
    }

    case "hotspot": {
      const targets = [concept, ...distractors].slice(0, 4);
      const positions = [
        { x: 25, y: 30 },
        { x: 65, y: 25 },
        { x: 35, y: 65 },
        { x: 72, y: 60 },
      ];
      return {
        type: "hotspot",
        instruction: "Discover the key concepts.",
        hotspots: targets.map((t, i) => ({
          id: t.id,
          label: t.title,
          x: positions[i % positions.length].x,
          y: positions[i % positions.length].y,
          revealText: t.brief,
          required: t.id === concept.id,
        })),
      };
    }

    case "timer": {
      return {
        type: "timer",
        urgencyNarrative: `Systems failing! Identify "${concept.title}" now!`,
        timeSeconds: 25,
        question: `Which describes "${concept.title}"?`,
        options: [
          { text: concept.brief, correct: true },
          ...distractors.map((d) => ({ text: d.brief, correct: false })),
        ],
      };
    }
  }
}
