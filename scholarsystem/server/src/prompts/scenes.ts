// Stage 6 prompt: On-demand scene generation per concept.
//
// Each concept gets a single Claude Code sub-session that produces
// one scene file: stage6-scenes/<bodyId>.md with YAML frontmatter
// matching the Scene schema.
//
// The archetype and challenge type are pre-selected by code — Claude
// fills content slots rather than choosing the template. This keeps
// animation/rendering predictable (archetypes have hand-authored GSAP
// timelines on the frontend).

import type {
  SceneArchetype,
  Challenge,
} from "@scholarsystem/shared";

export interface ScenePromptInput {
  /** The body id this scene is for (used as file name). */
  bodyId: string;
  /** Concept metadata. */
  concept: {
    id: string;
    title: string;
    kind: string;
    brief: string;
    modelTier: string;
  };
  /** Full detail body if available (from Stage 2). */
  fullDefinition?: string;
  /** Pre-selected archetype. */
  archetype: SceneArchetype;
  /** Pre-selected challenge type. */
  challengeType: Challenge["type"];
  /** Narrative context. */
  narrative?: {
    setting?: string;
    protagonist?: string;
    premise?: string;
    tone?: string;
    genre?: string;
  };
  /** Arc beat for the concept's topic (from Stage 3). */
  arcBeat?: {
    beat: string;
    emotionalTarget: string;
  };
  /** Visual context from Stage 5. */
  visual?: {
    biome?: string;
    character?: string;
    mood?: string;
  };
  /** Neighbouring concepts for distractors. */
  neighbours: { id: string; title: string; brief: string }[];
  /** Progress hints for adaptive difficulty. */
  progress?: {
    visitCount: number;
    masteryEstimate: number;
  };
}

/**
 * Build the scene generation prompt for a single concept.
 */
export function buildScenePrompt(input: ScenePromptInput): string {
  const {
    bodyId,
    concept,
    fullDefinition,
    archetype,
    challengeType,
    narrative,
    arcBeat,
    visual,
    neighbours,
    progress,
  } = input;

  const neighbourList = neighbours
    .slice(0, 6)
    .map((n) => `  - "${n.title}": ${n.brief}`)
    .join("\n");

  const narrativeBlock = narrative
    ? `
## Narrative Context

- Setting: ${narrative.setting ?? "deep space"}
- Protagonist: ${narrative.protagonist ?? "a traveller"}
- Premise: ${narrative.premise ?? "exploring knowledge"}
- Tone: ${narrative.tone ?? "wondrous"}
- Genre: ${narrative.genre ?? "exploration"}
`
    : "";

  const beatBlock = arcBeat
    ? `
## Story Beat

This concept's topic has the following story beat:
> ${arcBeat.beat}

Emotional target: ${arcBeat.emotionalTarget}

Weave this beat's tone into the opening narrative and dialogue.
`
    : "";

  const visualBlock = visual
    ? `
## Environment

- Biome: ${visual.biome ?? "crystal-cave"}
- Character: ${visual.character ?? "sage"}
- Mood: ${visual.mood ?? "mysterious"}

Use the biome to set the scene description. The character type determines the NPC's personality and speech style.
`
    : "";

  const progressBlock = progress
    ? `
## Learner Progress

- Visit count: ${progress.visitCount}
- Mastery estimate: ${progress.masteryEstimate}

${progress.masteryEstimate < 0.5 ? "The learner is struggling with this concept. Be more encouraging, provide clearer explanations, and use simpler language in the challenge." : "The learner is doing well. You can be more challenging."}
`
    : "";

  const challengeInstructions = getChallengeInstructions(challengeType, concept, neighbours);

  return `# Scene Generation: ${concept.title}

You are generating an interactive learning scene for a galaxy-themed education platform. The user "lands" on a celestial body and experiences a short narrative + dialogue + challenge that teaches one concept.

## Your Task

Create ONE file: \`stage6-scenes/${bodyId}.md\` with YAML frontmatter containing the complete scene data.

## Concept

- ID: ${concept.id}
- Title: ${concept.title}
- Kind: ${concept.kind}
- Brief: ${concept.brief}
- Model tier: ${concept.modelTier}
${fullDefinition ? `\n### Full Definition\n\n${fullDefinition}\n` : ""}
${narrativeBlock}${beatBlock}${visualBlock}${progressBlock}
## Neighbour Concepts (for distractors)

${neighbourList || "  (none available)"}

## Scene Requirements

**Archetype: \`${archetype}\`**

${getArchetypeDescription(archetype)}

**Challenge type: \`${challengeType}\`**

${challengeInstructions}

## Output Format

Create \`stage6-scenes/${bodyId}.md\` with this exact YAML frontmatter structure:

\`\`\`yaml
---
bodyId: "${bodyId}"
archetype: "${archetype}"
openingNarrative: >
  (1-3 sentences setting the scene. Use the biome environment. Draw the learner in.)
dialogue:
  - speakerId: null
    text: "(narrator/environmental text)"
  - speakerId: null
    text: "(NPC speech — use null for speakerId since we don't have character IDs)"
closingNarrative: >
  (1-2 sentences wrapping up after the challenge. Reference what was learned.)
challenge:
  ${getChallengeYamlTemplate(challengeType)}
---
\`\`\`

## Rules

1. The scene must teach the concept "${concept.title}" accurately using its brief and full definition.
2. Opening narrative: 1-3 vivid sentences. Set the scene using the biome/environment. No generic "you arrive" openers.
3. Dialogue: 2-5 lines. The NPC explains the concept in character. Use \`speakerId: null\` for all lines.
4. Challenge: MUST have exactly one correct answer path. Use neighbouring concepts as plausible distractors.
5. Closing narrative: 1-2 sentences. Reference the concept and what was just demonstrated.
6. Keep all text concise — this is mobile-friendly UI, not a novel.
7. Do NOT invent facts. Everything must come from the concept's brief and definition.
8. Create ONLY the one file specified. Do not create any other files.
`;
}

function getArchetypeDescription(archetype: SceneArchetype): string {
  const descriptions: Record<SceneArchetype, string> = {
    "guardian-dialogue":
      "A wise NPC guardian teaches the concept through dialogue. The NPC speaks with authority and guides understanding before the challenge.",
    "exploration-discovery":
      "The learner discovers the concept by exploring the environment. Description reveals clues. The NPC appears as a fellow explorer.",
    "environmental-puzzle":
      "The environment itself embodies the concept as a puzzle. The NPC provides hints. The concept is understood through solving.",
    "memory-echo":
      "A ghostly echo replays a memory that illustrates the concept. The NPC is a spectral presence narrating the echo.",
    "cooperative-challenge":
      "The learner works alongside a companion NPC to apply the concept together. The NPC is a partner, not a teacher.",
  };
  return descriptions[archetype];
}

function getChallengeInstructions(
  type: Challenge["type"],
  concept: { title: string; brief: string },
  neighbours: { title: string; brief: string }[],
): string {
  switch (type) {
    case "mcq":
      return `Multiple choice with 4 options. One correct (describes "${concept.title}"), three distractors from neighbouring concepts. Each option needs an \`explanation\` string shown after answering.`;
    case "drag-sort":
      return `3-5 items that must be placed in a logical order. Could be steps of a process, parts of a definition arranged logically, or a sequence inherent to the concept. Each item has an \`id\`, \`label\`, and \`correctIndex\` (0-based).`;
    case "hotspot":
      return `3-5 discoverable hotspots placed in the scene (x/y as 0-100 percentage coordinates). Each has a label, revealText explaining it, and a \`required\` boolean (the main concept's hotspot MUST be required). At least 2 should be required.`;
    case "match-pairs":
      return `3-5 term-definition pairs. Include the main concept and use neighbours as additional pairs. The learner connects left (term) to right (description).`;
    case "fill-blank":
      return `A sentence or formula with one or more blanks. Each blank has a \`correctAnswer\` and an \`options\` array (correct + 2-3 distractors). Segments alternate between \`kind: text\` and \`kind: blank\`.`;
    case "timer":
      return `A timed 4-option question (${concept.brief.length > 100 ? 30 : 20} seconds). Include an \`urgencyNarrative\` (1 dramatic sentence creating time pressure). Options have \`text\` and \`correct\` boolean. No explanations — speed is the test.`;
    case "dialogue-choice":
      return `1-2 exchanges where the NPC asks and the learner picks a response. Each exchange has an \`npcLine\`, and 2-3 \`playerOptions\` with \`text\`, \`correct\` boolean, \`npcReaction\` string, and \`emotion\` ("encouraging"/"stern"/"neutral"/"thoughtful").`;
  }
}

function getChallengeYamlTemplate(type: Challenge["type"]): string {
  switch (type) {
    case "mcq":
      return `type: mcq
  question: "(question text)"
  options:
    - text: "(option text)"
      correct: true
      explanation: "(why this is correct)"
    - text: "(distractor)"
      correct: false
      explanation: "(why this is wrong)"
    - text: "(distractor)"
      correct: false
      explanation: "(why this is wrong)"
    - text: "(distractor)"
      correct: false
      explanation: "(why this is wrong)"`;
    case "drag-sort":
      return `type: drag-sort
  instruction: "(what to arrange and in what order)"
  items:
    - id: "s1"
      label: "(item text)"
      correctIndex: 0
    - id: "s2"
      label: "(item text)"
      correctIndex: 1
    - id: "s3"
      label: "(item text)"
      correctIndex: 2`;
    case "hotspot":
      return `type: hotspot
  instruction: "(what to discover)"
  hotspots:
    - id: "h1"
      label: "(hotspot name)"
      x: 25
      y: 35
      revealText: "(explanation when discovered)"
      required: true
    - id: "h2"
      label: "(hotspot name)"
      x: 65
      y: 55
      revealText: "(explanation)"
      required: false`;
    case "match-pairs":
      return `type: match-pairs
  instruction: "(what to match)"
  pairs:
    - left: "(term)"
      right: "(definition)"
    - left: "(term)"
      right: "(definition)"
    - left: "(term)"
      right: "(definition)"`;
    case "fill-blank":
      return `type: fill-blank
  instruction: "(what to complete)"
  segments:
    - kind: text
      value: "(text before blank)"
    - kind: blank
      id: "b1"
      correctAnswer: "(correct term)"
      alternatives: []
      options: ["(correct)", "(distractor1)", "(distractor2)", "(distractor3)"]
    - kind: text
      value: "(text after blank)"`;
    case "timer":
      return `type: timer
  urgencyNarrative: "(dramatic time-pressure sentence)"
  timeSeconds: 25
  question: "(question text)"
  options:
    - text: "(option)"
      correct: true
    - text: "(distractor)"
      correct: false
    - text: "(distractor)"
      correct: false
    - text: "(distractor)"
      correct: false`;
    case "dialogue-choice":
      return `type: dialogue-choice
  setup: "(scene-setting sentence)"
  exchanges:
    - npcLine: "(NPC asks a question)"
      playerOptions:
        - text: "(correct response)"
          correct: true
          npcReaction: "(NPC reacts positively)"
          emotion: encouraging
        - text: "(wrong response)"
          correct: false
          npcReaction: "(NPC corrects gently)"
          emotion: stern
        - text: "(wrong response)"
          correct: false
          npcReaction: "(NPC corrects)"
          emotion: neutral`;
  }
}

// ─── Archetype + challenge type selection (deterministic) ─────────────
//
// Same logic as the frontend's mockScene.ts — pre-select in code so
// Claude fills content slots, not picks templates.

const KIND_ARCHETYPES: Record<string, SceneArchetype[]> = {
  definition: ["guardian-dialogue", "memory-echo"],
  formula: ["environmental-puzzle", "guardian-dialogue"],
  example: ["exploration-discovery", "cooperative-challenge"],
  fact: ["memory-echo", "exploration-discovery"],
  principle: ["guardian-dialogue", "cooperative-challenge"],
  process: ["environmental-puzzle", "exploration-discovery"],
  framework: ["guardian-dialogue", "exploration-discovery"],
  "trade-off": ["memory-echo", "cooperative-challenge"],
  distinction: ["exploration-discovery", "guardian-dialogue"],
  paradigm: ["guardian-dialogue", "memory-echo"],
  property: ["exploration-discovery", "environmental-puzzle"],
};

const ARCHETYPE_CHALLENGES: Record<SceneArchetype, Challenge["type"][]> = {
  "guardian-dialogue": ["mcq", "fill-blank", "dialogue-choice"],
  "exploration-discovery": ["hotspot", "match-pairs", "drag-sort"],
  "environmental-puzzle": ["drag-sort", "fill-blank", "timer"],
  "memory-echo": ["mcq", "match-pairs", "dialogue-choice"],
  "cooperative-challenge": ["dialogue-choice", "fill-blank", "drag-sort"],
};

function hash(str: string): number {
  let h = 0x811c9dc5;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

export function pickArchetype(conceptId: string, kind: string): SceneArchetype {
  const options = KIND_ARCHETYPES[kind] ?? ["guardian-dialogue"];
  return options[hash(conceptId) % options.length];
}

export function pickChallengeType(
  conceptId: string,
  archetype: SceneArchetype,
): Challenge["type"] {
  const options = ARCHETYPE_CHALLENGES[archetype];
  return options[(hash(conceptId) >> 4) % options.length];
}
