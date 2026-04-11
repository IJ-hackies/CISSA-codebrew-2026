// Stage 3 — Stories. Two sub-stages:
//
//   3a. Pitches       → one Pro call → 3-6 story plans (character + driving
//                       concepts + planned planets + arc outline)
//   3b. Write stories → parallel Pro calls → full literature-length narratives
//
// Each story is one character's themed journey across planets from any
// solar system. Concepts define the WHY. Stories are literature, not
// summaries — thousands of words, real character development.

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateJson, MODEL_PRO } from "./gemini";
import { mapLimited } from "../lib/concurrency";
import { writeStory } from "../workspace/write";
import type { PipelineContext, StoryCtx } from "./context";
import { allPlanets, allConcepts } from "./context";

// ── 3a. Story pitches ──────────────────────────────────────────────

const pitchesSchema = z.object({
  stories: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        character: z.string().min(1).max(1200),
        drivingConcepts: z.array(z.string()).min(1).max(5),
        plannedPlanets: z.array(z.string()).min(3).max(14),
        arcOutline: z.string().min(50).max(2000),
      }),
    )
    .min(2)
    .max(8),
});

const pitchesJsonSchema = {
  type: "object",
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      description:
        "3-6 story pitches. Each is a themed journey, one character, visiting several planets (possibly across different solar systems).",
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
            minItems: 3,
            maxItems: 14,
            description:
              "Planet titles (from the provided list) the character visits IN ORDER. 6-12 is typical. Can cross solar system boundaries.",
          },
          arcOutline: {
            type: "string",
            description: "2-4 sentences outlining the emotional/intellectual arc across the journey.",
          },
        },
      },
    },
  },
};

export async function runStoryPitchesStage(ctx: PipelineContext): Promise<void> {
  const planets = allPlanets(ctx);
  const concepts = allConcepts(ctx);
  if (planets.length === 0) return;

  const planetDigest = planets
    .map((p) => `- ${p.title}: ${p.oneLineHook}`)
    .join("\n");
  const conceptDigest = concepts
    .map((c) => `- ${c.title}: ${c.oneLineHook}`)
    .join("\n");

  const prompt = [
    `You are pitching long-form narrative stories for a knowledge galaxy. Each story follows ONE original character on a themed journey across PLANETS, driven by CONCEPTS that define their motivation.`,
    ``,
    `Stories are literature. Thousands of words. Character-driven. Real arcs. They can span solar systems — the journey is thematic, not geographic.`,
    ``,
    `Available planets (the character will visit a selection):`,
    planetDigest,
    ``,
    `Available concepts (pick 1-3 per story as the driving "why"):`,
    conceptDigest,
    ``,
    `Pitch 3-6 stories. Each story's character should be distinct — different background, different question they are trying to answer, different voice. Pick planets that cohere around each story's theme — do not just use adjacent planets. Return JSON.`,
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
    .filter((s) => s.plannedPlanetTitles.length >= 3 && s.drivingConceptTitles.length >= 1);
}

// ── 3b. Write each story ────────────────────────────────────────────

const storyBodySchema = z.object({
  introduction: z.string().min(400),
  scenes: z
    .array(
      z.object({
        planetTitle: z.string().min(1),
        markdown: z.string().min(400),
      }),
    )
    .min(3),
  conclusion: z.string().min(200),
});

const storyBodyJsonSchema = {
  type: "object",
  required: ["introduction", "scenes", "conclusion"],
  properties: {
    introduction: {
      type: "string",
      description:
        "Opening prose introducing the character and their motivation. 400-900 words. Reference the driving concepts inline as `[[(Concept) Name]]` wikilinks.",
    },
    scenes: {
      type: "array",
      minItems: 3,
      description:
        "One scene per visited planet, IN ORDER. Each scene is 400-800 words of prose narrating the character's arrival on that planet and what they discover there. Scenes should build on each other emotionally.",
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
            description: "400-800 words of scene prose. Narrative voice. No headings.",
          },
        },
      },
    },
    conclusion: {
      type: "string",
      description:
        "Closing prose: what the character discovered, how they changed, how the concepts they started with now feel different. 300-600 words. Reference driving concepts as `[[(Concept) Name]]` wikilinks.",
    },
  },
};

export async function runWriteStoriesStage(
  ctx: PipelineContext,
  concurrency = 3,
): Promise<void> {
  if (ctx.stories.length === 0) return;

  await mapLimited(ctx.stories, concurrency, async (story) => {
    // Pull the planets this story visits, with their full hooks + a short
    // excerpt of their body for grounding.
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
      `You are writing a LONG-FORM NARRATIVE STORY for a knowledge galaxy. This is literature, not a summary — real prose, character development, emotional arcs.`,
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
      `1. INTRODUCTION (400-900 words) — introduce the character and their motivation. Reference the driving concepts inline as \`[[(Concept) Name]]\` wikilinks.`,
      `2. SCENES — one scene per planet. Each scene is 400-800 words of prose narrating the character's arrival and what they discover there, drawing on the planet's content. No headings inside scenes. Use the exact planet title in the scene object.`,
      `3. CONCLUSION (300-600 words) — what the character found, how they changed, reference driving concepts again as wikilinks.`,
      ``,
      `Voice: third person, literary, confident. The character should feel like a real person with a specific voice and history, not a tour guide. Show don't tell — let the concepts land through the character's experience rather than naming them explicitly inside scenes.`,
      ``,
      `Return JSON matching the schema.`,
    ].join("\n");

    const out = await generateJson({
      model: MODEL_PRO,
      parts: [{ text: prompt }],
      schema: storyBodySchema,
      jsonSchema: storyBodyJsonSchema,
      temperature: 0.95,
      maxOutputTokens: 16384,
    });

    // Filter scenes to only those whose planetTitle we know about so
    // wikilinks resolve cleanly downstream.
    const knownTitles = new Set(plannedPlanets.map((p) => p.title));
    const cleanScenes = out.scenes
      .filter((s) => knownTitles.has(s.planetTitle))
      .map((s) => ({ planetTitle: s.planetTitle, markdown: s.markdown }));

    if (cleanScenes.length < 3) {
      // Skip stories that failed to produce enough valid scenes rather
      // than write a malformed mesh file.
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
