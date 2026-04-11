// Stage (one-shot) — for tiny and small tier input, collapse the entire
// 6-stage pipeline (ingest → cluster → outline → expand → pitches → write)
// into a SINGLE Gemini Flash call that returns the complete galaxy in one
// JSON payload.
//
// Rationale: staged pipelines pay ~6 × stage-latency of serial barriers
// even when each stage has only 1 item. For a "couple pages worth of
// notes" that's 60-120s of wall time for what amounts to one Flash call's
// worth of actual work. This path bypasses the staging entirely and ships
// a complete, wikilinked, story-bearing galaxy in ~10-25s.
//
// Control flow:
//   1. Read raw source files from disk (no ingest round-trip).
//   2. Build ONE multimodal prompt with all source content + full-galaxy
//      generation instructions, gated by the tier's budget.
//   3. Single Flash call with a wide responseJsonSchema covering every
//      entity the pipeline normally produces.
//   4. Create UUIDs, validate wikilinks against the titles the model just
//      emitted, write mesh files, and populate ctx AT THE END so a
//      partial failure leaves ctx clean for the staged fallback.
//   5. Fake progress ticks via setTimeout, reusing the existing staged
//      JobStatus values (ingest/outline/expand/stories) so the frontend's
//      progress display animates through recognisable states.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  generateJson,
  inlineFile,
  MODEL_FLASH,
  type LlmPart,
} from "./gemini";
import type { InputBudget } from "./budget";
import { canonicalizeGeneratedWikilinks } from "../lib/wikilinks";
import { galaxyPaths } from "../workspace/layout";
import {
  writeSource,
  writeSolarSystem,
  writePlanet,
  writeConcept,
  writeStory,
} from "../workspace/write";
import { updateGalaxyStatus } from "../db/client";
import type { SourceRow } from "../db/client";
import type {
  PipelineContext,
  SourceCtx,
  SolarSystemCtx,
  PlanetCtx,
  ConceptCtx,
  StoryCtx,
} from "./context";
import type { JobStatus } from "../types";

// ── Schema for the whole galaxy in one call ────────────────────────

const oneShotSchema = z.object({
  galaxyTitle: z.string().min(1).max(200),
  oneLineDescription: z.string().min(10).max(600),
  solarSystemBody: z.string().min(60),
  planets: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        oneLineHook: z.string().min(5).max(400),
        body: z.string().min(120),
        planetConnections: z.array(z.string()).max(6).default([]),
      }),
    )
    .min(1)
    .max(8),
  concepts: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        oneLineHook: z.string().min(5).max(400),
        body: z.string().min(100),
        planetConnections: z.array(z.string()).max(6).default([]),
        conceptConnections: z.array(z.string()).max(6).default([]),
      }),
    )
    .min(1)
    .max(6),
  story: z.object({
    title: z.string().min(1).max(200),
    character: z.string().min(10).max(1200),
    introduction: z.string().min(120),
    scenes: z
      .array(
        z.object({
          planetTitle: z.string().min(1),
          markdown: z.string().min(100),
        }),
      )
      .min(1)
      .max(8),
    conclusion: z.string().min(60),
  }),
});

type OneShotOutput = z.infer<typeof oneShotSchema>;

const oneShotJsonSchema = {
  type: "object",
  required: [
    "galaxyTitle",
    "oneLineDescription",
    "solarSystemBody",
    "planets",
    "concepts",
    "story",
  ],
  properties: {
    galaxyTitle: {
      type: "string",
      description: "Evocative title for the single solar system this galaxy contains.",
    },
    oneLineDescription: {
      type: "string",
      description: "One sentence describing the solar system's theme and scope.",
    },
    solarSystemBody: {
      type: "string",
      description:
        "A description of the solar system as a whole — mood, themes, scope. Length set in the prompt.",
    },
    planets: {
      type: "array",
      minItems: 1,
      description:
        "Concrete knowledge planets drawn from the sources. Each has a full markdown body.",
      items: {
        type: "object",
        required: ["title", "oneLineHook", "body", "planetConnections"],
        properties: {
          title: { type: "string", description: "Specific, evocative planet title (2-6 words)." },
          oneLineHook: { type: "string", description: "One sentence describing what the planet contains." },
          body: {
            type: "string",
            description:
              "Dense markdown prose. Length set in the prompt. Inline `[[(Planet) Other Title]]` and `[[(Concept) Name]]` wikilinks using ONLY titles also emitted in this response.",
          },
          planetConnections: {
            type: "array",
            items: { type: "string" },
            description: "Titles of other planets in this response that relate to this one.",
          },
        },
      },
    },
    concepts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: [
          "title",
          "oneLineHook",
          "body",
          "planetConnections",
          "conceptConnections",
        ],
        properties: {
          title: { type: "string" },
          oneLineHook: { type: "string" },
          body: {
            type: "string",
            description:
              "Markdown body for the concept. Length set in the prompt. Inline wikilinks to planets/concepts emitted in this same response.",
          },
          planetConnections: { type: "array", items: { type: "string" } },
          conceptConnections: { type: "array", items: { type: "string" } },
        },
      },
    },
    story: {
      type: "object",
      required: ["title", "character", "introduction", "scenes", "conclusion"],
      properties: {
        title: { type: "string" },
        character: {
          type: "string",
          description:
            "One or two sentences: the character's name, background, and why this journey matters to them.",
        },
        introduction: {
          type: "string",
          description:
            "Opening prose. Reference driving concepts as `[[(Concept) Name]]` wikilinks. Length set in the prompt.",
        },
        scenes: {
          type: "array",
          minItems: 1,
          description:
            "One scene per visited planet, IN ORDER. Length per scene set in the prompt.",
          items: {
            type: "object",
            required: ["planetTitle", "markdown"],
            properties: {
              planetTitle: {
                type: "string",
                description:
                  "Must exactly match one of the planet titles emitted in this response.",
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
    },
  },
};

// ── Source loading ─────────────────────────────────────────────────

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
  "text/xml",
  "application/xml",
]);

function isTextMime(mime: string): boolean {
  return TEXT_MIMES.has(mime) || mime.startsWith("text/");
}

// Text sources get inlined into the prompt as labelled blocks.
// Multimodal sources (PDFs, images) go through inlineData parts.
// Truncation cap per source keeps the total prompt comfortable even
// with 5 small-tier sources — total text budget stays well under
// Flash's context window before instructions + output headroom.
const TEXT_CHARS_PER_SOURCE = 6000;

interface PreparedSource {
  row: SourceRow;
  buf: Buffer;
  isText: boolean;
  snippet: string; // For text: truncated content. For binary: filename stub.
}

function prepareSources(galaxyId: string, rows: SourceRow[]): PreparedSource[] {
  const paths = galaxyPaths(galaxyId);
  return rows.map((row) => {
    const absPath = join(paths.mediaSources, row.mediaPath);
    const buf = readFileSync(absPath);
    const isText = isTextMime(row.mimeType);
    const snippet = isText
      ? buf.toString("utf8").slice(0, TEXT_CHARS_PER_SOURCE)
      : `(binary file: ${row.filename})`;
    return { row, buf, isText, snippet };
  });
}

// Build the full prompt parts: header text + per-source labelled blocks
// (text inline or inlineData) + a trailing "now produce JSON" nudge.
function buildParts(
  prepared: PreparedSource[],
  budget: InputBudget,
  galaxyTitle: string,
): LlmPart[] {
  const parts: LlmPart[] = [];

  // Scene count is bounded by both the tier budget AND the planet count
  // we plan to emit — can't visit 5 planets if we only have 3.
  const sceneMax = Math.min(
    budget.storyScenes.max,
    budget.planetsPerSystem.max,
  );
  const sceneMin = Math.min(budget.storyScenes.min, sceneMax);

  const header = [
    `You are building a complete knowledge galaxy from a small batch of source documents, in a single pass.`,
    ``,
    `Galaxy title hint: "${galaxyTitle || "Untitled"}"`,
    `Source count: ${prepared.length}`,
    ``,
    `You will produce, in ONE structured JSON response:`,
    `- a single SOLAR SYSTEM (title, one-line description, and a ${budget.solarSystemBodyWords.min}-${budget.solarSystemBodyWords.max} word body),`,
    `- ${budget.planetsPerSystem.min}-${budget.planetsPerSystem.max} PLANETS (each with a ${budget.planetBodyWords.min}-${budget.planetBodyWords.max} word markdown body),`,
    `- ${budget.conceptsPerSystem.min}-${budget.conceptsPerSystem.max} CONCEPTS (each with a ${budget.conceptBodyWords.min}-${budget.conceptBodyWords.max} word markdown body),`,
    `- ONE STORY following an original character on a themed journey: an intro (${budget.storyIntroWords.min}-${budget.storyIntroWords.max} words), ${sceneMin}-${sceneMax} scenes (each ${budget.sceneWords.min}-${budget.sceneWords.max} words, one per visited planet IN ORDER), and a conclusion (${budget.conclusionWords.min}-${budget.conclusionWords.max} words).`,
    ``,
    `Rules:`,
    `- Planet titles must be specific and evocative — not generic category names.`,
    `- Inside planet bodies, concept bodies, and story intro/conclusion, inline \`[[(Planet) Other Title]]\` and \`[[(Concept) Name]]\` wikilinks where natural, but ONLY use titles you are also emitting in this same response.`,
    `- Every scene's \`planetTitle\` must exactly match a planet title from your \`planets\` array.`,
    `- Match the output to the source material volume — do NOT pad to hit length targets. Short source → proportionally shorter bodies.`,
    `- Voice: confident, concrete, no hedging. Show don't tell inside story scenes.`,
    ``,
    `Source documents follow. They are labelled by index.`,
  ].join("\n");

  parts.push({ text: header });

  prepared.forEach((s, i) => {
    if (s.isText) {
      parts.push({
        text: [
          ``,
          `--- SOURCE ${i} — ${s.row.filename} (${s.row.mimeType}) ---`,
          s.snippet,
          `--- END SOURCE ${i} ---`,
        ].join("\n"),
      });
    } else {
      parts.push({
        text: `\n--- SOURCE ${i} — ${s.row.filename} (${s.row.mimeType}) ---\n`,
      });
      parts.push(inlineFile(s.buf, s.row.mimeType));
      parts.push({ text: `\n--- END SOURCE ${i} ---\n` });
    }
  });

  parts.push({
    text: `\nNow return the JSON response. Match the schema exactly.`,
  });

  return parts;
}

// Headroom for the entire galaxy in a single call. Flash's hard output
// ceiling is much higher; we're staying modest to keep latency down.
// `generateJson`'s internal retry-at-2x covers soft truncation.
function oneShotOutputTokens(budget: InputBudget): number {
  const totalWords =
    budget.solarSystemBodyWords.max +
    budget.planetsPerSystem.max * budget.planetBodyWords.max +
    budget.conceptsPerSystem.max * budget.conceptBodyWords.max +
    budget.storyIntroWords.max +
    budget.storyScenes.max * budget.sceneWords.max +
    budget.conclusionWords.max;
  // 1.8 tokens/word accounts for JSON structure, wikilinks, and Flash
  // being slightly more token-greedy on structured output than on prose.
  const raw = Math.ceil(totalWords * 1.8) + 2048;
  // Round up to 2048 multiple, cap at 32768 — well under Flash's ceiling
  // but far more than the biggest small-tier galaxy will ever need.
  return Math.min(32768, Math.ceil(raw / 2048) * 2048);
}

// ── Fake progress ticks (option 1) ─────────────────────────────────
//
// The one-shot path is a single Gemini call with no natural stage
// boundaries. Without fake ticks the frontend sits on "ingest" for 10-25s
// and then jumps straight to "complete", which reads as a hang. These
// ticks animate the existing JobStatus union so the frontend's progress
// display keeps moving without having to learn a new state.

interface ProgressTick {
  afterMs: number;
  status: JobStatus;
  detail: string;
}

const ONESHOT_TICKS: ProgressTick[] = [
  { afterMs: 2500, status: "outline", detail: "sketching galaxy" },
  { afterMs: 5000, status: "expand", detail: "writing planets & concepts" },
  { afterMs: 7500, status: "stories", detail: "writing story" },
];

function startFakeProgress(galaxyId: string): () => void {
  updateGalaxyStatus(galaxyId, "ingest", "reading sources");
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const tick of ONESHOT_TICKS) {
    timers.push(
      setTimeout(() => {
        updateGalaxyStatus(galaxyId, tick.status, tick.detail);
      }, tick.afterMs),
    );
  }
  return () => {
    for (const t of timers) clearTimeout(t);
  };
}

// ── Stage entry ────────────────────────────────────────────────────

export async function runOneShotPipeline(
  ctx: PipelineContext,
  sourceRows: SourceRow[],
  budget: InputBudget,
): Promise<void> {
  if (sourceRows.length === 0) {
    throw new Error("oneshot: no sources to process");
  }

  const prepared = prepareSources(ctx.galaxyId, sourceRows);
  const parts = buildParts(prepared, budget, ctx.galaxyTitle);
  const maxOutputTokens = oneShotOutputTokens(budget);

  const stopProgress = startFakeProgress(ctx.galaxyId);
  let result: OneShotOutput;
  try {
    result = await generateJson({
      model: MODEL_FLASH,
      parts,
      schema: oneShotSchema,
      jsonSchema: oneShotJsonSchema,
      temperature: 0.8,
      maxOutputTokens,
    });
  } finally {
    stopProgress();
  }

  // Everything below here is CPU-only; no more calls can fail. Safe to
  // start mutating state and writing files.

  // Dedupe titles coming back from the model — Flash occasionally emits
  // the same planet twice with slightly different bodies.
  const planetTitles = new Set<string>();
  const cleanPlanets = result.planets.filter((p) => {
    if (!p.title || planetTitles.has(p.title)) return false;
    planetTitles.add(p.title);
    return true;
  });
  const conceptTitles = new Set<string>();
  const cleanConcepts = result.concepts.filter((c) => {
    if (!c.title || conceptTitles.has(c.title)) return false;
    conceptTitles.add(c.title);
    return true;
  });
  if (cleanPlanets.length === 0) {
    throw new Error("oneshot: no valid planets in response");
  }
  if (cleanConcepts.length === 0) {
    throw new Error("oneshot: no valid concepts in response");
  }

  // Filter connection lists to titles that actually exist in the output.
  // The model is instructed to only reference its own titles but will
  // occasionally hallucinate or echo back something from the prompt.
  const filterList = (titles: string[], allowed: Set<string>, self?: string) =>
    titles.filter((t) => t !== self && allowed.has(t));

  const allPlanetTitles = [...planetTitles];
  const allConceptTitles = [...conceptTitles];

  // Build minimal SourceCtx entries directly from the raw file metadata
  // — no LLM call, filename-derived title, snippet-as-body. Enough for
  // the parser to assemble a valid GalaxyData.
  const sources: SourceCtx[] = prepared.map((p) => {
    const title = p.row.filename.replace(/\.[^.]+$/, "");
    const summary = p.isText
      ? p.snippet.slice(0, 400).trim() || p.row.filename
      : `Uploaded ${p.row.mimeType} file: ${p.row.filename}`;
    return {
      id: randomUUID(),
      title,
      filename: p.row.filename,
      mediaRef: `sources/${p.row.mediaPath}`,
      summary,
      keyThemes: [],
      notableDetails: [],
      tone: "source material",
    };
  });

  const sourceIdList = sources.map((s) => s.id);

  const planetCtxs: PlanetCtx[] = cleanPlanets.map((p) => ({
    id: randomUUID(),
    title: p.title,
    oneLineHook: p.oneLineHook,
    sourceIds: sourceIdList,
    planetConnectionTitles: filterList(p.planetConnections, planetTitles, p.title),
    body: canonicalizeGeneratedWikilinks(p.body, {
      planets: allPlanetTitles,
      concepts: allConceptTitles,
    }),
  }));

  const conceptCtxs: ConceptCtx[] = cleanConcepts.map((c) => ({
    id: randomUUID(),
    title: c.title,
    oneLineHook: c.oneLineHook,
    planetConnectionTitles: filterList(c.planetConnections, planetTitles),
    conceptConnectionTitles: filterList(c.conceptConnections, conceptTitles, c.title),
    body: canonicalizeGeneratedWikilinks(c.body, {
      planets: allPlanetTitles,
      concepts: allConceptTitles,
    }),
  }));

  const solarSystemCtx: SolarSystemCtx = {
    id: randomUUID(),
    title: result.galaxyTitle,
    oneLineDescription: result.oneLineDescription,
    sourceIds: sourceIdList,
    body: result.solarSystemBody,
    planets: planetCtxs,
    concepts: conceptCtxs,
  };

  // Filter story scenes to known planet titles. A story with zero valid
  // scenes is unusable — bail so the fallback can try the staged path.
  const cleanScenes = result.story.scenes
    .filter((s) => planetTitles.has(s.planetTitle))
    .map((s) => ({ planetTitle: s.planetTitle, markdown: s.markdown }));
  if (cleanScenes.length === 0) {
    throw new Error("oneshot: story has no valid scenes");
  }

  const storyCtx: StoryCtx = {
    id: randomUUID(),
    title: result.story.title,
    character: result.story.character,
    drivingConceptTitles: [],
    plannedPlanetTitles: cleanScenes.map((s) => s.planetTitle),
    arcOutline: "",
    introduction: canonicalizeGeneratedWikilinks(result.story.introduction, {
      planets: allPlanetTitles,
      concepts: allConceptTitles,
    }),
    scenes: cleanScenes.map((scene) => ({
      planetTitle: scene.planetTitle,
      markdown: canonicalizeGeneratedWikilinks(scene.markdown, {
        planets: allPlanetTitles,
        concepts: allConceptTitles,
      }),
    })),
    conclusion: canonicalizeGeneratedWikilinks(result.story.conclusion, {
      planets: allPlanetTitles,
      concepts: allConceptTitles,
    }),
  };

  // Write every mesh file. Order doesn't matter for the parser — it
  // indexes by filename + frontmatter id — but a natural order is easier
  // to scan when debugging the workspace by hand.
  for (const s of sources) {
    writeSource(ctx.galaxyId, {
      id: s.id,
      title: s.title,
      filename: s.filename,
      mediaRef: s.mediaRef,
      body: s.summary,
    });
  }
  writeSolarSystem(ctx.galaxyId, {
    id: solarSystemCtx.id,
    title: solarSystemCtx.title,
    planetTitles: planetCtxs.map((p) => p.title),
    conceptTitles: conceptCtxs.map((c) => c.title),
    body: solarSystemCtx.body ?? "",
  });
  for (const p of planetCtxs) {
    writePlanet(ctx.galaxyId, {
      id: p.id,
      title: p.title,
      planetConnections: p.planetConnectionTitles,
      body: p.body ?? "",
    });
  }
  for (const c of conceptCtxs) {
    writeConcept(ctx.galaxyId, {
      id: c.id,
      title: c.title,
      planetConnections: c.planetConnectionTitles,
      conceptConnections: c.conceptConnectionTitles,
      body: c.body ?? "",
    });
  }
  writeStory(ctx.galaxyId, {
    id: storyCtx.id,
    title: storyCtx.title,
    introduction: storyCtx.introduction ?? "",
    scenes: storyCtx.scenes ?? [],
    conclusion: storyCtx.conclusion ?? "",
  });

  // Populate ctx LAST so a throw above leaves it clean for the staged
  // fallback in runPipeline.
  ctx.sources = sources;
  ctx.solarSystems = [solarSystemCtx];
  ctx.stories = [storyCtx];
}
