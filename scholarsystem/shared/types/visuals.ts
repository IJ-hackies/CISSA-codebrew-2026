import { z } from "zod";
import { Slug } from "./ids";

// Per-body visual parameters. Discriminated union keyed on `kind` that
// mirrors spatial body kinds. Knowledge-bearing bodies get Claude-authored
// params in Stage 5; decorative bodies get code-authored params from the
// narrative aesthetic direction.

export const Palette = z.object({
  primary: z.string(),      // hex
  secondary: z.string(),
  accent: z.string(),
  atmosphere: z.string(),   // rgba
});

export const Terrain = z.enum([
  "crystalline",
  "rocky",
  "oceanic",
  "gaseous",
  "molten",
  "frozen",
  "organic",
  "desert",
  "metallic",
]);

export const AtmosphereType = z.enum([
  "thin",
  "dense-haze",
  "stormy",
  "clear",
  "toxic",
  "aurora",
  "none",
]);

export const Lighting = z.enum([
  "bioluminescent",
  "sunlit",
  "twilight",
  "eclipsed",
  "nebula-lit",
  "starlight",
]);

// ───────── Scene environment + NPC assignment (moon/asteroid only) ─────

// All concepts within one subtopic share a biome.
export const Biome = z.enum([
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
]);

// Which NPC archetype appears in scenes on this body.
// Assignment follows concept kind: definition/principle → sage,
// formula/process → engineer, example → archivist, fact → trickster.
// warrior and echo are rare, reserved for dramatic heavy-tier concepts.
export const SceneCharacterRole = z.enum([
  "sage",
  "engineer",
  "warrior",
  "archivist",
  "trickster",
  "echo",
]);

// ───────── Knowledge-bearing body visuals ─────────

export const GalaxyVisual = z.object({
  kind: z.literal("galaxy"),
  palette: Palette,
  armStyle: z.enum(["spiral", "barred", "elliptical", "irregular"]),
  starDensity: z.number().min(0).max(1),
});

export const SystemVisual = z.object({
  kind: z.literal("system"),
  palette: Palette,
  starGlow: z.number().min(0).max(1),
  orbitRingVisible: z.boolean(),
});

export const PlanetVisual = z.object({
  kind: z.literal("planet"),
  palette: Palette,
  terrain: Terrain,
  atmosphere: AtmosphereType,
  lighting: Lighting,
  features: z.array(z.string()),   // free-form flourish tags
  mood: z.string(),
  ring: z.boolean(),
});

export const MoonVisual = z.object({
  kind: z.literal("moon"),
  palette: Palette,
  terrain: Terrain,
  cratered: z.boolean(),
  glow: z.boolean(),
  biome: Biome,
  character: SceneCharacterRole,
});

export const AsteroidVisual = z.object({
  kind: z.literal("asteroid"),
  palette: Palette,
  shape: z.enum(["angular", "elongated", "clustered"]),
  biome: Biome,
  character: SceneCharacterRole,
});

// ───────── Decorative body visuals ─────────

export const StarVisual = z.object({
  kind: z.literal("star"),
  palette: Palette,
  coronaIntensity: z.number().min(0).max(1),
  pulseRate: z.number().min(0).max(1),
});

export const NebulaVisual = z.object({
  kind: z.literal("nebula"),
  palette: Palette,
  density: z.number().min(0).max(1),
  swirl: z.number().min(0).max(1),
});

export const CometVisual = z.object({
  kind: z.literal("comet"),
  palette: Palette,
  tailLength: z.number().positive(),
});

export const BlackHoleVisual = z.object({
  kind: z.literal("black-hole"),
  palette: Palette,
  accretionIntensity: z.number().min(0).max(1),
});

export const DustCloudVisual = z.object({
  kind: z.literal("dust-cloud"),
  palette: Palette,
  opacity: z.number().min(0).max(1),
});

export const AsteroidBeltVisual = z.object({
  kind: z.literal("asteroid-belt"),
  palette: Palette,
  density: z.number().min(0).max(1),
});

export const BodyVisual = z.discriminatedUnion("kind", [
  GalaxyVisual,
  SystemVisual,
  PlanetVisual,
  MoonVisual,
  AsteroidVisual,
  StarVisual,
  NebulaVisual,
  CometVisual,
  BlackHoleVisual,
  DustCloudVisual,
  AsteroidBeltVisual,
]);

// Keyed by body id. Missing keys are valid during partial population.
export const Visuals = z.record(Slug, BodyVisual);

export type Palette = z.infer<typeof Palette>;
export type BodyVisual = z.infer<typeof BodyVisual>;
export type Visuals = z.infer<typeof Visuals>;
export type Biome = z.infer<typeof Biome>;
export type SceneCharacterRole = z.infer<typeof SceneCharacterRole>;
