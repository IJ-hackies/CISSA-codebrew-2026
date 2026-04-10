import { z } from "zod";
import { Slug } from "./ids";

export const VisitRecord = z.object({
  firstVisitedAt: z.number().int(),
  lastVisitedAt: z.number().int(),
  visitCount: z.number().int().nonnegative(),
});

export const Position3D = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const Exploration = z.object({
  visited: z.record(Slug, VisitRecord),
  bookmarked: z.array(Slug),
  positions: z.record(Slug, Position3D).optional(),
});

export type VisitRecord = z.infer<typeof VisitRecord>;
export type Position3D = z.infer<typeof Position3D>;
export type Exploration = z.infer<typeof Exploration>;
