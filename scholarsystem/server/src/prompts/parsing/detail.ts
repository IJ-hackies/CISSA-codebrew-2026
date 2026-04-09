// Stage 2 prompt: Detail extraction.
//
// Given the Stage 1 knowledge outline and the original raw source text,
// extract deep per-concept content: full definitions, formulas, worked
// examples, edge cases, mnemonics, emphasis markers, and verbatim source
// quotes. Writes into the `detail` scope of the blob, keyed by concept id.
//
// ─── Output format ────────────────────────────────────────────────────────
//
// JSONL — one JSON object per line, one concept per line. Chosen over
// monolithic JSON for the same graceful-degradation property Stage 1 got
// from TAB-delimited lines: a single malformed line is logged and dropped,
// the rest of the concepts still land. Chosen over TAB-delimited lines
// (which Stage 1 uses) because this stage's per-concept payload is nested
// (multiple arrays of multi-word strings), and line-per-field starts
// fighting the shape instead of serving it.
//
// Every line is a valid JSON object with exactly these fields:
//   conceptId         string (must match one of the provided concept ids)
//   fullDefinition    string
//   formulas          string[]
//   workedExamples    string[]
//   edgeCases         string[]
//   mnemonics         string[]
//   emphasisMarkers   string[]   -- "the lecturer stressed X", "important:"
//   sourceQuotes      string[]   -- verbatim excerpts from the input text
//
// `extractedAt` is stamped by the orchestrator, not the model.

import type { Knowledge } from "../../../../shared/types";

export interface BuildDetailPromptOptions {
  /**
   * If provided, Claude is instructed to emit JSONL lines ONLY for these
   * concept ids. The rest of the outline is still shown as cross-reference
   * context so neighbour concepts can be referred to, but no output line
   * is produced for them. Used by the parallel fan-out in `runDetail` to
   * split Stage 2 work across multiple concurrent Claude calls — each
   * chunk owns a subset of concept ids and they merge into the same blob.
   *
   * When omitted (or empty), all concepts in the outline are in scope.
   */
  inScopeConceptIds?: readonly string[];
}

/**
 * Build the Stage 2 detail prompt. The outline is flattened into a compact
 * indented listing so Claude can see every concept it needs to produce a
 * line for, plus enough parent context (topic/subtopic titles) to
 * disambiguate similar concept names across different topics.
 */
export function buildDetailPrompt(
  knowledge: Knowledge,
  rawText: string,
  options: BuildDetailPromptOptions = {},
): string {
  const outline = renderOutline(knowledge);
  const inScope = options.inScopeConceptIds;
  const scopeSection =
    inScope && inScope.length > 0
      ? `\n## Scope of THIS call\n\nThis is ONE chunk of a parallel Stage 2 run. Other chunks are handling other concepts from the same outline. You must emit JSONL lines ONLY for the following concept ids, and NO others:\n\n${inScope.map((id) => `  - ${id}`).join("\n")}\n\nThe full outline below is shown as context so you can cross-reference neighbours, but do NOT emit lines for any concept id not in the list above. Emitting out-of-scope lines will cause duplicate merge conflicts.\n`
      : "";

  return `You are an educational content extractor. You have already produced a hierarchical outline of a study document. Your job now is to go back to the source text and pull out the deep, verbatim content for EACH concept in the outline.

This is NOT a summarization task. Content fidelity is the point. If the source gives a formula, reproduce it character-for-character. If the source defines a term in a specific way, quote it. If the source gives a worked example, preserve it in full. Later stages generate narrative and gameplay on top of this data — if you over-summarize here, everything downstream loses detail that can never be recovered.

## Output format

Emit JSONL — ONE JSON object per line, ONE concept per line. No surrounding array, no wrapper object, no markdown fences, no prose, no blank lines between rows. Each line must parse independently.

Every line must be an object with EXACTLY these fields in this order:

{"conceptId":"<slug>","fullDefinition":"<string>","formulas":[...],"workedExamples":[...],"edgeCases":[...],"mnemonics":[...],"emphasisMarkers":[...],"sourceQuotes":[...]}

Field rules:
- \`conceptId\`: MUST exactly match one of the concept ids listed in the outline below. Do not invent new ids. Do not emit a line for topics or subtopics.
- \`fullDefinition\`: a complete explanation of the concept in the source's own terms, typically 1-4 sentences. More than the one-sentence brief from Stage 1. If the source genuinely only has one sentence about it, that's fine — don't pad.
- \`formulas\`: each string is one formula/equation/symbolic rule, reproduced as written. Empty array if the concept has no formulas.
- \`workedExamples\`: each string is one complete example walking through the concept. Preserve numbers, steps, and labels. Empty array if none.
- \`edgeCases\`: boundary conditions, exceptions, "does not apply when…" style notes. Empty array if none.
- \`mnemonics\`: memory aids the source explicitly mentions (acronyms, rhymes, tricks). Do NOT invent mnemonics the source doesn't state.
- \`emphasisMarkers\`: phrases where the source signals importance — "the key insight is", "this is commonly tested", "remember that", bold/italic emphasis, "the lecturer stressed", etc. Capture the phrase + context.
- \`sourceQuotes\`: short verbatim excerpts (under ~30 words each) taken directly from the input. At least one quote per concept if the source text mentions the concept at all. These are the evidence trail.

## Do NOT fabricate

If the source does not mention formulas for a concept, emit \`"formulas":[]\`. Do NOT make one up because you think the concept "should" have one. Same for every other array field. Hallucinating detail defeats the purpose of this stage — downstream trusts this scope as ground truth.

If a concept from the outline is barely mentioned in the source, that's fine. Give it a short \`fullDefinition\` based on what little the source says, one \`sourceQuote\`, and empty arrays for everything else. Do NOT skip in-scope concepts — every in-scope concept id MUST have exactly one line.${scopeSection}

## JSON hygiene

- Use double quotes for strings (JSON standard).
- Escape embedded double quotes with \\" and newlines with \\n.
- No trailing commas. No comments inside the JSON.
- Each line ends with a newline. No line may contain a literal newline inside a string — use \\n.

## The concept outline you must cover

${outline}

## The input text to extract from

---INPUT---
${rawText}
---END INPUT---

Now produce the JSONL. Remember: one JSON object per line, one concept per line, no prose, no fences, no wrapper, no invented content. Every in-scope concept id must appear exactly once.`;
}

/**
 * Render the Stage 1 knowledge outline as an indented human-readable listing
 * for the prompt. We include topic/subtopic titles (not ids) above each
 * concept so Claude can disambiguate same-name concepts across topics, but
 * the concept lines lead with the id — that's the string the model must
 * reproduce verbatim in the JSONL.
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
