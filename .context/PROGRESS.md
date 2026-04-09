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

### Stage 1 — Ingest & Structure
Status: **text path in progress** (PDFs + parallel detail still TBD)
- [x] Text ingest (hash, excerpt, blank blob) — `pipeline/parsing/ingest.ts`
- [x] Structural analysis prompt + orchestrator (knowledge + relationships, referential integrity check) — `pipeline/parsing/structure.ts`, `prompts/parsing/structure.ts`
- [x] Multi-format ingest (.txt, .md, .markdown, .pdf, .docx, .pptx) via extractor dispatcher — `pipeline/parsing/extract/`
- [x] Stage 2 detail extraction with per-topic parallel fan-out (runs in background from HTTP route; foreground in CLI harness) — `pipeline/parsing/detail.ts`, `prompts/parsing/detail.ts`
- [ ] Source-text chunking for very large inputs (today every chunk re-sends the full raw text)

### Stage 2 — Galaxy Generation
Status: **layout done, visuals pending**
- [x] Deterministic concentric layout of systems/planets/moons/asteroids (v1, pure code) — `pipeline/worldgen/layout.ts`
- [x] SQLite key-value store + round-trip validation — `db/store.ts`
- [x] `POST /api/galaxy/create` runs ingest → structure → layout end-to-end and persists — `routes/galaxy.ts`
- [ ] Upgrade layout v1 → force-directed pass
- [ ] Claude-assigned visual parameters per body (Stage 5)

### Stage 3 — Scene Generation (On-Demand)
Status: **not started**
- [ ] Scene generation prompt + archetype rotation
- [ ] Streamed scene delivery (SSE) to frontend
- [ ] Procedural SVG scene compositor + parallax layers

### Stage 4 — Progress Tracking
Status: **not started**
- [ ] Visited/challenge/score state in galaxy JSON
- [ ] `PATCH /api/galaxy/:id/progress` endpoint
- [ ] Feedback loop into scene generation (reinforce weak concepts)

### Pre-deployment — Claude Code Proxy Migration
Status: **not started** (development uses local Claude Code spawner scripts until this lands)
- [ ] Stand up proxy server wrapping a long-running Claude Code instance
- [ ] Expose HTTP + SSE endpoints mirroring the spawner's request/response shape
- [ ] Swap backend pipeline adapter from spawner → proxy client

---

## Changelog

_Append newest entries at the top. Format: `YYYY-MM-DD — what landed — branch/PR`._

- 2026-04-10 — black-hole launch sequence replaces straight-up rocket: 5-phase cinematic (VP slide → entry spiral → steady-state hold ≥3s → shrink → fade) with tunnel-of-stars (radial streaks + inward acceleration + wrap), tangent-aligned spiraling rocket, stage gets sucked into the void via `.launching` scale-down/blur/fade. `parallaxBoost` repurposed as the unified tunnel-intensity knob that now also visibly drives `warp()` and `zoomOut()`/`zoomIn()` — feat/chat-page
- 2026-04-10 — palette swap: warm purple void → deep cosmic dark navy/black, cooler nebula palette, cool off-white text, refined tagline weight/sizing, more letterspacing on the wordmark — feat/chat-page
- 2026-04-10 — chat landing iteration: removed cursor parallax/light entirely (calmer ambient model), tightened input glow, added Lissajous ambient camera drift, added tagline + keyboard hint line + supported-formats footer, added `SCHOLAR SYSTEM` wordmark beside the logo — feat/chat-page
- 2026-04-10 — unified history system (`HistoryButton` + `HistoryOverlay`) replaces `OrbitingRecents`; one component, responsive interpolation desktop↔mobile, capped 980px column on desktop, translucent backdrop with `Renderer.zoomOut()`/`zoomIn()` camera pull-back, scroll-triggered IntersectionObserver reveals, first-time debut glow on the button — feat/chat-page
- 2026-04-10 — mobile system landed: bottom-pinned input via `useVisualViewport`, safe-area padding, sparser starfield (80 stars), tightened chrome, swapped logo↔history-button positions on mobile — feat/chat-page
- 2026-04-10 — `scholarsystem/client/` scaffolded from scratch: Vite + Vue 3 + TS strict + Tailwind v4 (CSS-first) + Vue Router + GSAP + Motion-V + ESLint + Prettier + Bun. Galaxy renderer foundation, chat landing page, fake submit + localStorage scaffolding — feat/chat-page
- 2026-04-09 — landed canonical galaxy schema as Zod in `shared/types/` (11 scopes: meta, source, knowledge, detail, relationships, narrative, spatial, visuals, scenes, progress, pipeline); full design rationale in `.context/SCHEMA.md` — main
- 2026-04-09 — Claude Code spawner + smoke-test script in `server/src/lib/spawner.ts` and `server/src/scripts/test-spawner.ts` — main
- 2026-04-09 — scaffolded `scholarsystem/` project folder with client/server/shared subtree per ABOUT.md — main
