import { z } from "zod";
import { Slug } from "./ids";

// Polymorphic body layout. Every cosmic object — knowledge-bearing or
// decorative — lives in one flat `bodies[]` array, discriminated by
// `kind`. Containment is expressed via `parentId` so the layout is a
// tree of positions without needing nested arrays.

export const Position = z.object({ x: z.number(), y: z.number() });

const BaseBody = z.object({
  id: Slug,
  position: Position,
  parentId: Slug.nullable(), // null for root galaxies
  radius: z.number().positive(),
});

// ───────── Knowledge-bearing bodies ─────────
// These reference a knowledge node and become interactive.

export const GalaxyBody = BaseBody.extend({
  kind: z.literal("galaxy"),
  knowledgeRef: z.null(), // galaxies wrap the whole tree, no single ref
});

export const SystemBody = BaseBody.extend({
  kind: z.literal("system"),
  knowledgeRef: Slug, // topic id
});

export const PlanetBody = BaseBody.extend({
  kind: z.literal("planet"),
  knowledgeRef: Slug, // subtopic id
  orbitRadius: z.number().positive(),
  orbitAngle: z.number(),
});

export const MoonBody = BaseBody.extend({
  kind: z.literal("moon"),
  knowledgeRef: Slug, // concept id
  orbitRadius: z.number().positive(),
  orbitAngle: z.number(),
});

export const AsteroidBody = BaseBody.extend({
  kind: z.literal("asteroid"),
  knowledgeRef: Slug, // loose concept id
});

// ───────── Decorative bodies ─────────
// Placed and themed entirely by code (no Claude calls). No knowledge ref,
// no scenes, no progress tracking. Pure atmosphere.

export const StarBody = BaseBody.extend({
  kind: z.literal("star"),
  spectralClass: z.enum(["O", "B", "A", "F", "G", "K", "M"]),
});

export const NebulaBody = BaseBody.extend({
  kind: z.literal("nebula"),
});

export const CometBody = BaseBody.extend({
  kind: z.literal("comet"),
  trajectoryAngle: z.number(),
});

export const BlackHoleBody = BaseBody.extend({
  kind: z.literal("black-hole"),
});

export const DustCloudBody = BaseBody.extend({
  kind: z.literal("dust-cloud"),
});

export const AsteroidBeltBody = BaseBody.extend({
  kind: z.literal("asteroid-belt"),
  innerRadius: z.number().positive(),
  outerRadius: z.number().positive(),
});

export const Body = z.discriminatedUnion("kind", [
  GalaxyBody,
  SystemBody,
  PlanetBody,
  MoonBody,
  AsteroidBody,
  StarBody,
  NebulaBody,
  CometBody,
  BlackHoleBody,
  DustCloudBody,
  AsteroidBeltBody,
]);

export const KNOWLEDGE_BEARING_KINDS = [
  "galaxy",
  "system",
  "planet",
  "moon",
  "asteroid",
] as const;

export const DECORATIVE_KINDS = [
  "star",
  "nebula",
  "comet",
  "black-hole",
  "dust-cloud",
  "asteroid-belt",
] as const;

export const Spatial = z.object({
  bounds: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }),
  bodies: z.array(Body),
});

export type Body = z.infer<typeof Body>;
export type Spatial = z.infer<typeof Spatial>;
export type Position = z.infer<typeof Position>;
