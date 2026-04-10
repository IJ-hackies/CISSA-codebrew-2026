// Stage 2 prompt: Detail extraction (Obsidian markdown output).
//
// Replaces the JSONL-based detail prompt. Claude Code writes one
// markdown file per concept into `stage2-detail/<topic-id>/` — files
// have YAML frontmatter with full detail fields. The compile step
// (pipeline/compile/) parses these into the Detail scope.

import type { Knowledge } from "@scholarsystem/shared";

export interface BuildDetailPromptOptions {
  /**
   * If provided, Claude is instructed to emit detail files ONLY for these
   * concept ids. The rest of the outline is still shown as cross-reference
   * context. Used by the parallel fan-out in `runDetailStage` to split
   * Stage 2 work across multiple concurrent Claude calls.
   *
   * When omitted (or empty), all concepts in the outline are in scope.
   */
  inScopeConceptIds?: readonly string[];
  /** Chapter ID for folder pathing. */
  chapterId: string;
  /** Source unit IDs available for citation. */
  sourceUnitIds: string[];
}

/**
 * Build the Stage 2 detail prompt. The outline is flattened into a compact
 * indented listing so Claude can see every concept it needs to produce
 * detail for.
 */
export function buildDetailPrompt(
  knowledge: Knowledge,
  options: BuildDetailPromptOptions,
): string {
  const outline = renderOutline(knowledge);
  const { chapterId, sourceUnitIds } = options;
  const inScope = options.inScopeConceptIds;
  const unitRange = sourceUnitIds.length > 0
    ? `${sourceUnitIds[0]} through ${sourceUnitIds[sourceUnitIds.length - 1]}`
    : "(none)";

  const scopeSection =
    inScope && inScope.length > 0
      ? `\n## Scope of THIS call\n\nThis is ONE chunk of a parallel Stage 2 run. You must write detail files ONLY for the following concept ids:\n\n${inScope.map((id) => `  - ${id}`).join("\n")}\n\nThe full outline is shown as context for cross-referencing, but do NOT write files for concepts not in the list above.\n`
      : "";

  return `You are an educational content extractor. You have already produced a hierarchical outline of a study document. Your job now is to go back to the source text and pull out deep, verbatim content for EACH concept.

This is NOT a summarization task. Content fidelity is the point. If the source gives a formula, reproduce it character-for-character. If the source defines a term in a specific way, quote it. If the source gives a worked example, preserve it in full. Later stages generate narrative and gameplay on top of this data — if you over-summarize here, everything downstream loses detail that can never be recovered.

## Output format

Create one markdown file per concept in \`stage2-detail/\`. Each file has YAML frontmatter with the detail fields.

### File naming

\`stage2-detail/<concept-id>.md\`

### Frontmatter fields

\`\`\`yaml
---
conceptId: <must match a concept id from the outline>
chapter: ${chapterId}
fullDefinition: >
  A complete explanation of the concept in the source's own terms,
  typically 1-4 sentences. More than the one-sentence brief from Stage 1.
formulas:
  - "E = mc^2"
workedExamples:
  - "Step 1: ... Step 2: ..."
edgeCases:
  - "Does not apply when..."
mnemonics:
  - "ROY G BIV for the visible spectrum"
emphasisMarkers:
  - "The lecturer stressed that this is commonly tested"
sourceQuotes:
  - "verbatim excerpt from the input text"
sourceRefs: [${chapterId}-s-NNNN, ...]
---
\`\`\`

### Rules

1. **\`conceptId\`** MUST exactly match a concept id from the outline. Do not invent new ids.
2. **\`sourceRefs\`** MUST cite the specific source units the detail was drawn from. Available units: ${unitRange}. At least one ref per concept.
3. **\`fullDefinition\`** — a complete explanation in the source's own terms, typically 1-4 sentences. If the source genuinely only has one sentence, that's fine — don't pad.
4. **\`formulas\`** — each string is one formula/equation/symbolic rule, reproduced as written. Empty array \`[]\` if none.
5. **\`workedExamples\`** — each string is one complete example. Preserve numbers, steps, labels. Empty array if none.
6. **\`edgeCases\`** — boundary conditions, exceptions, "does not apply when…" notes. Empty array if none.
7. **\`mnemonics\`** — memory aids the source explicitly mentions. Do NOT invent mnemonics the source doesn't state. Empty array if none.
8. **\`emphasisMarkers\`** — phrases where the source signals importance ("the key insight is", bold/italic emphasis, etc.). Empty array if none.
9. **\`sourceQuotes\`** — short verbatim excerpts (under ~30 words each) from the input. At least one per concept.

### Do NOT fabricate

If the source does not mention formulas for a concept, emit \`formulas: []\`. Do NOT make one up. Same for every other array field. Hallucinating detail defeats the purpose — downstream trusts this scope as ground truth.

If a concept is barely mentioned in the source, give it a short \`fullDefinition\`, one \`sourceQuote\`, and empty arrays for everything else. Do NOT skip in-scope concepts — every in-scope concept id MUST have exactly one file.
${scopeSection}
## The concept outline you must cover

${outline}

Now read the source material in \`sources/${chapterId}/\` and create the detail files. Remember: one file per concept, no invented content, every in-scope concept id must appear exactly once.`;
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
    }
  }

  return lines.join("\n");
}
