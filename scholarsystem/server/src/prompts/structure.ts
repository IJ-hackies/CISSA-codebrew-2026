// Stage 1 prompt: Structure (Obsidian markdown output).
//
// Replaces the TAB-delimited format. Claude Code writes one markdown
// file per knowledge node into `stage1-structure/` — files have YAML
// frontmatter and [[wikilink]] cross-references. The compile step
// (pipeline/compile/) parses these into the Knowledge + Relationships
// scopes.
//
// Why Obsidian markdown:
//   - Claude Code's training exposure to frontmatter+wikilinks is enormous
//   - Less prompt scaffolding than custom dialects
//   - Files are inspectable: `cat stage1-structure/` to debug
//   - Compile step validates via Zod at the stage boundary

import type { ChapterId } from "@scholarsystem/shared";

export interface StructurePromptInput {
  chapterId: ChapterId;
  /** Source unit IDs available for citation (e.g. w1-s-0001 through w1-s-0042). */
  sourceUnitIds: string[];
  /** Whether PDF page images are available in the workspace for vision reading. */
  hasPageImages?: boolean;
  /** Number of page images available. */
  pageCount?: number;
}

export function buildStructurePrompt(input: StructurePromptInput): string {
  const { chapterId, sourceUnitIds, hasPageImages, pageCount } = input;
  const unitRange = sourceUnitIds.length > 0
    ? `${sourceUnitIds[0]} through ${sourceUnitIds[sourceUnitIds.length - 1]}`
    : "(none)";

  return `You are an educational content analyst. Read the study material in the \`sources/${chapterId}/\` folder and produce a strict hierarchical knowledge outline.

## Output format

Create one markdown file per knowledge node in \`stage1-structure/\`. Each file has YAML frontmatter and an optional body with [[wikilinks]] to related nodes.

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
kind: <definition|formula|example|fact|principle|process>
modelTier: <light|standard|heavy>
title: <string>
brief: <1-2 sentence hook, ≤40 words>
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

For **loose concepts** (no subtopic parent), omit the \`subtopic\` field entirely.

### Body text

After the frontmatter, optionally add a short body with [[wikilinks]] to related nodes. These compile into relationship edges.

Example body for a concept:
\`\`\`markdown
## See also
- [[${chapterId}-some-other-concept]] (prerequisite)
- [[${chapterId}-related-concept]] (contrasts)
\`\`\`

### Rules

1. **Three levels only**: topic → subtopic → concept. Flatten deeper hierarchies.
2. **Every id starts with \`${chapterId}-\`** and is kebab-case: \`${chapterId}-photosynthesis\`, \`${chapterId}-energy-flow\`.
3. **Every node must cite source units** in \`sourceRefs\`. Available units: ${unitRange}. Cite the specific units the node's content came from — this is load-bearing for accuracy verification.
4. **Ids must be unique** across all files.
5. **Every parent reference must exist** as a file of the correct type.
6. **Preserve the source's own terminology.** Don't rename things.
7. **Scale**: aim for 2-6 topics, 2-5 subtopics per topic, 2-5 concepts per subtopic. Scale with input size.

### Concept kind guidance
- \`definition\` — a named term being defined
- \`formula\` — a mathematical or symbolic rule
- \`example\` — a worked instance illustrating a rule
- \`fact\` — a standalone factual claim
- \`principle\` — a general law or rule of thumb
- \`process\` — a multi-step procedure or sequence

### Model tier guidance (inherent reasoning complexity, not importance)
- \`light\` — isolated facts, single-sentence definitions, one-step recall
- \`standard\` — typical explanations, worked examples (default; use when in doubt)
- \`heavy\` — multi-step reasoning, proofs, heavy prerequisite chains

### Also produce a summary file

Create \`stage1-structure/_summary.md\` with:
\`\`\`yaml
---
type: summary
title: <overall title for the material>
summary: <2-3 sentence overview>
---
\`\`\`

## Worked example (shape only)

For astronomy notes, you might create:

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

\`stage1-structure/${chapterId}-inner-planets.md\`:
\`\`\`markdown
---
id: ${chapterId}-inner-planets
chapter: ${chapterId}
type: subtopic
topic: ${chapterId}-solar-system
title: Inner Planets
summary: Rocky worlds close to the sun.
sourceRefs: [${chapterId}-s-0004, ${chapterId}-s-0005]
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
brief: A planet whose surface is silicate rock or metal, as opposed to a gas giant.
sourceRefs: [${chapterId}-s-0004]
---

## See also
- [[${chapterId}-gas-giant-def]] (contrasts)
\`\`\`

Now read the source material in \`sources/${chapterId}/\` and create the structure files.${hasPageImages ? `

## IMPORTANT: PDF Page Images Available

The source material was uploaded as a PDF. The text extraction in \`sources/${chapterId}/\` may be **incomplete** — mathematical formulas, equations, diagrams, and tables are often lost during text extraction.

**You MUST read the page images** in \`sources/${chapterId}/pages/\` (${pageCount} PNG files: page-001.png through page-${String(pageCount).padStart(3, "0")}.png) to see the FULL original content including:
- Mathematical formulas and equations (LaTeX notation)
- Tables and structured data
- Diagrams and figures
- Any content that appears as blank lines or missing bullets in the text files

Use the page images as the PRIMARY source of truth. The text files are a supplement, not the authority. When the text and images disagree, trust the images.` : ""}`;
}
