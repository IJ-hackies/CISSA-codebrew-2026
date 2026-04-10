// Stage 1 prompt: Skeleton pass (Obsidian markdown output).
//
// The skeleton pass identifies the cluster/group/entry hierarchy and
// assigns source units. It does NOT produce wraps — that's the job of
// the parallel Stage 2 wrap agents.
//
// Key design:
//   - "Identify, don't explain." One-line brief only.
//   - "Assign every source unit." No source unit left unassigned.
//   - "Aggressive relationship discovery." Wikilinks are hero data.
//   - EntryKind taxonomy: moment, person, place, theme, artifact,
//     milestone, period.
//   - No auxiliary files (_map, _structure, _etc) — v3 simplification.

import type { ChapterId } from "@scholarsystem/shared";

export interface SkeletonPromptInput {
  chapterId: ChapterId;
  /** Source unit IDs available for citation (e.g. w1-s-0001 through w1-s-0042). */
  sourceUnitIds: string[];
  /** Whether PDF page images are available in the workspace for vision reading. */
  hasPageImages?: boolean;
  /** Number of page images available. */
  pageCount?: number;
  /** Pre-extracted digests from Stage 1a (map phase). When provided, the prompt
   *  reads digests instead of raw source files — much faster for large inputs. */
  digests?: string;
}

export function buildSkeletonPrompt(input: SkeletonPromptInput): string {
  const { chapterId, sourceUnitIds, hasPageImages, pageCount, digests } = input;
  const unitRange = sourceUnitIds.length > 0
    ? `${sourceUnitIds[0]} through ${sourceUnitIds[sourceUnitIds.length - 1]}`
    : "(none)";

  // When digests are provided (Stage 1a already ran), the prompt reads
  // the inline digests instead of the raw source files on disk.
  const sourceInstruction = digests
    ? `Read the pre-extracted digests below (one per source unit). These summarize the full source material — use them to build the hierarchy.\n\n${digests}`
    : `Read ALL source material in \`sources/${chapterId}/\` and produce a hierarchical skeleton that maps the content into a navigable galaxy of interconnected nodes.`;

  return `You are a knowledge architect. ${sourceInstruction}

## What this skeleton is for

This skeleton feeds a 3D galaxy visualization. Every cluster becomes a solar system. Every entry becomes a planet, moon, comet, or star. Relationships become glowing edges connecting nodes. Your job is to:
1. Identify the cluster/group/entry hierarchy
2. Assign every source unit to at least one entry
3. Classify each entry's kind (what body type it becomes in the galaxy)
4. **Aggressively discover relationships** — connections are the hero feature

Speed is the priority. Do NOT write explanatory bodies. One-line briefs only.

## Output format

Create one markdown file per knowledge node in \`stage1-structure/\`. Each file has YAML frontmatter and a body with [[wikilinks]] to related nodes.

### File naming

Use the node's id as the filename: \`stage1-structure/<id>.md\`

### Frontmatter fields

**Cluster files** (\`type: cluster\`):
\`\`\`yaml
---
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: cluster
title: <string>
brief: <1-2 sentences, ≤30 words>
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

**Group files** (\`type: group\`):
\`\`\`yaml
---
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: group
cluster: ${chapterId}-<parent-cluster-id>
title: <string>
brief: <1-2 sentences, ≤30 words>
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

**Entry files** (\`type: entry\`):
\`\`\`yaml
---
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: entry
group: ${chapterId}-<parent-group-id>
kind: <see EntryKind taxonomy below>
title: <string>
brief: <1 sentence, ≤30 words — classify, don't explain>
sourceRefs: [${chapterId}-s-NNNN, ...]
---

[[${chapterId}-related-entry-1]]
[[${chapterId}-related-entry-2]]
\`\`\`

For **loose entries** (no parent group), omit the \`group\` field entirely. These become asteroids floating between solar systems.

### EntryKind taxonomy — what each entry becomes in the galaxy

- \`moment\` — a specific event, memory, or experience → **Moon** (small, smooth)
- \`person\` — a person, character, or relationship → **Planet** (large, atmospheric)
- \`place\` — a location, setting, or environment → **Planet** (textured, grounded)
- \`theme\` — a recurring idea, pattern, or motif → **Star** (glowing, emissive)
- \`artifact\` — a specific object, document, photo, or creation → **Comet** (trailing particles)
- \`milestone\` — a turning point, achievement, or pivotal moment → **Large Moon** (bright, prominent)
- \`period\` — a time span, era, or phase of life → **Ringed Planet** (expansive)

Choose the kind that best captures what the entry IS, not what it's about. A journal entry about a trip is a \`moment\`. The city visited is a \`place\`. The friend who came along is a \`person\`. The life lesson learned is a \`theme\`.

## Relationship discovery — the hero feature

Wikilinks (\`[[target-id]]\`) in note bodies become visible edges in the 3D galaxy. **Be aggressive.** Every meaningful connection you discover makes the galaxy more interesting and navigable.

Types of connections to look for:
- **Temporal**: events that happen in sequence or overlap
- **Causal**: one thing leading to or causing another
- **Involves**: shared people, places, or artifacts
- **References**: one entry explicitly mentions another
- **Contrasts**: entries in tension or opposition
- **Related**: general semantic or thematic similarity

Add wikilinks generously. A galaxy with 50 entries and 100+ connections is better than one with 50 entries and 20 connections. Cross-cluster connections are especially valuable — they're the wormholes between solar systems.

## Summary file

### \`stage1-structure/_summary.md\`
\`\`\`yaml
---
type: summary
title: <overall title for this galaxy>
summary: <2-3 sentence overview>
---
\`\`\`

## Critical rules

1. **Three levels only**: cluster → group → entry. Flatten deeper hierarchies.
2. **Every id starts with \`${chapterId}-\`** and is kebab-case.
3. **ASSIGN EVERY SOURCE UNIT.** Every source-unit ID (${unitRange}) must appear in at least one entry's \`sourceRefs\`. No source unit left unassigned. This is the 100% accountability rule.
4. **Ids must be unique** across all files.
5. **Every parent reference must exist** as a file of the correct type.
6. **Preserve the source's own terminology.** Don't rename things.
7. **Scale**: 2-6 clusters, 2-5 groups per cluster, 2-8 entries per group. Scale with input size.
8. **Identify, don't explain.** Entry briefs should be classification-level: ≤30 words. No paragraphs, no definitions.
9. **Wikilink aggressively.** Every entry should have at least 2-3 wikilinks to related entries. Cross-cluster links are especially valuable.

## Worked example (shape only)

\`stage1-structure/${chapterId}-childhood-memories.md\`:
\`\`\`markdown
---
id: ${chapterId}-childhood-memories
chapter: ${chapterId}
type: cluster
title: Childhood Memories
brief: Early years growing up in Melbourne, family dynamics and formative experiences.
sourceRefs: [${chapterId}-s-0001, ${chapterId}-s-0002, ${chapterId}-s-0003]
---
\`\`\`

\`stage1-structure/${chapterId}-first-day-at-school.md\`:
\`\`\`markdown
---
id: ${chapterId}-first-day-at-school
chapter: ${chapterId}
type: entry
group: ${chapterId}-school-days
kind: moment
title: First Day at School
brief: The nervous excitement of starting primary school, September 1998.
sourceRefs: [${chapterId}-s-0004]
---

[[${chapterId}-mum]]
[[${chapterId}-melbourne-suburb]]
[[${chapterId}-making-friends]]
\`\`\`

Now read ALL source material in \`sources/${chapterId}/\` and create the skeleton files. Remember: assign EVERY source unit, classify don't explain, wikilink aggressively.${hasPageImages ? `

## IMPORTANT: PDF Page Images Available

The source material was uploaded as a PDF. The text extraction in \`sources/${chapterId}/\` may be **incomplete** — mathematical formulas, equations, diagrams, and tables are often lost during text extraction.

**You MUST read the page images** in \`sources/${chapterId}/pages/\` (${pageCount} PNG files: page-001.png through page-${String(pageCount).padStart(3, "0")}.png) to see the FULL original content including:
- Mathematical formulas and equations (LaTeX notation)
- Tables and structured data
- Diagrams and figures
- Any content that appears as blank lines or missing bullets in the text files

Use the page images as the PRIMARY source of truth. The text files are a supplement, not the authority. When the text and images disagree, trust the images.` : ""}`;
}
