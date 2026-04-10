import { z } from "zod";

// Every id in the galaxy blob is a chapter-prefixed kebab-case slug.
// Two segments minimum: `<chapter>-<rest>`. The chapter prefix is
// MANDATORY — an unprefixed id is a hard validation error, not a
// warning. This is what prevents cross-chapter collisions by
// construction when a galaxy grows via chapter extensions.
//
//   w1-photosynthesis        concept
//   w1-cellular-biology      topic
//   w1-s-0042                source unit (see SourceUnitId)
//   lecture-3-mitosis        chapter with its own hyphen is fine
//
// Enforced at every stage boundary via Zod.
export const Slug = z
  .string()
  .regex(/^[a-z][a-z0-9]*-[a-z][a-z0-9-]*$/, {
    message:
      "ids must be chapter-prefixed kebab-case (e.g. 'w1-photosynthesis')",
  });

export type Slug = z.infer<typeof Slug>;

// A chapter id is the plain prefix portion on its own — `w1`, `w2`,
// `lecture-3`. User-supplied labels are sanitized to this shape at
// ingest. Chapter ids themselves are NOT chapter-prefixed (they ARE
// the prefix), so they use a looser pattern than `Slug`.
export const ChapterId = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, {
    message:
      "chapter ids must be kebab-case with no leading prefix (e.g. 'w1', 'lecture-3')",
  });

export type ChapterId = z.infer<typeof ChapterId>;

// Source units follow a stricter sub-pattern so that ingest can mint
// them deterministically and downstream code can recognize them on
// sight: `<chapter>-s-<4-digit-seq>`. Still satisfies `Slug`.
export const SourceUnitId = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*-s-\d{4}$/, {
    message: "source unit ids must match '<chapter>-s-NNNN'",
  });

export type SourceUnitId = z.infer<typeof SourceUnitId>;
