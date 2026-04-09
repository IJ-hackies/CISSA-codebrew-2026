# Progress

Living log of what's done. Update this whenever a stage advances, a branch is published, or a meaningful piece lands on main. Keep entries short — one line, dated, with branch/PR if relevant. `/recontext` reads this file, so future sessions will know the current state.

## Stages

### Stage 1 — Ingest & Structure
Status: **text path in progress** (PDFs + parallel detail still TBD)
- [x] Text ingest (hash, excerpt, blank blob) — `pipeline/parsing/ingest.ts`
- [x] Structural analysis prompt + orchestrator (knowledge + relationships, referential integrity check) — `pipeline/parsing/structure.ts`, `prompts/parsing/structure.ts`
- [ ] PDF ingest (`pdf-parse`)
- [ ] Two-pass parallel detail extraction for large inputs (Stage 2)

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

- 2026-04-10 — Stage 1 switched from full-JSON emission to a compact TAB-delimited line format parsed by `pipeline/parsing/parseStructureLines.ts`; prompt rewritten to match; `applyStructureResponse` helper extracted so both `runStructure` + `runStructureFromText` share validation. ~35–50% fewer output tokens, per-row error tolerance instead of all-or-nothing JSON parse failures, brief cap bumped to ~40 words. Blob contract unchanged — Zod still authoritative at the stage boundary, downstream stages / frontend see identical shapes — main
- 2026-04-10 — frontend↔backend integration wired: Vite dev proxy `/api` → `:3000`, new `client/src/lib/api.ts` (`createGalaxy` / `getGalaxy`), `ChatLanding.handleSubmit` now races a real `POST /api/galaxy/create` against the rocket cruise and routes to the real `meta.id` on success; inline error surface on failure. Files-in-input still ignored (text-only backend) — main
- 2026-04-09 — first end-to-end pipeline slice: Stage 0 ingest + Stage 1 structure (Claude via spawner, Zod-validated, referential integrity checks) + Stage 4 deterministic layout, wired through `pipeline/runner.ts`, `POST /api/galaxy/create`, and `scripts/test-pipeline.ts`; SQLite store in `db/store.ts`; reserved `conversations` scope in the schema for future in-scene player↔NPC chat (no version bump needed) — backend-server
- 2026-04-09 — made `scholarsystem/` a Bun workspace root (`scholarsystem/package.json` + `shared/package.json`) so `shared/` can resolve its own `zod` via hoisted root `node_modules`; `bun install` now runs from workspace root, not `server/` — main
- 2026-04-09 — reorganised `server/src/` into phase-grouped pipeline (parsing/storyline/worldgen/gameplay), added `server/src/README.md` + `pipeline/README.md` + `shared/README.md` as teammate navigation docs — main
- 2026-04-09 — landed sample galaxy fixture (`server/src/fixtures/sample-galaxy.ts`) + minimal Hono server serving `GET /api/galaxy/:id` from the fixture, so the frontend branch has a real Galaxy shape to render against before the pipeline is built — main
- 2026-04-09 — landed canonical galaxy schema as Zod in `shared/types/` (11 scopes: meta, source, knowledge, detail, relationships, narrative, spatial, visuals, scenes, progress, pipeline); full design rationale in `.context/SCHEMA.md` — main
- 2026-04-09 — Claude Code spawner + smoke-test script in `server/src/lib/spawner.ts` and `server/src/scripts/test-spawner.ts` — main
- 2026-04-09 — scaffolded `scholarsystem/` project folder with client/server/shared subtree per ABOUT.md — main
