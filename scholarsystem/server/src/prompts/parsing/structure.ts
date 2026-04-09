// Stage 1 prompt: Structure.
//
// Produces a hierarchical outline (topic → subtopic → concept) plus a flat
// relationship graph from raw input. Deliberately does NOT extract deep
// content — that's Stage 2's job. The output of this stage is the minimum
// viable galaxy: enough structure for the frontend to render a map.
//
// ─── Output format ────────────────────────────────────────────────────────
//
// This stage asks for a compact TAB-DELIMITED line format, NOT JSON. The
// parser lives in `pipeline/parsing/parseStructureLines.ts` and converts
// each row into the corresponding node in the Knowledge + Relationships
// scopes. Every line is independent — a single malformed row is dropped
// with a warning instead of cascading into a whole-galaxy failure.
//
// Why not JSON:
//   - ~35-50% fewer output tokens (no field names, quotes, braces, commas)
//   - No quote-escaping class of bugs (apostrophes, embedded quotes)
//   - No trailing-comma / unbalanced-brace failure modes
//   - Truncation loses only the tail, not the whole tree
//   - Freed token budget can go toward richer briefs without inflating
//     the response size
//
// Why not Messages-API tool use:
//   - Pipeline runs through Claude Code (`claude -p`), which does not
//     expose structured-output APIs. The project's cost model deliberately
//     avoids metered API billing. See ABOUT.md → "abuse Claude Code".
//
// Design notes on the prompt:
//   - Slugs must be kebab-case (^[a-z][a-z0-9-]*$). This is enforced by
//     the Zod validator after parsing but we tell the model too so it
//     doesn't waste tokens producing `snake_case` or `Title Case` ids.
//   - `modelTier` is the single most important field for cost control in
//     later stages — light/standard/heavy routes to Haiku/Sonnet/Opus in
//     scene gen. The prompt gives explicit guidance on how to choose.
//   - A worked example locks in the exact shape. It's on astronomy to
//     match the fixture so drift between prompt and fixture is easy to spot.

export function buildStructurePrompt(input: string): string {
  return `You are an educational content analyst. Your job is to read study material and produce a strict, hierarchical knowledge outline suitable for a galaxy-themed learning game where topics become solar systems, subtopics become planets, and concepts become moons.

## What to produce

Output a series of TAB-DELIMITED lines in the format described below. Output the rows ONLY — no prose, no markdown fences, no explanations, no blank header line. One row per line. Use a single TAB character (U+0009) between fields. Do NOT use multiple spaces instead of a tab.

If a field value would contain a tab character, replace it with a single space before emitting the row. Never emit a literal tab inside a field.

### Row types

Emit these rows in any order. Every row starts with a short type tag:

  TITLE<TAB>short title of the overall material
  SUMMARY<TAB>2-3 sentence overview of what the material covers

  T<TAB>id<TAB>title<TAB>summary
    - topic (becomes a solar system)
    - summary: 1-2 sentences, the arc of this topic

  S<TAB>id<TAB>parentTopicId<TAB>title<TAB>summary
    - subtopic (becomes a planet)
    - parentTopicId MUST reference a T row's id
    - summary: 1-2 sentences

  C<TAB>id<TAB>parentSubtopicId<TAB>kind<TAB>tier<TAB>title<TAB>brief
    - concept (becomes a moon, or an asteroid if loose)
    - parentSubtopicId: either an S row id OR a single dash "-" for a
      loose concept (free-floating asteroid — use sparingly, only when a
      concept genuinely doesn't cluster into any subtopic)
    - kind: one of "definition" "formula" "example" "fact" "principle" "process"
    - tier: one of "light" "standard" "heavy"
    - brief: a ONE- or TWO-sentence hook that tells the learner what
      this concept is about, ≤40 words. NOT full content — deep detail
      is extracted in a later stage.

  R<TAB>fromConceptId<TAB>toConceptId<TAB>relationshipKind
    - relationshipKind: one of "prerequisite" "related" "contrasts" "example-of"
    - Both ids MUST reference concepts (C rows), never topics/subtopics.
    - Be sparing — fewer than one relationship per concept on average.
    - No self-loops, no duplicates.

### Rules

- Exactly THREE levels: topic → subtopic → concept. Flatten deeper source
  hierarchies into this shape.
- Every id is a kebab-case slug matching ^[a-z][a-z0-9-]*$ — lowercase
  letters, digits, hyphens. Start with a letter. No spaces, no underscores,
  no capitals.
- Ids must be UNIQUE across all T, S, and C rows combined.
- Every parent id referenced must exist as a row of the correct type in
  the same output.
- Preserve the source's own terminology. Do not rename things to sound cleaner.
- Aim for a playable galaxy: roughly 2-6 topics, 2-5 subtopics per topic,
  2-5 concepts per subtopic. Scale with input size but avoid fewer than 2
  topics or more than 8.

### Concept kind guidance

  definition - a named term being defined
  formula    - a mathematical or symbolic rule
  example    - a worked instance illustrating a rule
  fact       - a standalone factual claim (date, number, name)
  principle  - a general law or rule of thumb
  process    - a multi-step procedure or sequence

### Concept tier guidance

A hint about the INHERENT REASONING COMPLEXITY of the concept, not its
importance. Used by later stages to route scene generation to a cheaper
or stronger model.

  light    - isolated facts, single-sentence definitions, one-step recall
             (e.g. "Venus has 92x Earth's surface pressure")
  standard - typical explanations, worked examples, concepts that need a
             paragraph of context (default; use when in doubt)
  heavy    - multi-step reasoning, proofs, concepts that depend heavily
             on other concepts being understood first (e.g. HR diagram
             interpretation, causal chains)

## Worked example (shape only — do not copy this content)

For input "brief astronomy notes covering rocky planets and hydrogen fusion", a valid output is:

TITLE	Intro Astronomy
SUMMARY	Rocky planets and stellar fusion basics, for first-year students.
T	solar-system	The Solar System	Worlds orbiting our star and how they differ from one another.
T	stellar-evolution	Stellar Evolution	How stars live, fuse, and eventually die.
S	inner-planets	solar-system	Inner Planets	Rocky worlds close to the sun with thin or thick atmospheres.
S	main-sequence	stellar-evolution	Main Sequence	The long, stable fusion phase of a star's life.
C	rocky-planet-def	inner-planets	definition	light	Rocky Planet Definition	A planet whose surface is silicate rock or metal, as opposed to a gas giant.
C	hydrogen-fusion	main-sequence	process	standard	Hydrogen Fusion	The proton-proton chain that powers sun-like stars by fusing hydrogen into helium.
C	free-lunch	-	fact	light	No Free Lunch	A loose fun-fact concept that doesn't cluster into any subtopic, shown as an asteroid.
R	rocky-planet-def	hydrogen-fusion	related

## The input to analyse

---INPUT---
${input}
---END INPUT---

Now produce the rows. Remember: TAB-delimited, no prose, no fences, no JSON.`;
}
