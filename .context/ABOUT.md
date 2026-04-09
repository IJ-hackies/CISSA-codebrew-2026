# Scholar System

## What Is This?

Scholar System is an AI-powered learning platform that turns any study material (lecture notes, textbooks, pasted text, PDFs) into an explorable, galaxy-themed interactive story. Topics become solar systems, subtopics become planets, concepts become moons, and landing on a moon triggers a procedurally-composed interactive scene that teaches the concept through narrative, dialogue, and a challenge.

Core thesis: spatial exploration + story beats retain better than flashcards or linear summaries. Associating a concept with a *place you visited* and a *story you lived through* makes it stick.

---

## How It Works

### User Experience

Upload text/PDF → watch the galaxy materialize as stages complete → pan/zoom a 2D star map with parallax depth → click a moon to land → play an interactive scene ending in a challenge → visited bodies light up as progress. Every galaxy has a UUID URL that is both bookmark and share link. No accounts.

### Content Pipeline

Six stages plus an on-demand scene generator, all reading/writing the same `Galaxy` JSON blob in SQLite keyed by UUID. Data contract lives in `.context/SCHEMA.md` (canonical) and `scholarsystem/shared/types/` (Zod source of truth).

**Current implementation (2026-04-09):** Stages 0, 1, 4 are wired end-to-end via `server/src/pipeline/runner.ts` and exposed at `POST /api/galaxy/create`; `server/src/scripts/test-pipeline.ts` is the CLI harness. Stages 2, 3, 5, 6 not yet implemented — their scopes stay at empty defaults and `pipeline[stage].status` remains `"pending"`. Blobs are still schema-valid and renderable from just `knowledge` + `relationships` + `spatial`.

**Stage 0 — Ingest.** Raw text/PDF in, provenance (kind, size, hash, 500-char excerpt) written to `source`, raw input discarded, UUID minted, empty blob created with all downstream stages `"pending"`. Pure code. PDFs use `pdf-parse` (not yet wired).

**Stage 1 — Structure.** Single Claude call. Produces the three-level hierarchy (topic → subtopic → concept) plus a flat cross-link graph, each concept getting a one-sentence hook and a `modelTier` hint (`light`/`standard`/`heavy`) that later gates per-scene model routing. Output is **TAB-delimited lines, not JSON** (see Prompt Engineering below). Fast because output size is decoupled from input size; frontend can render the map the moment this completes.

**Stage 2 — Detail (parallel).** Per-concept granular extraction — definitions, formulas, worked examples, edge cases, mnemonics, verbatim quotes. For large inputs this fans out across chunks split along topic boundaries, each chunk receiving the full outline for cross-reference context. Content fidelity is first-class: prompts explicitly forbid over-summarization.

**Stage 3 — Narrative.** Single Claude call producing the galaxy-wide story spine (setting, protagonist framing, tone, aesthetic keywords, per-topic arc beats, a small recurring cast with distinct voices, finale hook). **Blocks on Stage 2** so beats reference real extracted content. Later consumed by Stage 5 and Stage 6.

**Stage 4 — Layout.** Pure code, zero Claude calls — assigns 2D positions to every body. Runs the moment Stage 1 finishes, in parallel with 2+3. *v1 is deterministic concentric* (topics on a ring, subtopics orbiting their star, concepts orbiting their planet, loose concepts as outer asteroids, plus a handful of default decoratives) — chosen over force-directed because every position is a pure function of tree indices, so runs are stable and diffs trivially debuggable. Force-directed upgrade is a drop-in replacement for the placement function.

**Stage 5 — Visuals.** Claude assigns per-body visual params (palette, terrain, atmosphere, lighting, mood) informed by the narrative's aesthetic direction so the galaxy reads as one coherent place. Decorative bodies skip Claude entirely — themed by code from the same narrative aesthetic via a hand-authored SVG library.

**Stage 6 — Scene Generation (on-demand, per-concept).** Scenes generate when the user lands on a moon/asteroid and cache into `scenes`. Per-concept (not per-subtopic) so each unit is tight and `modelTier` routing works cleanly. Prompt receives: the concept's Stage 2 detail, the parent topic's arc beat, the recurring cast, neighboring-concept context, user progress, the body's visual params, and a strict output schema (opening narrative → dialogue → challenge with per-option explanations → closing narrative). Response streams so narrative starts appearing immediately. Variety comes from a rotation of archetypes (`guardian-dialogue`, `exploration-discovery`, `environmental-puzzle`, `memory-echo`, `cooperative-challenge`); each archetype has a hand-authored GSAP timeline in the frontend that slots in Claude's content — **Claude does not generate animation sequences**, only content for templates.

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

**Backend.** Bun runtime (native speed, built-in SQLite, minimal config) + Hono (lightweight web framework) + TypeScript. Shared types with the frontend via the `shared/` workspace.

**AI.** All Claude calls go through Claude Code running Sonnet 4.6 (we deliberately avoid the metered Messages API). **Dev path:** backend shells out to a local Claude Code process per pipeline stage (`server/src/lib/spawner.ts`), captures streamed output, no network hop. **Pre-deployment path:** replace the spawner with a proxy server wrapping a long-running Claude Code instance, exposing HTTP + SSE that mirror the spawner's request/response shape — single adapter change, not a rewrite. `pdf-parse` for PDF extraction.

**Storage.** SQLite via Bun built-in, single table `galaxies(id TEXT PRIMARY KEY, data JSON, created_at INTEGER)`. Uploaded files live on disk only during extraction, then are discarded.

**Deliberately not used.** No Redis (SQLite + the blob cover session state). No Postgres (no joins, no complex queries). No S3 (files are transient). No auth system (UUID URL is the access key, eliminating an entire class of infra and UX friction). No AI image gen (procedural is faster, cheaper, consistent, interactive). No WebSocket (SSE covers the real-time needs).

---

## Project Structure

`scholarsystem/` is a Bun workspace root — deps install once at the top and hoist into `scholarsystem/node_modules`, so `shared/` and `server/` both resolve `zod` from the same place without their own installs.

- `scholarsystem/client/` — Vue 3 frontend. Components, composables (`useGalaxy`, `useScene`, `useParallax`, `useProgress`), and `lib/` holding `visualEngine.ts` / `layoutEngine.ts` / `sceneAssets.ts`.
- `scholarsystem/server/` — Bun + Hono backend. Phase-grouped pipeline under `src/pipeline/` (`parsing/` = stages 0-2, `storyline/` = stage 3, `worldgen/` = stages 4-5, `gameplay/` = stage 6), prompts under `src/prompts/` **mirroring** the same phase groups, `runner.ts` orchestrating the current slice, `db/store.ts` for SQLite + round-trip validation, `lib/spawner.ts` for Claude Code invocation, `lib/blob.ts` for empty-galaxy factory + stage transitions, `scripts/test-pipeline.ts` as the end-to-end CLI harness.
- `scholarsystem/shared/` — workspace member, Zod schemas + derived TS types, one file per scope (`meta`, `source`, `knowledge`, `detail`, `relationships`, `narrative`, `spatial`, `visuals`, `scenes`, `conversations`, `progress`, `pipeline`) composed into `galaxy.ts`. **Source of truth for the data contract.**

Use `Glob` / directory reads for exact file layout — don't rely on this doc to stay in sync with the tree.

---

## Prompt Engineering

Every prompt writes into a specific scope of the blob and its output is Zod-validated at the stage boundary. Validation failures fail loudly instead of surfacing downstream.

The one non-obvious choice worth pinning here: **Stage 1 emits compact TAB-delimited lines, not JSON.** Each row is one node (`TITLE`, `SUMMARY`, `T` topic, `S` subtopic, `C` concept, `R` relationship) with single-tab field separators, parsed by `pipeline/parsing/parseStructureLines.ts` into the `Knowledge` + `Relationships` shapes before Zod checks them. Rationale:

- ~35-50% fewer output tokens than JSON (no field names, quotes, braces, commas) — freed budget went into richer briefs (cap bumped ~25 → ~40 words).
- **Graceful degradation.** A malformed row is logged as a parser warning and dropped; the rest of the galaxy still lands. JSON is all-or-nothing — one unescaped quote kills the whole response.
- **No new deps.** The cost model (abuse Claude Code running Sonnet 4.6) rules out Messages-API tool use / structured output. Lines give us most of the reliability benefit of tool use while staying entirely inside the spawner path.

Parser is tolerant on the way in (skips blank lines, `#` comments, accidental fenced-code markers, unknown tags) and strict on the way out (Zod + referential-integrity pass before writing into the blob).

For the shape of each stage's prompt inputs/outputs, read the prompt files under `server/src/prompts/` — they're the living spec.
