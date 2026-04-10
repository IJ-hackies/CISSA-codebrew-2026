# Scholar System — Stellar Stories Pivot

## The Theme

**Stellar Stories** — data and cultural preservation using technology. Design new UIs to help preserve data and culture for current and future generations. Study existing digital experiences (archives, storytelling sites, museum apps, note-taking tools) and build something better. Skip ideation, go straight to refinement.

## The Pitch

Scholar System is an AI-powered cultural preservation platform that transforms any body of information — historical texts, personal photo archives, text messages, event timelines, oral histories, a full year of someone's life — into a navigable 3D galaxy. The AI pipeline processes everything, finds connections, and builds a cosmos out of your data. Then you fly through it.

**Auto-generated Wikipedia on absolute design crack.**

We studied how archives, museums, and knowledge platforms present content today. They're static. Text walls. Thumbnail grids. Keyword search. The content is preserved but not *alive*. Scholar System makes preserved knowledge a 3D universe you can orbit, zoom into, and explore — every topic a star, every subtopic a planet, every detail a place you can land on and experience through motion graphics, rich media, and interactive storytelling.

**Core thesis:** Spatial exploration + narrative storytelling preserves data better than filing cabinets. Associating a piece of knowledge with *a place you visited* and *a story you experienced* makes it stick across generations.

---

## The New Direction

### What It Does

1. **User uploads anything.** Cultural texts, photo dumps, text message exports, event logs, historical documents, a full year of experiences — whatever they want preserved and made explorable.
2. **Pipeline processes everything.** AI chunks, structures, finds connections, builds a knowledge graph with full source traceability. Nothing is silently dropped (derivatives + coverage audit prove it).
3. **A galaxy is born.** The output is a 3D force-directed graph — like Obsidian's built-in graph view, but themed as a cosmos. Topics are star-sized nodes, subtopics orbit them, connections are visible as edges. The whole thing is freely rotatable, zoomable, navigable.
4. **Drill down.** Click a topic node → camera zooms in to a planet view with subtopics orbiting. Click a subtopic → enter a rich detail view with motion graphics, images/videos, interactive content, narrative storytelling.
5. **Everything connects.** Cross-topic relationships are visible as glowing edges in the 3D graph. Zoom out and you see the whole galaxy of connections. Zoom in and you're on a planet experiencing one piece of preserved knowledge in full richness.

---

## Change Impact Assessment

### Frontend — FULL REWRITE

The entire frontend rendering layer is being replaced. The Vue 3 app shell, routing, and state management survive, but every visual component is new.

#### What Gets Deleted

| Component / System | Location | Why |
|---|---|---|
| 2D Canvas galaxy renderer | `client/src/lib/renderer.ts` | Replaced by Three.js 3D scene |
| SVG skill tree | `client/src/views/SkillTree.vue`, `ConstellationSection.vue`, `SkillTreeHUD.vue` | Replaced by 3D force-directed graph |
| SVG planet view | `client/src/views/PlanetView.vue` | Replaced by 3D planet drill-down |
| Flat concept scene | `client/src/views/ConceptScene.vue` | Replaced by rich 3D detail view |
| 7-layer SVG planet rendering | Used across SkillTree + PlanetView | Replaced by Three.js planet meshes |
| Moon orbit CSS spinner trick | PlanetView `.moon-rotator` system | Replaced by Three.js orbital animation |
| Seeded LCG constellation layout | `ConstellationSection.vue` | Replaced by force-directed positioning |
| `useParallax` composable | `client/src/composables/` | 2D parallax concept doesn't apply to 3D |
| `visualEngine.ts`, `layoutEngine.ts`, `sceneAssets.ts` | `client/src/lib/` | Superseded by Three.js scene management |
| ogl WebGL post-pass | Fragment shader composite (grain/bloom) | Replaced by Three.js EffectComposer |

**Estimated effort: LARGE.** This is the biggest single workstream. The entire visual layer is new code.

#### What Survives

| Component / System | Location | Notes |
|---|---|---|
| Vue 3 app shell | `client/src/App.vue`, `main.ts` | Stays — Three.js mounts inside Vue |
| Vue Router | `client/src/router/` | Routes change but router stays |
| `galaxyStore.ts` | `client/src/stores/` | Shared `ref<Galaxy>` singleton — data layer unchanged |
| `useIsMobile` composable | `client/src/composables/` | Still needed for responsive |
| Chat landing page | `client/src/views/ChatLanding.vue` | Copy changes, visual structure stays |
| History system | `HistoryButton.vue`, `HistoryOverlay.vue` | Keeps working |
| Stats page | `client/src/views/StatsView.vue` | Reframe "mastery" → "exploration depth", but structure stays |
| Tailwind v4 setup | `client/src/` | CSS framework still used for UI chrome |
| GSAP | Already installed | Repurposed for 3D camera transitions + detail view motion graphics |

#### What Gets Built (New)

| Component | Description | Effort |
|---|---|---|
| Three.js scene manager | Initializes renderer, camera, controls, post-processing. Mounts inside a Vue component. | Medium |
| 3D force-directed graph | `three-forcegraph` or `d3-force-3d` + Three.js. Nodes = topics/subtopics/concepts, edges = relationships. Cosmic theme (glowing nodes, pulsing edges, starfield particles). | **Large** — hero feature, must look great |
| Node rendering | Custom Three.js meshes per node type: topic = large glowing star, subtopic = planet sphere, concept = small moon. Shaders for glow, atmosphere, surface detail. | Medium–Large |
| Edge rendering | Glowing lines/curves between related nodes. Thickness/brightness by relationship strength. | Small–Medium |
| Camera system | OrbitControls for free rotation. Animated fly-in/fly-out for drill-down (GSAP-driven). Smooth focus transitions on click. | Medium |
| Planet drill-down view | Topic in center, subtopics orbiting in 3D. Triggered by clicking a topic node in the graph. Animated camera transition. | Medium |
| Detail view | Rich content experience for a concept. Motion graphics, images/video, animated typography, source provenance panel. This is where the "design crack" lives. | **Large** — design-heavy |
| Background / atmosphere | Particle starfield, nebula volumetric fog, ambient cosmic lighting. Post-processing: bloom, god rays, chromatic aberration via Three.js EffectComposer. | Medium |
| View transition system | Manages state between Galaxy → Planet → Detail views. Handles camera animation, scene object show/hide, DOM overlay show/hide. | Medium |

**New dependencies:** `three`, `@types/three`, `three-forcegraph` (or `d3-force-3d`), `postprocessing` (or Three.js built-in EffectComposer).

### Backend Pipeline — MODERATE CHANGES

The pipeline is mostly content-agnostic. The core stage logic (1–3, 2.5) doesn't change. Layout and visuals need adaptation, and Stage 0 needs new extractors.

#### Stage 0 — Ingest & Chunk

| Change | Effort | Details |
|---|---|---|
| New image extractor | Medium | Vision model (or OCR) to describe image content → text source unit. Store `mediaUrl` + `mediaType` on the unit. |
| New chat export extractor | Small–Medium | Parse WhatsApp/iMessage export formats, chunk by conversation/date range. |
| New event/calendar extractor | Small | Parse ICS/CSV/JSON event data, chunk by event. |
| Video extractor | Large (stretch) | Keyframe extraction + Whisper transcript. Probably P2. |

**Key insight:** once a new input type produces source units with text content, stages 1–5 process it identically. New extractors are additive — existing extractors untouched.

Files affected: `server/src/pipeline/chunker.ts`, new files under `server/src/pipeline/parsing/extract/`.

#### Stage 1 — Skeleton: NO CHANGES

Reads source units, produces knowledge hierarchy + dispatch plan. Completely content-agnostic. The prompt in `prompts/structure.ts` doesn't need to know whether the source was a PDF or a photo.

#### Stage 2 — Detail: NO CHANGES

Parallel per-concept sub-sessions producing derivative-backed detail files. Content-agnostic. `pipeline/detail.ts` + `prompts/detail.ts` unchanged.

#### Stage 2.5 — Coverage Audit: NO CHANGES

Pure-code unit-level + word-level coverage check. Doesn't care about source type. `pipeline/coverage.ts` unchanged.

#### Stage 3 — Narrative: SMALL CHANGES

| Change | Effort | Details |
|---|---|---|
| Prompt language reframe | Small | `prompts/narrative.ts` — shift language from "learning/studying" to "preserving/discovering/experiencing". Characters are cultural guardians, not tutors. |

Core logic in `pipeline/narrative.ts` unchanged. Canon + arcs architecture stays.

#### Stage 4 — Layout: MODERATE CHANGES

| Change | Effort | Details |
|---|---|---|
| 3D coordinates | Medium | Current layout produces 2D `{ x, y }` positions (concentric rings). Needs to produce `{ x, y, z }` for the 3D force-directed graph. Could either: (a) run d3-force-3d server-side to pre-compute positions, or (b) send the graph topology to the frontend and let three-forcegraph compute positions client-side. Option (b) is simpler — the layout stage just outputs the node/edge graph, the frontend handles positioning. |
| Position lock for 3D | Small | Existing position-lock logic (pinned bodies across extensions) needs to work in 3D. Conceptually identical, just one more axis. |

Files affected: `server/src/pipeline/layout.ts`. Schema change: `spatial.bodies[].position` gains `z: number`.

#### Stage 5 — Visuals: MODERATE CHANGES

| Change | Effort | Details |
|---|---|---|
| 3D material params | Medium | Current visual params target SVG rendering (palette, terrain enum, mood string). Need to add/replace with Three.js-oriented params: material type (emissive, metallic, glass), emissive color, emissive intensity, shader hints, particle effects. |
| Prompt update | Medium | `prompts/worldgen/visuals.ts` — output schema shifts from SVG-oriented to Three.js-oriented. |

Files affected: `pipeline/visuals.ts`, `prompts/worldgen/visuals.ts`. Schema changes in `shared/types/visuals.ts`.

#### Stage 6 — Scene Generation: RETHINK NEEDED

| Change | Effort | Details |
|---|---|---|
| Scene output format | Large | Current scene output is dialogue + challenge (MCQ, drag-sort, etc.) designed for 2D GSAP-templated scenes. The new detail view is a rich content experience with motion graphics, media, and interactive elements. The `Scene` schema and prompts need rethinking. |
| Archetype system | Medium–Large | Current 5 archetypes with hand-authored GSAP timelines. May simplify to fewer archetypes or pivot to a more content-card-like format with embedded media + narrative. |
| Challenge types | TBD | 7 challenge types may be overkill for the new direction. Could simplify or keep — depends on how the detail view shakes out. |

Files affected: `shared/types/scenes.ts`, `prompts/` (scene prompts not yet written), future `pipeline/scene.ts`. This stage wasn't implemented yet, so it's greenfield either way.

### Proxy — NO CHANGES

Workspace proxy, Claude Code worker pools, session locking, TTL cleanup — all infrastructure-level. Completely content-agnostic. Zero changes.

Files: `proxy/src/**/*` — untouched.

### Schema (shared/) — SMALL-MODERATE CHANGES

| Change | Effort | Details |
|---|---|---|
| `spatial.bodies[].position` | Small | Add `z: number` to the position type. |
| Source unit media fields | Small | Add optional `mediaUrl: string` and `mediaType: 'image' | 'video' | 'audio'` to source unit schema. |
| Visual params for 3D | Medium | Add Three.js-oriented fields (materialType, emissiveColor, shaderHints) to visual param schemas. May restructure the discriminated union. |
| Scene schema rethink | Medium | `scenes.ts` needs to match whatever the new detail view format is. But Scene wasn't being produced yet, so no migration needed. |

Files affected: `shared/types/spatial.ts`, `shared/types/source.ts`, `shared/types/visuals.ts`, `shared/types/scenes.ts`.

### Prompts — SMALL-MODERATE CHANGES

| File | Change | Effort |
|---|---|---|
| `prompts/structure.ts` | No change | Content-agnostic |
| `prompts/detail.ts` | No change | Content-agnostic |
| `prompts/narrative.ts` | Language reframe | Small |
| `prompts/worldgen/visuals.ts` | 3D visual param output | Medium |
| Scene prompts (not yet written) | Design from scratch for new detail view | Medium–Large (greenfield) |

### Compile Step — SMALL CHANGES

| Change | Effort | Details |
|---|---|---|
| Spatial compiler | Small | Handle `z` coordinate in position. |
| Visual compiler | Small–Medium | Parse new 3D visual param fields from frontmatter. |

Files affected: `server/src/pipeline/compile/`.

---

## Summary: Change Size by Area

| Area | Change Size | Notes |
|---|---|---|
| **Frontend rendering** | **FULL REWRITE** | Every visual component replaced. Vue shell + state + routing survive. |
| **Frontend landing/history/stats** | Small | Copy changes, structure stays. |
| **Stage 0 (ingest)** | Medium | New extractors for images/messages/events. Existing extractors untouched. |
| **Stage 1 (skeleton)** | None | Content-agnostic. |
| **Stage 2 (detail)** | None | Content-agnostic. |
| **Stage 2.5 (coverage)** | None | Content-agnostic. |
| **Stage 3 (narrative)** | Small | Prompt language reframe only. |
| **Stage 4 (layout)** | Medium | 3D coordinates, possibly delegate positioning to frontend. |
| **Stage 5 (visuals)** | Medium | 3D material params instead of SVG params. |
| **Stage 6 (scenes)** | Greenfield | Wasn't built yet. Design for new detail view from scratch. |
| **Proxy** | None | Infrastructure-level, content-agnostic. |
| **Schema (shared/)** | Small–Medium | Additive fields (z coord, media, 3D visual params). |
| **Prompts** | Small–Medium | Narrative reframe + visuals output change. |
| **Compile step** | Small | Handle new fields. |

**Overall: the frontend is the big bet. The backend is mostly intact.**

---

## Frontend Architecture (New)

### Tech Stack

- **Three.js** — 3D rendering, camera, lighting, post-processing
- **three-forcegraph** or **d3-force-3d + Three.js** — force-directed 3D graph layout
- **Vue 3** — still the app shell, routing, state management
- **GSAP** — transitions between views (galaxy → planet → detail), motion graphics in detail views
- **Shaders** — custom GLSL for node glow, edge pulse, nebula fog, atmospheric effects

### View Hierarchy

```
Galaxy View (3D force-directed graph, all nodes visible)
  │
  ├─ click topic node → fly-in transition
  │
  Planet View (single topic, subtopics orbiting in 3D)
  │  │
  │  ├─ click subtopic → transition
  │  │
  │  Detail View (rich content experience for a concept)
  │     - motion graphics, images, video, narrative
  │     - source provenance panel
  │     - related concepts sidebar
  │     - interactive elements
  │
  ├─ scroll out → fly-out back to galaxy
```

### Camera System

- Galaxy view: OrbitControls, free rotation, scroll zoom, click-to-focus on nodes
- Planet view: constrained orbit around the central topic body
- Detail view: locked camera, content fills the viewport
- All transitions: smooth GSAP-animated camera flights between views

### Routes (Updated)

```
/                           → Chat landing (upload flow)
/galaxy/:id                 → 3D galaxy graph (force-directed)
/galaxy/:id/topic/:topicId  → Planet drill-down (topic + orbiting subtopics)
/galaxy/:id/concept/:conceptId → Detail view (rich content experience)
/galaxy/:id/stats           → Exploration stats
```

---

## Broader Ingest (Pipeline Extension)

The pipeline currently handles text/PDF/DOCX/PPTX. The new direction needs:

| Input type | What changes | Effort |
|-----------|-------------|--------|
| Text, PDF, DOCX, PPTX | Already supported — no change | None |
| Images/photos | New Stage 0 extractor — vision model describes content, extracts text (OCR), identifies subjects/dates/places. Each image becomes a source unit with the description as text + image URL as metadata | Medium |
| Text messages / chat exports | New Stage 0 extractor — parse common export formats (WhatsApp, iMessage, etc.), chunk by conversation/date, extract participants + timestamps | Small–Medium |
| Event data / calendars | New Stage 0 extractor — parse ICS/CSV/JSON event formats, chunk by event, extract dates + descriptions + participants | Small |
| Video | Future stretch — extract keyframes + transcript (whisper), each segment becomes a source unit | Large |

**Key insight:** once any input type is chunked into source units with text content, the rest of the pipeline (stages 1–5) works unchanged. The new extractors are additive, not disruptive.

---

## Priority Order (Hackathon Timeline)

### P0 — Must Ship (the demo)

1. **3D galaxy graph** — Three.js + force-directed layout rendering the knowledge hierarchy as a navigable 3D cosmos. This is the hero feature. If this looks good, the demo sells itself.
2. **Drill-down transitions** — click a star → fly into planet view → click a planet → enter detail view. Smooth, cinematic camera movements.
3. **Detail view with rich content** — show the AI-generated content beautifully. Motion graphics and animated typography are bonus; clean, well-designed content cards are the minimum.
4. **Upload flow** — landing page → upload → processing → galaxy appears. End-to-end demo path.
5. **Cultural demo content** — pre-process a compelling cultural dataset so the demo is instant.

### P1 — Should Ship (polish)

6. **Source provenance panel** — "this content was built from these exact passages." The preservation proof.
7. **Edge visualization** — glowing connections between related nodes in the 3D graph.
8. **Post-processing** — bloom, god rays, chromatic aberration on the 3D scene. Cosmic atmosphere.
9. **Landing page with new copy** — preservation-focused tagline, chips, and framing.

### P2 — Nice to Have (stretch)

10. **Image/photo ingest** — extend Stage 0 to handle image uploads via vision model.
11. **Motion graphics in detail views** — animated scenes per concept, not just static content cards.
12. **Chat/message ingest** — WhatsApp/iMessage export parsing.
13. **Video in detail views** — embedded video clips tied to source units.

---

## Competitive Angle

| Existing tool | What it does | What we do better |
|---------------|-------------|-------------------|
| Museum websites | Static galleries, text panels | 3D navigable cosmos, interactive detail experiences |
| Digital archives | Store and search | Preserve with provenance + make explorable as a 3D universe |
| Obsidian graph view | 2D/3D node graph of your notes | AI-generated graph from raw content, themed as a galaxy, with rich drill-down |
| Wikipedia | Text + hyperlinks | Spatial relationships, 3D navigation, motion graphics, narrative |
| Google Arts & Culture | Curated cultural exhibits | AI-generated from any upload, not curated — democratized preservation |
| StoryMapJS | Linear narratives on maps | Non-linear 3D exploration with branching content experiences |

**Our edge:** upload anything → AI preserves it with mechanical traceability → explore it as a 3D galaxy with rich interactive content. No existing tool connects AI-powered preservation with 3D spatial exploration.

---

## The One-Liner

**"Upload your data. We turn it into a galaxy you can fly through."**
