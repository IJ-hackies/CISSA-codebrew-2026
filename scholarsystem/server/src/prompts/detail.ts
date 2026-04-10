// Stage 2 prompt: Topic detail extraction with derivatives.
//
// Each parallel agent receives:
//   - Only its topic's source units (scoped by the skeleton's sourceRefs)
//   - The full skeleton for cross-reference context
//   - Instructions to produce full concept files with body + derivatives
//
// Key Flint-informed rules:
//   - "Do not summarize." 200-300 word bodies.
//   - "Derivatives are verbatim." Exact quotes from source.
//   - "Every source unit must appear as a derivative."
//   - "Self-contained concepts."
//   - "Structure and ETC are real artifacts."

import type { Knowledge } from "@scholarsystem/shared";

export interface BuildDetailPromptOptions {
  /**
   * Concept IDs this agent is responsible for. The agent ONLY produces
   * files for these concepts. The rest of the skeleton is shown as
   * cross-reference context for wikilinks.
   */
  inScopeConceptIds?: readonly string[];
  /** Chapter ID for folder pathing. */
  chapterId: string;
  /** Source unit IDs assigned to this topic by the skeleton. */
  sourceUnitIds: string[];
  /** Source unit IDs from _structure.md assigned to this topic. */
  structureUnitIds?: string[];
  /** Source unit IDs from _etc.md assigned to this topic. */
  etcUnitIds?: string[];
}

/**
 * Build the Stage 2 topic detail prompt. Instructs one parallel agent
 * to produce full concept bodies + verbatim derivatives for its
 * assigned source units.
 */
export function buildTopicDetailPrompt(
  knowledge: Knowledge,
  options: BuildDetailPromptOptions,
): string {
  const outline = renderOutline(knowledge);
  const { chapterId, sourceUnitIds, structureUnitIds, etcUnitIds } = options;
  const inScope = options.inScopeConceptIds;
  const unitRange = sourceUnitIds.length > 0
    ? `${sourceUnitIds[0]} through ${sourceUnitIds[sourceUnitIds.length - 1]}`
    : "(none)";

  const scopeSection =
    inScope && inScope.length > 0
      ? `\n## Scope of THIS call

This is ONE agent in a parallel Stage 2 fan-out. You must write detail files ONLY for the following concept ids:

${inScope.map((id) => `  - ${id}`).join("\n")}

The full skeleton is shown for cross-reference context (you may use [[wikilinks]] to concepts in other topics), but do NOT create files for concepts not in your scope.

Your assigned source units: ${unitRange}
`
      : "";

  const structureSection = structureUnitIds && structureUnitIds.length > 0
    ? `\n### Structural source units assigned to you

These source units contain structural/transitional content (intros, transitions, recaps). You must write a \`_structure.md\` file with derivatives for them:

${structureUnitIds.map((id) => `  - ${id}`).join("\n")}
`
    : "";

  const etcSection = etcUnitIds && etcUnitIds.length > 0
    ? `\n### Non-knowledge source units assigned to you

These source units were pre-classified as non-knowledge-bearing. You must write an \`_etc.md\` file with derivatives and justifications for them:

${etcUnitIds.map((id) => `  - ${id}`).join("\n")}
`
    : "";

  return `You are an educational content extractor performing deep detail extraction for ONE topic of a study document. A skeleton pass has already identified the concept hierarchy. Your job is to go back to the source text and produce:

1. **Full concept bodies** (200-300 words of self-contained explanation)
2. **Verbatim derivative quotes** from the source for every concept
3. **Relation annotations** linking concepts via typed edges

This is NOT a summarization task. Content fidelity is the point. If the source gives a formula, reproduce it character-for-character. If the source defines a term, quote it exactly. If the source gives a worked example, preserve it in full.

## Output format

Create one markdown file per concept in \`stage2-detail/\`. Each file has YAML frontmatter + body text + a \`# Relations\` section + a \`# Derivatives\` section.

### File naming

\`stage2-detail/<concept-id>.md\`

### File structure

\`\`\`markdown
---
conceptId: <must match a concept id from the skeleton>
chapter: ${chapterId}
fullDefinition: >
  Complete explanation in the source's own terms, 1-4 sentences.
formulas:
  - "E = mc^2"
workedExamples:
  - "Step 1: ... Step 2: ..."
edgeCases:
  - "Does not apply when..."
mnemonics:
  - "ROY G BIV"
emphasisMarkers:
  - "The lecturer stressed this"
sourceRefs: [${chapterId}-s-NNNN, ...]
---

<200-300 word body: self-contained explanation of the concept. Should be
understandable without reading other concepts. Use technical precision.
Reference related concepts via [[wikilinks]] but don't assume the reader
has context.>

# Relations

from:: [[${chapterId}-prerequisite-concept]]
to:: [[${chapterId}-dependent-concept]]
related:: [[${chapterId}-similar-concept]]
contrasts:: [[${chapterId}-opposing-concept]]

# Derivatives

## ${chapterId}-s-NNNN

> "Exact verbatim quote from the source text. No cleaning, no
> paraphrasing, no ellipsis substitution."

> "Another exact quote from the same source unit."

## ${chapterId}-s-NNNN

> "Quote from a different source unit."
\`\`\`

### Relation types allowed

\`from::\` (prerequisite), \`to::\` (leads to), \`related::\`, \`contrasts::\`, \`example-of::\`, \`cause-effect::\`, \`similar::\`, \`parent-child::\`

### Rules

1. **Do not summarize.** Concept bodies must be 200-300 words of self-contained explanation. More is better than less. If the source has that much content, use it all.
2. **Every source unit assigned to you must appear as a derivative.** Every source unit in your scope must have at least one verbatim quote in exactly one file (concept, _structure.md, or _etc.md). No source unit may be silently dropped. The coverage script will verify this mechanically.
3. **Derivatives are verbatim.** Quotes must be exact passages from the source. No cleaning, no paraphrasing, no ellipsis substitution. Minor punctuation differences from text extraction are acceptable.
4. **Self-contained concepts.** Each concept body should be understandable without reading other concepts. Use [[wikilinks]] for connections but don't assume context.
5. **\`sourceRefs\` must match your derivatives.** List the source-unit IDs that appear in your \`# Derivatives\` section. These must agree.
6. **\`fullDefinition\`** in frontmatter is a compact 1-4 sentence definition. The full 200-300 word explanation goes in the body.
7. **Do NOT fabricate.** If the source doesn't mention formulas, emit \`formulas: []\`. Same for every array field. Hallucinating defeats the purpose.
8. **Do NOT skip in-scope concepts.** Every in-scope concept id MUST have exactly one file.
9. **Stay in scope.** Only produce files for concepts in your in-scope list. Reference out-of-scope concepts via [[wikilinks]] but don't create files for them.
${scopeSection}${structureSection}${etcSection}
## Structure and ETC files

If you have structural or non-knowledge source units assigned to you, also produce:

### \`stage2-detail/_structure.md\`
\`\`\`markdown
---
type: structure
chapter: ${chapterId}
---

# Derivatives

## ${chapterId}-s-NNNN

> "Verbatim quote from the structural content (intro, transition, recap)."
\`\`\`

### \`stage2-detail/_etc.md\`
\`\`\`markdown
---
type: etc
chapter: ${chapterId}
---

# Non-Knowledge Content

## ${chapterId}-s-NNNN
Reason: Announcements about office hours, not learnable content.

> "Verbatim quote proving this is non-knowledge."
\`\`\`

## The concept skeleton you must cover

${outline}

Now read the source material in \`sources/${chapterId}/\` and create the detail files. Remember: 200-300 word bodies, verbatim derivatives for every source unit, no skipped concepts.`;
}

// Backward compat alias.
export const buildDetailPrompt = buildTopicDetailPrompt;

// ─── Single-concept prompt (for parallel sub-session fan-out) ────

export interface BuildConceptDetailPromptOptions {
  /** The concept to extract detail for. */
  concept: {
    id: string;
    title: string;
    kind: string;
    brief: string;
    sourceRefs: string[];
  };
  /** Chapter ID for folder pathing. */
  chapterId: string;
  /** Neighboring concept titles for wikilink context. */
  neighbors: { id: string; title: string }[];
}

/**
 * Build a focused prompt for a single concept. The agent creates
 * exactly ONE file: `stage2-detail/<conceptId>.md`.
 *
 * Source unit files are pre-pushed into the sub-session workspace
 * under `sources/<chapterId>/`, so the prompt just references them.
 */
export function buildConceptDetailPrompt(
  options: BuildConceptDetailPromptOptions,
): string {
  const { concept, chapterId, neighbors } = options;

  const neighborList = neighbors.length > 0
    ? neighbors.map((n) => `  - [[${n.id}]] "${n.title}"`).join("\n")
    : "  (none)";

  return `You are an educational content extractor. Your task is to produce ONE detail file for ONE concept by reading the source material.

## The concept

- **ID:** ${concept.id}
- **Title:** ${concept.title}
- **Kind:** ${concept.kind}
- **Brief:** ${concept.brief}
- **Source units:** ${concept.sourceRefs.join(", ")}

## Related concepts (for wikilinks only — do NOT create files for these)

${neighborList}

## Output

Create exactly ONE file: \`stage2-detail/${concept.id}.md\`

\`\`\`markdown
---
conceptId: ${concept.id}
chapter: ${chapterId}
fullDefinition: >
  Complete explanation in the source's own terms, 1-4 sentences.
formulas:
  - "E = mc^2"
workedExamples:
  - "Step 1: ... Step 2: ..."
edgeCases:
  - "Does not apply when..."
mnemonics:
  - "ROY G BIV"
emphasisMarkers:
  - "The lecturer stressed this"
sourceRefs: [${concept.sourceRefs.join(", ")}]
---

<200-300 word body: self-contained explanation of the concept. Should be
understandable without reading other concepts. Use technical precision.
Reference related concepts via [[wikilinks]] but don't assume context.>

# Relations

from:: [[prerequisite-concept]]
to:: [[dependent-concept]]
related:: [[similar-concept]]
contrasts:: [[opposing-concept]]

# Derivatives

## ${concept.sourceRefs[0] ?? `${chapterId}-s-NNNN`}

> "Exact verbatim quote from the source text."
\`\`\`

## Rules

1. **Create exactly ONE file.** \`stage2-detail/${concept.id}.md\`. Nothing else.
2. **200-300 words** in the body. More is better than less. Do not summarize.
3. **Derivatives are verbatim.** Exact quotes from the source. No paraphrasing, no ellipsis.
4. **Every source unit in sourceRefs must have at least one derivative quote.**
5. **sourceRefs in frontmatter must match the source units in # Derivatives.**
6. **Do NOT fabricate.** Empty arrays for fields the source doesn't cover.
7. **Self-contained.** The body should be understandable without reading other concepts.

## Relation types allowed

\`from::\` (prerequisite), \`to::\` (leads to), \`related::\`, \`contrasts::\`, \`example-of::\`, \`cause-effect::\`, \`similar::\`, \`parent-child::\`

Now read the source material in \`sources/${chapterId}/\` and create the file.`;
}

/**
 * Build a focused prompt for _structure.md and _etc.md files.
 * Handles structural/transitional and non-knowledge source units
 * that need derivative coverage but don't map to concepts.
 */
export function buildAuxiliaryDetailPrompt(options: {
  chapterId: string;
  structureUnitIds: string[];
  etcUnitIds: string[];
}): string {
  const { chapterId, structureUnitIds, etcUnitIds } = options;

  const parts: string[] = [];

  if (structureUnitIds.length > 0) {
    parts.push(`### \`stage2-detail/_structure.md\`

This file covers structural/transitional source units (intros, transitions, recaps).
Source units: ${structureUnitIds.join(", ")}

\`\`\`markdown
---
type: structure
chapter: ${chapterId}
---

# Derivatives

## ${structureUnitIds[0]}

> "Verbatim quote from the structural content."
\`\`\``);
  }

  if (etcUnitIds.length > 0) {
    parts.push(`### \`stage2-detail/_etc.md\`

This file covers non-knowledge source units with justifications.
Source units: ${etcUnitIds.join(", ")}

\`\`\`markdown
---
type: etc
chapter: ${chapterId}
---

# Non-Knowledge Content

## ${etcUnitIds[0]}
Reason: <why this is not learnable content>

> "Verbatim quote proving this is non-knowledge."
\`\`\``);
  }

  return `You are an educational content extractor. Your task is to produce derivative coverage for source units that don't map to concepts.

## Source units to cover

${structureUnitIds.length > 0 ? `**Structural:** ${structureUnitIds.join(", ")}` : ""}
${etcUnitIds.length > 0 ? `**Non-knowledge:** ${etcUnitIds.join(", ")}` : ""}

## Output

${parts.join("\n\n")}

## Rules

1. **Create only the file(s) listed above.** Nothing else.
2. **Every listed source unit must have at least one verbatim derivative quote.**
3. **Derivatives are verbatim.** Exact quotes, no paraphrasing.

Now read the source material in \`sources/${chapterId}/\` and create the file(s).`;
}

/**
 * Render the Stage 1 knowledge outline as an indented listing for the prompt.
 */
function renderOutline(knowledge: Knowledge): string {
  const subtopicsById = new Map(knowledge.subtopics.map((s) => [s.id, s]));
  const conceptsById = new Map(knowledge.concepts.map((c) => [c.id, c]));
  const lines: string[] = [];

  lines.push(`Document: ${knowledge.title}`);
  lines.push(`Overview: ${knowledge.summary}`);
  lines.push("");

  for (const topic of knowledge.topics) {
    lines.push(`TOPIC "${topic.title}" — ${topic.summary}`);
    lines.push(`  sourceRefs: [${topic.sourceRefs.join(", ")}]`);
    for (const sid of topic.subtopicIds) {
      const sub = subtopicsById.get(sid);
      if (!sub) continue;
      lines.push(`  SUBTOPIC "${sub.title}" — ${sub.summary}`);
      for (const cid of sub.conceptIds) {
        const c = conceptsById.get(cid);
        if (!c) continue;
        lines.push(
          `    CONCEPT id=${c.id} [${c.kind}/${c.modelTier}] "${c.title}" — ${c.brief}`,
        );
        lines.push(
          `      sourceRefs: [${c.sourceRefs.join(", ")}]`,
        );
      }
    }
  }

  if (knowledge.looseConceptIds.length > 0) {
    lines.push("");
    lines.push("LOOSE CONCEPTS (no parent subtopic)");
    for (const cid of knowledge.looseConceptIds) {
      const c = conceptsById.get(cid);
      if (!c) continue;
      lines.push(
        `  CONCEPT id=${c.id} [${c.kind}/${c.modelTier}] "${c.title}" — ${c.brief}`,
      );
      lines.push(
        `    sourceRefs: [${c.sourceRefs.join(", ")}]`,
      );
    }
  }

  return lines.join("\n");
}
