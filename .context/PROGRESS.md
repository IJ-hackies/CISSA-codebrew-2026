# Progress

Living log of what's done. Update this whenever a stage advances, a branch is published, or a meaningful piece lands on main. Keep entries short — one line, dated, with branch/PR if relevant. `/recontext` reads this file, so future sessions will know the current state.

## Stages

### Frontend — Chat Landing
Status: **in progress** (mockup mode, fake submit, localStorage scaffolding)
- [x] `scholarsystem/client/` scaffolded — Vite + Vue 3 + TS strict + Tailwind v4 + Vue Router + GSAP + Motion-V + ESLint + Prettier + Bun
- [x] Galaxy renderer foundation: ambient deep-cosmic void (cool navy/black palette), drifting nebulae, ambient stars, slow Lissajous camera drift, rare shooting-star + nebula-pulse events
- [x] Renderer public API: `setPointer`, `setFocusAnchor`, `warp`, `zoomOut`/`zoomIn`, `launchRocket`, `landRocket`, `getPhase`, `start`/`stop`/`destroy`
- [x] Black-hole launch sequence: 5-phase cinematic (vanishing-point slide → entry spiral → steady-state hold → shrink → fade), tunnel-of-stars effect (radial streaks + inward acceleration + wrap), tangent-aligned spiraling rocket, `parallaxBoost` repurposed as unified tunnel-intensity knob also driving `warp()`/`zoomOut()`/`zoomIn()`
- [x] Chat landing page: logo + wordmark, tagline hero, chat input, suggestion chips, hint-line, supported-formats footer, drag-drop overlay, fake submit → localStorage entry → placeholder galaxy route
- [x] Unified history system: `HistoryButton` + `HistoryOverlay` with vertical constellation-path layout, responsive interpolation (52→124px glyphs, 148→280px pitch, capped 980px column), translucent backdrop on desktop, scroll-triggered IntersectionObserver reveals, first-time debut glow on the button
- [x] Mobile system: bottom-pinned input via `useVisualViewport` + safe-area, file-picker primary on touch, sparser starfield, tightened chrome, swapped logo/history-button positions
- [x] localStorage helpers (`recentGalaxies`) + UUID-seeded constellation glyph generator + canonical file-type list + quality-tier detector + `uuidHorizontalOffset`
- [ ] **Stubbed** — submit handler fakes the galaxy entry; cruise loop uses fixed 3s timer; both swap to real backend once Stage 0+1 land
- [ ] **Stubbed** — WebGL post-fx (grain/bloom/god-rays); quality flag wired, implementation deferred
- [ ] **Stubbed** — `Renderer.setPointer()` still on public API but no longer consumed (calmer ambient model — kept for forward compatibility)

### Frontend — Galaxy Exploration (Skill Tree + Planet View + Concept Scene + Stats)
Status: **Tier 1 + Tier 2 + Tier 3 complete** (in-memory progress; backend persistence pending)

- [x] **Skill tree page** (`/galaxy/:id`) — `SkillTree.vue` + `ConstellationSection.vue` + `SkillTreeHUD.vue`
  - Seeded LCG constellation layout: each topic's subtopic nodes form a unique glyph shape (deterministic per topic ID, never the same twice)
  - 7-layer SVG planet rendering per node: atmosphere glow → radial gradient → terrain ellipses → terminator shadow → cloud wisps → rim highlight → specular
  - Node states: `locked` / `available` (pulse ring) / `in-progress` (progress arc) / `mastered` (star badge)
  - Progress arc on `in-progress` nodes shows `completedConcepts / totalConcepts` — updates reactively via Vue 3 Proxy when concepts are completed
  - Dashed connector lines between consecutive nodes in each topic section
  - `SkillTreeHUD`: galaxy title, animated progress bar (`overallMastery`), visited/total count, stats button (bar chart icon → `/galaxy/:id/stats`)
- [x] **Planet view page** (`/galaxy/:id/planet/:subtopicId`) — `PlanetView.vue`
  - Large central planet SVG (200px desktop / 140px mobile) with same 7-layer rendering seeded from subtopic ID
  - Concept moons orbit via CSS two-spinner trick: `.moon-rotator` (CW spin, anchored at viewport 50%/50%) → `.moon-offset` (0×0 absolute, `translateX` to radius) → `.moon-counter` (0×0 absolute, CCW spin) → `.moon-btn` (`translate(-50%,-50%)` centred on orbit point). All layers are 0×0 so `transform-origin` is always the orbit centre — avoids the drift bug caused by content-sized elements rotating around their own midpoint
  - Orbit radii: 167–267px desktop, 139–211px mobile. Durations: 70/105/85/125s. Orbit ring SVG centred via `top:50%; left:50%; transform:translate(-50%,-50%)`
  - Moon SVGs coloured by concept kind; visited badge (green checkmark) on completed moons
- [x] **Concept scene page** (`/galaxy/:id/concept/:conceptId`) — `ConceptScene.vue`
  - Study card: kind-themed opening flavour text, concept title, `brief` text
  - 4-option multiple-choice challenge: correct = `concept.brief`, distractors = other concepts' briefs, shuffled via seeded RNG from `hash(concept.id)` (stable per concept)
  - On submit: in-memory progress update to galaxy store (`visited`, `masteryEstimate`, `attemptCount`, `bestScore`, `visitedCount`, `completedCount`, `overallMastery`)
  - Continue → back to parent planet
- [x] **Stats page** (`/galaxy/:id/stats`) — `StatsView.vue`
  - Overall mastery SVG donut ring (r=72, animated `stroke-dashoffset`), percentage in centre
  - Counter pills: explored / mastered / total
  - Per-topic cards: chapter label (accent coloured), title, animated mastery bar (palette gradient), subtopic and concept counts
  - Back → skill tree
- [x] Router: all four routes wired (`/galaxy/:id`, `/galaxy/:id/planet/:subtopicId`, `/galaxy/:id/concept/:conceptId`, `/galaxy/:id/stats`)
- [x] `galaxyStore.ts` — shared `ref<Galaxy>` singleton; all pages read and mutate the same reactive object
- [x] `useIsMobile` composable — responsive layout for planet view
- [ ] Progress persistence — currently in-memory only; `PATCH /api/galaxy/:id/progress` endpoint not yet built

### Backend v2 — Workspace Proxy + Obsidian Markdown Rewrite
Status: **Stages 0–5 wired and running end-to-end** — pipeline completes from PDF upload through visuals generation. Flint-informed extraction methodology (skeleton → dispatch plan → derivatives) replaces placeholder Stage 1/2 prompts. The prior backend work under `server/src/pipeline/parsing/` (ingest, structure, detail, extractors) and `pipeline/worldgen/layout.ts` is being superseded; extractor dispatch + the SQLite store carry over, everything else is rebuilt. Branch: `feat/refined-proxy`.

**Schema changes (do first — blocks everything else):**
- [x] `source.chapters[].units[]` — stable numbered source units (`w1-s-0001`), immutable once written
- [x] `meta.chapters[]` — upload history (`id`, `uploadedAt`, `filename`, `addedKnowledgeIds`, `addedBodyIds`)
- [x] `narrative.canon` vs `narrative.arcs[]` split — canon frozen after first generation, arcs append per chapter
- [x] `sourceRefs: Slug[]` with `.min(1)` on every `knowledge` node, `detail` entry, and `relationships` edge
- [x] `Slug` schema extended to require chapter prefix (`^[a-z][a-z0-9]*-[a-z][a-z0-9-]*$`); added `ChapterId` + `SourceUnitId`
- [x] `meta.schemaVersion` bumped to 2; mutability comment in `galaxy.ts` rewritten for the new append-only zones + `spatial.bodies[].position` lock
- [x] `pipeline.coverageAudit` stage added (Stage 2.5 status entry)

**Workspace proxy (`scholarsystem/proxy/`):**
- [x] HTTP+SSE Hono server, VPS-deployable (`proxy/src/index.ts`, port 4100)
- [x] Worker pool of long-running Claude Code processes with concurrency cap (`proxy/src/worker/pool.ts`)
- [x] Per-galaxy workspace directories (`workspaces/<galaxyId>/`) with stage subfolders (`proxy/src/workspace/manager.ts`)
- [x] Endpoints: `POST /session/:id/files`, `POST /session/:id/run` (SSE), `GET /session/:id/compile`, `DELETE /session/:id` (`proxy/src/routes/session.ts`)
- [x] Rehydration: given a stored blob, reconstruct the workspace for chapter extensions (`proxy/src/workspace/rehydrate.ts`)
- [x] TTL-based idle cleanup; per-session single-writer lock (`sweepIdle`, `acquireWriteLock`/`releaseWriteLock` in manager)
- [x] Proxy-client library for the API server (`server/src/lib/proxy-client.ts`), replacing `spawner.ts`

**API server pipeline rewrite (`scholarsystem/server/`):**
- [x] Stage 0 chunker — pure code, `pipeline/chunker.ts`, produces numbered source units per chapter
- [x] Stage 1 skeleton — Flint-informed rewrite: fast classification pass producing hierarchy + dispatch plan + auxiliary files (`_map.md`, `_structure.md`, `_etc.md`). Expanded 11 concept kinds. `pipeline/skeleton.ts` + `prompts/structure.ts` (`buildSkeletonPrompt`). Old `pipeline/structure.ts` deleted.
- [x] Stage 2 detail — Flint-informed rewrite: dispatch-plan-driven sequential fan-out (proxy single-writer), 200-300 word bodies + `# Derivatives` (verbatim quotes) + `# Relations` (typed edges). `pipeline/detail.ts` + `prompts/detail.ts` (`buildTopicDetailPrompt`).
- [x] Stage 2.5 coverage auditor — Hybrid unit-level (95% gate) + word-level (`computeWordCoverage()`) coverage. Gap audit now produces derivative quotes. `pipeline/coverage.ts`.
- [x] Stage 3 narrative — `pipeline/narrative.ts` + `prompts/narrative.ts`. Canon writer (first-run) + arc extender (chapter mode). Compiles `stage3-narrative/canon.md` + `stage3-narrative/arcs/<chapter>.md` via `compileNarrative()` in `compile/index.ts`.
- [x] Stage 4 layout v1 — extension-aware concentric placement with position locks
- [x] Stage 5 visuals — batched by system (5-15 bodies per Claude call), append-only. Decorative bodies code-themed. `pipeline/visuals.ts` + `prompts/worldgen/visuals.ts`.
- [x] Compile step — folder → Galaxy blob via `gray-matter` frontmatter parser + wikilink walker + derivative parser (`extractDerivatives`) + Zod validation (structure + detail + narrative + visuals compilers). `compileStructure` now returns `DispatchPlan`. `compileDetail` extracts derivatives from `# Derivatives` sections.
- [x] Pipeline orchestrator — `runner.ts` drives fast path (0→1→4) synchronously, background path (2→2.5→3→5) fire-and-forget with `onStageComplete` callback for re-persistence. Passes `dispatchPlan` from skeleton to detail stage.
- [x] `POST /api/galaxy/create` — first-chapter path, re-persists galaxy to SQLite after each background stage
- [ ] `POST /api/galaxy/:id/extend` — chapter extension path (rehydrate workspace, run delta stages only)

**Stage 6 — Scene Generation (On-Demand):**
- [ ] Scene prompt + archetype rotation
- [ ] Streamed scene delivery (SSE) to frontend
- [ ] Procedural SVG scene compositor + parallax layers
- [ ] Per-concept `modelTier` routing (Haiku/Sonnet/Opus)

**Progress tracking:**
- [ ] Visited/challenge/score state already scoped in schema
- [ ] `PATCH /api/galaxy/:id/progress` endpoint
- [ ] Feedback loop into scene generation (reinforce weak concepts)

---

### Superseded (prior backend, kept as reference during rewrite)
- Stages 0/1/2/4 previously wired via `server/src/lib/spawner.ts` + TAB-delimited Stage 1 output. Extractor dispatcher (`pipeline/parsing/extract/`) and SQLite store (`db/store.ts`) carry over; Stage 1/2 prompts and orchestration are rewritten for the Obsidian workspace model.

---

## Changelog

_Append newest entries at the top. Format: `YYYY-MM-DD — what landed — branch/PR`._

- 2026-04-11 — **Parallel sub-session fan-out for Stage 2 + Stage 5** (main, uncommitted): Stages 2 and 5 rewritten from sequential single-agent-per-topic to parallel per-concept/per-body sub-sessions. Each concept/body gets its own isolated proxy workspace (`galaxyId--d--conceptId`, `galaxyId--v--bodyId`) running a focused Claude Code agent that creates exactly 1 file. Sub-sessions run in parallel bounded by proxy worker pool (`maxConcurrency` bumped 4→10). Stage 5 switched from Sonnet to Haiku. New infrastructure: `fanOutSubSessions()` + `mergeSubSessionFiles()` in `proxy-client.ts`, `buildConceptDetailPrompt()` + `buildAuxiliaryDetailPrompt()` in `prompts/detail.ts`, `buildSingleBodyVisualPrompt()` in `prompts/worldgen/visuals.ts`. Merged files pushed back to main workspace to preserve folder-to-folder inspectability. Verified: typechecks clean, pipeline runs end-to-end.
- 2026-04-10 — **Flint-informed extraction pipeline rewrite + Stage 5 visuals** (`feat/pipeline-stage5-and-stage12-revamp`): Stage 1 rewritten as skeleton pass (fast classify, dispatch plan, 11 concept kinds, `_map/_structure/_etc` aux files); Stage 2 rewritten as dispatch-plan-driven sequential fan-out with 200-300 word bodies + `# Derivatives` (verbatim quotes) + `# Relations` (typed edges); Stage 2.5 upgraded with hybrid unit-level (95% gate) + word-level (`computeWordCoverage()`) coverage and gap audit that produces derivative quotes; Stage 5 visuals implemented (batched by system, decorative code-themed); schema expanded with `Derivative` type on `ConceptDetail`, `ConceptKind` widened to 11 values, `ChapterEntry` gains `structureNote`/`thematicGroups`/`etcContent`; compile step gains `DispatchPlan` output + derivative parser (`extractDerivatives`); old `pipeline/structure.ts` deleted. End-to-end pipeline verified with real PDF upload: 33/33 concepts, 100% unit coverage, 21/30 visuals themed. Known issues: ~5 skeleton YAML parse failures, ~5 detail gaps from output limits, ~9 visual Zod validation failures — see `plan.md` for diagnosis.
- 2026-04-10 — resolved merge conflicts between `feat/frontend-enhancements` and `origin/main`; took `--theirs` on `scholarsystem.db` (binary, non-mergeable), reconciled `.context/PROGRESS.md` conflict, pushed clean merge commit — `feat/frontend-enhancements`
- 2026-04-10 — **Stages 2, 2.5, 3 implemented and wired into runner** (`feat/refined-proxy`): new proxy-based detail stage (`pipeline/detail.ts` + `prompts/detail.ts`) with parallel per-topic fan-out writing Obsidian markdown to `stage2-detail/`; coverage auditor (`pipeline/coverage.ts`) with pure-code uncited-unit diff + targeted Claude gap-audit loop (3 rounds, 95% threshold); narrative stage (`pipeline/narrative.ts` + `prompts/narrative.ts`) with canon writer (first-run) + arc extender (chapter mode) writing to `stage3-narrative/`; `compileNarrative()` added to `compile/index.ts`; runner now fires background path (2→2.5→3) after fast path with `onStageComplete` callback; galaxy route re-persists to SQLite after each background stage. All new code typechecks clean.
- 2026-04-10 — **proxy skeleton landed** (`scholarsystem/proxy/`): Bun+Hono workspace member, worker pool with concurrency cap, workspace manager with single-writer locks + TTL sweep + crash recovery, rehydrate-from-blob, 4 session endpoints (files/run-SSE/compile/delete), SSE stream helper, proxy-client on the API server side. Typechecks clean. `@scholarsystem/shared` exports field added.
- 2026-04-10 — **schema v2 landed in `shared/types/`**: chapter-prefixed `Slug` + new `ChapterId`/`SourceUnitId`, `source` restructured into `chapters[]` with stable numbered `units[]`, `meta.chapters[]` upload history, `sourceRefs.min(1)` on `Concept`/`Subtopic`/`Topic`/`ConceptDetail`/`Relationship`, `narrative` split into frozen `canon` + append-only `arcs[]`, `pipeline.coverageAudit` stage added, `SCHEMA_VERSION` bumped to 2, mutability zones rewritten in `galaxy.ts`. Prior server code under `server/src/pipeline/` + `fixtures/sample-galaxy.ts` + `db/store.ts` will not typecheck against the new shapes — expected, that code is being rewritten in step 3 of the backend revamp
- 2026-04-10 — backend architecture locked to **workspace-proxy + Obsidian markdown** model: Claude Code operates on per-galaxy workspace directories on a VPS proxy, stages read/write frontmatter+wikilink markdown notes, compile step walks folders into the Galaxy blob. Accuracy guarantee via stable source-unit chunks + mandatory `sourceRefs` citations + pure-code coverage auditor + targeted gap-audit Claude call. Chapter extensions first-class: `meta.chapters[]`, frozen `narrative.canon` + extendable `narrative.arcs[]`, position-locked layout, append-only mutability. Chapter-prefixed slugs enforced in `Slug` Zod schema. Sonnet 4.6 default across Stages 1–5; Opus/Haiku only in Stage 6 via `modelTier`. Supersedes prior spawner + TAB-delimited approach. Context files updated — `.context/`
- 2026-04-10 — black-hole launch sequence replaces straight-up rocket: 5-phase cinematic (VP slide → entry spiral → steady-state hold ≥3s → shrink → fade) with tunnel-of-stars (radial streaks + inward acceleration + wrap), tangent-aligned spiraling rocket, stage gets sucked into the void via `.launching` scale-down/blur/fade. `parallaxBoost` repurposed as the unified tunnel-intensity knob that now also visibly drives `warp()` and `zoomOut()`/`zoomIn()` — feat/chat-page
- 2026-04-10 — palette swap: warm purple void → deep cosmic dark navy/black, cooler nebula palette, cool off-white text, refined tagline weight/sizing, more letterspacing on the wordmark — feat/chat-page
- 2026-04-10 — chat landing iteration: removed cursor parallax/light entirely (calmer ambient model), tightened input glow, added Lissajous ambient camera drift, added tagline + keyboard hint line + supported-formats footer, added `SCHOLAR SYSTEM` wordmark beside the logo — feat/chat-page
- 2026-04-10 — unified history system (`HistoryButton` + `HistoryOverlay`) replaces `OrbitingRecents`; one component, responsive interpolation desktop↔mobile, capped 980px column on desktop, translucent backdrop with `Renderer.zoomOut()`/`zoomIn()` camera pull-back, scroll-triggered IntersectionObserver reveals, first-time debut glow on the button — feat/chat-page
- 2026-04-10 — mobile system landed: bottom-pinned input via `useVisualViewport`, safe-area padding, sparser starfield (80 stars), tightened chrome, swapped logo↔history-button positions on mobile — feat/chat-page
- 2026-04-10 — `scholarsystem/client/` scaffolded from scratch: Vite + Vue 3 + TS strict + Tailwind v4 (CSS-first) + Vue Router + GSAP + Motion-V + ESLint + Prettier + Bun. Galaxy renderer foundation, chat landing page, fake submit + localStorage scaffolding — feat/chat-page
- 2026-04-09 — landed canonical galaxy schema as Zod in `shared/types/` (11 scopes: meta, source, knowledge, detail, relationships, narrative, spatial, visuals, scenes, progress, pipeline); full design rationale in `.context/SCHEMA.md` — main
- 2026-04-09 — Claude Code spawner + smoke-test script in `server/src/lib/spawner.ts` and `server/src/scripts/test-spawner.ts` — main
- 2026-04-09 — scaffolded `scholarsystem/` project folder with client/server/shared subtree per ABOUT.md — main
