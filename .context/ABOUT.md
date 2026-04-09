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

This is the engine that makes everything work. It runs in four stages.

#### Stage 1: Ingest & Structure

Raw input (text, PDF content, pasted notes) hits the server. For PDFs, text is extracted via `pdf-parse`. The raw content is then sent to Claude via the Anthropic Messages API with a carefully engineered prompt that performs **structural analysis only** — it produces a hierarchical outline of the material without extracting details yet. This is fast because the output is small regardless of input size.

The prompt instructs Claude to act as an educational content analyst and to identify: major topic areas, subtopics within each, individual concepts and facts, and the relationships between them (prerequisites, related concepts, contrasts). The output is a strict JSON schema representing the knowledge tree.

For very large inputs (100+ pages), the system uses a **two-pass parallel approach**: the structural outline from pass one is used to split the document into semantically meaningful chunks (by topic boundary, not arbitrary page splits). These chunks are then fanned out as parallel Claude API calls, each extracting detailed knowledge from its chunk while receiving the full outline as context so cross-references are preserved.

**Why this matters:** Most AI learning tools over-summarize. They lose the specific formulas, the edge cases, the "this is what the lecturer emphasized" details that students actually need. Scholar System treats content fidelity as a first-class priority. The extraction prompts explicitly instruct Claude to preserve all granular details — specific numbers, exact definitions, named exceptions, worked examples — and flag when content might be ambiguous or incomplete.

#### Stage 2: Galaxy Generation

The knowledge tree maps onto a galaxy structure following a consistent spatial metaphor:

| Knowledge Level | Galaxy Element | Visual Representation |
|---|---|---|
| Course / Subject | Galaxy | The full map |
| Major Topic | Solar System | A star with orbiting bodies |
| Subtopic | Planet | Distinct world with unique visuals |
| Concept / Fact | Landmark / Challenge | Interactive element on a planet's surface |
| Relationship | Warp Lane | Visual connection between related bodies |

Positions are assigned using a force-directed layout algorithm that clusters related systems together and spaces unrelated ones apart. Each celestial body receives procedurally generated visual parameters based on its content characteristics (more on this in the Visual System section).

The complete galaxy state — structure, positions, visual parameters, extracted content per node — is serialized as a JSON blob and stored server-side, keyed by a random UUID. This UUID becomes the shareable URL: `app.com/galaxy/{uuid}`.

#### Stage 3: Scene Generation (On-Demand)

Scenes are not pre-generated for every planet — that would be slow and expensive. Instead, when a user lands on a planet, a Claude API call generates the interactive scene in real time.

The scene generation prompt includes:
- The specific concept/content for this planet
- Context from neighboring/related planets (what has the user already seen?)
- The user's progress (what have they completed, what did they struggle with?)
- Visual parameters for the planet (so narrative matches the environment)
- A strict output schema: narrative text, character dialogue, a challenge with options, explanation for correct/incorrect answers, and hints

The response is streamed to the frontend, so the narrative begins appearing immediately while the full scene loads.

**Scene variety** is achieved through prompt variation. The system rotates through scene archetypes: guardian dialogue (an alien teaches through conversation), exploration discovery (the user finds artifacts that reveal knowledge), environmental puzzle (applying a concept to navigate a hazard), memory echo (replaying a historical event that demonstrates a principle), and cooperative challenge (helping an NPC by using the concept). The archetype is selected based on the content type — formulas get puzzles, historical facts get memory echoes, conceptual explanations get guardian dialogues.

#### Stage 4: Progress Tracking

User progress is stored in the galaxy's JSON blob (no database, no account needed). Each celestial body tracks: visited/unvisited status, challenge attempts and scores, time spent, and hints used. This data feeds back into scene generation — if a user struggled with a prerequisite concept, the next scene will reference and reinforce it.

Progress is persisted via the galaxy UUID. As long as the user has their URL, they can resume from where they left off.

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
| **CSS (Tailwind)** | Utility-first styling. Parallax transforms, animations, and visual effects via CSS. |
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
Accepts raw text or file upload. Initiates the content pipeline. Returns a galaxy UUID immediately, then streams extraction progress via SSE.

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

### Content Extraction Prompt (Stage 1 — Structure)

The system prompt instructs Claude to act as an educational content analyst. It emphasizes: preserve all specific details (numbers, formulas, named entities, exceptions), identify hierarchical structure (topic → subtopic → concept → fact), flag relationships between concepts (prerequisite, related, contrasting), and output strict JSON matching a provided schema. The prompt includes few-shot examples of correctly extracted knowledge trees to guide the format.

### Content Extraction Prompt (Stage 2 — Detail)

For each chunk in the parallel extraction pass, Claude receives: the full structural outline (for context), the specific chunk to extract from, and instructions to extract every granular detail — definitions, formulas, examples, edge cases, mnemonics, emphasis markers. The output is a detailed JSON array of knowledge items with metadata (importance level, content type, relationships).

### Galaxy Theming Prompt

Given the knowledge tree, Claude assigns visual parameters to each celestial body. The prompt provides a mapping guide: abstract/theoretical topics get ethereal, gaseous planets; quantitative/formula-heavy topics get crystalline, geometric worlds; historical/narrative topics get ancient, ruin-covered surfaces; creative/open-ended topics get lush, organic biomes. The prompt includes the full parameter schema and constraints.

### Scene Generation Prompt

The most complex prompt. It receives: the planet's content, visual parameters, the user's progress, the selected scene archetype, and a strict output schema. Claude generates: an opening narrative paragraph (sets the scene), interactive dialogue or exploration text (teaches the concept), a challenge (tests understanding), four response options (one correct, three plausible distractors), explanations for each option, and a closing narrative that connects to the next planet.

The prompt enforces that the scene must teach the *specific* content faithfully — no hallucinating facts, no oversimplifying, no skipping details that were in the original notes.

---

## Project Structure

```
scholarsystem/
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
│   │   │   ├── galaxy.ts             # Galaxy CRUD endpoints
│   │   │   ├── scene.ts              # Scene generation endpoint
│   │   │   └── upload.ts             # File upload handling
│   │   ├── pipeline/
│   │   │   ├── ingest.ts             # PDF/text extraction
│   │   │   ├── structure.ts          # Stage 1: structural analysis
│   │   │   ├── extract.ts            # Stage 2: detailed extraction
│   │   │   ├── galaxy-builder.ts     # Stage 3: galaxy generation
│   │   │   └── scene-generator.ts    # Stage 4: scene generation
│   │   ├── prompts/
│   │   │   ├── structure.ts          # Structural analysis prompt
│   │   │   ├── extract.ts            # Detail extraction prompt
│   │   │   ├── theme.ts              # Visual parameter prompt
│   │   │   └── scene.ts              # Scene generation prompt
│   │   ├── db/
│   │   │   └── store.ts              # SQLite key-value operations
│   │   ├── lib/
│   │   │   ├── claude.ts             # Anthropic API client wrapper
│   │   │   └── parallel.ts           # Parallel extraction orchestrator
│   │   └── index.ts                  # Server entry point
│   ├── tsconfig.json
│   └── package.json
│
├── shared/                     # Shared types between client and server
│   └── types/
│       ├── galaxy.ts                  # Galaxy, SolarSystem, Planet, etc.
│       ├── scene.ts                   # Scene, Challenge, Response, etc.
│       └── api.ts                     # API request/response contracts
│
└── README.md
```

---

## Key Design Decisions

**Why no accounts?** Friction kills hackathon demos. Every second spent on "create an account" is a second the judge/user isn't experiencing the actual product. URL-based access with UUID keys is zero-friction and naturally shareable.

**Why procedural visuals over AI image gen?** Speed (instant vs 3-10 seconds), cost (zero vs $0.01-0.05 per image), consistency (deterministic vs variable), and interactivity (DOM elements vs static rasters). The tradeoff is that scenes are more stylized/abstract than photorealistic, but that fits the space aesthetic perfectly.

**Why SQLite over a "real" database?** The data model is a single JSON blob per galaxy. There are no joins, no complex queries, no concurrent write contention. SQLite handles this perfectly and requires zero operational overhead. If we ever need to scale, migrating the key-value pattern to Postgres or DynamoDB is trivial.

**Why stream everything?** Perceived performance is more important than actual performance. A 5-second response that streams feels instant. A 3-second response that blocks feels slow. Every Claude API call in the pipeline uses streaming, and the frontend is built to render incrementally.