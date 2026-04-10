// Stage 5: Visuals (parallel sub-session fan-out).
//
// Each knowledge-bearing body gets its own isolated proxy sub-session
// with a focused Claude Code agent (Haiku) that creates exactly ONE
// visual file. Sub-sessions run in parallel.
//
// Decorative bodies are still themed by pure code (zero Claude calls).
//
// Also pre-computes deterministic assignments before fan-out:
//   - biome: picked per subtopic (all moons under one subtopic share a biome)
//   - character: picked per concept based on concept kind
//
// Append-only: existing visual entries are frozen across chapter extensions.

import type {
  Galaxy,
  Body,
  BodyVisual,
  Palette,
  NarrativeCanon,
  Biome,
  SceneCharacterRole,
  ConceptKind,
  Slug,
} from "@scholarsystem/shared";
import { KNOWLEDGE_BEARING_KINDS, DECORATIVE_KINDS } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import {
  pushFiles,
  fanOutSubSessions,
  mergeSubSessionFiles,
  type SubSessionTask,
} from "../lib/proxy-client";
import { buildSingleBodyVisualPrompt } from "../prompts/worldgen/visuals";
import { compileVisuals } from "./compile";

/**
 * Run Stage 5. Mutates the galaxy blob in place, writing into
 * `galaxy.visuals`. Returns the same galaxy for chaining.
 *
 * Requires: knowledge (Stage 1), spatial (Stage 4), narrative.canon (Stage 3).
 */
export async function runVisualsStage(galaxy: Galaxy): Promise<Galaxy> {
  if (!galaxy.knowledge || !galaxy.spatial || !galaxy.narrative.canon) {
    const missing = [
      !galaxy.knowledge && "knowledge",
      !galaxy.spatial && "spatial",
      !galaxy.narrative.canon && "narrative.canon",
    ].filter(Boolean).join(", ");
    console.warn(`[visuals] skipping — missing dependencies: ${missing}`);
    stageError(galaxy, "visuals", `missing dependencies: ${missing}`);
    return galaxy;
  }

  stageStart(galaxy, "visuals");

  try {
    const canon = galaxy.narrative.canon;
    const allBodies = galaxy.spatial.bodies;

    // Split bodies into those already themed and those needing visuals.
    const existingVisualIds = new Set(Object.keys(galaxy.visuals));
    const newBodies = allBodies.filter((b) => !existingVisualIds.has(b.id));

    if (newBodies.length === 0) {
      console.log("[visuals] all bodies already have visuals — no-op");
      stageDone(galaxy, "visuals");
      return galaxy;
    }

    const knowledgeBearing = newBodies.filter((b) =>
      (KNOWLEDGE_BEARING_KINDS as readonly string[]).includes(b.kind),
    );
    const decorative = newBodies.filter((b) =>
      (DECORATIVE_KINDS as readonly string[]).includes(b.kind),
    );

    // Pre-compute deterministic assignments.
    const subtopicBiomes = assignBiomesPerSubtopic(galaxy);
    const conceptCharacters = assignCharactersPerConcept(galaxy);

    // ── Claude path: knowledge-bearing bodies via parallel sub-sessions ──

    if (knowledgeBearing.length > 0) {
      // Pre-compute system palettes: first pass themes systems, then
      // planets/moons/asteroids can reference their parent system's palette.
      // We do this in two waves: systems first, then everything else.
      const systems = knowledgeBearing.filter((b) => b.kind === "system" || b.kind === "galaxy");
      const nonSystems = knowledgeBearing.filter((b) => b.kind !== "system" && b.kind !== "galaxy");

      // Wave 1: systems + galaxy (run in parallel).
      const systemPalettes = new Map<string, { primary: string; secondary: string; accent: string }>();

      if (systems.length > 0) {
        const systemTasks: SubSessionTask[] = systems.map((body) =>
          buildVisualTask(galaxy.meta.id, body, canon, galaxy.knowledge!, subtopicBiomes, conceptCharacters),
        );

        console.log(
          `[visuals] wave 1: ${systemTasks.length} system/galaxy bodies (Haiku)`,
        );

        const systemResults = await fanOutSubSessions(systemTasks);
        const systemFiles = mergeSubSessionFiles(systemResults, "stage5-visuals/");

        if (Object.keys(systemFiles).length > 0) {
          await pushFiles(galaxy.meta.id, systemFiles);
        }

        const systemCompiled = compileVisuals(systemFiles);

        for (const [bodyId, visual] of Object.entries(systemCompiled.visuals)) {
          if (!existingVisualIds.has(bodyId)) {
            galaxy.visuals[bodyId] = visual;
            existingVisualIds.add(bodyId);
          }
          // Extract palette for child bodies.
          if ("palette" in visual) {
            systemPalettes.set(bodyId, visual.palette);
          }
        }

        console.log(
          `[visuals] wave 1 complete: ${Object.keys(systemCompiled.visuals).length}/${systems.length} themed`,
        );
      }

      // Wave 2: planets, moons, asteroids (run in parallel, with system palette hints).
      if (nonSystems.length > 0) {
        const bodyTasks: SubSessionTask[] = nonSystems.map((body) => {
          // Find parent system's palette for coherence hint.
          const parentId = "parentId" in body ? body.parentId : undefined;
          let systemPalette: { primary: string; secondary: string; accent: string } | undefined;
          if (parentId) {
            // For moons, parent is a planet — find the planet's parent system.
            systemPalette = systemPalettes.get(parentId);
            if (!systemPalette) {
              const parentBody = allBodies.find((b) => b.id === parentId);
              if (parentBody && "parentId" in parentBody && parentBody.parentId) {
                systemPalette = systemPalettes.get(parentBody.parentId);
              }
            }
          }

          return buildVisualTask(
            galaxy.meta.id, body, canon, galaxy.knowledge!,
            subtopicBiomes, conceptCharacters, systemPalette,
          );
        });

        console.log(
          `[visuals] wave 2: ${bodyTasks.length} planet/moon/asteroid bodies (Haiku)`,
        );

        const bodyResults = await fanOutSubSessions(bodyTasks);
        const bodyFiles = mergeSubSessionFiles(bodyResults, "stage5-visuals/");

        if (Object.keys(bodyFiles).length > 0) {
          await pushFiles(galaxy.meta.id, bodyFiles);
        }

        const bodyCompiled = compileVisuals(bodyFiles);

        let wave2Themed = 0;
        for (const [bodyId, visual] of Object.entries(bodyCompiled.visuals)) {
          if (!existingVisualIds.has(bodyId)) {
            galaxy.visuals[bodyId] = visual;
            existingVisualIds.add(bodyId);
            wave2Themed++;
          }
        }

        console.log(
          `[visuals] wave 2 complete: ${wave2Themed}/${nonSystems.length} themed`,
        );

        // ── Retry pass for bodies still missing visuals ──
        const allKB = [...systems, ...nonSystems];
        const stillMissing = allKB.filter((b) => !existingVisualIds.has(b.id));
        if (stillMissing.length > 0) {
          console.log(
            `[visuals] retrying ${stillMissing.length} bodies that failed`,
          );

          const retryTasks: SubSessionTask[] = stillMissing.map((body) =>
            buildVisualTask(
              galaxy.meta.id, body, canon, galaxy.knowledge!,
              subtopicBiomes, conceptCharacters, undefined, true,
            ),
          );

          const retryResults = await fanOutSubSessions(retryTasks);
          const retryFiles = mergeSubSessionFiles(retryResults, "stage5-visuals/");

          if (Object.keys(retryFiles).length > 0) {
            await pushFiles(galaxy.meta.id, retryFiles);
          }

          const retryCompiled = compileVisuals(retryFiles);

          let retryCount = 0;
          for (const [bodyId, visual] of Object.entries(retryCompiled.visuals)) {
            if (!existingVisualIds.has(bodyId)) {
              galaxy.visuals[bodyId] = visual;
              existingVisualIds.add(bodyId);
              retryCount++;
            }
          }
          console.log(
            `[visuals] retry pass themed ${retryCount}/${stillMissing.length} remaining bodies`,
          );
        }
      }

      const totalThemed = knowledgeBearing.filter((b) => existingVisualIds.has(b.id)).length;
      console.log(
        `[visuals] ${totalThemed}/${knowledgeBearing.length} knowledge-bearing bodies themed by Claude`,
      );
    }

    // ── Code path: decorative bodies ──
    if (decorative.length > 0) {
      for (const body of decorative) {
        const visual = generateDecorativeVisual(body, canon);
        if (visual) {
          galaxy.visuals[body.id] = visual;
        }
      }

      console.log(
        `[visuals] ${decorative.length} decorative bodies themed by code`,
      );
    }

    stageDone(galaxy, "visuals");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[visuals] stage failed: ${message}`);
    stageError(galaxy, "visuals", message);
    return galaxy;
  }
}

// ───────── Sub-session task builder ─────────

function buildVisualTask(
  galaxyId: string,
  body: Body,
  canon: NarrativeCanon,
  knowledge: import("@scholarsystem/shared").Knowledge,
  subtopicBiomes: Record<string, string>,
  conceptCharacters: Record<string, string>,
  systemPalette?: { primary: string; secondary: string; accent: string },
  isRetry = false,
): SubSessionTask {
  const ref = "knowledgeRef" in body ? body.knowledgeRef : null;

  // Determine biome and character for moons/asteroids.
  let biome: string | undefined;
  let character: string | undefined;
  if (body.kind === "moon" && ref) {
    const sub = knowledge.subtopics.find((s) => s.conceptIds.includes(ref));
    biome = sub ? subtopicBiomes[sub.id] : "neon-city";
    character = conceptCharacters[ref] ?? "sage";
  } else if (body.kind === "asteroid" && ref) {
    biome = "floating-islands";
    character = conceptCharacters[ref] ?? "trickster";
  }

  const prompt = buildSingleBodyVisualPrompt({
    body,
    canon,
    knowledge,
    biome,
    character,
    systemPalette,
  });

  const prefix = isRetry ? `${galaxyId}--vr--` : `${galaxyId}--v--`;

  return {
    sessionId: `${prefix}${body.id}`,
    files: {}, // Visual prompts don't need source files — all context is in the prompt.
    prompt,
    model: "haiku",
    label: body.id,
  };
}

// ───────── Biome assignment ─────────
//
// All concepts within one subtopic share a biome. We rotate through
// biomes deterministically so each subtopic gets a distinct environment.

const BIOME_POOL: Biome[] = [
  "crystal-cave",
  "alien-ruins",
  "space-station",
  "volcanic-surface",
  "frozen-tundra",
  "jungle-canopy",
  "deep-ocean",
  "desert-mesa",
  "floating-islands",
  "neon-city",
];

function assignBiomesPerSubtopic(galaxy: Galaxy): Record<string, string> {
  if (!galaxy.knowledge) return {};
  const map: Record<string, string> = {};
  galaxy.knowledge.subtopics.forEach((sub, i) => {
    map[sub.id] = BIOME_POOL[i % BIOME_POOL.length];
  });
  return map;
}

// ───────── Character assignment ─────────
//
// Deterministic based on concept kind:
//   definition/principle → sage
//   formula/process      → engineer
//   example              → archivist
//   fact                 → trickster
//   warrior/echo are rare — reserved for heavy-tier concepts.

const KIND_TO_CHARACTER: Record<ConceptKind, SceneCharacterRole> = {
  definition: "sage",
  principle: "sage",
  formula: "engineer",
  process: "engineer",
  example: "archivist",
  fact: "trickster",
  framework: "engineer",
  "trade-off": "trickster",
  distinction: "archivist",
  paradigm: "sage",
  property: "archivist",
};

function assignCharactersPerConcept(galaxy: Galaxy): Record<string, string> {
  if (!galaxy.knowledge) return {};
  const map: Record<string, string> = {};
  for (const concept of galaxy.knowledge.concepts) {
    if (concept.modelTier === "heavy") {
      // Heavy-tier concepts get the rare dramatic characters.
      map[concept.id] =
        concept.kind === "principle" || concept.kind === "definition"
          ? "warrior"
          : "echo";
    } else {
      map[concept.id] = KIND_TO_CHARACTER[concept.kind] ?? "sage";
    }
  }
  return map;
}

// ───────── Decorative visual generation (pure code) ─────────
//
// Derive visual params from narrative.canon.aesthetic without any Claude call.
// Uses motif keywords and palette direction to seed a deterministic palette.

function generateDecorativeVisual(
  body: Body,
  canon: NarrativeCanon,
): BodyVisual | null {
  const palette = deriveDecorativePalette(body.id, canon);

  switch (body.kind) {
    case "star": {
      const spectralClass = "spectralClass" in body ? body.spectralClass : "G";
      // Hotter spectral classes get more corona/pulse.
      const heatMap: Record<string, number> = {
        O: 0.95,
        B: 0.85,
        A: 0.7,
        F: 0.55,
        G: 0.45,
        K: 0.3,
        M: 0.2,
      };
      const heat = heatMap[spectralClass] ?? 0.5;
      return {
        kind: "star",
        palette,
        coronaIntensity: heat,
        pulseRate: 0.3 + heat * 0.4,
      };
    }

    case "nebula":
      return {
        kind: "nebula",
        palette,
        density: 0.4 + hashFloat(body.id, "density") * 0.4,
        swirl: 0.3 + hashFloat(body.id, "swirl") * 0.5,
      };

    case "comet":
      return {
        kind: "comet",
        palette,
        tailLength: 40 + hashFloat(body.id, "tail") * 80,
      };

    case "black-hole":
      return {
        kind: "black-hole",
        palette: {
          ...palette,
          primary: "#0a0a12",
          secondary: "#1a0a2e",
        },
        accretionIntensity: 0.6 + hashFloat(body.id, "accretion") * 0.35,
      };

    case "dust-cloud":
      return {
        kind: "dust-cloud",
        palette,
        opacity: 0.15 + hashFloat(body.id, "opacity") * 0.35,
      };

    case "asteroid-belt":
      return {
        kind: "asteroid-belt",
        palette,
        density: 0.3 + hashFloat(body.id, "belt-density") * 0.5,
      };

    default:
      return null;
  }
}

/**
 * Derive a palette from the narrative aesthetic direction + a body-id seed.
 * This is deliberately simple — the aesthetic direction gives us a hue family,
 * and we vary saturation/lightness per body. Not a full color science system.
 */
function deriveDecorativePalette(bodyId: string, canon: NarrativeCanon): Palette {
  // Use motif keywords to seed a base hue. Hash the first keyword for
  // determinism, shift per body id for variety.
  const baseHue = hashFloat(canon.aesthetic.motifKeywords[0] ?? "cosmos", "hue") * 360;
  const bodyShift = hashFloat(bodyId, "hue-shift") * 60 - 30; // +/- 30 degrees
  const hue = (baseHue + bodyShift + 360) % 360;

  const sat = 40 + hashFloat(bodyId, "sat") * 30; // 40-70%
  const light = 20 + hashFloat(bodyId, "light") * 25; // 20-45%

  return {
    primary: hslToHex(hue, sat, light),
    secondary: hslToHex((hue + 30) % 360, sat * 0.8, light * 1.2),
    accent: hslToHex((hue + 180) % 360, sat * 1.1, light + 15),
    atmosphere: `rgba(${hslToRgb(hue, sat * 0.6, light + 10).join(", ")}, 0.25)`,
  };
}

// ───────── Hash utilities ─────────
//
// Simple string hash for deterministic but varied per-body values.

function hashFloat(str: string, salt: string): number {
  let h = 0;
  const input = str + salt;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return (
    "#" +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
