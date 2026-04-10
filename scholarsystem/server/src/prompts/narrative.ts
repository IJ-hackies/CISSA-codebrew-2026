// Stage 3 prompt: Narrative (Obsidian markdown output).
//
// Two modes:
//   - FIRST RUN: generates `narrative.canon` + first `narrative.arcs[0]`
//   - EXTEND:    canon frozen as input, generates new arc for the chapter
//
// Claude Code writes files into `stage3-narrative/`:
//   - `stage3-narrative/canon.md`     (first run only)
//   - `stage3-narrative/arcs/<chapter>.md`  (every run)

import type { Knowledge, NarrativeCanon } from "@scholarsystem/shared";

export interface NarrativePromptInput {
  chapterId: string;
  knowledge: Knowledge;
  /** If provided, canon is frozen — extend mode. */
  existingCanon?: NarrativeCanon | null;
  /** Detail summaries per concept for richer beat writing. */
  conceptSummaries?: Record<string, string>;
}

export function buildNarrativePrompt(input: NarrativePromptInput): string {
  const { chapterId, knowledge, existingCanon, conceptSummaries } = input;
  const isExtend = existingCanon != null;

  const outline = renderKnowledgeForNarrative(knowledge, conceptSummaries);

  if (isExtend) {
    return buildExtendPrompt(chapterId, outline, existingCanon);
  }
  return buildFirstRunPrompt(chapterId, outline);
}

function buildFirstRunPrompt(chapterId: string, outline: string): string {
  return `You are a narrative designer for an educational space-exploration game. Players explore a galaxy where each solar system is a topic, planets are subtopics, and moons are concepts they can land on to learn through interactive story scenes.

Your job: create the narrative spine that will tie all these educational concepts together into a coherent, engaging story.

## Output

Create TWO files:

### 1. \`stage3-narrative/canon.md\` — the immutable story bible

This file is FROZEN after creation. Future chapter uploads will read it but never modify it. It must be rich enough to sustain story continuity across many chapters.

\`\`\`yaml
---
type: canon
setting: >
  A vivid 2-3 sentence description of the galaxy setting. What kind of
  place is this? What's the atmosphere? Think: the opening crawl of a
  space opera, but for a learning galaxy.
protagonist: >
  Who is the player? Not a blank slate — give them a role, a reason to
  explore, a voice. "A newly graduated astro-cartographer on their first
  solo survey mission" is better than "a space explorer".
premise: >
  What's the central narrative question? Why must these systems be explored?
  "Map the remnants of a collapsed civilization's knowledge vaults before
  the stellar drift erases them" gives every landing a sense of urgency.
stakes: >
  What happens if the player succeeds? What if they don't? Keep it thematic
  rather than apocalyptic — the stakes should match the tone.
tone:
  primary: <mysterious|heroic|investigative|comedic|melancholic|wondrous|ominous|reverent>
  secondary: <optional free-text nuance, or null>
  genre: <hard-sf|space-opera|cosmic-horror|archaeological|exploration|mythic>
aesthetic:
  paletteDirection: >
    High-level color direction for the visual engine. "Deep indigo void with
    amber knowledge-light accents" not hex codes.
  atmosphereDirection: >
    What should the galaxy feel like? "Ancient library suspended in space,
    dust motes catching light between shelves of stars"
  motifKeywords:
    - keyword1
    - keyword2
    - keyword3
    # 3-12 keywords that recurring visual motifs should draw from
recurringCharacters:
  - id: ${chapterId}-<kebab-name>
    name: <display name>
    role: <narrative role: guide, rival, trickster, sage, echo, etc.>
    description: <2-3 sentences, appearance + personality>
    voice: >
      How they talk. Sentence length, vocabulary level, verbal tics,
      whether they use metaphor or speak plainly. This is the MOST
      important field for keeping NPCs distinct across independently
      generated scenes.
    arc: >
      How does this character change or reveal more of themselves as the
      player progresses through the galaxy?
  # Create 2-4 recurring characters. They will appear across many scenes.
finaleHook: >
  A teaser for what the player will discover when they've explored everything.
  Not a spoiler — a promise.
hardConstraints:
  - "No character deaths"
  - "Never break the fourth wall"
  # Soft guidance appended to scene gen prompts as "avoid these"
---
\`\`\`

### 2. \`stage3-narrative/arcs/${chapterId}.md\` — story beats for this chapter

\`\`\`yaml
---
type: arc
chapter: ${chapterId}
arcSummary: >
  2-3 sentences: what is this chapter's story arc about? What does the
  player discover or accomplish by exploring these systems?
beats:
  - topicId: ${chapterId}-<topic-id>
    role: <opening|rising-action|complication|midpoint|deepening|climax|resolution|epilogue>
    beat: >
      What happens in this system's story? 2-4 sentences. Reference
      specific concepts the player will encounter as moons. This is the
      scene generator's primary narrative input.
    emotionalTarget: >
      One phrase: "curiosity turning to awe", "mounting tension", "quiet
      satisfaction", "playful discovery"
    connectsTo:
      - ${chapterId}-<related-topic-id>
      # Topics whose beats connect to this one narratively
chapterHook: >
  The opening text the player sees when this chapter's content first
  appears in their galaxy. 1-2 sentences, setting the stage.
---
\`\`\`

## Rules

1. **One beat per topic.** Not per subtopic or concept — those are too granular. The beat references concepts by name so the scene generator knows the narrative context.
2. **Characters must feel distinct.** The \`voice\` field is critical. If two characters could swap dialogue and nobody would notice, rewrite their voices.
3. **The story must serve the learning**, not the other way around. Narrative is scaffolding that makes concepts memorable. Don't let plot complexity distract from the educational content.
4. **Tone must be consistent** but not monotone. A \`wondrous\` galaxy can have moments of tension; a \`mysterious\` galaxy can have warmth.
5. **Beat roles should form a natural arc** across topics. If there are 4 topics, consider: opening → rising-action → climax → resolution.
6. **Character ids must start with \`${chapterId}-\`** and be kebab-case.

## The knowledge to wrap in narrative

${outline}

Now read the source material in \`sources/${chapterId}/\` for additional context, then create the canon and arc files.`;
}

function buildExtendPrompt(
  chapterId: string,
  outline: string,
  canon: NarrativeCanon,
): string {
  const canonYaml = renderCanonForPrompt(canon);

  return `You are a narrative designer extending an existing educational space-exploration galaxy with a new chapter of content.

## FROZEN CANON (DO NOT MODIFY)

The following canon was established when the galaxy was first created. You MUST NOT change any of it — treat it as immutable input. Your new arc must feel like a natural continuation of this story.

${canonYaml}

## Your task

Create ONE file:

### \`stage3-narrative/arcs/${chapterId}.md\` — story beats for the NEW chapter

\`\`\`yaml
---
type: arc
chapter: ${chapterId}
arcSummary: >
  2-3 sentences: what is this chapter's arc about? How does it extend
  the existing story? What new discoveries or challenges does it bring?
beats:
  - topicId: ${chapterId}-<topic-id>
    role: <opening|rising-action|complication|midpoint|deepening|climax|resolution|epilogue>
    beat: >
      What happens in this system's story? 2-4 sentences. Reference
      specific concepts the player will encounter. Connect to the
      existing canon's characters and tone.
    emotionalTarget: >
      One phrase describing the target emotion.
    connectsTo:
      - <related-topic-id>
chapterHook: >
  The opening text when this chapter's content appears. Reference the
  existing story — "new signals detected in an unexplored sector" rather
  than starting from scratch.
---
\`\`\`

## Rules

1. **Use the existing characters.** Reference them by name in beats. You may hint at character development but don't contradict their established arcs.
2. **Maintain the established tone.** The \`tone\` in canon is the guardrail.
3. **Cross-chapter connections are encouraged.** If a new topic relates to an earlier one, make the beat reference it. This creates the "story extends" feeling.
4. **Do NOT create a new canon file.** Canon is frozen.
5. **Beat roles should form a natural arc** within this chapter's topics.

## The NEW knowledge to wrap in narrative

${outline}

Now read the source material in \`sources/${chapterId}/\` and the existing narrative files in \`stage3-narrative/\` for context, then create the arc file.`;
}

function renderKnowledgeForNarrative(
  knowledge: Knowledge,
  conceptSummaries?: Record<string, string>,
): string {
  const subtopicsById = new Map(knowledge.subtopics.map((s) => [s.id, s]));
  const conceptsById = new Map(knowledge.concepts.map((c) => [c.id, c]));
  const lines: string[] = [];

  lines.push(`# ${knowledge.title}`);
  lines.push(knowledge.summary);
  lines.push("");

  for (const topic of knowledge.topics) {
    lines.push(`## TOPIC: ${topic.title}`);
    lines.push(topic.summary);

    for (const sid of topic.subtopicIds) {
      const sub = subtopicsById.get(sid);
      if (!sub) continue;
      lines.push(`  ### SUBTOPIC: ${sub.title}`);
      lines.push(`  ${sub.summary}`);

      for (const cid of sub.conceptIds) {
        const c = conceptsById.get(cid);
        if (!c) continue;
        const summary = conceptSummaries?.[cid];
        lines.push(
          `    - **${c.title}** (${c.id}, ${c.kind}): ${c.brief}${summary ? ` — ${summary}` : ""}`,
        );
      }
    }
    lines.push("");
  }

  if (knowledge.looseConceptIds.length > 0) {
    lines.push("## LOOSE CONCEPTS");
    for (const cid of knowledge.looseConceptIds) {
      const c = conceptsById.get(cid);
      if (!c) continue;
      const summary = conceptSummaries?.[cid];
      lines.push(
        `  - **${c.title}** (${c.id}, ${c.kind}): ${c.brief}${summary ? ` — ${summary}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

function renderCanonForPrompt(canon: NarrativeCanon): string {
  const chars = canon.recurringCharacters
    .map(
      (c) =>
        `  - **${c.name}** (${c.id}, ${c.role}): ${c.description}\n    Voice: ${c.voice}\n    Arc: ${c.arc}`,
    )
    .join("\n");

  return `**Setting:** ${canon.setting}
**Protagonist:** ${canon.protagonist}
**Premise:** ${canon.premise}
**Stakes:** ${canon.stakes}
**Tone:** ${canon.tone.primary}${canon.tone.secondary ? ` / ${canon.tone.secondary}` : ""} (${canon.tone.genre})
**Aesthetic:** palette=${canon.aesthetic.paletteDirection}, atmosphere=${canon.aesthetic.atmosphereDirection}, motifs=[${canon.aesthetic.motifKeywords.join(", ")}]
**Characters:**
${chars}
**Finale hook:** ${canon.finaleHook}
**Hard constraints:** ${canon.hardConstraints.join("; ")}`;
}
