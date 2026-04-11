// Stage 3 — Stories. Two sub-stages:
//
//   3a. Pitches       → one Pro call → budget.stories.min..max story plans
//   3b. Write stories → parallel Pro calls via the shared Pro limiter
//
// Each story is one character's themed journey across planets from any
// solar system. Counts, scene counts, and per-section word targets all
// come from the galaxy's InputBudget.

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateJson, MODEL_PRO } from "./gemini";
import { mapViaLimiter, type Limiter } from "../lib/concurrency";
import { writeStory } from "../workspace/write";
import type { PipelineContext, StoryCtx } from "./context";
import { allPlanets, allConcepts } from "./context";
import type { InputBudget } from "./budget";
import { wordsToOutputTokens } from "./budget";

// ── 3a. Story pitches ──────────────────────────────────────────────

const pitchesSchema = z.object({
  stories: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        character: z.string().min(1).max(1200),
        drivingConcepts: z.array(z.string()).min(1).max(5),
        plannedPlanets: z.array(z.string()).min(1).max(14),
        arcOutline: z.string().min(30).max(2000),
      }),
    )
    .min(1)
    .max(8),
});

const pitchesJsonSchema = {
  type: "object",
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      description:
        "Story pitches. Each is a themed journey, one character, visiting several planets (possibly across different solar systems).",
      items: {
        type: "object",
        required: ["title", "character", "drivingConcepts", "plannedPlanets", "arcOutline"],
        properties: {
          title: { type: "string", description: "Evocative story title" },
          character: {
            type: "string",
            description:
              "One or two sentences: the character's name, background, and why this journey matters to them.",
          },
          drivingConcepts: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description:
              "Concept titles (from the provided list) that define the character's motivation for the journey.",
          },
          plannedPlanets: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 14,
            description:
              "Planet titles (from the provided list) the character visits IN ORDER. Count is set in the prompt.",
          },
          arcOutline: {
            type: "string",
            description: "A few sentences outlining the emotional/intellectual arc across the journey.",
          },
        },
      },
    },
  },
};

export async function runStoryPitchesStage(
  ctx: PipelineContext,
  budget: InputBudget,
): Promise<void> {
  const planets = allPlanets(ctx);
  const concepts = allConcepts(ctx);
  if (planets.length === 0) return;

  const planetDigest = planets
    .map((p) => `- ${p.title}: ${p.oneLineHook}`)
    .join("\n");
  const conceptDigest = concepts
    .map((c) => `- ${c.title}: ${c.oneLineHook}`)
    .join("\n");

  // Clamp the scene-count range to what we actually have — can't visit
  // 10 planets on a galaxy that only has 3.
  const maxScenes = Math.min(budget.storyScenes.max, planets.length);
  const minScenes = Math.min(budget.storyScenes.min, maxScenes);

  const prompt = [
    `You are pitching narrative stories for a knowledge galaxy. Each story follows ONE original character on a themed journey across PLANETS, driven by CONCEPTS that define their motivation.`,
    ``,
    `Stories are character-driven. They can span solar systems — the journey is thematic, not geographic. Scale the ambition to the input: small galaxies get short journeys, not epics.`,
    ``,
    `Available planets (the character will visit a selection):`,
    planetDigest,
    ``,
    `Available concepts (pick 1-3 per story as the driving "why"):`,
    conceptDigest,
    ``,
    `Pitch ${budget.stories.min}-${budget.stories.max} stories. Each story should visit ${minScenes}-${maxScenes} planets. Each story's character should be distinct — different background, different question, different voice. Pick planets that cohere around each story's theme — do not just use adjacent planets. Return JSON.`,
  ].join("\n");

  const result = await generateJson({
    model: MODEL_PRO,
    parts: [{ text: prompt }],
    schema: pitchesSchema,
    jsonSchema: pitchesJsonSchema,
    temperature: 0.9,
    maxOutputTokens: 4096,
  });

  const planetTitleSet = new Set(planets.map((p) => p.title));
  const conceptTitleSet = new Set(concepts.map((c) => c.title));

  ctx.stories = result.stories
    .map<StoryCtx>((s) => ({
      id: randomUUID(),
      title: s.title,
      character: s.character,
      drivingConceptTitles: s.drivingConcepts.filter((t) => conceptTitleSet.has(t)),
      plannedPlanetTitles: s.plannedPlanets.filter((t) => planetTitleSet.has(t)),
      arcOutline: s.arcOutline,
    }))
    .filter((s) => s.plannedPlanetTitles.length >= 1 && s.drivingConceptTitles.length >= 1);
}

// ── 3b. Write each story ────────────────────────────────────────────

// Schema mins lowered so tiny/small stories (150-word intros, 150-word
// scenes) pass validation without the model padding to hit a floor.
const storyBodySchema = z.object({
  introduction: z.string().min(150),
  scenes: z
    .array(
      z.object({
        planetTitle: z.string().min(1),
        markdown: z.string().min(120),
      }),
    )
    .min(1),
  conclusion: z.string().min(80),
});

const storyBodyJsonSchema = {
  type: "object",
  required: ["introduction", "scenes", "conclusion"],
  properties: {
    introduction: {
      type: "string",
      description:
        "Opening prose introducing the character and their motivation. Length target is set in the prompt. Reference the driving concepts inline as `[[(Concept) Name]]` wikilinks.",
    },
    scenes: {
      type: "array",
      minItems: 1,
      description:
        "One scene per visited planet, IN ORDER. Scenes should build on each other emotionally. Length per scene is set in the prompt.",
      items: {
        type: "object",
        required: ["planetTitle", "markdown"],
        properties: {
          planetTitle: {
            type: "string",
            description: "Planet title — must exactly match one from the planned list.",
          },
          markdown: {
            type: "string",
            description: "Scene prose. Narrative voice. No headings.",
          },
        },
      },
    },
    conclusion: {
      type: "string",
      description:
        "Closing prose: what the character discovered, how they changed. Reference driving concepts as `[[(Concept) Name]]` wikilinks.",
    },
  },
};

export async function runWriteStoriesStage(
  ctx: PipelineContext,
  budget: InputBudget,
  limiter: Limiter,
): Promise<void> {
  if (ctx.stories.length === 0) return;

  // Total story output budget: intro + (maxScenes × sceneWords) + conclusion.
  // Headroom for JSON structure and wikilink expansion.
  const totalWords =
    budget.storyIntroWords.max +
    budget.storyScenes.max * budget.sceneWords.max +
    budget.conclusionWords.max;
  const storyOutputBudget = wordsToOutputTokens(totalWords, 1024);

  await mapViaLimiter(ctx.stories, limiter, async (story) => {
    const planetsByTitle = new Map(allPlanets(ctx).map((p) => [p.title, p]));
    const plannedPlanets = story.plannedPlanetTitles
      .map((t) => planetsByTitle.get(t))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const planetDigest = plannedPlanets
      .map((p) => {
        const excerpt = (p.body ?? p.oneLineHook).slice(0, 900);
        return `### ${p.title}\nhook: ${p.oneLineHook}\nsnippet: ${excerpt}`;
      })
      .join("\n\n");

    const conceptDigest = story.drivingConceptTitles
      .map((t) => {
        const c = allConcepts(ctx).find((x) => x.title === t);
        return c ? `- ${t}: ${c.oneLineHook}` : `- ${t}`;
      })
      .join("\n");

    const prompt = [
      `You are writing a narrative story for a knowledge galaxy. Real prose, character development, emotional arc — scaled to the available material.`,
      ``,
      `Story title: "${story.title}"`,
      `Character: ${story.character}`,
      `Arc outline: ${story.arcOutline}`,
      ``,
      `Driving concepts (why the character is on this journey):`,
      conceptDigest,
      ``,
      `Planets the character visits, IN ORDER:`,
      planetDigest,
      ``,
      `Write the story in three parts:`,
      `1. INTRODUCTION (${budget.storyIntroWords.min}-${budget.storyIntroWords.max} words) — introduce the character and their motivation. Reference the driving concepts inline as \`[[(Concept) Name]]\` wikilinks.`,
      `2. SCENES — one scene per planet, each ${budget.sceneWords.min}-${budget.sceneWords.max} words of prose narrating the character's arrival and what they discover there, drawing on the planet's content. No headings inside scenes. Use the exact planet title in the scene object.`,
      `3. CONCLUSION (${budget.conclusionWords.min}-${budget.conclusionWords.max} words) — what the character found, how they changed, reference driving concepts again as wikilinks.`,
      ``,
      `These targets are ceilings matched to the input volume — do NOT pad to hit them. If the planet snippets only give you two ideas, two ideas is the right amount.`,
      ``,
      `Voice: third person, confident. The character should feel like a real person with a specific voice, not a tour guide. Show don't tell — let the concepts land through experience rather than naming them explicitly inside scenes.`,
      ``,
      `Return JSON matching the schema.`,
    ].join("\n");

    const out = await generateJson({
      model: MODEL_PRO,
      parts: [{ text: prompt }],
      schema: storyBodySchema,
      jsonSchema: storyBodyJsonSchema,
      temperature: 0.95,
      maxOutputTokens: storyOutputBudget,
    });

    const knownTitles = new Set(plannedPlanets.map((p) => p.title));
    const cleanScenes = out.scenes
      .filter((s) => knownTitles.has(s.planetTitle))
      .map((s) => ({ planetTitle: s.planetTitle, markdown: s.markdown }));

    if (cleanScenes.length < 1) {
      return;
    }

    story.introduction = out.introduction;
    story.scenes = cleanScenes;
    story.conclusion = out.conclusion;

    writeStory(ctx.galaxyId, {
      id: story.id,
      title: story.title,
      introduction: story.introduction,
      scenes: story.scenes,
      conclusion: story.conclusion,
    });
  });
}
