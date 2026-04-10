// Stage 1 prompt: Skeleton pass (Obsidian markdown output).
//
// The skeleton pass identifies the topic/subtopic/concept hierarchy and
// assigns source units to topics. It does NOT extract full concept bodies
// or derivatives — that's the job of the parallel Stage 2 detail agents.
//
// Key design:
//   - "Identify, don't explain." One-line brief only.
//   - "Assign every source unit." No source unit left unassigned.
//   - "Source-unit assignment is a routing decision." Detail agents will
//     ONLY see the source units assigned to their topic.
//   - Expanded concept kind taxonomy from Flint.
//   - Produces _map.md, _structure.md, _etc.md auxiliary files.

import type { ChapterId } from "@scholarsystem/shared";

export interface SkeletonPromptInput {
  chapterId: ChapterId;
  /** Source unit IDs available for citation (e.g. w1-s-0001 through w1-s-0042). */
  sourceUnitIds: string[];
  /** Whether PDF page images are available in the workspace for vision reading. */
  hasPageImages?: boolean;
  /** Number of page images available. */
  pageCount?: number;
}

// Re-export under old name for backward compat during transition.
export type StructurePromptInput = SkeletonPromptInput;

export function buildSkeletonPrompt(input: SkeletonPromptInput): string {
  const { chapterId, sourceUnitIds, hasPageImages, pageCount } = input;
  const unitRange = sourceUnitIds.length > 0
    ? `${sourceUnitIds[0]} through ${sourceUnitIds[sourceUnitIds.length - 1]}`
    : "(none)";

  return `You are an educational content analyst. Read ALL source material in \`sources/${chapterId}/\` and produce a lightweight hierarchical skeleton. Your job is to IDENTIFY and CLASSIFY — not to explain.

## What this skeleton is for

This skeleton is a routing manifest. A separate set of parallel detail agents will each receive ONE topic's source units and produce full concept bodies and verbatim quotes. Your job is to:
1. Identify the topic/subtopic/concept hierarchy
2. Assign every source unit to a topic (this is the routing decision)
3. Classify each concept's kind and model tier

Speed is the priority. Do NOT write explanatory bodies. One-line briefs only.

## Output format

Create one markdown file per knowledge node in \`stage1-structure/\`. Each file has YAML frontmatter and a body with ONLY [[wikilinks]] to related nodes — no explanatory text.

### File naming

Use the node's id as the filename: \`stage1-structure/<id>.md\`

### Frontmatter fields

**Topic files** (\`type: topic\`):
\`\`\`yaml
---
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: topic
title: <string>
summary: <1-2 sentences>
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

**Subtopic files** (\`type: subtopic\`):
\`\`\`yaml
---
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: subtopic
topic: ${chapterId}-<parent-topic-id>
title: <string>
summary: <1-2 sentences>
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

**Concept files** (\`type: concept\`):
\`\`\`yaml
---
id: ${chapterId}-<kebab-slug>
chapter: ${chapterId}
type: concept
subtopic: ${chapterId}-<parent-subtopic-id>
kind: <see concept kind taxonomy below>
modelTier: <light|standard|heavy>
title: <string>
brief: <1 sentence, ≤30 words — classify, don't explain>
sourceRefs: [${chapterId}-s-NNNN, ...]
---

[[${chapterId}-related-concept-1]]
[[${chapterId}-related-concept-2]]
\`\`\`

For **loose concepts** (no subtopic parent), omit the \`subtopic\` field entirely.

If a source unit is relevant to multiple topics, assign it to the primary topic and add a \`sharedWith\` field listing the other topic IDs:
\`\`\`yaml
sharedWith: [${chapterId}-other-topic-id]
\`\`\`
The orchestrator will push that source unit to both topic agents.

### Concept kind taxonomy

- \`definition\` — a named term being formally defined
- \`formula\` — a mathematical or symbolic rule/equation
- \`example\` — a worked instance illustrating a concept
- \`fact\` — a standalone factual claim
- \`principle\` — a general law, rule, or heuristic
- \`process\` — a multi-step procedure or algorithm
- \`framework\` — a model, architecture, or theoretical system
- \`trade-off\` — a tension between competing approaches
- \`distinction\` — a key difference between related ideas
- \`paradigm\` — a major approach or school of thought
- \`property\` — a characteristic or attribute of a system/concept

### Model tier guidance (inherent reasoning complexity, not importance)
- \`light\` — isolated facts, single-sentence definitions, one-step recall
- \`standard\` — typical explanations, worked examples (default; use when in doubt)
- \`heavy\` — multi-step reasoning, proofs, heavy prerequisite chains

## Auxiliary files

### \`stage1-structure/_summary.md\`
\`\`\`yaml
---
type: summary
title: <overall title for the material>
summary: <2-3 sentence overview>
---
\`\`\`

### \`stage1-structure/_map.md\` — thematic groupings
\`\`\`yaml
---
type: map
groups:
  - name: <theme name>
    conceptIds: [${chapterId}-concept-a, ${chapterId}-concept-b]
  - name: <another theme>
    conceptIds: [${chapterId}-concept-c]
---
\`\`\`
Group concepts by thematic similarity. This feeds narrative generation.

### \`stage1-structure/_structure.md\` — structural/transitional content
\`\`\`yaml
---
type: structure
sourceUnits:
  - id: ${chapterId}-s-NNNN
    role: intro|transition|section-marker|recap|conclusion
    note: <brief description of what this unit contains>
---
\`\`\`
List source units that contain structural/transitional content (introductions, section markers, transitions between topics, recaps). These are NOT concepts — they are routing metadata. The detail agents will include derivatives for them.

### \`stage1-structure/_etc.md\` — non-knowledge-bearing content
\`\`\`yaml
---
type: etc
sourceUnits:
  - id: ${chapterId}-s-NNNN
    reason: <why this is not learnable content (announcements, logistics, verbal filler, redundant repetition)>
---
\`\`\`
List source units that genuinely contain no learnable knowledge. Be conservative — if in doubt, assign to a topic instead.

## Critical rules

1. **Three levels only**: topic → subtopic → concept. Flatten deeper hierarchies.
2. **Every id starts with \`${chapterId}-\`** and is kebab-case.
3. **ASSIGN EVERY SOURCE UNIT.** Every source-unit ID (${unitRange}) must appear in at least one concept's \`sourceRefs\`, or in \`_structure.md\`, or in \`_etc.md\`. No source unit left unassigned. This is the 100% accountability rule.
4. **Source-unit assignment IS a routing decision.** The detail agents will ONLY see the source units assigned to their topic. If you miss a source unit, that content will be lost.
5. **Ids must be unique** across all files.
6. **Every parent reference must exist** as a file of the correct type.
7. **Preserve the source's own terminology.** Don't rename things.
8. **Scale**: 2-6 topics, 2-5 subtopics per topic, 2-8 concepts per subtopic. Scale with input size — don't force content into a fixed number.
9. **Identify, don't explain.** Concept briefs should be classification-level: ≤30 words. No paragraphs, no definitions. The detail agents handle that.

## Worked example (shape only)

\`stage1-structure/${chapterId}-solar-system.md\`:
\`\`\`markdown
---
id: ${chapterId}-solar-system
chapter: ${chapterId}
type: topic
title: The Solar System
summary: Worlds orbiting our star and how they differ.
sourceRefs: [${chapterId}-s-0001, ${chapterId}-s-0002, ${chapterId}-s-0003]
---
\`\`\`

\`stage1-structure/${chapterId}-rocky-planet-def.md\`:
\`\`\`markdown
---
id: ${chapterId}-rocky-planet-def
chapter: ${chapterId}
type: concept
subtopic: ${chapterId}-inner-planets
kind: definition
modelTier: light
title: Rocky Planet Definition
brief: A silicate/metal-surfaced planet, contrasted with gas giants.
sourceRefs: [${chapterId}-s-0004]
---

[[${chapterId}-gas-giant-def]]
\`\`\`

Now read ALL source material in \`sources/${chapterId}/\` and create the skeleton files. Remember: assign EVERY source unit, classify don't explain, keep it lightweight.${hasPageImages ? `

## IMPORTANT: PDF Page Images Available

The source material was uploaded as a PDF. The text extraction in \`sources/${chapterId}/\` may be **incomplete** — mathematical formulas, equations, diagrams, and tables are often lost during text extraction.

**You MUST read the page images** in \`sources/${chapterId}/pages/\` (${pageCount} PNG files: page-001.png through page-${String(pageCount).padStart(3, "0")}.png) to see the FULL original content including:
- Mathematical formulas and equations (LaTeX notation)
- Tables and structured data
- Diagrams and figures
- Any content that appears as blank lines or missing bullets in the text files

Use the page images as the PRIMARY source of truth. The text files are a supplement, not the authority. When the text and images disagree, trust the images.` : ""}`;
}

// Backward compat alias.
export const buildStructurePrompt = buildSkeletonPrompt;
