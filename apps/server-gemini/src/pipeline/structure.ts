// Stage 2 — Structure. Four sub-stages:
//
//   2a. Cluster       → partition sources into solar systems
//   2b. Outline       → per solar system, produce planet + concept lists
//   2c. Expand planets → per planet, rich body
//   2d. Expand concepts → per concept, rich body
//
// Every stage takes an `InputBudget` that scales counts and word targets
// to the actual volume of uploaded content. Every Pro-backed stage runs
// through a shared `proLimiter` so outline + expand + stories compete
// fairly for one per-minute quota budget.

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateJson, generateText, MODEL_FLASH } from "./gemini";
import { mapViaLimiter, mapViaLimiterTolerant, type Limiter } from "../lib/concurrency";
import { canonicalizeGeneratedWikilinks } from "../lib/wikilinks";
import {
  writeSolarSystem,
  writePlanet,
  writeConcept,
} from "../workspace/write";
import type {
  PipelineContext,
  PlanetCtx,
  ConceptCtx,
  SolarSystemCtx,
} from "./context";
import { allPlanetTitles, allConceptTitles } from "./context";
import type { InputBudget } from "./budget";
import { wordsToOutputTokens, modelForBudget } from "./budget";

// Strip fenced code blocks and leading headings from freeform prose
// output. Flash/Pro sometimes wrap markdown in ``` fences or add a
// top-level heading even when the prompt says not to — cheap to clean up
// once on the way out rather than fighting the model on every prompt.
function stripProseArtifacts(raw: string): string {
  let out = raw.trim();
  const fenceMatch = out.match(/^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) out = fenceMatch[1].trim();
  // Strip ONE leading `# heading` line if present — the file writer adds
  // the real heading from the planet title.
  out = out.replace(/^#[^\n]*\n+/, "");
  return out.trim();
}

// ── 2a. Cluster ─────────────────────────────────────────────────────
//
// Numeric indices (not UUIDs) in the response keep the output small.
// On a 500-source run the cluster call's output used to be mostly
// identifiers; switching to indices cut it by ~10x.

const clusterSchema = z.object({
  solarSystems: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        oneLineDescription: z.string().min(10).max(600),
        indices: z.array(z.number().int().nonnegative()).min(1),
      }),
    )
    .min(1)
    .max(12),
});

const clusterJsonSchema = {
  type: "object",
  required: ["solarSystems"],
  properties: {
    solarSystems: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      description:
        "Thematic solar systems partitioning the sources. Every source index must be assigned to exactly one solar system.",
      items: {
        type: "object",
        required: ["title", "oneLineDescription", "indices"],
        properties: {
          title: { type: "string", description: "Short evocative title (2-6 words)" },
          oneLineDescription: { type: "string", description: "One sentence describing the theme" },
          indices: {
            type: "array",
            items: { type: "integer", minimum: 0 },
            minItems: 1,
            description:
              "Source list indices belonging to this solar system. Must reference the numbered entries from the input.",
          },
        },
      },
    },
  },
};

export async function runClusterStage(
  ctx: PipelineContext,
  budget: InputBudget,
): Promise<void> {
  const n = ctx.sources.length;
  if (n === 0) return;

  // Lever 4: a single source never needs clustering — there's no partition
  // to discover. Synthesise one solar system and skip the Flash call.
  // Title falls back through galaxy title → first source title → a placeholder
  // so the downstream outline prompt always has something to work with.
  // Multi-source uploads always go through the AI cluster call so topics can
  // be separated into distinct solar systems.
  if (n === 1) {
    const title =
      ctx.galaxyTitle?.trim() || ctx.sources[0]?.title || "Knowledge Galaxy";
    const themes = Array.from(
      new Set(ctx.sources.flatMap((s) => s.keyThemes.slice(0, 3))),
    ).slice(0, 5);
    const description =
      themes.length > 0
        ? `A focused collection exploring ${themes.join(", ")}.`
        : `A focused collection of ${n} source document${n === 1 ? "" : "s"}.`;
    ctx.solarSystems = [
      {
        id: randomUUID(),
        title,
        oneLineDescription: description,
        sourceIds: ctx.sources.map((s) => s.id),
        planets: [],
        concepts: [],
      },
    ];
    return;
  }

  // Compact input: one line per source (or segment, post-ingest). A long
  // source may have been split into multiple virtual sources during
  // ingest — each one is labelled with its segment title here, so the
  // cluster model sees the real topic structure instead of just filenames.
  const lines = ctx.sources.map((s, i) => {
    const themes = s.keyThemes.slice(0, 4).join(", ");
    return `${i}. ${s.title} | themes: ${themes} | tone: ${s.tone}`;
  });

  // Target range comes from the budget, floored so multi-source uploads
  // always get a chance to split. If n >= 2 we never ask for just 1
  // system — the previous behaviour (small tier → {1,2}) let Flash
  // collapse everything into a single system, which is the bug this
  // whole change is fixing.
  const targetLo = Math.max(budget.solarSystems.min, n >= 2 ? 2 : 1);
  const targetHi = Math.max(targetLo, budget.solarSystems.max);

  const prompt = [
    `You are designing a knowledge galaxy out of ${n} source document(s) or document segments.`,
    ``,
    `Group them into ${targetLo}-${targetHi} thematic "solar systems". Each source must be assigned to exactly one solar system by its numeric index.`,
    ``,
    `Split clearly distinct topics into separate solar systems. Only group sources together when they share a strong common theme — do NOT merge unrelated topics just to reduce the system count. A galaxy with multiple focused solar systems is better than one sprawling catch-all. If you can identify ${targetLo} or more genuinely distinct themes across these sources, produce that many systems.`,
    ``,
    `Sources (numbered):`,
    lines.join("\n"),
    ``,
    `Return JSON matching the schema. Every source index from 0 to ${n - 1} must appear in exactly one solar system's \`indices\` array. Do not repeat indices across systems. Do not invent indices outside the range.`,
  ].join("\n");

  const result = await generateJson({
    model: MODEL_FLASH,
    parts: [{ text: prompt }],
    schema: clusterSchema,
    jsonSchema: clusterJsonSchema,
    temperature: 0.5,
    // Scale output budget with source count: ~6 tokens/index plus cluster
    // overhead. Clamp to 65k (Flash max).
    maxOutputTokens: Math.min(65536, Math.max(2048, 2048 + n * 6)),
  });

  const seen = new Set<number>();
  const cleanClusters: Array<{
    title: string;
    oneLineDescription: string;
    sourceIds: string[];
  }> = [];

  for (const ss of result.solarSystems) {
    const sourceIds: string[] = [];
    for (const idx of ss.indices) {
      if (idx < 0 || idx >= n) continue;
      if (seen.has(idx)) continue;
      seen.add(idx);
      sourceIds.push(ctx.sources[idx].id);
    }
    if (sourceIds.length > 0) {
      cleanClusters.push({
        title: ss.title,
        oneLineDescription: ss.oneLineDescription,
        sourceIds,
      });
    }
  }

  // Safety net for sources the model forgot.
  const unplaced: string[] = [];
  for (let i = 0; i < n; i++) {
    if (!seen.has(i)) unplaced.push(ctx.sources[i].id);
  }
  if (unplaced.length > 0) {
    cleanClusters.push({
      title: "Uncategorized",
      oneLineDescription: "Sources not placed in a primary theme.",
      sourceIds: unplaced,
    });
  }

  ctx.solarSystems = cleanClusters.map<SolarSystemCtx>((ss) => ({
    id: randomUUID(),
    title: ss.title,
    oneLineDescription: ss.oneLineDescription,
    sourceIds: ss.sourceIds,
    planets: [],
    concepts: [],
  }));
}

// ── 2b. Outline per solar system ────────────────────────────────────

const outlineSchema = z.object({
  solarSystemBody: z.string().min(40),
  planets: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        oneLineHook: z.string().min(10).max(600),
        sourceIds: z.array(z.string()).min(1),
        planetConnections: z.array(z.string()).max(8),
      }),
    )
    .min(1)
    .max(14),
  concepts: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        oneLineHook: z.string().min(10).max(600),
        planetConnections: z.array(z.string()).max(8),
        conceptConnections: z.array(z.string()).max(8),
      }),
    )
    .min(1)
    .max(10),
});

const outlineJsonSchema = {
  type: "object",
  required: ["solarSystemBody", "planets", "concepts"],
  properties: {
    solarSystemBody: {
      type: "string",
      description:
        "A description of the solar system as a whole — its theme, mood, and scope. Length matches the input volume, not a fixed target.",
    },
    planets: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      description:
        "Concrete knowledge planets. Each is a distinct tangible thing (a concept, technique, example, or entity) drawn from the sources.",
      items: {
        type: "object",
        required: ["title", "oneLineHook", "sourceIds", "planetConnections"],
        properties: {
          title: { type: "string", description: "Specific, evocative title (2-6 words)" },
          oneLineHook: { type: "string", description: "One sentence describing what this planet contains" },
          sourceIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Which source ids this planet draws from",
          },
          planetConnections: {
            type: "array",
            items: { type: "string" },
            description:
              "Titles of other planets in THIS solar system that relate to this one. Must match another title in this outline exactly.",
          },
        },
      },
    },
    concepts: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      description:
        "Concepts — themes, techniques, people, patterns. Flexible nodes that connect planets and stories together.",
      items: {
        type: "object",
        required: ["title", "oneLineHook", "planetConnections", "conceptConnections"],
        properties: {
          title: { type: "string" },
          oneLineHook: { type: "string" },
          planetConnections: {
            type: "array",
            items: { type: "string" },
            description: "Planet titles this concept touches.",
          },
          conceptConnections: {
            type: "array",
            items: { type: "string" },
            description: "Other concept titles that relate.",
          },
        },
      },
    },
  },
};

export async function runOutlineStage(
  ctx: PipelineContext,
  budget: InputBudget,
  limiter: Limiter,
): Promise<void> {
  await mapViaLimiter(ctx.solarSystems, limiter, async (ss) => {
    const assignedSources = ctx.sources.filter((s) => ss.sourceIds.includes(s.id));
    const digest = assignedSources
      .map(
        (s) =>
          `- id: ${s.id}\n  title: ${s.title}\n  themes: ${s.keyThemes.join(", ")}\n  summary: ${s.summary}`,
      )
      .join("\n\n");

    const prompt = [
      `You are outlining a "solar system" of knowledge from a set of source documents.`,
      ``,
      `Solar system title: "${ss.title}"`,
      `One-line description: "${ss.oneLineDescription}"`,
      ``,
      `Assigned source documents:`,
      digest,
      ``,
      `Produce an outline of ${budget.planetsPerSystem.min}-${budget.planetsPerSystem.max} concrete PLANETS (tangible knowledge nodes — a concept, a technique, a specific example, an entity) and ${budget.conceptsPerSystem.min}-${budget.conceptsPerSystem.max} flexible CONCEPTS (themes, patterns, people, techniques). Also produce a SOLAR SYSTEM BODY of ${budget.solarSystemBodyWords.min}-${budget.solarSystemBodyWords.max} words describing the system as a whole. Match the scope to how much source material you actually have — do not invent content to pad the counts.`,
      ``,
      `Rules:`,
      `- Planet titles should be specific and evocative. Not generic.`,
      `- Each planet must reference at least one source id from the list above.`,
      `- Planet connections must reference OTHER planet titles that appear in YOUR outline. No external titles.`,
      `- Concepts can be abstract (a theme) or concrete (a named person, technique, pattern).`,
      `- Concept connections reference either planet titles or other concept titles from this outline.`,
    ].join("\n");

    const outline = await generateJson({
      model: modelForBudget(budget),
      parts: [{ text: prompt }],
      schema: outlineSchema,
      jsonSchema: outlineJsonSchema,
      temperature: 0.8,
      maxOutputTokens: 8192,
    });

    ss.body = outline.solarSystemBody;

    const localSourceIds = new Set(ss.sourceIds);

    ss.planets = outline.planets.map<PlanetCtx>((p) => ({
      id: randomUUID(),
      title: p.title,
      oneLineHook: p.oneLineHook,
      sourceIds: p.sourceIds.filter((id) => localSourceIds.has(id)),
      planetConnectionTitles: p.planetConnections,
    }));

    ss.concepts = outline.concepts.map<ConceptCtx>((c) => ({
      id: randomUUID(),
      title: c.title,
      oneLineHook: c.oneLineHook,
      planetConnectionTitles: c.planetConnections,
      conceptConnectionTitles: c.conceptConnections,
    }));

    const localPlanetTitles = new Set(ss.planets.map((p) => p.title));
    const localConceptTitles = new Set(ss.concepts.map((c) => c.title));
    for (const p of ss.planets) {
      p.planetConnectionTitles = p.planetConnectionTitles.filter(
        (t) => t !== p.title && localPlanetTitles.has(t),
      );
    }
    for (const c of ss.concepts) {
      c.planetConnectionTitles = c.planetConnectionTitles.filter((t) =>
        localPlanetTitles.has(t),
      );
      c.conceptConnectionTitles = c.conceptConnectionTitles.filter(
        (t) => t !== c.title && localConceptTitles.has(t),
      );
    }

    writeSolarSystem(ctx.galaxyId, {
      id: ss.id,
      title: ss.title,
      planetTitles: ss.planets.map((p) => p.title),
      conceptTitles: ss.concepts.map((c) => c.title),
      body: ss.body,
    });
  });
}

// ── 2c. Expand each planet ──────────────────────────────────────────
//
// Lever 6: this stage returns plain markdown via generateText, not a
// single-field JSON wrapper. JSON mode's constrained decoding is slow on
// long outputs and the structured-output salvage logic adds nothing when
// there's only one string field. Freeform is simpler and measurably
// faster, and `stripProseArtifacts` cleans up the two ways the model
// sometimes oversteps (``` fences or a stray `#` heading).

export async function runExpandPlanetsStage(
  ctx: PipelineContext,
  budget: InputBudget,
  limiter: Limiter,
): Promise<void> {
  const planetTitles = allPlanetTitles(ctx);
  const conceptTitles = allConceptTitles(ctx);

  const tasks: Array<{ ss: SolarSystemCtx; planet: PlanetCtx }> = [];
  for (const ss of ctx.solarSystems) {
    for (const p of ss.planets) tasks.push({ ss, planet: p });
  }

  const planetOutputBudget = wordsToOutputTokens(budget.planetBodyWords.max);
  const planetModel = modelForBudget(budget);

  const { failed } = await mapViaLimiterTolerant(
    tasks,
    limiter,
    "expand-planet",
    async ({ ss, planet }) => {
      const assigned = ctx.sources.filter((s) => planet.sourceIds.includes(s.id));
      const sourceDigest = assigned
        .map((s) => `- ${s.title}\n  ${s.summary}`)
        .join("\n\n");

      const prompt = [
        `You are writing the body of a knowledge PLANET for an interactive 3D galaxy.`,
        ``,
        `Planet title: "${planet.title}"`,
        `Hook: "${planet.oneLineHook}"`,
        `Inside solar system: "${ss.title}" — ${ss.oneLineDescription}`,
        ``,
        `Source material this planet is drawn from:`,
        sourceDigest,
        ``,
        `Other planet titles you may wikilink to (only these): ${planetTitles.join(" | ")}`,
        `Concept titles you may wikilink to (only these): ${conceptTitles.join(" | ")}`,
        ``,
        `TARGET LENGTH: ${budget.planetBodyWords.min}-${budget.planetBodyWords.max} words. This is the instruction — not a floor to pad toward. Match it to the source material above. If the source has only two paragraphs of content, your body should feel proportional, not inflated.`,
        ``,
        `Write a dense markdown body. Paragraphs. Concrete details, examples, definitions, consequences. Inline \`[[(Planet) Other Title]]\` and \`[[(Concept) Name]]\` wikilinks where a reader would benefit from jumping — but only using titles from the lists above. Do NOT include a top-level heading (it is added when the file is written). Do not hedge. Do not add meta-commentary.`,
        ``,
        `Return ONLY the markdown body. No JSON wrapper, no fenced code block, no preamble — just the prose.`,
      ].join("\n");

      const raw = await generateText({
        model: planetModel,
        parts: [{ text: prompt }],
        temperature: 0.85,
        maxOutputTokens: planetOutputBudget,
      });

      planet.body = canonicalizeGeneratedWikilinks(stripProseArtifacts(raw), {
        planets: planetTitles,
        concepts: conceptTitles,
      });

      writePlanet(ctx.galaxyId, {
        id: planet.id,
        title: planet.title,
        planetConnections: planet.planetConnectionTitles,
        body: planet.body,
      });

      return planet;
    },
  );

  for (const ss of ctx.solarSystems) {
    ss.planets = ss.planets.filter((p) => p.body !== undefined);
  }
  if (failed > 0) {
    console.warn(`[expand-planet] ${failed}/${tasks.length} planet(s) failed — dropped from mesh`);
  }
}

// ── 2d. Expand each concept ─────────────────────────────────────────
//
// Lever 6: same freeform-text approach as expand-planets. See that
// stage's comment for rationale.

export async function runExpandConceptsStage(
  ctx: PipelineContext,
  budget: InputBudget,
  limiter: Limiter,
): Promise<void> {
  const planetTitles = allPlanetTitles(ctx);
  const conceptTitles = allConceptTitles(ctx);

  const tasks: Array<{ ss: SolarSystemCtx; concept: ConceptCtx }> = [];
  for (const ss of ctx.solarSystems) {
    for (const c of ss.concepts) tasks.push({ ss, concept: c });
  }

  const conceptOutputBudget = wordsToOutputTokens(budget.conceptBodyWords.max);
  const conceptModel = modelForBudget(budget);

  const { failed } = await mapViaLimiterTolerant(
    tasks,
    limiter,
    "expand-concept",
    async ({ ss, concept }) => {
      const digest = ctx.sources
        .filter((s) => ss.sourceIds.includes(s.id))
        .map((s) => `- ${s.title}: ${s.keyThemes.join(", ")}`)
        .join("\n");

      const prompt = [
        `You are writing the body of a CONCEPT in a knowledge galaxy.`,
        ``,
        `Concept title: "${concept.title}"`,
        `Hook: "${concept.oneLineHook}"`,
        `Inside solar system: "${ss.title}"`,
        ``,
        `Surrounding sources in this solar system:`,
        digest,
        ``,
        `Planet titles you may wikilink to: ${planetTitles.join(" | ")}`,
        `Concept titles you may wikilink to: ${conceptTitles.join(" | ")}`,
        ``,
        `TARGET LENGTH: ${budget.conceptBodyWords.min}-${budget.conceptBodyWords.max} words. Match it to the source material — do not pad.`,
        ``,
        `Unlike a planet, a concept can be more thematic — explore why it matters, how it shows up across different planets, what makes it distinctive. Inline \`[[(Planet) Other Title]]\` and \`[[(Concept) Name]]\` wikilinks using only titles from the lists above. No top-level heading.`,
        ``,
        `Return ONLY the markdown body. No JSON wrapper, no fenced code block, no preamble — just the prose.`,
      ].join("\n");

      const raw = await generateText({
        model: conceptModel,
        parts: [{ text: prompt }],
        temperature: 0.85,
        maxOutputTokens: conceptOutputBudget,
      });

      concept.body = canonicalizeGeneratedWikilinks(stripProseArtifacts(raw), {
        planets: planetTitles,
        concepts: conceptTitles,
      });

      writeConcept(ctx.galaxyId, {
        id: concept.id,
        title: concept.title,
        planetConnections: concept.planetConnectionTitles,
        conceptConnections: concept.conceptConnectionTitles,
        body: concept.body,
      });

      return concept;
    },
  );

  for (const ss of ctx.solarSystems) {
    ss.concepts = ss.concepts.filter((c) => c.body !== undefined);
  }
  if (failed > 0) {
    console.warn(`[expand-concept] ${failed}/${tasks.length} concept(s) failed — dropped from mesh`);
  }
}
