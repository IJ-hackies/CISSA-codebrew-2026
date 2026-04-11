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
const { data, galaxyId, visitedPlanetIds, collectedConceptIds, loadFromApi, loadFromFixture, clear, markPlanetVisited, collectConcept, isConceptCollected } = useMeshStore()

// Server:
await loadFromApi('some-galaxy-id')

// Static:
loadFromFixture(fixture, 'optional-galaxy-id')

// Access:
data.value.planets, data.value.stories, etc.
```

`data` is a shared `ref<GalaxyData | null>` — all components using `useMeshStore()` see the same data.

**Exploration state** — module-level singletons, persisted to per-galaxy localStorage keys:
- `galaxyId` — `ref<string>` current galaxy ID, scopes all persistence.
- `visitedPlanetIds` — `ref<Set<string>>`. Key: `scholarSystem.visited:<galaxyId>`.
- `collectedConceptIds` — `ref<Set<string>>`. Key: `scholarSystem.souls:<galaxyId>`.
- `systemPresets` — `ref<Record<string, string>>`. Key: `scholarSystem.presets:<galaxyId>`. Maps system id → particle-formation preset name. Read/written via `getOrGenerateSystemPreset(systemId, availablePresets)`: picks one randomly with `Math.random()` on first generation, persists, and returns the same choice on subsequent calls. Both `GalaxyView` and `SolarSystemView` call it so the cluster shape and the central sun shape always agree, and so the random choice survives refresh.
- `markPlanetVisited(id)` / `collectConcept(id)` — write methods. Stale IDs filtered on hydration (presets too).

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
- Solar systems → each system's central "sun" in `SolarSystemView` is the **same particle formation** that represents it in `GalaxyView`, scaled to 60%. Both views call `meshStore.getOrGenerateSystemPreset(sys.id, PRESETS)` which randomizes via `Math.random()` on first generation and persists the choice per galaxy — so the cluster shape and central sun shape always agree, and the random pick survives refreshes. Both views also pull the sun/cluster colour from a shared 8-entry `SYSTEM_COLORS` palette via the same seeded RNG so the colour matches too. Galaxy and solar both use textured particles (a small canvas radial-gradient `map`) so each particle self-glows — no bloom needed in galaxy view, no bubble halos. Solar's sun has ~2.5× the particle count (`800 + planetCount*45`) at a smaller point size for fine structure at close range.

**Lighting gotcha (Three.js 0.183+):** Physical lights are the default, which means `PointLight` uses inverse-square falloff — a `PointLight` at the origin with intensity ~2 produces almost nothing at planet distance (30–50 units). `SolarSystemView` works around this by using a `DirectionalLight` as the sun's key light and setting `emissiveMap: tex` on planet materials so surfaces self-light through their own texture regardless of light positioning. If you ever see planets rendering as dark/grey silhouettes, this is almost certainly the cause.

## Deep-space ambience

Both views share `useThreeScene`, which builds the renderer/scene/camera/controls/post-processing/starfield. It exposes opt-in layers for hero stars and distant nebula billboards, plus a default-on space rift, all viewport-scaled.

**`useThreeScene` opt-in options:**
- `heroStarCount` — bright `Points` layer at radius 250–450 with white/warm/cool palette, additive blending, `fog: false`. Uses a soft circular `map` texture so points are smooth glowing dots, not square pixels.
- `nebulaCount` — distant `Sprite` regions at radius 360–460. Each region stacks 2–3 layered billboards with slight position offsets in a desaturated slate-purple palette (`0x4a3a70`, `0x3a4060`, etc.), `fog: false`, `depthTest: false`, `renderOrder: -1` so they sit firmly behind everything. Hue-coherent within a region — layers pull from neighboring palette slots so each cloudbank stays roughly one hue family.
- `showRift` (default `true`) — the **space rift**: an elongated filamentary "California Nebula"-style streak fixed at azimuth ≈33°, 68° from pole, radius 430. Two overlapping `Sprite`s — a sharp violet spine (white tint, `opacity: 0.22`) plus a wider/dimmer indigo halo (`0x4455cc`, `opacity: 0.10`) — both rotated ~−28°, additive, `fog: false`, `renderOrder: -2`. Co-rotates very slowly with the rest of the sky.
- All three layers, plus the regular `starCount`, are scaled by `viewportScale = clamp(sqrt(width·height / (1440·900)), 0.75, 1.6)`. Phones still feel star-rich (75% floor); 4K gets up to ~160%; no caller-side breakpoints.

**Soft point texture (`makeSoftPointTexture()`):** 64×64 canvas radial gradient (white center → transparent edge). Used as `map` on the regular star and hero star `PointsMaterial`s with `alphaTest: 0.01`. Eliminates the subpixel-flicker that small unfiltered points get when the starfield slowly rotates.

**Nebula texture (`makeNebulaTexture(seed)`):** Pixel-level noise on a 256×256 canvas — a smooth Gaussian radial falloff (`exp(-3.2·d²)`) modulated by ~15% pseudo-FBM (stacked sinusoids). Three master textures generated at init with different seeds, reused across sprites with random `material.rotation` jitter. Per-sprite opacity stays at `0.025–0.05` so individual sprites are essentially invisible — the visual effect comes from many overlapping sprites accumulating additively.

**Rift texture (`makeRiftTexture()`):** 512×128 canvas (4:1 elongated) with multi-filament FBM noise — main spine + tendrils + knot brightening + sin-envelope tip fade. RGB is **baked into each pixel** (violet core → indigo mid → blue-violet outer); alpha is the intensity mask. The first sprite uses white tint so the baked colours come through unchanged; the second uses an indigo tint for the cooler outer halo layer.

**Background tint:** The Three canvas runs with `alpha: true` and `setClearColor(0x000000, 0)` (transparent clear, no `scene.background`). Each view's container has a CSS `radial-gradient(ellipse at 50% 35–40%, #0a0618 0%, #06051a 28%, #04040f 60%, #02030a 100%)` that shows through. Subtle purple-blue tint at the center, near-black at the edges. Fog color shifted to `0x06081a` so distant fogged geometry fades into the gradient instead of a hard black.

**Bloom budgets:**
- **Galaxy view runs with bloom completely off** (`bloomStrength: 0`). The old approach (small bright dots + heavy bloom for glow) caused unavoidable spherical bubble halos around any pure-white pixel. Replaced with **soft textured particles** — `makeParticleTexture()` in `GalaxyView` generates a 64×64 radial gradient used as `map` on every system's `PointsMaterial`, so each particle is a self-glowing soft dot. Bigger sizes (mobile `1.10`, desktop `0.85`) and higher counts (`600 + planetCount*30`) make the systems read clearly without any bloom amplification. Atom preset's electron-head brightness is also capped (`glow * 0.55`) so additive accumulation can't form a hard blob.
- Solar view runs `bloomStrength: 0.18, bloomThreshold: 0.6` — high threshold, so only hero stars + sun particles bloom, planets stay clean.

## Story reader & one-rail-at-a-time

`StoryReader.vue` is a left-rail `<DrawerShell>` that lives in both `GalaxyView` and `SolarSystemView`. Closed state is a small "Stories" trigger pill at top-left (`top:22 left:22 z-index:55`).

**State the StoryReader exposes via `defineExpose`:**
- `openById(id)` / `openByIdAtScene(id, sceneIndex)` — open the drawer at a specific story (and optional scene).
- `restoreState(id, sceneIndex)` — set `activeStory` + `currentSceneIndex` *without* opening the drawer. Used on cross-system arrival so the user lands on the planet first and the story stays as a Resume affordance.
- `collapse()` — set `open = false` while preserving `activeStory` + `currentSceneIndex`. Used when a planet/concept drawer takes focus.
- `getCurrentState()` — snapshot `{ storyId, sceneIndex, isOpen }`. Used to capture state before cross-system transit.
- An `opened` event fires (via a watcher on `open`) whenever the drawer transitions `false → true`. The parent listens and closes the right rail.

**One-rail-at-a-time pattern (`SolarSystemView`):**
- `openPlanetById` and `openConcept` call `storyReaderRef.value?.collapse()` first — the story drawer hides but its state lives on.
- `@opened="onStoryOpened"` clears `rightStack` (planet/concept drawer) and animates the camera back to `(0,0,85)` — story takes focus, the right rail steps out of the way.
- The Stories trigger gets a colored left border (`var(--resume-accent)` set from the active story's color) and a soft glow when `activeStory` is set, hinting that clicking will resume the preserved story. Width stays identical to the default state so the Galaxy back button (at `left:140`) doesn't get pushed around.

## Cross-system planet traversal

When a story scene's "Visit planet" button is clicked (or a planet wikilink in any drawer), the destination might be in a different solar system from the current view. The flow uses route query params to thread state across the route changes.

**Helper:** `findSystemForPlanet(planetId)` — both views have a copy. Linear scan through `meshData.solarSystems` looking for the one whose `planets[]` contains the id.

**SolarSystemView → SolarSystemView (cross-system):**
1. `onStoryVisitPlanet(planetId)` — if `planetMeshes.has(planetId)`, fly + open drawer (with a brief zoom-out if currently parked at a planet). Else: `travelToOtherSystemPlanet`.
2. `travelToOtherSystemPlanet` snapshots the current story state via `storyReaderRef.value?.getCurrentState()`, then plays the back-to-galaxy transition (veil fade + warp 'in') and `router.push({ name: 'galaxy', query: { goSystem, openPlanet, fromStory?, storyScene? } })`.
3. `GalaxyView` mounts, fades the veil out (~500ms), the user briefly sees the galaxy. After 850ms it auto-calls `enterSystem(goSystem, openPlanet, fromStory, storyScene)` which forwards everything to the next solar route.
4. Destination `SolarSystemView` mounts, preloads textures, builds the scene, then `applyDeepLinkQuery` reads the query: `flyToPlanet(openPlanet, true)` opens the planet drawer (which calls `collapse()` on the story), and if `fromStory` is present, `storyReaderRef.value?.restoreState(fromStory, sceneIndex)` is called 200ms later to set internal state without opening — the trigger now shows the Resume affordance.
5. The query is stripped via `router.replace` so refresh stays clean.

**GalaxyView → SolarSystemView (one-hop):** Same flow but starts at step 4 — `enterSystem(sysId, planetId, storyState…)` is called directly from `onStoryVisitPlanet` / `onStoryNavigateToPlanet`, bypassing the auto-enter.

`enterSystem(systemId, openPlanetId?, fromStory?, storyScene?)` is the canonical entry — it animates the camera into the target system mesh (`clickableMeshes.find(m => m.userData.systemId === systemId)`), fades the veil, plays warp 'out', and routes with whatever query params it was passed.

**Browser back button animation (`onBeforeRouteLeave`):** `SolarSystemView` registers a Vue Router leave guard that intercepts *any* navigation away from the route — including the browser's native back button. On the first pass it calls `next(false)` to cancel the navigation, plays the standard veil-fade + warp-in animation, then re-navigates to the galaxy route with `bypassLeaveGuard = true`. On the second pass the guard sees the flag, resets it, and calls `next()` immediately. Programmatic exits (`navigateBack`, `travelToOtherSystemPlanet`) set `bypassLeaveGuard = true` before their own `router.push` so the guard never intercepts them — no double animation.

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

## UI Component Architecture

### Drawer system (right rail / left rail / mobile sheet)

All drawers are built from shared primitives:

- **`DrawerShell.vue`** — container. Props: `open`, `side: 'left'|'right'`, `canGoBack`, `width`. Emits: `close`, `back`. Slots: `#hero`, `#body`, `#footer`. Mobile: renders as a bottom sheet (`88vh`, `border-radius: 20px top`). Uses `Teleport to="body"`. ESC key pops back or closes.
- **`EntityHero.vue`** — gradient hero header inside a drawer. Props: `type: 'planet'|'concept'|'story'`, `title`, `color`, `stats: EntityStatPair`, `hasBack?`. GSAP stagger reveal (tag → title → stats) + count-up animation. When `type='concept'` the tag label reads "Soul".
- **`EntityProse.vue`** — sectioned markdown body. Props: `prose: RenderedProse`. Emits: `wikilink-click`. Renders H2/H3 sections with inline wikilink routing.
- **`PlanetDrawer.vue`** — thin shell for planets. Connected planets footer: horizontal scroll chips.
- **`ConceptDrawer.vue`** — thin shell for souls. "Threads through" chip row (up to 5 connected planets) above prose body. "Stories featuring this idea" card list in footer.
- **`StoryReader.vue`** — left-rail story reader + trigger button. Trigger is now a labeled pill (icon + "Stories" text). List mode shows story cards with seeded accent colour. Active story shows scene-by-scene prose with progress bar + prev/next nav footer.

### Drawer stack pattern

`createDrawerStack()` composable (`src/composables/useDrawerStack.ts`):
- `push(entry)` / `replace(entry)` / `pop()` / `clear()`
- `top: ComputedRef<DrawerEntry | null>`, `depth: ComputedRef<number>`, `canGoBack: ComputedRef<boolean>`
- `SolarSystemView` keeps two stacks: `leftStack` (stories) and `rightStack` (planets/concepts)
- Direct 3D map clicks use `replace` (no history growth); wikilink navigation uses `push`
- On mobile: opening the right rail clears the left, and vice versa

### ConceptHUD

`ConceptHUD.vue` — bottom-right souls inventory panel.
- Desktop: collapsible panel (toggle uses soul ghost icon, body grows upward from toggle button). Max 3 rows visible, then scrolls (`max-height: calc(3 * 63px + 2 * 6px + 20px)`).
- Mobile pill mode: fixed top-right circle + badge count, tap → full-screen overlay grid.
- Reactive: reads `collectedConceptIds` from store, looks up galaxy data. No imperative `collect()` call.
- `getTargetRect()` exposed for the GSAP fly-in target.

### OnboardingTooltip

`OnboardingTooltip.vue` — dismissable first-visit tooltip. Props: `storageKey`, `text`, `position`, `offset`. Checks localStorage on mount. "Got it" button sets the key. Only renders when parent component is active (no `Teleport` — avoids leaking across routes). Gated by `isFirstGalaxy` computed in both `GalaxyView` and `SolarSystemView` (`ss.firstGalaxyId` key set on first galaxy load).

## Planet Connection Lines (3D)

When a planet drawer opens, animated dash lines fan out from that planet to each of its `planetConnections`.

**Implementation:**
- Pre-built during `buildSolarSystem` for every connected pair: two directed `THREE.Line` objects (forward A→B + reverse B→A), each with a custom `ShaderMaterial`.
- Stored in `connectionLines: Map<planetId, THREE.Line[]>` — each planet has its own correctly-directed lines.
- Shader: `vDist` attribute (`[0, segLen]`) + `uTime` uniform. Fragment: `mod(vDist - uTime, uDash + uGap)` → `discard` in gap. Centre glow: brightness ramped by `1 - |t - 0.5| * 1.6`. Colour = destination planet's hex. Density: `uDash: 1.4, uGap: 1.2`.
- `watch(currentRightPlanet)`: GSAP tweens `uniforms.uOpacity.value` to `0.75` on open, `0` on close.
- Render loop advances `uniforms.uTime.value = elapsed * 3.5` for active lines only.
- Sun-to-planet spokes removed (replaced by connection lines).

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
