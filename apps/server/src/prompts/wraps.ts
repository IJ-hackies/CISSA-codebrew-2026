// Stage 2 prompt: Wrap generation (per-node sub-sessions).
//
// Each parallel agent receives:
//   - Only its node's source units (scoped by the skeleton's sourceRefs)
//   - The node's metadata (kind, brief, parent, siblings)
//   - Neighboring node summaries for wikilink context
//   - Instructions to produce a wrap file with the Spotify-Wrapped-style card
//
// Key rules:
//   - Wraps are the PRODUCT — what users see when clicking a node
//   - Derivatives are verbatim source quotes (accuracy guarantee)
//   - Mood + color drive visual appearance in the 3D galaxy
//   - Every source unit assigned to this node must appear as a derivative

export interface WrapNodeInfo {
  id: string;
  level: "cluster" | "group" | "entry";
  title: string;
  brief: string;
  kind?: string;         // EntryKind — only for entries
  sourceRefs: string[];
  parentTitle?: string;   // cluster title for groups, group title for entries
  childTitles?: string[]; // group/entry titles under this node
}

export interface BuildNodeWrapPromptOptions {
  /** The node to generate a wrap for. */
  node: WrapNodeInfo;
  /** Chapter ID for folder pathing. */
  chapterId: string;
  /** Neighboring nodes for wikilink context. */
  neighbors: { id: string; title: string }[];
}

/**
 * Build a focused prompt for a single node's wrap. The agent creates
 * exactly ONE file: `stage2-wraps/<nodeId>.md`.
 *
 * Source unit files are pre-pushed into the sub-session workspace
 * under `sources/<chapterId>/`, so the prompt just references them.
 */
export function buildNodeWrapPrompt(
  options: BuildNodeWrapPromptOptions,
): string {
  const { node, chapterId, neighbors } = options;

  const neighborList = neighbors.length > 0
    ? neighbors.map((n) => `  - [[${n.id}]] "${n.title}"`).join("\n")
    : "  (none)";

  const levelSpecificFields = getLevelSpecificFields(node);
  const levelSpecificInstructions = getLevelSpecificInstructions(node);

  return `You are a content wrapper for a Memory Galaxy. Your task is to produce ONE rich "wrap" card for a single node — like Spotify Wrapped, but for a piece of someone's knowledge or memories. This wrap is what users see when they click a node in the 3D galaxy.

## The node

- **ID:** ${node.id}
- **Level:** ${node.level}
- **Title:** ${node.title}
- **Brief:** ${node.brief}${node.kind ? `\n- **Kind:** ${node.kind}` : ""}${node.parentTitle ? `\n- **Parent:** ${node.parentTitle}` : ""}${node.childTitles && node.childTitles.length > 0 ? `\n- **Children:** ${node.childTitles.join(", ")}` : ""}
- **Source units:** ${node.sourceRefs.join(", ")}

## Related nodes (for connections — do NOT create files for these)

${neighborList}

## Output

Create exactly ONE file: \`stage2-wraps/${node.id}.md\`

\`\`\`markdown
---
nodeId: ${node.id}
level: ${node.level}
headline: <catchy one-liner, like a Spotify Wrapped title — "The month everything changed">
summary: <2-4 sentences capturing the essence>
mood: <one of: joyful, melancholic, energetic, peaceful, tense, nostalgic, triumphant, curious, bittersweet, determined>
color: <hex color that captures the mood/tone, e.g. "#FF6B35">
stats:
  - label: <key number label>
    value: <the number/value>
highlights:
  - "A standout quote or moment"
  - "Another highlight"
sourceRefs: [${node.sourceRefs.join(", ")}]
${levelSpecificFields}---

${node.level === "entry" ? `<200-300 word rich content. Tell the story of this ${node.kind ?? "entry"}.
Paint a picture. Make it engaging and personal. Use the source material
faithfully but present it in a way that feels like unwrapping a gift.
Reference related nodes via [[wikilinks]].>` : ""}
# Derivatives

## ${node.sourceRefs[0] ?? `${chapterId}-s-NNNN`}

> "Exact verbatim quote from the source text."
\`\`\`

## Mood guide

Choose the mood that best captures the emotional tone of this content:
- \`joyful\` — warm, happy, celebratory → warm glow
- \`melancholic\` — sad, reflective, wistful → cool, dim
- \`energetic\` — exciting, fast-paced, dynamic → bright, fast particles
- \`peaceful\` — calm, serene, content → soft, steady glow
- \`tense\` — anxious, conflicted, uncertain → flickering, sharp
- \`nostalgic\` — longing, bittersweet remembrance → amber, gentle
- \`triumphant\` — victorious, proud, accomplished → brilliant, radiant
- \`curious\` — wondering, exploratory, open → shifting, iridescent
- \`bittersweet\` — mixed joy and sadness → warm with cool undertones
- \`determined\` — resolute, focused, driven → intense, steady

## Color guide

Pick a hex color that complements the mood and content. Be creative — this drives the node's glow in the 3D galaxy. Avoid generic grays. Each node should feel visually distinct.

${levelSpecificInstructions}

## Rules

1. **Create exactly ONE file.** \`stage2-wraps/${node.id}.md\`. Nothing else.
2. **Headline should hook.** Think Spotify Wrapped titles — punchy, personal, surprising.
3. **Stats should be specific.** Not "many things happened" but "23 memories, 5 key people, 3 turning points."
4. **Highlights are the best bits.** 2-5 standout quotes, moments, or facts.
5. **Derivatives are verbatim.** Exact quotes from the source. No paraphrasing, no ellipsis.
6. **Every source unit in sourceRefs must have at least one derivative quote.**
7. **sourceRefs in frontmatter must match the source units in # Derivatives.**
8. **Do NOT fabricate.** If the source doesn't cover something, don't invent it.
9. **Mood and color must match.** A joyful wrap shouldn't have a dark gray color.

Now read the source material in \`sources/${chapterId}/\` and create the wrap file.`;
}

/** Level-specific YAML frontmatter fields. */
function getLevelSpecificFields(node: WrapNodeInfo): string {
  switch (node.level) {
    case "cluster":
      return `dateRange: <time period if applicable, e.g. "March 2024", "2023 Q1">
topEntries:
  - <id of most significant entry>
  - <id of another key entry>
themes:
  - <recurring theme across this cluster>
  - <another theme>
`;
    case "group":
      return `theme: <what ties these entries together — the common thread>
`;
    case "entry":
      return `keyFacts:
  - label: <fact label, e.g. "When">
    value: <fact value, e.g. "March 15, 2024">
connections:
  - targetId: <related-node-id>
    reason: <why they're connected, e.g. "Both involve Sarah">
`;
  }
}

/** Level-specific instructions for the wrap content. */
function getLevelSpecificInstructions(node: WrapNodeInfo): string {
  switch (node.level) {
    case "cluster":
      return `## Cluster wrap instructions

This is a **solar system** overview. Think big picture.
- **headline**: Capture the era/theme of this cluster ("The Summer That Changed Everything")
- **stats**: Count entries, key people, places, themes within this cluster
- **themes**: 2-4 recurring patterns across all entries in this cluster
- **topEntries**: 3-5 most significant entry IDs in this cluster
- **dateRange**: Time period if the content is chronological
- No body text needed — the summary and stats tell the story.`;

    case "group":
      return `## Group wrap instructions

This is an **orbital group** — a subset of the solar system.
- **headline**: What makes this grouping special ("The People Who Shaped You")
- **stats**: Count entries in this group, key characteristics
- **theme**: The single thread tying these entries together
- No body text needed — the summary, theme, and stats tell the story.`;

    case "entry":
      return `## Entry wrap instructions

This is a **planet/moon/comet/star** — the main product users interact with.
- **headline**: Personal and specific ("The Night You Realized You Were Home")
- **body**: 200-300 words. This IS the wrap content. Tell the story. Paint a picture.
  Make it feel like unwrapping a Spotify Wrapped card — engaging, personal, surprising.
  Use the source faithfully but present it beautifully.
- **keyFacts**: Extracted data points (when, where, who, what)
- **connections**: Links to related nodes with reasons. Be generous — at least 2-3 connections.
- Reference related nodes via [[wikilinks]] in the body text.`;
  }
}
