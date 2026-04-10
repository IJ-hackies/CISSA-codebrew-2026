// Stage 5 prompt: Visuals (Obsidian markdown output).
//
// Generates per-body visual parameters for knowledge-bearing bodies so the
// galaxy reads as one coherent place. Decorative bodies are handled in pure
// code — this prompt only covers galaxy, system, planet, moon, and asteroid.
//
// Claude Code writes files into `stage5-visuals/`, one .md per body.

import type {
  Knowledge,
  NarrativeCanon,
  Body,
  Spatial,
} from "@scholarsystem/shared";

export interface VisualsPromptInput {
  /** Bodies that need visual params (knowledge-bearing, not yet themed). */
  bodies: Body[];
  /** Full spatial scope for positional context. */
  spatial: Spatial;
  /** Narrative canon — aesthetic direction is the primary input. */
  canon: NarrativeCanon;
  /** Knowledge tree for titles and semantic context. */
  knowledge: Knowledge;
  /** Biome assignments per subtopic (pre-computed by orchestrator). */
  subtopicBiomes: Record<string, string>;
  /** Character role assignments per concept (pre-computed by orchestrator). */
  conceptCharacters: Record<string, string>;
}

export function buildVisualsPrompt(input: VisualsPromptInput): string {
  const { bodies, canon, knowledge, subtopicBiomes, conceptCharacters } = input;

  const bodyList = renderBodyList(bodies, knowledge, subtopicBiomes, conceptCharacters);

  return `You are a visual designer for an educational space-exploration game. Each cosmic body in the galaxy needs visual parameters that make it feel like part of one coherent, beautiful place.

## Aesthetic direction (from the narrative canon — this is your primary guide)

- **Palette direction:** ${canon.aesthetic.paletteDirection}
- **Atmosphere direction:** ${canon.aesthetic.atmosphereDirection}
- **Motif keywords:** ${canon.aesthetic.motifKeywords.join(", ")}
- **Tone:** ${canon.tone.primary}${canon.tone.secondary ? ` / ${canon.tone.secondary}` : ""} (${canon.tone.genre})
- **Setting:** ${canon.setting}

## Output

Create ONE markdown file per body in \`stage5-visuals/\`. Each file has ONLY YAML frontmatter — no body text needed.

### Galaxy visual (\`stage5-visuals/<bodyId>.md\`)

\`\`\`yaml
---
bodyId: <body-id>
kind: galaxy
palette:
  primary: "<hex>"
  secondary: "<hex>"
  accent: "<hex>"
  atmosphere: "<rgba>"
armStyle: <spiral|barred|elliptical|irregular>
starDensity: <0.0-1.0>
---
\`\`\`

### System visual (\`stage5-visuals/<bodyId>.md\`)

\`\`\`yaml
---
bodyId: <body-id>
kind: system
palette:
  primary: "<hex>"
  secondary: "<hex>"
  accent: "<hex>"
  atmosphere: "<rgba>"
starGlow: <0.0-1.0>
orbitRingVisible: <true|false>
---
\`\`\`

### Planet visual (\`stage5-visuals/<bodyId>.md\`)

\`\`\`yaml
---
bodyId: <body-id>
kind: planet
palette:
  primary: "<hex>"
  secondary: "<hex>"
  accent: "<hex>"
  atmosphere: "<rgba>"
terrain: <crystalline|rocky|oceanic|gaseous|molten|frozen|organic|desert|metallic>
atmosphere: <thin|dense-haze|stormy|clear|toxic|aurora|none>
lighting: <bioluminescent|sunlit|twilight|eclipsed|nebula-lit|starlight>
features:
  - "<free-form flourish tag>"
  - "<another flourish tag>"
mood: "<one-phrase mood description>"
ring: <true|false>
---
\`\`\`

### Moon visual (\`stage5-visuals/<bodyId>.md\`)

\`\`\`yaml
---
bodyId: <body-id>
kind: moon
palette:
  primary: "<hex>"
  secondary: "<hex>"
  accent: "<hex>"
  atmosphere: "<rgba>"
terrain: <crystalline|rocky|oceanic|gaseous|molten|frozen|organic|desert|metallic>
cratered: <true|false>
glow: <true|false>
biome: <ASSIGNED BELOW — use the biome listed for this body>
character: <ASSIGNED BELOW — use the character listed for this body>
---
\`\`\`

### Asteroid visual (\`stage5-visuals/<bodyId>.md\`)

\`\`\`yaml
---
bodyId: <body-id>
kind: asteroid
palette:
  primary: "<hex>"
  secondary: "<hex>"
  accent: "<hex>"
  atmosphere: "<rgba>"
shape: <angular|elongated|clustered>
biome: <ASSIGNED BELOW — use the biome listed for this body>
character: <ASSIGNED BELOW — use the character listed for this body>
---
\`\`\`

## Rules

1. **Palette coherence.** All bodies should feel like they belong to the same galaxy. Use the aesthetic direction as your north star. Vary hue and saturation across systems to distinguish topics, but keep the overall tone consistent.
2. **Systems should contrast.** Each solar system (topic) should have a distinct color identity within the shared palette — the player navigates by visual landmark, so two systems shouldn't look the same.
3. **Planets within a system relate.** Planets (subtopics) under one system should share their system's palette family but vary in terrain, atmosphere, and mood to feel like distinct worlds.
4. **Moons inherit from their planet** but should be subtler — smaller palette range, simpler features. The biome and character fields are pre-assigned; use them exactly as listed.
5. **Atmosphere rgba** should have alpha < 1.0 (e.g. \`rgba(100, 50, 200, 0.3)\`). This is an overlay color, not opaque.
6. **Features** on planets are free-form tags the visual engine uses for procedural decoration (e.g. "crystalline spires", "bioluminescent pools", "orbital debris ring"). Be creative but concise — 2-5 per planet.
7. **Mood** is a short evocative phrase ("haunted serenity", "electric discovery", "ancient weight").

## Bodies to theme

${bodyList}

Now create the visual files. One \`.md\` file per body in \`stage5-visuals/\`.`;
}

function renderBodyList(
  bodies: Body[],
  knowledge: Knowledge,
  subtopicBiomes: Record<string, string>,
  conceptCharacters: Record<string, string>,
): string {
  const topicsById = new Map(knowledge.topics.map((t) => [t.id, t]));
  const subtopicsById = new Map(knowledge.subtopics.map((s) => [s.id, s]));
  const conceptsById = new Map(knowledge.concepts.map((c) => [c.id, c]));

  const lines: string[] = [];

  for (const body of bodies) {
    const ref = "knowledgeRef" in body ? body.knowledgeRef : null;

    switch (body.kind) {
      case "galaxy":
        lines.push(`- **${body.id}** (galaxy) — the root galaxy`);
        break;

      case "system": {
        const topic = ref ? topicsById.get(ref) : null;
        lines.push(
          `- **${body.id}** (system) — topic: "${topic?.title ?? ref}"${topic ? ` — ${topic.summary.slice(0, 100)}` : ""}`,
        );
        break;
      }

      case "planet": {
        const sub = ref ? subtopicsById.get(ref) : null;
        const biome = ref ? subtopicBiomes[ref] : undefined;
        lines.push(
          `- **${body.id}** (planet) — subtopic: "${sub?.title ?? ref}"${biome ? ` [biome for its moons: ${biome}]` : ""}${sub ? ` — ${sub.summary.slice(0, 100)}` : ""}`,
        );
        break;
      }

      case "moon": {
        const concept = ref ? conceptsById.get(ref) : null;
        const sub = concept
          ? knowledge.subtopics.find((s) => s.conceptIds.includes(concept.id))
          : null;
        const biome = sub ? subtopicBiomes[sub.id] : "neon-city";
        const character = ref ? conceptCharacters[ref] : "sage";
        lines.push(
          `- **${body.id}** (moon) — concept: "${concept?.title ?? ref}" (${concept?.kind ?? "unknown"}) | biome: ${biome} | character: ${character}`,
        );
        break;
      }

      case "asteroid": {
        const concept = ref ? conceptsById.get(ref) : null;
        const biome = "floating-islands"; // loose concepts get a default biome
        const character = ref ? conceptCharacters[ref] : "trickster";
        lines.push(
          `- **${body.id}** (asteroid) — loose concept: "${concept?.title ?? ref}" (${concept?.kind ?? "unknown"}) | biome: ${biome} | character: ${character}`,
        );
        break;
      }
    }
  }

  return lines.join("\n");
}
