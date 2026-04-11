# Frontend Guide (v4)

The data model has changed. The old v3 types (Cluster, Group, Entry, Wrap) are superseded. The frontend now consumes `GalaxyData` from the mesh parser API.

## Data Loading

Two ways to get `GalaxyData` — pick whichever fits your setup:

### Option 1: Server API

```
GET /api/mesh/:id  →  GalaxyData JSON
```

The server parses a workspace of markdown files and returns everything the frontend needs in a single response. No polling, no partial loads — one fetch, full data.

### Option 2: Static fixture (no server needed)

```ts
import fixture from '@/fixtures/galaxy-data.json'
import { useMeshStore } from '@/lib/meshStore'

const { data, loadFromFixture } = useMeshStore()
loadFromFixture(fixture)
// data.value is now a fully typed GalaxyData
```

The fixture at `src/fixtures/galaxy-data.json` contains real parsed test data (3 solar systems, 40 planets, 21 concepts, 4 stories). Use this to build and test UI without running the server.

### Reactive Store

`src/lib/meshStore.ts` provides a Vue composable wrapping both loading methods:

```ts
const { data, loadFromApi, loadFromFixture, clear } = useMeshStore()

// Server:
await loadFromApi('some-galaxy-id')

// Static:
loadFromFixture(fixture)

// Access:
data.value.planets, data.value.stories, etc.
```

`data` is a shared `ref<GalaxyData | null>` — all components using `useMeshStore()` see the same data.

## Types

Import from `@scholarsystem/shared`:

```ts
import type {
  GalaxyData,
  MeshSolarSystem,
  MeshPlanet,
  MeshConcept,
  MeshStory,
  MeshSource,
  StoryScene,
  WikiLinkIndex,
  UUID,
} from "@scholarsystem/shared";
```

### What you get

```ts
interface GalaxyData {
  solarSystems: Record<UUID, MeshSolarSystem>;  // 3-7 thematic groupings
  planets:      Record<UUID, MeshPlanet>;        // concrete knowledge nodes
  concepts:     Record<UUID, MeshConcept>;       // flexible thematic nodes
  stories:      MeshStory[];                     // character-driven narratives
  sources:      Record<UUID, MeshSource>;        // summaries of uploaded files
  media:        Record<UUID, MeshMedia>;         // images/media
  wikiLinkIndex: WikiLinkIndex;                  // "(Type) Name" → UUID
}
```

### Entity shapes

**Solar System** — a cluster of planets. Has `planets: UUID[]` and `concepts: UUID[]` listing what it contains. `markdown` is a description of the solar system.

**Planet** — a concrete piece of knowledge. Has `planetConnections: UUID[]` linking to related planets. `markdown` is dense prose content (the planet's "surface"). No concept connections — planets are self-contained.

**Concept** — a flexible thematic node (theme, technique, pattern, person). Has `planetConnections: UUID[]` and `conceptConnections: UUID[]`. `markdown` is content about the concept.

**Story** — a long narrative arc (thousands of words). Structure:
- `introduction` — prose + `conceptIds[]` (the concepts that motivate the character)
- `scenes[]` — each has a `planetId` and `markdown` (character visits a planet)
- `conclusion` — prose + `conceptIds[]` (what the character discovered)

## Building the 3D Graph

```ts
// Nodes = planets + concepts
const nodes = [
  ...Object.values(data.planets).map(p => ({ id: p.id, type: 'planet' as const, title: p.title })),
  ...Object.values(data.concepts).map(c => ({ id: c.id, type: 'concept' as const, title: c.title })),
];

// Edges = planet↔planet + concept→planet + concept↔concept
const edges = [
  ...Object.values(data.planets).flatMap(p =>
    p.planetConnections.map(tid => ({ source: p.id, target: tid, kind: 'planet-planet' }))
  ),
  ...Object.values(data.concepts).flatMap(c => [
    ...c.planetConnections.map(tid => ({ source: c.id, target: tid, kind: 'concept-planet' })),
    ...c.conceptConnections.map(tid => ({ source: c.id, target: tid, kind: 'concept-concept' })),
  ]),
];
```

**Visual treatment:**
- Planets → solid spheres (orbiting bodies in a solar system)
- Concepts → floating fragments / ethereal particles (soul fragments)
- Solar systems → grouping containers (each has its own set of planets)

## Rendering Wikilinks in Markdown

Every `markdown` field may contain `[[(Type) Name]]` wikilinks. Use `wikiLinkIndex` to resolve them:

```ts
function renderMarkdown(md: string, wikiLinkIndex: WikiLinkIndex) {
  return md.replace(/\[\[([^\]]+)\]\]/g, (match, name) => {
    // Strip any path prefix (some wikilinks have full paths)
    const key = name.includes('/') ? name.split('/').pop() : name;
    const uuid = wikiLinkIndex[key];
    if (!uuid) return match;
    const type = key.match(/^\((\w[\w ]*)\)/)?.[1]?.toLowerCase();
    const label = key.replace(/^\([^)]+\)\s*/, '');
    return `<a data-id="${uuid}" data-type="${type}" class="wikilink">${label}</a>`;
  });
}
```

Click handler for wikilinks:
- **Planet** → zoom camera to that planet in 3D view
- **Concept** → show concept overlay / highlight the soul fragment
- **Story** → open story reader sidebar

Image embeds `![[filename]]` → resolve to `/api/galaxy/:id/media/filename`.

## Story Reader

Stories are the narrative layer. The reader is a sidebar/panel:

1. Show introduction — character creation, departure motivation
2. For each scene — show narrative, highlight which planet the character is visiting. Optionally move the camera to that planet as the user reads.
3. Show conclusion — transformation, what the character discovered

Each story has 8-11 scenes, each scene is ~2000 chars. Total story length is 20,000-30,000 chars.

## What Changed from v3

| v3 | v4 |
|---|---|
| `Galaxy` blob from SQLite | `GalaxyData` from mesh parser API |
| `Cluster` / `Group` / `Entry` | `SolarSystem` / `Planet` / `Concept` |
| `Wrap` cards (headline, stats, mood) | Raw `markdown` prose |
| `EntryKind` → mesh shape | Entity type (planet/concept) → visual |
| `relationships.edges[]` | `planetConnections` / `conceptConnections` on entities |
| No stories | `Story[]` — full narrative arcs |
| `GET /api/galaxy/:id` | `GET /api/mesh/:id` |

The chat landing page, Three.js renderer, camera system, and warp effects all carry over. The data layer needs rewiring.
