# Scholar System

## What Is This?

Scholar System is an AI-powered learning platform that turns any study material (lecture notes, textbooks, pasted text, PDFs) into an explorable, galaxy-themed interactive story. Topics become solar systems, subtopics become planets, concepts become moons, and landing on a moon triggers a procedurally-composed interactive scene that teaches the concept through narrative, dialogue, and a challenge.

Core thesis: spatial exploration + story beats retain better than flashcards or linear summaries. Associating a concept with a *place you visited* and a *story you lived through* makes it stick.

---

## How It Works

### User Experience

1. **Upload.** The user pastes text, uploads PDFs, or describes what they want to learn. No account required — just drop your notes and go.
2. **Watch your galaxy form.** The system parses the content in real time. As topics are identified, stars begin appearing on screen. Solar systems take shape. The user sees their knowledge materializing as a galaxy before their eyes.
3. **Explore.** The user is presented with their galaxy — a 2D star map with subtle ambient motion (slow Lissajous camera drift, drifting nebulae, rare shooting stars). Each solar system is a major topic. Planets within each system are subtopics and concepts. The user clicks to travel between systems, orbit planets, and land on surfaces.
4. **Learn through story.** Landing on a planet triggers an interactive scene. A narrative plays out — maybe the user encounters an alien guardian who explains the concept through dialogue, or discovers ancient ruins where the inscriptions teach a formula, or navigates a storm that requires applying a principle to survive. Each scene ends with a challenge that tests understanding.
5. **Track progress.** Visited planets change appearance. Completed challenges light up connections between related concepts. The galaxy map becomes a visual progress tracker that shows what's been mastered and what remains.
6. **Extend over time.** Upload week 2 of your lecture notes to an existing galaxy and watch it grow. New constellations unlock, story arcs continue with the same cast and tone, and week-2 concepts can reference week-1 ones as prerequisites. Existing progress, visited state, and cached scenes are preserved.
7. **Share.** Every galaxy gets a unique URL. Bookmark it to come back later, or share it with classmates so they can explore the same material.

### Content Pipeline

**Architecture: Claude Code + Obsidian-markdown workspace on a proxy server.** Each galaxy has a session directory (`workspaces/<galaxyId>/`) containing stage folders (`sources/`, `stage1-structure/`, `stage2-detail/`, `stage3-narrative/`, …) populated with markdown notes carrying YAML frontmatter and `[[wikilink]]` cross-references. Pipeline stages are Claude Code sessions invoked through the proxy's HTTP+SSE API — each session reads files from the previous stage's folder and writes notes into the next. A final `compile` step walks the folder state and produces the canonical `Galaxy` JSON blob stored in SQLite.

**The blob is the source of truth; the workspace is scratchpad.** Workspaces are rehydrated from the blob on demand (e.g. when a user uploads a new chapter) and garbage-collected on a TTL. This keeps durability concerns in one place (a single SQLite row per galaxy) while giving Claude Code the native file-editing affordances it's strongest at. Current implementation status lives in `PROGRESS.md` — the workspace/proxy architecture supersedes the earlier single-process spawner + TAB-delimited output approach.

**Accuracy model — citations, not trust.** Every derived artifact in every stage carries a `sourceRefs` array citing stable source-unit IDs produced at ingest. After Stage 2 a pure-code **coverage auditor** unions all citations and computes `uncited = allSourceUnits - citedSourceUnits`; a targeted gap-audit Claude call then decides, for each uncited passage: attach to an existing concept, create a new concept, or justify as non-knowledge-bearing (formatting, redundant example, etc.). Coverage is verifiable by machine, not self-reported by the model. This is the mechanism that delivers the "no content silently dropped" guarantee.

**Stage 0 — Ingest & Chunk.** Pure code. Extracts text from the upload (txt/md/pdf/docx/pptx via an extractor dispatcher), hashes it for provenance, and **chunks the source into stable numbered units** (`w1-s-0001`, `w1-s-0002`, …) stored under `source.chapters[].units`. Chapter prefix is mandatory on every unit ID — collisions across chapters are prevented by construction, not detection. An empty blob is minted with all downstream stages `"pending"`.

**Stage 1 — Structure.** Single Claude Code session, Sonnet 4.6. Reads `sources/<chapter>/`, writes Obsidian knowledge notes into `stage1-structure/` — one file per topic / subtopic / concept with frontmatter (`id`, `chapter`, `topic`, `subtopic`, `modelTier`, `sourceRefs`) and wikilinks to related nodes. The file system *is* the output; no TAB dialect, no JSON streaming. Output size is decoupled from input size, so the galaxy map can render the moment this stage completes.

**Stage 2 — Detail (parallel, per-topic sandboxes).** Fan-out across topics via a worker pool on the proxy (concurrency capped by VPS capacity, default Sonnet 4.6). Each topic gets its own subfolder (`stage2-detail/<topic-id>/`) owned exclusively by one Claude Code session — no file contention, no locking. Sessions read the full outline from `stage1-structure/` for cross-reference context and write one detail note per concept with definitions, formulas, worked examples, edge cases, verbatim quotes, and the source unit IDs they drew from. Prompts explicitly forbid over-summarization.

**Stage 2.5 — Coverage Audit.** Pure-code pass computes uncited source units. If any remain, a sequential gap-audit Claude call (Sonnet 4.6, small input by construction) receives the uncited passages plus the existing concept list and decides for each: attach to an existing concept, create a new concept, or mark as non-knowledge-bearing with justification. Loops at most N times until coverage meets threshold. This is the accuracy backstop — don't cheap out on the model tier here.

**Stage 3 — Narrative.** Sonnet 4.6. Writes `stage3-narrative/canon.md` (setting, protagonist framing, recurring cast, aesthetic keywords, tone) and `stage3-narrative/arcs/<chapter>.md` (per-topic beats, chapter hook). **Canon is frozen after first generation** — subsequent chapter extensions treat canon as immutable input and only append new arc files. Blocks on Stage 2.5 so beats can reference real extracted content.

**Stage 4 — Layout.** Pure code, zero Claude calls. Runs in parallel with Stage 3 the moment Stage 1 completes. *v1 is deterministic concentric* — topics on a ring, subtopics orbiting their star, concepts orbiting their planet, loose concepts as outer asteroids. **Extension-aware:** existing body positions are pinned across chapter uploads (a visited moon never teleports), new topics land in angular gaps on an outer ring, new subtopics/concepts append to their parent's orbit. The force-directed upgrade is a drop-in replacement that must also respect position locks.

**Stage 5 — Visuals.** Sonnet 4.6. Reads `narrative/canon.md` + the list of new bodies, writes per-body visual params so the galaxy reads as one coherent place across chapters. Append-only: existing entries are frozen. Decorative bodies are code-themed from `narrative.canon.aesthetic`, zero Claude calls.

**Stage 6 — Scene Generation (on-demand, per concept).** Scenes generate when the user lands on a moon/asteroid and cache into `scenes`. **This is the only stage where `modelTier` routing hits different models**: Haiku 4.5 for `light`, Sonnet 4.6 for `standard`, Opus 4.6 for `heavy`. Prompt receives: the concept's Stage 2 detail, the parent topic's arc beat, the recurring cast, neighboring-concept context, user progress, the body's visual params, and a strict output schema (opening narrative → dialogue → challenge with per-option explanations → closing narrative). Response streams so narrative starts appearing immediately. Variety comes from a rotation of archetypes (`guardian-dialogue`, `exploration-discovery`, `environmental-puzzle`, `memory-echo`, `cooperative-challenge`); each archetype has a hand-authored GSAP timeline in the frontend that slots in Claude's content — **Claude does not generate animation sequences**, only content for templates.

**Chapter extensions.** Users can upload additional chapters to an existing galaxy. The proxy rehydrates the workspace from the stored blob, drops the new sources into `sources/<chapter>/`, and runs Stages 0 → 2.5 over the new chapter only. Stage 3 runs in *extend mode* — canon frozen, a new arc file appended, cast and tone carried forward. Stage 4 places only new bodies (existing positions pinned). Stage 5 themes only new bodies. Existing scenes, progress, and visited state are untouched. Cross-chapter wikilinks (`[[w1-energy-flow]]` from a week-2 concept) knit the extended story together and naturally produce prerequisite edges in the relationship graph.

**Progress (continuous).** Lives in the `progress` scope of the blob — visited status, challenge attempts with full history, best/last scores, hints used, time spent, mastery estimate. Feeds back into scene generation so weak prerequisites get reinforced in later scenes. Persistence = the UUID URL.

---

## The Visual System

**Philosophy: procedural composition, not image generation.** No Stable Diffusion / DALL-E. Image gen is slow (seconds), expensive at scale, inconsistent, and non-interactive. Instead: a library of SVG building blocks (terrain, atmosphere, flora/fauna silhouettes, geological formations, celestial objects) composed, recolored, layered, and animated from parameters Claude generated in Stage 5.

**2D-with-3D-feel** via layered parallax: deep background (slow starfield/nebula) → mid background (distant silhouettes) → main layer (surface, characters, interactables) → foreground (particles, close debris moving opposite to input). Each layer uses `transform: perspective() translateZ()`, directional shadows whose angle matches the lighting parameter, bloom on light sources, and atmospheric haze fading distant layers.

**Motion & choreography stack.** GSAP drives scene timelines (pausable/scrubable so dialogue choices can branch). Motion for Vue handles UI-layer springs (dialogue boxes, challenge cards). Rive handles characters — state machines wired to dialogue state, so a guardian can idle, react to correct/incorrect answers, and transition between emotional beats without per-frame scripting. Lottie handles pre-authored flourishes (intro stings, landing moments, reward vignettes). A single full-screen WebGL fragment shader composites grain, bloom, chromatic aberration, god-rays, and heat haze over the whole scene — one draw call per frame, single biggest multiplier for perceived production value.

Division of labor: realtime owns everything the user touches more than once; pre-rendered video (see `FUTURE.md`) is reserved for a handful of hero cutscenes where interactivity isn't needed.

**Galaxy map** renders as Canvas (starfield) + SVG (interactive bodies). Stars pulse, systems show orbiting planets on hover/zoom, warp lanes between related systems draw as curved glowing paths, visited systems brighter and more detailed. Pan, zoom, click-to-travel.

---

## Tech Stack

**Frontend.** Vue 3 + Vite + TypeScript, Tailwind v4 (CSS-first config, no `tailwind.config.js`), Vue Router (`/galaxy/:id`, `/galaxy/:id/planet/:planetId`). Rendering: HTML Canvas for the starfield, SVG for interactive scene elements. Motion stack as above (GSAP + Motion for Vue + Rive + Lottie + ogl for the WebGL post pass — deliberately skipping Three.js unless we need true 3D).

**Backend.** Bun + Hono + TypeScript, split into two deployables:

- **API server** (`scholarsystem/server/`) — thin HTTP layer the frontend talks to. Owns SQLite (the galaxy blob store), hosts `POST /api/galaxy/create` and `POST /api/galaxy/:id/extend`, drives the pipeline by calling the proxy stage-by-stage, and runs the pure-code stages (ingest/chunking, coverage audit, layout, compile). Never touches filesystems other than SQLite.
- **Workspace proxy** (`scholarsystem/proxy/`) — runs on a VPS, manages per-galaxy workspace directories on local disk, maintains a worker pool of long-running Claude Code processes, and exposes an HTTP+SSE API (`POST /session/:id/files`, `POST /session/:id/run`, `GET /session/:id/compile`, `DELETE /session/:id`). Enforces per-session single-writer discipline, caps concurrent Claude Code processes, and garbage-collects idle workspaces on a TTL. Rehydrates a workspace from a stored blob on extension requests so the API server never ships file state around.

Shared types flow through the `shared/` workspace so both sides validate against the same Zod schemas.

**AI.** All Claude calls go through Claude Code, never the metered Messages API. Default model is Sonnet 4.6 across Stages 1–5. Opus 4.6 appears only in Stage 6 scene generation for `modelTier: heavy` concepts; Haiku 4.5 handles Stage 6 `light` concepts. Files live on disk inside the proxy's workspace — Claude Code reads and writes them natively, which removes prompt-ballooning for file-heavy stages and makes runs inspectable (`cat` the workspace to see exactly what the model produced). `pdf-parse` and equivalent extractors run in Stage 0 on the API server side.

**Storage.** SQLite via Bun built-in, single table `galaxies(id TEXT PRIMARY KEY, data JSON, created_at INTEGER, updated_at INTEGER)`. The blob is the durable source of truth; workspaces on the proxy are ephemeral, rehydrated on demand and TTL'd when idle.

**Deliberately not used.** No Redis (SQLite + the blob cover session state). No Postgres (no joins, no complex queries). No S3 (files are transient, live only inside the proxy workspace during a run). No auth system (UUID URL is the access key, eliminating an entire class of infra and UX friction). No AI image gen (procedural is faster, cheaper, consistent, interactive). No WebSocket (SSE covers the real-time needs).

---

## Project Structure

`scholarsystem/` is a Bun workspace root — deps hoist at the top so `shared/`, `server/`, and `proxy/` all resolve dependencies from the same place without their own installs.

- `scholarsystem/client/` — Vue 3 frontend. Components, composables (`useGalaxy`, `useScene`, `useParallax`, `useProgress`), and `lib/` holding `visualEngine.ts` / `layoutEngine.ts` / `sceneAssets.ts`.
- `scholarsystem/server/` — Bun + Hono **API server**. Owns SQLite (`db/store.ts`), HTTP routes (`routes/galaxy.ts` — create + extend), the pipeline orchestrator that drives the proxy stage-by-stage (`pipeline/orchestrator.ts`), pure-code stages (`pipeline/chunker.ts`, `pipeline/coverage.ts`, `pipeline/layout.ts`), the folder-to-blob compile step (`pipeline/compile/` — frontmatter parser, wikilink walker, Zod validation), and the proxy client (`lib/proxy-client.ts`, replacing the old `spawner.ts`). Prompts live under `prompts/` mirroring the stage phases, authored as Obsidian-style markdown templates.
- `scholarsystem/proxy/` — **New.** Workspace manager + Claude Code worker pool deployed to a VPS. HTTP+SSE API over `workspaces/<galaxyId>/` directories on local disk. Enforces session locking, concurrency caps, and TTL cleanup. Rehydrates workspaces from blobs on extension requests.
- `scholarsystem/shared/` — workspace member, Zod schemas + derived TS types, one file per scope (`meta`, `source`, `knowledge`, `detail`, `relationships`, `narrative`, `spatial`, `visuals`, `scenes`, `conversations`, `progress`, `pipeline`) composed into `galaxy.ts`. Also owns `ids.ts` (chapter-prefixed `Slug` schema) and citation helpers. **Source of truth for the data contract.**

Use `Glob` / directory reads for exact file layout — don't rely on this doc to stay in sync with the tree.

---

## Prompt Engineering

**Format: Obsidian markdown.** Every pipeline stage reads and writes notes with YAML frontmatter + body markdown + `[[wikilink]]` cross-references. Claude Code handles this format natively — training exposure is enormous — which means less prompt scaffolding and higher extraction quality than custom dialects like TAB-delimited lines or streamed JSON. On compile, a lightweight parser (`gray-matter` + a wikilink walker) pulls frontmatter into Zod-validated structs and resolves wikilinks into `relationships` edges. Validation failures fail loudly at stage boundaries rather than surfacing downstream.

**Example — a Stage 2 detail note:**

```markdown
---
id: w1-photosynthesis
chapter: w1
topic: w1-cellular-biology
subtopic: w1-plant-metabolism
modelTier: standard
sourceRefs: [w1-s-0042, w1-s-0043, w1-s-0044]
tags: [biology, energy-transfer]
---

# Photosynthesis

## Definition
The process by which plants convert light energy into chemical energy...

## Worked example
...

## See also
- [[w1-cellular-respiration]] (contrasts)
- [[w1-chlorophyll]] (prerequisite)
- [[w1-energy-flow]] (example-of)
```

**Three distinct cross-reference mechanisms — do not conflate them:**

1. **`sourceRefs`** — machine-verified citations back to stable source-unit IDs. **Load-bearing for the accuracy guarantee.** Zod-required (`.min(1)`) on every derived artifact. The coverage auditor runs on this.
2. **Wikilinks (`[[node-id]]`)** — edges between knowledge nodes. Compile into the `relationships` scope; power cross-chapter story continuity when a new chapter's concept links back to an earlier one.
3. **`tags`** — free-form thematic labels. Polish, not correctness. Useful for scene-gen archetype hints and cross-chapter discovery. **Never let tags creep into the correctness story** — they're unverifiable by construction.

**Namespace discipline.** Every ID carries a chapter prefix (`w1-photosynthesis`, `w1-s-0042`, `w1-cellular-biology`). The `Slug` Zod schema enforces the prefix pattern — an unprefixed id is a hard validation error, not a warning. Prevents cross-chapter collision at the schema boundary rather than hoping it doesn't happen at runtime.

**Model tier routing.** Default Sonnet 4.6 across Stages 1–5. Opus 4.6 appears only in Stage 6 scene generation and only for `modelTier: heavy` concepts. Haiku 4.5 handles Stage 6 `light` concepts. This is where the generation-time budget is actually won or lost.

For the shape of each stage's prompt inputs/outputs, read the prompt files under `server/src/prompts/` — they're the living spec.
