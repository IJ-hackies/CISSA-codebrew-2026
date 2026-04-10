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

### Backend v2 — Workspace Proxy + Obsidian Markdown Rewrite
Status: **design locked, implementation not started** — supersedes the earlier spawner + TAB-delimited Stage 1 + in-memory Stage 2 approach. The prior backend work under `server/src/pipeline/parsing/` (ingest, structure, detail, extractors) and `pipeline/worldgen/layout.ts` is being superseded; extractor dispatch + the SQLite store carry over, everything else is rebuilt.

**Schema changes (do first — blocks everything else):**
- [ ] `source.chapters[].units[]` — stable numbered source units (`w1-s-0001`), immutable once written
- [ ] `meta.chapters[]` — upload history (`id`, `uploadedAt`, `filename`, `addedKnowledgeIds`, `addedBodyIds`)
- [ ] `narrative.canon` vs `narrative.arcs[]` split — canon frozen after first generation, arcs append per chapter
- [ ] `sourceRefs: Slug[]` with `.min(1)` on every `knowledge` node, `detail` entry, and `relationships` edge
- [ ] `Slug` schema extended to require chapter prefix (`^[a-z][a-z0-9]*-[a-z][a-z0-9-]*$`)
- [ ] Mutability table updated: append-only (not write-once) for `knowledge`, `detail`, `relationships`, `spatial`, `visuals`; position-lock on `spatial.bodies[].position`

**Workspace proxy (`scholarsystem/proxy/`):**
- [ ] HTTP+SSE Hono server, VPS-deployable
- [ ] Worker pool of long-running Claude Code processes with concurrency cap
- [ ] Per-galaxy workspace directories (`workspaces/<galaxyId>/`) with stage subfolders
- [ ] Endpoints: `POST /session/:id/files`, `POST /session/:id/run`, `GET /session/:id/compile`, `DELETE /session/:id`
- [ ] Rehydration: given a stored blob, reconstruct the workspace for chapter extensions
- [ ] TTL-based idle cleanup; per-session single-writer lock
- [ ] Proxy-client library for the API server (`server/src/lib/proxy-client.ts`), replacing `spawner.ts`

**API server pipeline rewrite (`scholarsystem/server/`):**
- [ ] Stage 0 chunker — pure code, `pipeline/chunker.ts`, produces numbered source units per chapter
- [ ] Stage 1 structure prompt — Obsidian markdown output to `stage1-structure/`, wikilink-based relationships
- [ ] Stage 2 detail prompt — per-topic parallel sandboxes (`stage2-detail/<topic-id>/`), per-concept markdown notes with frontmatter + `sourceRefs`
- [ ] Stage 2.5 coverage auditor — pure-code uncited-unit diff + targeted gap-audit Claude call loop
- [ ] Stage 3 narrative — canon writer (first-run) + arc extender (chapter mode)
- [ ] Stage 4 layout v1 — extension-aware concentric placement with position locks
- [ ] Stage 5 visuals — append-only per-body params from `narrative.canon`
- [ ] Compile step — folder → Galaxy blob via `gray-matter` frontmatter parser + wikilink walker + Zod validation
- [ ] Pipeline orchestrator driving the proxy stage-by-stage with status writes into `pipeline[stage].status`
- [ ] `POST /api/galaxy/create` — first-chapter path
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
