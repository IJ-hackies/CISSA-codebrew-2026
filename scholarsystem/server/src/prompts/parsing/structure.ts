// Stage 1 prompt: Structure.
//
// Produces a hierarchical outline (topic → subtopic → concept) plus a flat
// relationship graph from raw input. Deliberately does NOT extract deep
// content — that's Stage 2's job. The output of this stage is the minimum
// viable galaxy: enough structure for the frontend to render a map.
//
// Design notes on the prompt:
//   - The model is told to output STRICT JSON only, no prose, no fences.
//     We still defensively extract JSON on the orchestrator side.
//   - Slugs must be kebab-case (^[a-z][a-z0-9-]*$). This is enforced by the
//     Zod validator but we tell the model too so it doesn't waste tokens
//     producing `snake_case` or `Title Case` ids we'd have to reject.
//   - `modelTier` is the single most important field for cost control in
//     later stages — light/standard/heavy routes to Haiku/Sonnet/Opus in
//     scene gen. The prompt gives explicit guidance on how to choose.
//   - A small worked example locks in the exact shape. The example is on
//     astronomy to match the fixture, so drift between prompt and fixture
//     is easy to spot.

export function buildStructurePrompt(input: string): string {
  return `You are an educational content analyst. Your job is to read study material and produce a strict, hierarchical knowledge outline suitable for a galaxy-themed learning game where topics become solar systems, subtopics become planets, and concepts become moons.

## What to produce

Output a SINGLE JSON object with exactly two top-level keys: "knowledge" and "relationships". Output JSON ONLY — no prose, no markdown fences, no explanations.

### knowledge

An object shaped like this:

{
  "title": "short title of the overall material",
  "summary": "2-3 sentence overview of what the material covers",
  "topics":    [ { "id": "slug", "title": "...", "summary": "...", "subtopicIds": ["slug", ...] }, ... ],
  "subtopics": [ { "id": "slug", "title": "...", "summary": "...", "conceptIds":  ["slug", ...] }, ... ],
  "concepts":  [ { "id": "slug", "title": "...", "kind": "...", "brief": "...", "modelTier": "..." }, ... ],
  "looseConceptIds": ["slug", ...]
}

Rules for \`knowledge\`:
- EXACTLY three levels: topic → subtopic → concept. Flatten deeper source hierarchies into this shape. Do not nest.
- Topics, subtopics, and concepts are stored as three FLAT arrays that reference each other by id. Do not nest concepts inside subtopics inline.
- Every id is a kebab-case slug matching \`^[a-z][a-z0-9-]*$\` — lowercase letters, digits, hyphens. Start with a letter. No spaces, no underscores, no capitals.
- Ids must be UNIQUE across the entire knowledge object (across topics, subtopics, and concepts combined).
- Every id referenced in \`subtopicIds\` / \`conceptIds\` / \`looseConceptIds\` MUST exist in the corresponding flat array. No dangling references.
- \`brief\` is a ONE-SENTENCE hook, not full content. Save granular detail for later stages. Keep briefs under ~25 words.
- \`looseConceptIds\` contains concept ids that don't naturally belong to any subtopic. These become free-floating asteroids in the game world. Use sparingly — only when a concept genuinely doesn't cluster.
- Preserve the source's own terminology. Do not rename things to sound cleaner.
- Aim for a tree that produces a playable galaxy: roughly 2–6 topics, 2–5 subtopics per topic, 2–5 concepts per subtopic. Scale gracefully with input size but avoid fewer than 2 topics or more than 8.

Rules for \`concept.kind\`: one of "definition", "formula", "example", "fact", "principle", "process".
- definition — a named term being defined
- formula — a mathematical or symbolic rule
- example — a worked instance illustrating a rule
- fact — a standalone factual claim (date, number, name)
- principle — a general law or rule of thumb
- process — a multi-step procedure or sequence

Rules for \`concept.modelTier\`: one of "light", "standard", "heavy". This is a hint about the INHERENT REASONING COMPLEXITY of the concept, not its importance.
- light — isolated facts, single-sentence definitions, memorization, one-step recall. (e.g. "Venus has 92x Earth's pressure")
- standard — typical explanations, worked examples, concepts that need a paragraph of context. (default; use when in doubt)
- heavy — multi-step reasoning, proofs, concepts that depend heavily on other concepts being understood first. (e.g. HR diagram interpretation, causal chains)

### relationships

A flat array of cross-concept edges:

[ { "from": "concept-slug", "to": "concept-slug", "kind": "..." }, ... ]

Where \`kind\` is one of:
- "prerequisite" — understanding \`from\` is needed before \`to\`
- "related" — the two concepts touch the same underlying idea
- "contrasts" — the two concepts are deliberately compared / opposed
- "example-of" — \`from\` is a concrete instance of \`to\`

Rules:
- Only link CONCEPT ids (not topics or subtopics).
- Both \`from\` and \`to\` must exist in \`knowledge.concepts\`.
- Be sparing. Only include relationships that are genuinely informative for a learner navigating the material — aim for fewer than one relationship per concept on average.
- No self-loops. No duplicates.

## Worked example (shape only — do not copy this content)

For input "brief astronomy notes covering rocky planets and hydrogen fusion", a valid output is:

{
  "knowledge": {
    "title": "Intro Astronomy",
    "summary": "Rocky planets and stellar fusion basics.",
    "topics": [
      { "id": "solar-system", "title": "The Solar System", "summary": "Worlds orbiting our star.", "subtopicIds": ["inner-planets"] },
      { "id": "stellar-evolution", "title": "Stellar Evolution", "summary": "How stars live and die.", "subtopicIds": ["main-sequence"] }
    ],
    "subtopics": [
      { "id": "inner-planets", "title": "Inner Planets", "summary": "Rocky worlds close to the sun.", "conceptIds": ["rocky-planet-def"] },
      { "id": "main-sequence", "title": "Main Sequence", "summary": "Stable fusion phase.", "conceptIds": ["hydrogen-fusion"] }
    ],
    "concepts": [
      { "id": "rocky-planet-def", "title": "Rocky Planet Definition", "kind": "definition", "brief": "A planet of silicate rock or metal.", "modelTier": "light" },
      { "id": "hydrogen-fusion", "title": "Hydrogen Fusion", "kind": "process", "brief": "Proton-proton chain powering sun-like stars.", "modelTier": "standard" }
    ],
    "looseConceptIds": []
  },
  "relationships": [
    { "from": "rocky-planet-def", "to": "hydrogen-fusion", "kind": "related" }
  ]
}

## The input to analyse

---INPUT---
${input}
---END INPUT---

Now produce the JSON. Remember: JSON only, no prose, no fences.`;
}
