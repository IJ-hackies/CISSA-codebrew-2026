// Stage 2 — Structure. Four sub-stages:
//
//   2a. Cluster       → partition sources into solar systems
//   2b. Outline       → per solar system, produce planet + concept lists
//   2c. Expand planets → per planet, rich 1500+ word body
//   2d. Expand concepts → per concept, rich body
//
// After 2c and 2d finish, the mesh contains every (Solar System), (Planet),
// and (Concept) markdown file. Story stages run next.

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { generateJson, MODEL_FLASH, MODEL_PRO } from "./gemini";
import { mapLimited, mapLimitedTolerant } from "../lib/concurrency";
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

// ── 2a. Cluster ─────────────────────────────────────────────────────
//
// Scale note: on 1000+ sources this stage was choking because we were
// echoing full 36-char UUIDs back from the model. A 987-source list of
// UUIDs is ~40KB of pure identifiers in the output — enough to cap out
// Flash's output token budget. Switched to numeric indices (source's
// position in ctx.sources) which cuts the output by >10x, and we map
// back to UUIDs ourselves after the call.

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
        "Thematic solar systems partitioning the sources. Every source index must be assigned to exactly one solar system. Aim for 3-7 systems; go up to 12 only for very large and diverse input sets.",
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

export async function runClusterStage(ctx: PipelineContext): Promise<void> {
  const n = ctx.sources.length;
  if (n === 0) return;

  // Compact input: one line per source. ~40-60 tokens each.
  // `<idx>. <title> | themes: <csv> | tone: <word>`
  const lines = ctx.sources.map((s, i) => {
    const themes = s.keyThemes.slice(0, 4).join(", ");
    return `${i}. ${s.title} | themes: ${themes} | tone: ${s.tone}`;
  });

  // Target solar-system count — scales sub-linearly with source count so
  // we don't end up with 200 clusters of 5 items each.
  const targetLo = Math.min(3, Math.max(1, Math.ceil(n / 20)));
  const targetHi = Math.min(12, Math.max(targetLo + 1, Math.ceil(Math.sqrt(n))));

  const prompt = [
    `You are designing a knowledge galaxy out of ${n} source documents.`,
    ``,
    `Group them into ${targetLo}-${targetHi} thematic "solar systems". Each source must be assigned to exactly one solar system by its numeric index. Prefer fewer, broader systems over many narrow ones.`,
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
    // Scale output budget with source count: ~3 tokens/index for the
    // JSON array plus cluster metadata overhead. Clamp to 65k (Flash max).
    maxOutputTokens: Math.min(65536, Math.max(8192, 2048 + n * 6)),
  });

  // Validate indices and build final clusters with UUIDs.
  const seen = new Set<number>();
  const cleanClusters: Array<{
    title: string;
    oneLineDescription: string;
    sourceIds: string[];
  }> = [];

  for (const ss of result.solarSystems) {
    const sourceIds: string[] = [];
    for (const idx of ss.indices) {
      if (idx < 0 || idx >= n) continue; // out of range — drop
      if (seen.has(idx)) continue; // duplicate — drop (first assignment wins)
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

  // Catch any sources the model forgot so we don't silently drop content.
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
  solarSystemBody: z.string().min(100),
  planets: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        oneLineHook: z.string().min(10).max(600),
        sourceIds: z.array(z.string()).min(1),
        planetConnections: z.array(z.string()).max(8),
      }),
    )
    .min(3)
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
    .min(2)
    .max(10),
});

const outlineJsonSchema = {
  type: "object",
  required: ["solarSystemBody", "planets", "concepts"],
  properties: {
    solarSystemBody: {
      type: "string",
      description:
        "A rich 2-4 paragraph description of the solar system as a whole. Describe its theme, mood, and scope. Not a summary — prose.",
    },
    planets: {
      type: "array",
      minItems: 3,
      maxItems: 14,
      description:
        "5-10 concrete knowledge planets. Each is a distinct tangible thing (a concept, technique, example, or entity) drawn from the sources.",
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
            description: "Which source ids (from the ones below) this planet draws from",
          },
          planetConnections: {
            type: "array",
            items: { type: "string" },
            description:
              "Titles of other planets in THIS solar system that relate to this one. Must match another title in this outline exactly. 1-5 is typical.",
          },
        },
      },
    },
    concepts: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      description:
        "4-7 concepts — themes, techniques, people, patterns. Flexible nodes that connect planets and stories together.",
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
  concurrency = 3,
): Promise<void> {
  await mapLimited(ctx.solarSystems, concurrency, async (ss) => {
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
      `Produce an outline of 5-10 concrete PLANETS (tangible knowledge nodes — a concept, a technique, a specific example, an entity) and 4-7 flexible CONCEPTS (themes, patterns, people, techniques). Also produce a 2-4 paragraph SOLAR SYSTEM BODY describing the system as a whole in rich prose.`,
      ``,
      `Rules:`,
      `- Planet titles should be specific and evocative. Not generic.`,
      `- Each planet must reference at least one source id from the list above.`,
      `- Planet connections must reference OTHER planet titles that appear in YOUR outline. No external titles.`,
      `- Concepts can be abstract (a theme) or concrete (a named person, technique, pattern).`,
      `- Concept connections reference either planet titles or other concept titles from this outline.`,
    ].join("\n");

    const outline = await generateJson({
      model: MODEL_PRO,
      parts: [{ text: prompt }],
      schema: outlineSchema,
      jsonSchema: outlineJsonSchema,
      temperature: 0.8,
      maxOutputTokens: 8192,
    });

    ss.body = outline.solarSystemBody;

    // Only allow sourceIds that belong to this system.
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

    // Prune self-references and unknown titles from connections, since
    // those won't resolve to wikilinks later.
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

    // Write (Solar System) file now that we have titles + body.
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

const planetBodySchema = z.object({
  body: z.string().min(800),
});

const planetBodyJsonSchema = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "string",
      description:
        "Rich, dense markdown prose for this planet. 1500-3000 words. Use paragraphs. Embed `[[(Planet) Name]]` and `[[(Concept) Name]]` wikilinks inline where natural — only use titles from the provided lists. Do not include a heading — that is added automatically.",
    },
  },
};

export async function runExpandPlanetsStage(
  ctx: PipelineContext,
  concurrency = 6,
): Promise<void> {
  const planetTitles = allPlanetTitles(ctx);
  const conceptTitles = allConceptTitles(ctx);

  const tasks: Array<{ ss: SolarSystemCtx; planet: PlanetCtx }> = [];
  for (const ss of ctx.solarSystems) {
    for (const p of ss.planets) tasks.push({ ss, planet: p });
  }

  const { failed } = await mapLimitedTolerant(
    tasks,
    concurrency,
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
        `Write a rich, dense markdown body for this planet. 1500-3000 words. Multiple paragraphs. Concrete details, examples, definitions, consequences. Inline \`[[(Planet) Other Title]]\` and \`[[(Concept) Name]]\` wikilinks where a reader would benefit from jumping — but only using titles from the lists above. Do NOT include a top-level heading (it is added when the file is written). Do not hedge. Do not add meta-commentary. Return structured JSON.`,
      ].join("\n");

      const out = await generateJson({
        model: MODEL_PRO,
        parts: [{ text: prompt }],
        schema: planetBodySchema,
        jsonSchema: planetBodyJsonSchema,
        temperature: 0.85,
        maxOutputTokens: 8192,
      });

      planet.body = out.body;

      writePlanet(ctx.galaxyId, {
        id: planet.id,
        title: planet.title,
        planetConnections: planet.planetConnectionTitles,
        body: planet.body,
      });

      return planet;
    },
  );

  // Drop planets that never got a body written so downstream stages
  // don't try to reference them via wikilinks that won't resolve.
  for (const ss of ctx.solarSystems) {
    ss.planets = ss.planets.filter((p) => p.body !== undefined);
  }
  if (failed > 0) {
    console.warn(`[expand-planet] ${failed}/${tasks.length} planet(s) failed — dropped from mesh`);
  }
}

// ── 2d. Expand each concept ─────────────────────────────────────────

const conceptBodySchema = z.object({
  body: z.string().min(400),
});

const conceptBodyJsonSchema = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "string",
      description:
        "Rich markdown body for this concept. 600-1500 words. Paragraphs. Inline `[[(Planet) Name]]` and `[[(Concept) Name]]` wikilinks using only titles from the provided lists. No top-level heading.",
    },
  },
};

export async function runExpandConceptsStage(
  ctx: PipelineContext,
  concurrency = 6,
): Promise<void> {
  const planetTitles = allPlanetTitles(ctx);
  const conceptTitles = allConceptTitles(ctx);

  const tasks: Array<{ ss: SolarSystemCtx; concept: ConceptCtx }> = [];
  for (const ss of ctx.solarSystems) {
    for (const c of ss.concepts) tasks.push({ ss, concept: c });
  }

  const { failed } = await mapLimitedTolerant(tasks, concurrency, "expand-concept", async ({ ss, concept }) => {
    // Give the concept access to its solar system's sources — broader
    // context than a planet gets.
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
      `Write a rich markdown body for this concept. 600-1500 words. Unlike a planet, a concept can be more thematic — explore why it matters, how it shows up across different planets, what makes it distinctive. Inline \`[[wikilinks]]\` using only titles from the lists above. No top-level heading.`,
    ].join("\n");

    const out = await generateJson({
      model: MODEL_PRO,
      parts: [{ text: prompt }],
      schema: conceptBodySchema,
      jsonSchema: conceptBodyJsonSchema,
      temperature: 0.85,
      maxOutputTokens: 6144,
    });

    concept.body = out.body;

    writeConcept(ctx.galaxyId, {
      id: concept.id,
      title: concept.title,
      planetConnections: concept.planetConnectionTitles,
      conceptConnections: concept.conceptConnectionTitles,
      body: concept.body,
    });

    return concept;
  });

  for (const ss of ctx.solarSystems) {
    ss.concepts = ss.concepts.filter((c) => c.body !== undefined);
  }
  if (failed > 0) {
    console.warn(`[expand-concept] ${failed}/${tasks.length} concept(s) failed — dropped from mesh`);
  }
}
