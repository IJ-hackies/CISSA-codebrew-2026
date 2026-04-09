# Scholar System

## What Is This?

Scholar System is an AI-powered learning platform that transforms any study material — lecture notes, textbooks, course outlines, or raw text — into an explorable, galaxy-themed interactive story experience. Instead of flashcards, quizzes, or linear summaries, learners navigate a procedurally generated galaxy where every solar system is a topic, every planet is a concept, and every landing is an interactive scene that teaches through narrative, dialogue, and challenges.

The core thesis: spatial exploration and storytelling are fundamentally better vehicles for retention than traditional study tools. When you associate a concept with a place you've visited and a story you've lived through, it sticks. Scholar System exploits this by mapping knowledge hierarchies onto a galaxy structure and wrapping each piece of content in a unique, dynamically generated narrative scene.

---

## How It Works

### The User Experience

1. **Upload.** The user pastes text, uploads PDFs, or describes what they want to learn. No account required — just drop your notes and go.
2. **Watch your galaxy form.** The system parses the content in real time. As topics are identified, stars begin appearing on screen. Solar systems take shape. The user sees their knowledge materializing as a galaxy before their eyes.
3. **Explore.** The user is presented with their galaxy — a 2D star map with parallax depth. Each solar system is a major topic. Planets within each system are subtopics and concepts. The user clicks to travel between systems, orbit planets, and land on surfaces.
4. **Learn through story.** Landing on a planet triggers an interactive scene. A narrative plays out — maybe the user encounters an alien guardian who explains the concept through dialogue, or discovers ancient ruins where the inscriptions teach a formula, or navigates a storm that requires applying a principle to survive. Each scene ends with a challenge that tests understanding.
5. **Track progress.** Visited planets change appearance. Completed challenges light up connections between related concepts. The galaxy map becomes a visual progress tracker that shows what's been mastered and what remains.
6. **Share.** Every galaxy gets a unique URL. Bookmark it to come back later, or share it with classmates so they can explore the same material.

### The Content Pipeline

This is the engine that makes everything work. It runs in six stages plus an on-demand scene generator. Every stage reads from and writes to the same `Galaxy` blob — a single JSON object stored in SQLite, keyed by UUID. The full data contract for the blob lives in [`.context/SCHEMA.md`](./SCHEMA.md) as the canonical reference; the Zod source of truth is in `scholarsystem/shared/types/`.

**Current implementation state (2026-04-09):** Stages 0 (ingest, pure code), 1 (structure, single Claude call), and 4 (layout, deterministic pure code) are wired end-to-end in `server/src/pipeline/runner.ts` and exposed via `POST /api/galaxy/create`. A CLI harness in `server/src/scripts/test-pipeline.ts` runs the same slice against a file / stdin / inline text and persists the result. Stages 2 (detail), 3 (narrative), 5 (visuals), and 6 (scene) are not yet implemented — their scopes stay at their empty defaults and their `pipeline[stage].status` remains `"pending"`. Blobs from the current slice are still fully schema-valid and renderable from just `knowledge` + `relationships` + `spatial`, which is the minimum the frontend needs to draw a playable map.

#### Stage 0: Ingest

Raw input (text, PDF, pasted notes) hits the server. For PDFs, text is extracted via `pdf-parse`. Input provenance (kind, size, hash, 500-char excerpt) is written to the `source` scope; the raw upload is then discarded. The galaxy UUID is minted here and the blob is created with empty downstream scopes and a `pipeline` scope where every later stage is marked `pending`.

#### Stage 1: Structure

The content is sent to Claude with a prompt that performs **structural analysis only** — producing a hierarchical outline (topic → subtopic → concept) plus a flat graph of cross-concept relationships. No deep content is extracted yet; each concept gets only a one-sentence hook and a `modelTier` hint (`light` / `standard` / `heavy`) describing its inherent reasoning complexity, which downstream scene generation uses for per-concept model routing.

This stage is fast because the output is small regardless of input size, and it's the minimum viable galaxy — the frontend can render the map as soon as this completes, with later stages filling in afterward.

#### Stage 2: Detail (Parallel)

For each concept in the tree, Claude extracts the granular content — full definitions, formulas, worked examples, edge cases, mnemonics, emphasis markers, verbatim source quotes. For very large inputs this is fanned out across parallel chunks split along topic boundaries from Stage 1's outline, with each chunk receiving the full outline as context so cross-references are preserved.

**Why this matters:** Most AI learning tools over-summarize. Scholar System treats content fidelity as a first-class priority — the detail prompts explicitly instruct Claude to preserve all granular details (specific numbers, exact definitions, named exceptions, worked examples) and flag when content is ambiguous or incomplete.

#### Stage 3: Narrative

A single Claude call produces the galaxy-wide story spine: setting, protagonist framing, tone and genre, aesthetic direction (palette/atmosphere/motif keywords), a per-topic arc beat, a small recurring cast with distinct voices, and a finale hook. **This stage blocks on Stage 2** so beats can be grounded in specific extracted content rather than guessing at it.

Per-planet scenes are later generated *against* this narrative spine, turning what would otherwise be 20 disconnected alien encounters into a coherent journey through one arc. The narrative is also consumed by Stage 5 (visuals) so body theming matches tone — an "eldritch cosmic horror investigation" narrative produces ominous palettes; a "heroic exploration" narrative produces luminous ones.

#### Stage 4: Layout

A deterministic force-directed algorithm — pure code, zero Claude calls — assigns 2D positions to every body. Knowledge-bearing bodies (galaxies, systems, planets, moons, asteroids) are placed from the knowledge tree: topics cluster into systems, subtopics orbit as planets, concepts orbit their subtopic as moons, loose concepts become free-floating asteroids. For uploads with broad material, the clustering may produce multiple galaxies in a shared spatial cluster.

Decorative bodies (nebulae, comets, black holes, dust clouds, asteroid belts) are then sprinkled into empty regions for visual density. Because layout is pure code, it can run the moment Stage 1 finishes, in parallel with Detail + Narrative, recovering most of the latency cost of blocking narrative on detail.

*Current implementation:* v1 is a **deterministic concentric** layout, not force-directed — topics on a ring around the origin, subtopics orbiting their system's star, concepts orbiting their planet, loose concepts on an outer ring as asteroids, plus a handful of default decoratives. Chosen over force-directed for v1 because every position is a pure function of tree indices, so runs are stable and diffs are trivially debuggable. The force-directed upgrade is a drop-in replacement for the placement function — the surrounding orchestration, bounds, `progress.totalBodies` counting, and decorative pass don't change.

#### Stage 5: Visuals

Claude assigns visual parameters to each knowledge-bearing body — palette, terrain, atmosphere, lighting, mood — informed by the narrative's aesthetic direction and tone so the visual language is coherent across the galaxy. **Decorative bodies are themed entirely by code** from the same narrative aesthetic (no Claude calls), pulling from a hand-authored SVG building-block library.

The complete galaxy state at this point — structure, detail, relationships, narrative, positions, visual parameters, progress — is the full shareable blob. The UUID URL `app.com/galaxy/{uuid}` loads it back in its entirety.

#### Stage 6: Scene Generation (On-Demand, Per-Concept)

Scenes are not pre-generated — when the user lands on a moon (or asteroid, or small-planet-with-no-moons), a Claude call generates the interactive scene and caches it in the `scenes` scope. **Scenes are per-concept, not per-subtopic**, so each moon is its own tight learning unit and the model tier can be routed per scene: `light` concepts use a cheap model, `heavy` concepts use a strong one.

The scene generation prompt includes:
- The concept's full detail from Stage 2
- The narrative's arc beat for the parent topic (so the scene is a chapter in the arc)
- The recurring cast (so familiar characters can appear)
- Context from neighboring/related concepts (what has the user already seen?)
- The user's progress (what have they completed, what did they struggle with?)
- Visual parameters for the body (so narrative matches the environment)
- A strict output schema: opening narrative, dialogue, challenge with options and explanations, closing narrative

The response is streamed to the frontend so narrative begins appearing immediately while the full scene loads.

**Scene variety** comes from a rotation of archetypes — `guardian-dialogue`, `exploration-discovery`, `environmental-puzzle`, `memory-echo`, `cooperative-challenge`. Each archetype has a hand-authored GSAP timeline in the frontend that slots in the Claude-generated content; **Claude does not generate animation sequences**, it generates content for templates.

#### Progress Tracking (Continuous)

User progress lives in the `progress` scope of the galaxy blob (no database, no account needed). Each knowledge-bearing body tracks visited status, challenge attempts with full history, best/last scores, hints used, time spent, and a mastery estimate. This data feeds back into scene generation — if a user struggled with a prerequisite concept, the next scene will reference and reinforce it.

Progress is persisted via the galaxy UUID. As long as the user has their URL, they can resume where they left off.

---

## The Visual System

### Philosophy: Procedural Composition, Not Image Generation

Scholar System does not use AI image generation (Stable Diffusion, DALL-E, etc.) for scenes. Image generation is too slow (seconds per image), too expensive at scale, visually inconsistent between calls, and impossible to make interactive.

Instead, the system uses a **procedural scene compositor** — a library of SVG building blocks (terrain shapes, atmospheric effects, flora/fauna silhouettes, geological formations, celestial objects) that are composed, recolored, layered, and animated based on parameters generated by Claude during galaxy creation.

### Planet Visual Parameters

When Claude generates the galaxy structure, each planet receives a parameter set:

```json
{
  "palette": {
    "primary": "#1a0533",
    "secondary": "#6b2fa0",
    "accent": "#ff6b35",
    "atmosphere": "rgba(107, 47, 160, 0.3)"
  },
  "terrain": "crystalline",
  "atmosphere": "dense_haze",
  "lighting": "bioluminescent",
  "features": ["crystal_spires", "floating_islands", "underground_rivers"],
  "mood": "mysterious",
  "moons": 2,
  "ring": false
}
```

These parameters drive every visual decision — the background layers, the terrain shapes selected, the color grading, the particle effects, the ambient animation.

### The 2D-with-3D-Feel Technique

The visual depth effect is achieved through layered parallax rendering:

1. **Deep background** — distant star field, nebula clouds. Moves very slowly relative to user input.
2. **Mid background** — larger celestial objects, distant terrain silhouettes. Moves at medium speed.
3. **Main layer** — the planet surface, interactive elements, characters. Fixed reference point.
4. **Foreground** — atmospheric particles, floating debris, close terrain features. Moves opposite to input for depth illusion.

Each layer uses CSS `transform: perspective() translateZ()` to create real parallax depth. Combined with directional shadows (whose angle matches the lighting parameter), subtle bloom effects on light sources, and atmospheric haze gradients that fade distant layers, the result is a 2D scene that reads as three-dimensional.

### Motion & Choreography Stack

The "immersive cutscene" feel during gameplay comes from motion design, not video rendering. Every moment the user interacts with runs on a realtime stack so nothing blocks on a render pipeline:

- **GSAP drives scene timelines.** Each planet scene is authored as a GSAP timeline that sequences narrative reveals, camera moves, and challenge entry beats. Timelines are pausable/scrubable so dialogue choices can interrupt and branch.
- **Motion for Vue handles UI-layer springs** — dialogue boxes, challenge option cards, progress overlays. Declarative, reactive, plays nicely with Vue's state.
- **Rive handles characters.** Guardians and NPCs are Rive files with state machines wired to the scene's dialogue state. A character can idle, react to correct/incorrect answers, and transition between emotional beats without any per-frame scripting from our side.
- **Lottie handles flourishes.** Short vignettes (intro stings, landing flourishes, reward moments) are pre-authored in After Effects and dropped in as JSON.
- **A WebGL post-processing pass sits over the whole scene.** One full-screen fragment shader composites grain, bloom, chromatic aberration, atmospheric god-rays, and heat haze on top of the SVG/Canvas scene. This is the single biggest multiplier for perceived production value and stays cheap because it's one draw call per frame.

**Division of labor between realtime and pre-rendered:** realtime stack owns everything the user touches more than once (gameplay scenes, transitions, character animation). Pre-rendered video (see `FUTURE.md`) is reserved for a small number of hero cutscenes where interactivity isn't needed and the quality ceiling of realtime web can't compete.

### Galaxy Map Rendering

The galaxy overview is rendered as an interactive 2D star map using HTML Canvas or SVG. Stars pulse with subtle animation. Solar systems show orbiting planets when hovered or zoomed. Warp lanes between related systems are drawn as curved, glowing paths. Visited systems are brighter and more detailed; unvisited ones are dimmer and more abstract. The map supports pan, zoom, and click-to-travel interactions.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **Vue 3** | Core framework. Composition API for state management, reactive galaxy/scene state. |
| **Vite** | Build tooling. Fast HMR during development, optimized production builds. |
| **TypeScript** | Type safety across the frontend. Especially important for the complex galaxy state objects. |
| **HTML Canvas / SVG** | Galaxy map rendering and planet scene composition. Canvas for the starfield, SVG for interactive scene elements. |
| **Tailwind CSS v4** | Utility-first styling, CSS-first config (no `tailwind.config.js`). Parallax transforms, animations, and visual effects via CSS. |
| **GSAP** | Scene timeline orchestration. Sequenced reveals, eased camera moves, choreographed narrative beats. Drives the per-scene "cutscene-feel" during gameplay without giving up interactivity. |
| **Motion for Vue** (Framer Motion) | Declarative spring physics for UI-layer choreography layered over the SVG/Canvas scene — dialogue boxes, challenge reveals, hover states. |
| **Rive** | Rigged character animation for planet guardians and NPCs. State machines tie directly into dialogue/challenge flow, so characters react to player choices without regenerating the scene. |
| **Lottie** | Hand-authored vignettes for intro stings, planet-entry flourishes, and reward moments. Tiny JSON payloads, crisp at any size, instant playback. |
| **WebGL post-processing (ogl)** | A single full-screen fragment shader pass over the composed scene — film grain, chromatic aberration, atmospheric god-rays, heat haze, bloom. This is the largest single "holy shit" multiplier for perceived quality and runs entirely client-side. Skip Three.js unless we need true 3D. |
| **Vue Router** | Client-side routing. `/galaxy/:id` for galaxy views, `/galaxy/:id/planet/:planetId` for scenes. |

### Backend

| Technology | Purpose |
|---|---|
| **Bun** | JavaScript runtime. Chosen for native speed, built-in SQLite bindings, and minimal config. |
| **Hono** | Lightweight web framework on Bun. Minimal overhead, fast routing, middleware support. |
| **TypeScript** | Shared types between frontend and backend (galaxy schema, API contracts). |

### AI & Content Processing

| Technology | Purpose |
|---|---|
| **Claude Code (Sonnet 4.6)** | All AI operations — content extraction, galaxy structuring, scene generation. We abuse Claude Code running Sonnet 4.6 rather than hitting the Messages API directly. |
| **pdf-parse** | PDF text extraction for uploaded documents. |
| **Streaming responses** | Streamed output from the Claude Code instance for real-time scene delivery and progressive galaxy building. |

**Development vs pre-deployment AI access path:**

- **During development:** the backend invokes Claude Code via local **spawner scripts** — each pipeline stage shells out to a Claude Code process, passes the prompt + input, and captures streamed output. No network hop, no proxy. This lets us iterate on prompts and pipeline logic without standing up infra.
- **Pre-deployment:** we replace the spawner with a **proxy server** that wraps a long-running Claude Code instance and exposes an API-style interface (HTTP + SSE) the backend can call. All pipeline code that currently shells out will be swapped to hit the proxy endpoints instead. The spawner and proxy should share the same request/response shape so the switch is a single adapter change, not a rewrite.

### Data & Storage

| Technology | Purpose |
|---|---|
| **SQLite (via Bun built-in)** | Lightweight key-value storage. One table: `galaxies(id TEXT PRIMARY KEY, data JSON, created_at INTEGER)`. Zero config, single file. |
| **File system** | Uploaded documents stored temporarily on disk during processing. Cleaned up after extraction. |

### Deployment

| Technology | Purpose |
|---|---|
| **TBD** | Deployment details to be figured out later. Frontend (static files served by Hono) and backend will likely run together, but we also need to host a **separate proxy server** that runs a Claude Code instance the backend can talk to. |

### What We Deliberately Don't Use

- **No Redis.** Session state lives in SQLite or in the galaxy JSON blob. Adding Redis means another service to deploy and monitor for zero benefit at this scale.
- **No Postgres.** SQLite handles everything we need. The data model is simple (key-value with JSON blobs), and we're not doing complex relational queries.
- **No S3.** Uploaded files are processed and discarded. The extracted knowledge lives in the galaxy JSON. File storage adds complexity for a transient asset.
- **No Auth system.** No accounts, no OAuth, no JWT. Access is via galaxy UUID in the URL. This eliminates an entire class of infrastructure and UX friction.
- **No AI image generation.** Procedural visuals are faster, cheaper, more consistent, and interactive. Image gen APIs would add seconds of latency per scene.
- **No WebSocket.** Server-Sent Events (SSE) via Claude API streaming cover the real-time needs. WebSocket would be needed only if we add multiplayer features.

---

## API Design

### Endpoints

**POST `/api/galaxy/create`**
Accepts raw text (PDF upload TBD). Runs the currently-implemented pipeline slice (ingest → structure → layout) synchronously, persists the blob to SQLite, and returns the full `Galaxy` JSON with a 201. SSE streaming of extraction progress is a planned upgrade once the latency budget demands it — today's slice is fast enough that a blocking response is fine.

**GET `/api/galaxy/:id`**
Returns the full galaxy state JSON — structure, positions, visual parameters, progress.

**POST `/api/galaxy/:id/scene/:planetId`**
Generates an interactive scene for a specific planet. Streams the scene content as Server-Sent Events so narrative appears progressively.

**PATCH `/api/galaxy/:id/progress`**
Updates user progress (planet visited, challenge completed, score). Writes to the galaxy JSON blob.

**GET `/api/galaxy/:id/export`**
Exports the galaxy as a shareable format (link, or potentially a summary document of all learned content).

---

## Prompt Engineering

Every prompt in the pipeline writes into a specific scope of the `Galaxy` blob and its output is validated against the corresponding Zod schema in `shared/types/`. Validation failures fail loudly at the stage boundary instead of surfacing downstream.

### Stage 1 — Structure Prompt

The system prompt instructs Claude to act as an educational content analyst. It emphasizes: preserve the source's own terminology, identify the fixed three-level hierarchy (topic → subtopic → concept), flag cross-concept relationships (prerequisite, related, contrasts, example-of), assign each concept a `kind` (definition / formula / example / fact / principle / process) and a `modelTier` (light / standard / heavy) based on inherent reasoning complexity, and output strict JSON matching the `Knowledge` + `Relationships` schemas. The prompt includes a small worked example to lock in the format.

### Stage 2 — Detail Prompt

For each chunk in the parallel extraction pass, Claude receives: the full structural outline (for context), the specific chunk to extract from, and instructions to extract every granular detail — definitions, formulas, examples, edge cases, mnemonics, emphasis markers, verbatim source quotes. Output is keyed by concept id and validated against the `Detail` schema.

### Stage 3 — Narrative Prompt

A single call that produces the galaxy-wide story spine. Claude receives the full knowledge tree and extracted detail, and outputs: setting, protagonist framing, premise, stakes, structured tone (primary + genre), aesthetic direction (palette/atmosphere/motif keywords), a per-topic arc beat with role and emotional target, a small recurring cast (each with a distinct voice description — the single most important field for keeping NPCs feeling consistent across independently-generated scenes), a finale hook, and soft hard-constraints. Output is validated against the `Narrative` schema.

### Stage 5 — Visuals Prompt

Given the knowledge tree **and the narrative's aesthetic direction + tone**, Claude assigns visual parameters to each knowledge-bearing body. Tone-matched theming is what makes the galaxy read as one coherent place rather than a bag of unrelated planets — a cosmic-horror narrative produces ominous palettes, a heroic exploration narrative produces luminous ones. Decorative bodies skip this prompt entirely and are themed by code from the same narrative aesthetic. Output is validated against the `Visuals` schema (discriminated union per body kind).

### Stage 6 — Scene Generation Prompt

The most complex prompt. It receives: the concept's full detail from Stage 2, the narrative's arc beat for the parent topic, the recurring cast (so familiar characters can appear), context from neighboring/related concepts, the user's progress so far, the body's visual parameters, and the selected scene archetype. Claude generates: opening narrative, dialogue lines (each attributed to a speaker id or the narrator), a challenge with options and per-option explanations, and closing narrative. Output is validated against the `Scene` schema.

The prompt enforces that the scene must teach the *specific* concept faithfully — no hallucinating facts, no oversimplifying, no skipping details. It also instructs Claude to treat the scene as a **beat within the galaxy-wide arc**, not an isolated story, so every scene compounds the journey instead of resetting it.

The model used per scene is selected from the concept's `modelTier` hint — `light` concepts go to a cheap model, `heavy` concepts to a strong one. This is the single largest cost lever in the pipeline.

---

## Project Structure

`scholarsystem/` is a Bun workspace root — dependencies install once from the top and hoist into `scholarsystem/node_modules`, so `shared/` and `server/` both resolve `zod` from the same place without needing their own installs.

```
scholarsystem/
├── package.json                # Workspace root (declares server + shared)
├── client/                     # Vue 3 frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── GalaxyMap.vue          # Main galaxy overview with starfield
│   │   │   ├── SolarSystem.vue        # Zoomed view of a topic's system
│   │   │   ├── PlanetScene.vue        # Interactive learning scene
│   │   │   ├── SceneRenderer.vue      # Parallax layer compositor
│   │   │   ├── UploadPanel.vue        # Note upload / text input
│   │   │   ├── ProgressTracker.vue    # Visual progress overlay
│   │   │   └── ParticleField.vue      # Ambient particle effects
│   │   ├── composables/
│   │   │   ├── useGalaxy.ts           # Galaxy state management
│   │   │   ├── useScene.ts            # Scene streaming and rendering
│   │   │   ├── useParallax.ts         # Parallax depth engine
│   │   │   └── useProgress.ts         # Progress tracking
│   │   ├── lib/
│   │   │   ├── visualEngine.ts        # Procedural scene composition
│   │   │   ├── layoutEngine.ts        # Force-directed galaxy layout
│   │   │   └── sceneAssets.ts         # SVG building block library
│   │   ├── types/
│   │   │   └── galaxy.ts              # Shared TypeScript types
│   │   ├── App.vue
│   │   └── main.ts
│   ├── public/
│   │   └── assets/                    # Static SVG components, fonts
│   ├── index.html
│   └── vite.config.ts
│
├── server/                     # Bun + Hono backend
│   ├── src/
│   │   ├── routes/
│   │   │   └── galaxy.ts             # GET /api/galaxy/:id, POST /api/galaxy/create
│   │   ├── pipeline/                 # Content engine, grouped by phase
│   │   │   ├── README.md             # Stage order, phase grouping, rules
│   │   │   ├── runner.ts             # runPipeline(): ingest → structure → layout (current slice)
│   │   │   ├── parsing/              # Stages 0-2: input → knowledge
│   │   │   │   ├── ingest.ts         # Stage 0: hash, excerpt, init blob  [IMPLEMENTED]
│   │   │   │   ├── structure.ts      # Stage 1: hierarchical knowledge + relationships + referential-integrity checks  [IMPLEMENTED]
│   │   │   │   └── detail.ts         # Stage 2: parallel per-concept detail extraction  [NOT YET]
│   │   │   ├── storyline/            # Stage 3: narrative spine
│   │   │   │   └── narrative.ts      # Stage 3: galaxy-wide story, arc beats, cast  [NOT YET]
│   │   │   ├── worldgen/             # Stages 4-5: building the game world
│   │   │   │   ├── layout.ts         # Stage 4: deterministic concentric layout v1  [IMPLEMENTED]
│   │   │   │   └── visuals.ts        # Stage 5: per-body theming  [NOT YET]
│   │   │   └── gameplay/             # Stage 6: interactive content
│   │   │       └── scene.ts          # Stage 6: on-demand per-concept scene gen  [NOT YET]
│   │   ├── prompts/                  # Claude prompts — MIRRORS pipeline/ structure
│   │   │   ├── parsing/              # structure.ts [IMPLEMENTED], detail.ts [NOT YET]
│   │   │   ├── storyline/            # narrative.ts [NOT YET]
│   │   │   ├── worldgen/             # visuals.ts [NOT YET]
│   │   │   └── gameplay/             # scene.ts [NOT YET]
│   │   ├── db/
│   │   │   └── store.ts              # SQLite key-value store, validates on write + read
│   │   ├── lib/
│   │   │   ├── spawner.ts            # Local Claude Code spawner (dev) — proxy client later
│   │   │   └── blob.ts               # Empty-galaxy factory, stage status transitions, JSON extraction
│   │   ├── fixtures/
│   │   │   └── sample-galaxy.ts      # Valid Galaxy fixture, validated at import
│   │   ├── scripts/
│   │   │   ├── test-spawner.ts       # Smoke test for the spawner
│   │   │   └── test-pipeline.ts      # End-to-end harness: text in → validated Galaxy out → persisted
│   │   ├── README.md                 # Navigation guide for teammates
│   │   └── index.ts                  # Hono server entry point
│   ├── tsconfig.json
│   └── package.json
│
├── shared/                     # Shared Zod schemas + derived TS types (workspace member)
│   ├── package.json            # Declares zod dep — hoisted to workspace root
│   ├── README.md
│   └── types/                  # Source of truth for the Galaxy data contract
│       ├── ids.ts                     # Slug validator (kebab-case id discipline)
│       ├── meta.ts                    # id, schemaVersion, timestamps, title
│       ├── source.ts                  # Input provenance
│       ├── knowledge.ts               # Topics, subtopics, concepts (flat with id refs)
│       ├── detail.ts                  # Deep per-concept content
│       ├── relationships.ts           # Flat cross-link graph
│       ├── narrative.ts               # Galaxy-wide story spine
│       ├── spatial.ts                 # Polymorphic bodies (discriminated union on kind)
│       ├── visuals.ts                 # Per-body visual params (discriminated union)
│       ├── scenes.ts                  # Cached per-concept scenes
│       ├── conversations.ts            # Reserved: per-body player↔NPC chat turns (chat feature TBD)
│       ├── progress.ts                # User progress state
│       ├── pipeline.ts                # Per-stage status for streaming UI
│       ├── galaxy.ts                  # Top-level composition of all 11 scopes
│       └── index.ts                   # Barrel export
│
└── README.md
```

---

## Key Design Decisions

**Why no accounts?** Friction kills hackathon demos. Every second spent on "create an account" is a second the judge/user isn't experiencing the actual product. URL-based access with UUID keys is zero-friction and naturally shareable.

**Why procedural visuals over AI image gen?** Speed (instant vs 3-10 seconds), cost (zero vs $0.01-0.05 per image), consistency (deterministic vs variable), and interactivity (DOM elements vs static rasters). The tradeoff is that scenes are more stylized/abstract than photorealistic, but that fits the space aesthetic perfectly.

**Why SQLite over a "real" database?** The data model is a single JSON blob per galaxy. There are no joins, no complex queries, no concurrent write contention. SQLite handles this perfectly and requires zero operational overhead. If we ever need to scale, migrating the key-value pattern to Postgres or DynamoDB is trivial.

**Why stream everything?** Perceived performance is more important than actual performance. A 5-second response that streams feels instant. A 3-second response that blocks feels slow. Every Claude API call in the pipeline uses streaming, and the frontend is built to render incrementally.