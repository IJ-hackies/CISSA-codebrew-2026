# Galaxy Schema (v4 — Markdown Mesh)

The data model for Scholar System. Instead of a JSON blob in SQLite, each galaxy is a **workspace folder of typed markdown files** that Claude Code writes directly. The server parses the workspace and serves a `GalaxyData` JSON response.

Source of truth: the markdown files in the workspace `Mesh/` directory.

## Workspace Structure

```
galaxies/<galaxy-id>/
  Media/
    Sources/              <- raw uploaded files (any format)
    Media/                <- images, generated media
  Mesh/
    (Source) <Name>.md
    (Solar System) <Name>.md
    (Planet) <Name>.md
    (Concept) <Name>.md
    (Story) <Name>.md
```

- Files are named `(Type) Name.md` — no numbers, no zero-padding
- Wikilinks are `[[(Type) Name]]`

## Entity Types

### (Source)

One per uploaded file. Contains a summary of the source document.

```yaml
---
id: <uuid>
type: source
filename: "<original filename>"
media-ref: "Sources/<original filename>"
---
```

Body: 2-5 paragraph summary covering what the document is, key themes, notable details, and tone.

### (Solar System)

Root document for a thematic grouping. Lists its planets and concepts. Does NOT reference stories.

```yaml
---
id: <uuid>
type: solar-system
planets:
  - "[[(Planet) Name]]"
concepts:
  - "[[(Concept) Name]]"
---
```

Body: description of the solar system — mood, themes, scope.

### (Planet)

A concrete knowledge node — something tangible from the sources. Self-contained. No concept-connections.

```yaml
---
id: <uuid>
type: planet
planet-connections:
  - "[[(Planet) Name]]"
---
```

Body: rich, detailed prose. Dense content, not summaries.

### (Concept)

A flexible thematic node — a theme, technique, person, pattern. Not forced to be abstract.

```yaml
---
id: <uuid>
type: concept
planet-connections:
  - "[[(Planet) Name]]"
concept-connections:
  - "[[(Concept) Name]]"
---
```

Body: content for the concept.

### (Story)

Long-form narrative arc. One character, one themed journey across planets from any solar system.

```yaml
---
id: <uuid>
type: story
---
```

Body structure:

```markdown
## Introduction
<prose introducing the character, referencing [[(Concept) Name]] as motivation>

---
planet: [[(Planet) Name]]
<scene narrative — character lands on planet, discovers its content>

---
planet: [[(Planet) Name]]
<scene narrative — journey continues>

(more scenes...)

---

## Conclusion
<prose — what the character found, how they changed, referencing [[(Concept) Name]]>
```

## JSON API Types

```typescript
type UUID = string;
type WikiLinkIndex = Record<string, UUID>;

interface Source {
  id: UUID;
  type: "source";
  title: string;
  filename: string;
  mediaRef: string;
  markdown: string;
}

interface SolarSystem {
  id: UUID;
  type: "solar-system";
  title: string;
  planets: UUID[];
  concepts: UUID[];
  markdown: string;
}

interface Planet {
  id: UUID;
  type: "planet";
  title: string;
  planetConnections: UUID[];
  markdown: string;
}

interface Concept {
  id: UUID;
  type: "concept";
  title: string;
  planetConnections: UUID[];
  conceptConnections: UUID[];
  markdown: string;
}

interface StoryScene {
  planetId: UUID;
  markdown: string;
}

interface Story {
  id: UUID;
  type: "story";
  title: string;
  introduction: {
    markdown: string;
    conceptIds: UUID[];
  };
  scenes: StoryScene[];
  conclusion: {
    markdown: string;
    conceptIds: UUID[];
  };
}

interface Media {
  id: UUID;
  filename: string;
  url: string;
}

interface GalaxyData {
  solarSystems: Record<UUID, SolarSystem>;
  planets: Record<UUID, Planet>;
  concepts: Record<UUID, Concept>;
  stories: Story[];
  sources: Record<UUID, Source>;
  media: Record<UUID, Media>;
  wikiLinkIndex: WikiLinkIndex;
}
```

## Pipeline

```
1. Ingest     → (Source) files                              (Claude Code)
2. Structure  → (Solar System), (Planet), (Concept) files   (Claude Code)
3. Stories    → (Story) files                               (Claude Code)
```

Three stages. Claude Code runs in a loop per stage until the output validates.

## Server Parsing

### Step 1: Build WikiLink Index

Scan all `.md` files in `Mesh/`. For each:
1. Parse filename `(Type) Name.md` -> type + name
2. Parse frontmatter -> extract `id`
3. Index: `"(Type) Name"` -> UUID

### Step 2: Parse Entities

**Source:** extract `filename`, `media-ref` from frontmatter. Body -> `markdown`.

**Solar System:** resolve `planets[]` and `concepts[]` wikilinks to UUIDs. Body -> `markdown`.

**Planet:** resolve `planet-connections[]` to UUIDs. Body -> `markdown` (wikilinks kept for frontend).

**Concept:** resolve `planet-connections[]` and `concept-connections[]` to UUIDs. Body -> `markdown`.

**Story:**
1. Split on `## Introduction`, `---` separators, `## Conclusion`
2. For each `---` block: extract `planet: [[(Planet) Name]]`, resolve to UUID -> `scene.planetId`
3. For intro/conclusion: extract all `[[(Concept) Name]]` wikilinks -> `conceptIds[]`

### Step 3: Assemble GalaxyData

Combine into `GalaxyData` with the `wikiLinkIndex` for frontend rendering.

## Frontend Wikilink Resolution

The frontend renders markdown bodies. When it encounters `[[(Type) Name]]`:

1. Look up in `wikiLinkIndex` -> get UUID
2. Determine type from the `(Type)` prefix
3. Render as clickable `<a>` that navigates:
   - Planet -> zoom camera to planet in 3D view
   - Concept -> show concept overlay
   - Story -> open story reader

Image embeds `![[filename]]` resolve to `Media/Media/filename` served URL.

## Sizing Guidelines

- 3-7 solar systems per galaxy workspace
- 5-10 planets per solar system
- 4-7 concepts per solar system
- Output should reflect the size and richness of the input

## Key Design Decisions

1. **Markdown IS the data** — no JSON blob, no SQLite for content. The workspace of `.md` files is the source of truth.
2. **Planets are self-contained** — no concept-connections on planets. Concepts connect TO planets.
3. **Stories are independent** — not owned by a solar system. Can span across solar systems.
4. **Stories are literature** — thousands of words. Character development arcs. Not summaries.
5. **Concepts are flexible** — not necessarily abstract. Whatever fits the narrative.
6. **Two resolution layers** — markdown uses `[[wikilinks]]` (human-readable). JSON API uses UUIDs. Server bridges them.
7. **Real UUID generation** — every entity needs a real UUID v4. No fake or placeholder UUIDs.
