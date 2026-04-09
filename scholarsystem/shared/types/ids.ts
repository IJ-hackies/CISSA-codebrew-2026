import { z } from "zod";

// Every id in the galaxy blob is a kebab-case slug. Enforcing a single
// id format across scopes is what lets spatial, visuals, scenes, and
// progress all key off the same strings without any translation layer.
export const Slug = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, {
    message: "ids must be kebab-case: lowercase letters, digits, hyphens",
  });

export type Slug = z.infer<typeof Slug>;
