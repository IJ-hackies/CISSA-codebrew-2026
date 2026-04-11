---
id: 7d3e1f8a-4b2c-4e9d-8f1a-6c7d8e9f0a1b
tags:
  - "#report"
  - "#rpt/report"
status: active
date-created: 2026-04-11
orbh-sessions:
  - "[[ee79fea2-46ac-4aad-b0fd-a146e4ff3778]]"
template: tmp-rpt-report
---

# v4 Narrative Galaxy Schema

## Summary

Complete specification for the v4 schema pivot. The Galaxy data model moves from a single JSON blob in SQLite to a **markdown mesh** — a folder of typed markdown files that Claude Code writes directly. The frontend consumes these via a JSON API that the server builds by parsing the workspace. Input is any data (PDFs, lectures, journals, code, transcripts). Output is planets, concepts, and long-form narrative stories.

## Content

### 1. Workspace Structure

Each galaxy is an independent workspace folder. No JSON blob. No SQLite for content. The markdown files ARE the data.

```
galaxies/<galaxy-id>/
  Media/
    Sources/                          <- raw uploaded files (any format)
    Media/                            <- images, generated media
  Mesh/
    (Source) <Name>.md
    (Solar System) <Name>.md
    (Planet) <Name>.md
    (Concept) <Name>.md
    (Story) <Name>.md
```

- Files are named `(Type) Name.md` — no numbers, no zero-padding
- Wikilinks are `[[(Type) Name]]`
- The UUID in frontmatter is the real ID
- Filenames are human-readable labels Claude picks

---

### 2. Entity Types

There are 5 entity types. Each is a markdown file with YAML frontmatter.

#### (Source)

One per uploaded file. Any data — PDFs, lecture slides, journal entries, code, transcripts, PowerPoints. This is the ground truth layer.

```markdown
---
id: <uuid>
type: source
filename: "probability-notes.pdf"
media-ref: "Sources/probability-notes.pdf"
---

# Probability Notes

A 40-page set of lecture notes covering Bayesian probability,
conditional distributions, and Markov chains. Key themes include
decision-making under uncertainty and the frequentist-Bayesian
debate. Contains worked examples on medical testing (sensitivity
vs specificity) and a final section on Monte Carlo methods.
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `type` | `"source"` | Always "source" |
| `filename` | string | Original uploaded filename |
| `media-ref` | string | Path to raw file within `Media/Sources/` |
| Body | markdown | Summary of the source document |

#### (Solar System)

The root document. One per solar system. Describes the solar system as a whole. Does NOT reference stories — stories are independent and can span solar systems.

```markdown
---
id: <uuid>
type: solar-system
planets:
  - "[[(Planet) Childhood Memories]]"
  - "[[(Planet) First Day of Uni]]"
  - "[[(Planet) Graduation Day]]"
concepts:
  - "[[(Concept) Growth]]"
  - "[[(Concept) Bayes Theorem]]"
---

# My Life

A solar system built from journal entries, university lecture notes,
and family photographs spanning 2018-2024. The dominant themes
are education, personal growth, and the quiet accumulation of
identity through ordinary experiences.
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `type` | `"solar-system"` | Always "solar-system" |
| `planets` | WikiLink[] | All planets in this solar system |
| `concepts` | WikiLink[] | All concepts in this solar system |
| Body | markdown | Solar system description — mood, themes, scope |

Note: no `stories` field. Stories reference planets/concepts, not the other way around.

#### (Planet)

A concrete node of knowledge — something tangible from the sources. Self-contained, scoped tightly enough to stand on its own without concept links.

```markdown
---
id: <uuid>
type: planet
planet-connections:
  - "[[(Planet) Graduation Day]]"
  - "[[(Planet) Summer Internship]]"
---

# First Day of Uni

The lecture theatre seats 400. Row J, seat 12 — far enough back
to feel invisible, close enough to read the whiteboard. The
professor writes P(A|B) in blue marker and says "this will
change how you think about everything."

Three students in the row ahead are already taking notes. The
textbook is still shrink-wrapped. Outside, the campus stretches
in every direction — sandstone buildings, bike racks, a coffee
cart with a 20-minute queue.

This is the first day of something that won't make sense for
another three years.
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `type` | `"planet"` | Always "planet" |
| `planet-connections` | WikiLink[] | Other planets this connects to |
| Body | markdown | Rich content — the planet's "surface" |

Note: no `concept-connections`. Planets are self-contained in v4.0.

#### (Concept)

A flexible node — not necessarily abstract. Could be a theme, a technique, a person, a recurring pattern. Whatever Claude decides fits the narrative best. The distinction from Planet is intentionally soft — during generation, entities can shift between Planet and Concept as the picture becomes clearer.

```markdown
---
id: <uuid>
type: concept
planet-connections:
  - "[[(Planet) First Day of Uni]]"
  - "[[(Planet) Graduation Day]]"
  - "[[(Planet) Late Night Problem Sets]]"
concept-connections:
  - "[[(Concept) Decision Making]]"
---

# Bayes Theorem

Not just a formula — a way of updating what you believe when
new evidence arrives. It shows up in the lecture notes as
P(A|B) = P(B|A)P(A)/P(B), but it shows up in life as the
slow revision of assumptions. Every semester, every exam,
every failed hypothesis is a Bayesian update.

First encountered on [[(Planet) First Day of Uni]]. Mastered
(or something like it) by [[(Planet) Graduation Day]].
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `type` | `"concept"` | Always "concept" |
| `planet-connections` | WikiLink[] | Planets this concept touches |
| `concept-connections` | WikiLink[] | Other related concepts |
| Body | markdown | Content — concrete or abstract |

#### (Story)

A long narrative arc — thousands of words. Character development driven by the user's data. Stories are NOT owned by a galaxy. They reference planets and concepts via wikilinks and can span across galaxies.

Structure:
1. **Introduction** (`## Introduction`) — character creation, built from concepts/soul fragments
2. **Scenes** (separated by `---`, each starting with `planet: [[(Planet) Name]]`) — the character visits planets
3. **Conclusion** (`## Conclusion`) — the character transformed, remaining concepts absorbed

```markdown
---
id: <uuid>
type: story
---

# A Wanderer Awakens

## Introduction

A figure steps out of the void, carrying fragments of
[[(Concept) Growth]] and [[(Concept) Curiosity)]]. They
don't know where they're going. They only know the pull
of distant light.

The void is not empty — it hums with half-remembered
theorems and the smell of cut grass. Something about
probability. Something about home. The figure reaches
into the darkness and pulls out a formula: P(A|B). It
glows faintly. It means nothing yet. It will mean
everything.

---
planet: [[(Planet) Childhood Memories]]

The first planet is small and warm. It sits in a pocket
of amber light, turning slowly.

The wanderer touches down on soft earth. The backyard
stretches out — impossibly large, the way it always was.
The old oak tree. The rusted swing set. Afternoons that
lasted forever. A garden hose coiled like a sleeping
snake.

They find something here they didn't expect: a formula
scratched into the bark. P(A|B). A child's handwriting.
[[(Concept) Bayes Theorem]] was here before they knew
its name.

Under the oak tree, a jar of fireflies. Each one a
question: why does it rain? Where does the sun go?
What happens when you die? The child who caught them
didn't know these were hypotheses. Didn't know they
were already doing science. The wanderer picks up the
jar and watches the light pulse — prior, likelihood,
posterior. The fireflies were Bayesian all along.

---
planet: [[(Planet) First Day of Uni]]

The second planet is louder. Bigger. The gravity pulls
harder.

The wanderer stumbles through orientation week carrying
a probability textbook they haven't opened. Everyone
else seems to know where they're going. The lecture
theatre seats 400. Row J, seat 12. The professor writes
the same formula on the whiteboard — P(A|B) — but in
blue marker now, and with subscripts.

The formula from the tree is here too, grown up. It
has confidence intervals and convergence proofs. The
wanderer sits in the back row and feels the distance
between the bark and the whiteboard. Between wondering
and knowing. [[(Concept) Growth]] isn't a feeling
anymore. It's measurable. It has a distribution.

[...thousands of words continue across more scenes...]

---

## Conclusion

The wanderer stands at the edge of the last planet,
looking back at the trail of light they've left behind.
Every planet visited, every formula learned, every
afternoon in every backyard — they are all the same
story told at different scales.

[[(Concept) Bayes Theorem]] sits in their chest now,
not as a formula but as an instinct. Update your
beliefs. Revise your priors. The evidence is always
arriving.

They are not the same figure that stepped out of the
void. [[(Concept) Growth]] taught them that. And
[[(Concept) Curiosity]] — that restless pull toward
the next planet, the next question — that hasn't
changed. It just has better notation now.

The galaxy turns. The story doesn't end. It updates.
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `type` | `"story"` | Always "story" |
| Body structure | see below | Introduction, scenes, conclusion |

**Story body parsing:**

| Section | Identified by | Contains |
|---------|--------------|----------|
| Introduction | `## Introduction` heading | Prose + concept wikilinks |
| Scene | `---` separator followed by `planet: [[(Planet) Name]]` | Long narrative visiting that planet |
| Conclusion | `## Conclusion` heading | Prose + concept wikilinks |

---

### 3. JSON API Types

The server reads the markdown workspace, parses frontmatter and body, resolves wikilinks to UUIDs, and serves JSON to the frontend.

```typescript
type UUID = string;

// Lookup table: maps "(Type) Name" strings to UUIDs
// Sent to the frontend so it can resolve wikilinks in markdown bodies
type WikiLinkIndex = Record<string, UUID>;
// e.g. {
//   "(Planet) Childhood Memories": "a1b2c3d4-...",
//   "(Concept) Growth": "d4e5f6a7-...",
//   "(Story) A Wanderer Awakens": "b8c9d0e1-..."
// }

// ─── Source ───────────────────────────────────────

interface Source {
  id: UUID;
  type: "source";
  title: string;           // from filename: "(Source) X.md" -> "X"
  filename: string;        // original uploaded filename
  mediaRef: string;        // path within Media/Sources/
  markdown: string;        // summary body
}

// ─── Solar System ────────────────────────────────

interface SolarSystem {
  id: UUID;
  type: "solar-system";
  title: string;
  planets: UUID[];         // resolved from wikilinks in frontmatter
  concepts: UUID[];        // resolved from wikilinks in frontmatter
  markdown: string;        // description body
}

// ─── Planet ───────────────────────────────────────

interface Planet {
  id: UUID;
  type: "planet";
  title: string;
  planetConnections: UUID[];  // other planets only, no concepts
  markdown: string;           // full body with wikilinks preserved
}

// ─── Concept ──────────────────────────────────────

interface Concept {
  id: UUID;
  type: "concept";
  title: string;
  planetConnections: UUID[];
  conceptConnections: UUID[];
  markdown: string;           // full body with wikilinks preserved
}

// ─── Story ────────────────────────────────────────

interface StoryScene {
  planetId: UUID;             // the planet this scene visits
  markdown: string;           // long narrative for this scene
}

interface Story {
  id: UUID;
  type: "story";
  title: string;
  introduction: {
    markdown: string;         // character creation, departure
    conceptIds: UUID[];       // concepts referenced in intro
  };
  scenes: StoryScene[];       // split on --- separators
  conclusion: {
    markdown: string;         // transformation, resolution
    conceptIds: UUID[];       // concepts absorbed at the end
  };
}

// ─── Media ────────────────────────────────────────

interface Media {
  id: UUID;
  filename: string;
  url: string;               // served URL for the blob
}

// ─── Full Galaxy Response ─────────────────────────

interface GalaxyData {
  solarSystems: Record<UUID, SolarSystem>;
  planets: Record<UUID, Planet>;
  concepts: Record<UUID, Concept>;
  stories: Story[];           // independent, not keyed by solar system
  sources: Record<UUID, Source>;
  media: Record<UUID, Media>;
  wikiLinkIndex: WikiLinkIndex;  // frontend wikilink resolution
}
```

---

### 4. Server Parsing Logic

The server reads the galaxy workspace and produces a `GalaxyData` JSON response.

#### Step 1: Build the WikiLink Index

Scan all `.md` files in `Mesh/`. For each file:
1. Parse filename: `(Type) Name.md` -> extract type and name
2. Parse frontmatter: extract `id` (UUID)
3. Add entry: `"(Type) Name"` -> UUID

This index is used internally to resolve all wikilink references AND sent to the frontend as `wikiLinkIndex`.

```
Mesh/
  (Planet) Childhood Memories.md   ->  id: a1b2c3d4
  (Planet) First Day of Uni.md     ->  id: e5f6a7b8
  (Concept) Growth.md              ->  id: c9d0e1f2

Index:
  "(Planet) Childhood Memories"  -> "a1b2c3d4"
  "(Planet) First Day of Uni"    -> "e5f6a7b8"
  "(Concept) Growth"             -> "c9d0e1f2"
```

#### Step 2: Parse Each Entity

For each file, based on `type` in frontmatter:

**Source:**
- Extract `filename`, `media-ref` from frontmatter
- Body -> `markdown`

**Solar System:**
- Resolve `planets[]` and `concepts[]` wikilinks to UUIDs via index
- Body -> `markdown`

**Planet:**
- Resolve `planet-connections[]` wikilinks to UUIDs
- Body -> `markdown` (wikilinks left as-is for frontend rendering)

**Concept:**
- Resolve `planet-connections[]` and `concept-connections[]` wikilinks to UUIDs
- Body -> `markdown` (wikilinks left as-is for frontend rendering)

**Story:**
- Split body on `## Introduction`, `---` separators, and `## Conclusion`
- For each `---` block: extract `planet: [[(Planet) Name]]` line, resolve to UUID -> `scene.planetId`. Rest of block -> `scene.markdown`
- For introduction: extract all `[[(Concept) Name]]` wikilinks, resolve to UUIDs -> `introduction.conceptIds`
- For conclusion: same concept extraction -> `conclusion.conceptIds`

#### Step 3: Assemble GalaxyData

```typescript
const data: GalaxyData = {
  solarSystems,              // Record<UUID, SolarSystem>
  planets,                   // Record<UUID, Planet>
  concepts,                  // Record<UUID, Concept>
  stories,                   // Story[]
  sources,                   // Record<UUID, Source>
  media,                     // Record<UUID, Media> from Media/Media/
  wikiLinkIndex,             // the full name->UUID lookup table
};
```

#### Resolution Flow

```
CC writes markdown       Server parses              Frontend receives
------------------    ------------------------    ----------------------
[[(Planet) X]]    ->  filename index lookup    ->  UUID in typed fields
[[(Planet) X]]    ->  kept as-is in markdown   ->  frontend resolves via wikiLinkIndex
![[photo.jpg]]    ->  Media/Media/ path        ->  served URL
YAML frontmatter  ->  typed fields             ->  JSON object
--- separators    ->  scene splitting          ->  StoryScene[]
planet: [[...]]   ->  resolve to UUID          ->  scene.planetId
## Introduction   ->  intro object             ->  story.introduction
## Conclusion     ->  conclusion object        ->  story.conclusion
```

---

### 5. Frontend Usage

#### Loading a Galaxy

```typescript
// Fetch the full galaxy data
const response = await fetch(`/api/galaxy/${galaxyId}`);
const data: GalaxyData = await response.json();
```

The response contains everything the frontend needs:
- All entities with their connections (as UUIDs)
- All markdown bodies (with wikilinks still embedded)
- The `wikiLinkIndex` for resolving wikilinks during rendering

#### Rendering Markdown with Clickable Wikilinks

The frontend renders markdown bodies with a custom renderer that handles wikilinks and image embeds.

```typescript
// Pseudo-code for wikilink resolution during markdown rendering
function renderMarkdown(markdown: string, wikiLinkIndex: WikiLinkIndex): string {
  // Replace [[(Type) Name]] with clickable links
  return markdown.replace(
    /\[\[([^\]]+)\]\]/g,
    (match, name) => {
      const uuid = wikiLinkIndex[name];
      if (!uuid) return match; // unresolved, leave as-is
      const type = name.match(/^\((\w+)\)/)?.[1]?.toLowerCase();
      return `<a data-entity-id="${uuid}" data-entity-type="${type}"
                class="wikilink">${name.replace(/^\(\w+\)\s*/, '')}</a>`;
    }
  );

  // Replace ![[filename]] with images
  // markdown.replace(/!\[\[([^\]]+)\]\]/g, ...)
}
```

Click handler:
```typescript
function onWikiLinkClick(entityId: UUID, entityType: string) {
  switch (entityType) {
    case 'planet':
      // Navigate camera to planet in 3D view, open wrap card
      navigateToPlanet(entityId);
      break;
    case 'concept':
      // Show concept overlay / floating fragment highlight
      showConceptOverlay(entityId);
      break;
    case 'story':
      // Open story reader panel
      openStoryReader(entityId);
      break;
  }
}
```

#### Building the 3D Graph

The galaxy data provides everything needed to build the force-directed graph:

```typescript
// Nodes: planets + concepts
const nodes = [
  ...Object.values(data.planets).map(p => ({
    id: p.id, type: 'planet', title: p.title
  })),
  ...Object.values(data.concepts).map(c => ({
    id: c.id, type: 'concept', title: c.title
  })),
];

// Edges: planet-planet connections + concept-planet connections + concept-concept
const edges = [
  ...Object.values(data.planets).flatMap(p =>
    p.planetConnections.map(targetId => ({
      source: p.id, target: targetId, type: 'planet-planet'
    }))
  ),
  ...Object.values(data.concepts).flatMap(c => [
    ...c.planetConnections.map(targetId => ({
      source: c.id, target: targetId, type: 'concept-planet'
    })),
    ...c.conceptConnections.map(targetId => ({
      source: c.id, target: targetId, type: 'concept-concept'
    })),
  ]),
];
```

Render planets as solid spheres (solar system bodies). Render concepts as floating fragments/particles/shards. Different visual treatment — planets are grounded, concepts are ethereal.

#### Story Navigation

Stories provide a narrative layer on top of the spatial galaxy:

```typescript
// Story reader component
function renderStory(story: Story) {
  // Show introduction with concept highlights
  renderIntro(story.introduction);

  // For each scene, show narrative + link to planet
  for (const scene of story.scenes) {
    const planet = data.planets[scene.planetId];
    renderScene(scene, planet);
    // Clicking "visit planet" zooms camera to planet position
  }

  // Show conclusion with concept highlights
  renderConclusion(story.conclusion);
}
```

The story reader is a sidebar/panel. As the user reads through scenes, the 3D view can track along — highlighting the current planet, drawing the story's path through the galaxy.

#### Image Embeds

```typescript
// Resolve ![[filename]] to served URLs
function resolveImageEmbed(filename: string, galaxyId: string): string {
  return `/api/galaxy/${galaxyId}/media/${encodeURIComponent(filename)}`;
}
```

---

### 6. Pipeline

Three stages. Claude Code runs in a loop per stage until the output is valid.

| Stage | Input | Output | Done when |
|-------|-------|--------|-----------|
| **1 — Ingest** | Raw files in `Media/Sources/` | `(Source) *.md` with summaries | Every uploaded file has a source file |
| **2 — Structure** | `(Source)` files | `(Solar System)`, `(Planet)`, `(Concept)` files | Valid entities with connections, all wikilinks resolve |
| **3 — Stories** | Planets + Concepts | `(Story) *.md` | Long-form narratives with intro/scenes/conclusion, planet links resolve |

**Stage 1 — Ingest:**
- For each file in `Media/Sources/`, create a `(Source) Name.md`
- Extract text, summarise content, identify key themes
- Can use Gemini Flash for speed or Claude for depth

**Stage 2 — Structure:**
- Read all `(Source)` files
- Produce `(Solar System)` root documents with descriptions
- Produce `(Planet)` files — concrete knowledge nodes, self-contained
- Produce `(Concept)` files — flexible nodes, whatever fits
- Wire up connections in frontmatter wikilinks
- Entities can reclassify (concept <-> planet) during generation
- CC loops until all wikilinks resolve and the mesh is consistent

**Stage 3 — Stories:**
- Read all `(Planet)` and `(Concept)` files
- Write `(Story)` files — long-form narrative (thousands of words)
- Each story: `## Introduction` with concept refs, scenes separated by `---` each visiting a planet, `## Conclusion` with concept refs
- CC has creative freedom — character creation, world-building, emotional arcs
- CC loops until all planet/concept references in stories resolve

---

### 7. Key Design Principles

1. **Any input** — PDFs, lectures, journals, code, transcripts, PowerPoints. Claude turns whatever it gets into planets, concepts, and stories.

2. **Flexible classification** — the line between Planet and Concept is intentionally soft. Claude decides what fits best. Things can shift during generation.

3. **Stories are independent** — not owned by a galaxy. They reference planets and concepts via wikilinks and can span across galaxies.

4. **Stories are literature** — thousands of words, creative, character-driven. Not summaries. Actual narrative with character development arcs.

5. **The workspace IS the data** — no JSON blob, no compiled intermediate. The markdown files are the source of truth. The server parses them into JSON for the frontend.

6. **Planets are self-contained** — no concept-connections on planets in v4.0. Scoped tightly enough to stand on their own. Concepts connect TO planets, not the reverse.

7. **Two resolution layers** — markdown uses `[[wikilinks]]` (human-readable, filename-matched). JSON API uses UUIDs (machine-efficient). The server bridges them. The frontend gets both (UUIDs in typed fields + `wikiLinkIndex` for rendering markdown bodies).

## Conclusions

- The v4 schema is a complete rewrite of the data model — from JSON blob to markdown mesh
- Five entity types: Source, Solar System, Planet, Concept, Story
- Server parses the workspace into a `GalaxyData` JSON response with a `wikiLinkIndex` for frontend rendering
- Frontend builds 3D graph from planet/concept connections, renders markdown with clickable wikilinks, and provides a story reader that tracks through the galaxy
- Pipeline is 3 stages: Ingest (source summaries), Structure (solar systems/planets/concepts), Stories (long-form narrative)
- Input is any data. Output is a navigable narrative galaxy.

## References

- [[(Notepad) 001 Narrative Pivot]] — brainstorming session that developed this schema
- [[(Report) 001 Scholar System Architecture]] — previous v3 architecture (superseded)
