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
const { data, visitedPlanetIds, collectedConceptIds, persistSet, loadFromApi, loadFromFixture, clear } = useMeshStore()

// Server:
await loadFromApi('some-galaxy-id')

// Static:
loadFromFixture(fixture)

// Access:
data.value.planets, data.value.stories, etc.
```

`data` is a shared `ref<GalaxyData | null>` — all components using `useMeshStore()` see the same data.

**Exploration state** — also module-level singletons, persisted to localStorage:
- `visitedPlanetIds` — `ref<Set<string>>` of planet IDs opened via the drawer. Written by `openPlanetById` in `SolarSystemView`. Read by label projection to show the visited dot. Read by `GalaxyView` to compute per-system progress ring fill.
- `collectedConceptIds` — `ref<Set<string>>` of concept IDs whose souls have been collected. Written by `collectSoul`. Drives sprite visibility (collected → hidden). `ConceptHUD` rehydrates from this on mount.
- `persistSet(key, set)` — write a `Set<string>` to localStorage. Keys: `scholarSystem.visitedPlanets`, `scholarSystem.collectedConcepts`.

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
- Planets → textured spheres. 20 planet types seeded from planet ID — 9 use real Solar System Scope 2K textures (earth, mars, moon, jupiter, saturn, uranus, neptune, venus, mercury), 11 use exotic procedural canvas textures (lava, ice, desert, toxic, crystal, dead_rock, ocean, gas_purple, ice_giant, molten, void). Type drives both radius and surface. Saturn type renders `RingGeometry` with radially-remapped UVs. Textures preload via `THREE.TextureLoader` before `buildScene()` runs; to populate `public/textures/planets/`, run `bash apps/client/scripts/download-planet-textures.sh`.
- Concepts → `THREE.Sprite` objects in the solar system scene. Ghost silhouette drawn on a canvas texture (coloured glow pass at α=0.12 + solid body at α=0.28 + black eyes). `NormalBlending` + `depthWrite: false` so they're see-through. Placed on a Fibonacci sphere in the inner-to-mid planet belt (22–40 units), with a push-apart loop to keep them clear of planet meshes. Bob via `sin(elapsed × 1.8 + seededPhase)` each frame. Opacity fades with camera distance. Highlighted (from story reader) → scale pulses at ×1.3. Collected → `sprite.visible = false`. Raycasted for click/hover, checked before planets in the event handlers.
- Solar systems → each system's central "sun" in `SolarSystemView` is the **same particle formation** that represents it in `GalaxyView` (shared `seededRng(sys.id + '_preset')`), scaled to 60% — so clicking into a system feels like zooming into the node you saw from outside.

**Lighting gotcha (Three.js 0.183+):** Physical lights are the default, which means `PointLight` uses inverse-square falloff — a `PointLight` at the origin with intensity ~2 produces almost nothing at planet distance (30–50 units). `SolarSystemView` works around this by using a `DirectionalLight` as the sun's key light and setting `emissiveMap: tex` on planet materials so surfaces self-light through their own texture regardless of light positioning. If you ever see planets rendering as dark/grey silhouettes, this is almost certainly the cause.

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
