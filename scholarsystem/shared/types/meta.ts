import { z } from "zod";

// Bump when the schema shape changes in a way old blobs can't satisfy.
// Migrations live next to the version they migrate from.
export const SCHEMA_VERSION = 1;

export const Meta = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  title: z.string(),
});

export type Meta = z.infer<typeof Meta>;
