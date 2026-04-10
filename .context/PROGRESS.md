# Progress

Living log of what's done. Update this whenever a stage advances or a meaningful piece lands. `/recontext` reads this file.

> **PIVOT v3 (2026-04-11):** Project pivoted to wrap-based memory galaxy. Every node is a Spotify-Wrapped-style card. Pipeline simplified to 4 stages (0→1→2→2.5). Stages 3–6 dropped. Schema reduced to 7 scopes. `detail` merged into `wraps`. No narrative, no layout stage, no visuals stage, no scenes. Frontend derives all visuals from `EntryKind` + wrap `mood` + `color`. See REVAMP.md for full details.

## Stages

### Schema v3 (`shared/types/`)
Status: **complete** — landed on `feat/schema-context`

- [x] `galaxy.ts` — 7 scopes (meta, source, knowledge, relationships, wraps, exploration, pipeline)
- [x] `knowledge.ts` — Cluster, Group, Entry with `EntryKind` (7 kinds)
- [x] `relationships.ts` — `RelationshipEdge` with `EdgeType` (6 types), `weight`, `label`
- [x] `wraps.ts` — `ClusterWrap`, `GroupWrap`, `EntryWrap`, `Mood`, `WrapStat`, `WrapFact`, `WrapConnection`, `Derivative`
- [x] `exploration.ts` — visited, bookmarked, optional positions
- [x] `pipeline.ts` — 4 stages (ingest, structure, wraps, coverage)
- [x] `meta.ts` / `source.ts` / `ids.ts` — minor updates
- [ ] Delete old scope files (detail, narrative, spatial, visuals, scenes, conversations, progress)
- [ ] Mock galaxy fixture for frontend development

### Frontend — Chat Landing
Status: **complete** — `pivot/frontend`
- [x] Chat landing page (logo, wordmark, tagline, input, drag-drop)
- [x] History system (HistoryButton + HistoryOverlay)
- [x] Mobile system (bottom-pinned input, safe-area)
- [x] Galaxy renderer foundation (ambient cosmic void, nebulae, stars, shooting stars)
- [x] Black-hole launch sequence (submit → rocket → warp → galaxy)
- [x] Custom resize grip (1:1 cursor tracking compensates for flex recentering)
- [x] Background polish — drifting/breathing nebula blobs, dot grid overlay, hero glow, noise texture, edge vignette
- [x] Placeholder copy updated for memory bank purpose

### Frontend — 3D Galaxy
Status: **complete** — `pivot/frontend`

- [x] Three.js scene manager (`useThreeScene` composable — bloom, OrbitControls, starfield, resize)
- [x] 3D force-directed graph — galaxy view (`GalaxyView.vue`, d3-force-3d, cluster nodes as glowing spheres)
- [x] Particle stream edges (animated points between cluster nodes)
- [x] Camera fly-in + GSAP transition to solar system with warp-speed star effect (`useWarpEffect`)
- [x] Solar system drill-down (`SolarSystemView.vue` — central sun, entry nodes by kind, orbit lines)
- [x] Wrap card overlay (`WrapCard.vue` — full Spotify-Wrapped-style modal with stats, highlights, connections)
- [x] HTML overlay labels (3D→2D projection, opacity fade by distance, readable at all zoom levels)
- [x] Spam-click guard (`navigating` ref)
- [x] Warp-speed effect — outward on enter, inward on exit (`useWarpEffect.ts`)
- [x] Exploration UI — arc ring progress per cluster (galaxy), visited dot per entry (solar system)
- [x] Stats page (`StatsView.vue` — SVG arc ring, per-cluster breakdown)
- [x] Mobile support — larger cameraZ, back button moved to bottom, hover disabled on touch

### Frontend — Superseded (to be deleted)
- 2D Canvas renderer, SVG skill tree, SVG planet view, concept scene view
- `visualEngine.ts`, `layoutEngine.ts`, `sceneAssets.ts`

### Backend — Pipeline Rebuild
Status: **Phase 4 complete** — all old files deleted, typechecks clean on `feat/schema-context`

**Reusable (no/minimal changes):**
- [x] Stage 0 chunker (`pipeline/chunker.ts`) — updated for v3 ChapterEntry shape
- [x] Stage 0 extractors (`pipeline/parsing/extract/`) — fully reusable
- [x] Proxy (`proxy/`) — fully reusable, zero changes
- [x] SQLite store (`db/store.ts`) — fully reusable
- [x] Proxy client (`lib/proxy-client.ts`) — fan-out infra reusable
- [x] `lib/blob.ts` — rewritten for v3 (4 pipeline stages, 7 scopes, status:"complete")

**Rewritten (Phase 2):**
- [x] Stage 1 prompt (`prompts/structure.ts`) — cluster/group/entry vocabulary, EntryKind, aggressive relationship discovery
- [x] Stage 1 logic (`pipeline/skeleton.ts`) — adapted for v3 knowledge shape, addedNodeIds
- [x] Stage 2 prompt (`prompts/wraps.ts`) — NEW: per-node wrap prompt (cluster/group/entry variants)
- [x] Stage 2 logic (`pipeline/wraps.ts`) — NEW: fan-out ALL nodes (clusters+groups+entries), replaces detail.ts
- [x] Compile step (`pipeline/compile/index.ts`) — compileStructure() for v3, compileWraps() replaces compileDetail()
- [x] Stage 2.5 coverage (`pipeline/coverage.ts`) — adapted for v3 (wraps derivatives, EntryKind, stage name "coverage")

**Rewritten (Phase 3):**
- [x] Pipeline runner (`runner.ts`) — sequential 0→1→2→2.5, no background path, no layout/narrative/visuals
- [x] API routes (`routes/galaxy.ts`) — scene endpoints + imports removed
- [x] Test script (`scripts/test-pipeline.ts`) — updated for v3 summary (clusters/groups/entries, wraps, edges)

**Deleted (Phase 4):**
- [x] `pipeline/layout.ts`, `pipeline/narrative.ts`, `pipeline/visuals.ts`, `pipeline/scene.ts`, `pipeline/detail.ts`
- [x] `pipeline/worldgen/layout.ts`
- [x] `pipeline/parsing/structure.ts`, `pipeline/parsing/detail.ts`, `pipeline/parsing/parseDetailLines.ts`, `pipeline/parsing/parseStructureLines.ts`
- [x] `prompts/narrative.ts`, `prompts/detail.ts`, `prompts/scenes.ts`, `prompts/worldgen/visuals.ts`, `prompts/parsing/detail.ts`, `prompts/parsing/structure.ts`
- [x] `lib/spawner.ts`, `scripts/test-spawner.ts`

---

## Changelog

_Newest at top._

- 2026-04-11 — **Phase 4: Cleanup complete** — deleted 18 old files (pipeline stages 3–6, old prompts, old parsing, spawner, test-spawner, worldgen/layout). Only remaining type error is a pre-existing pdf-parse library type mismatch in `extract/pdf.ts`. — `feat/schema-context`
- 2026-04-11 — **Phase 3: Runner + API complete** — runner.ts rewritten (sequential 0→1→2→2.5, no background path), routes/galaxy.ts cleaned (scene endpoints removed), test-pipeline.ts updated for v3. All Phase 3 files typecheck clean; remaining errors are from Phase 4 deletion targets. — `feat/schema-context`
- 2026-04-11 — **Phase 1: Schema v3 complete** — all 10 type files in `shared/types/` written (galaxy, knowledge, relationships, wraps, exploration, pipeline, meta, source, ids, index). Cluster/Group/Entry replaces Topic/Subtopic/Concept. 7 scopes, 4 pipeline stages. — `feat/schema-context`
- 2026-04-11 — **Phase 2: Pipeline Rebuild complete** — compile/index.ts rewritten (compileStructure v3, compileWraps), prompts/structure.ts v3 (cluster/group/entry, EntryKind, aggressive relationships), prompts/wraps.ts NEW (per-node wrap generation), pipeline/skeleton.ts v3, pipeline/wraps.ts NEW (replaces detail.ts, fans out all nodes), pipeline/coverage.ts v3, lib/blob.ts v3, chunker.ts + ingest.ts patched — `feat/schema-context`
- 2026-04-11 — **Frontend polish pass** — galaxy/solar system label readability, bloom tuning, warp-speed effect, exploration UI (arc rings + visited dots), mobile zoom/layout fixes, custom resize grip with flex-centering compensation, landing page background effects (nebula breathe, dot grid, hero glow, noise). — `pivot/frontend`
- 2026-04-11 — **3D frontend complete** — GalaxyView, SolarSystemView, WrapCard, StatsView, useThreeScene, useWarpEffect, mockGalaxy fixture. Full navigation flow working with GSAP + warp transitions. — `pivot/frontend`
- 2026-04-11 — **PIVOT v3: Wrap-based Memory Galaxy** — every node is a Spotify-Wrapped card. Pipeline simplified to 4 stages. Schema reduced to 7 scopes. Stages 3–6 dropped. Frontend derives visuals from kind+mood+color. Context files fully rewritten. — `feat/major-revamp`
- 2026-04-11 — (superseded) PIVOT v2: Interactive Memory Galaxy — intermediate direction, replaced by v3 same day
- 2026-04-11 — Parallel sub-session fan-out for Stage 2 + Stage 5 — `main`
- 2026-04-10 — Flint-informed extraction pipeline rewrite + Stage 5 visuals — `feat/pipeline-stage5-and-stage12-revamp`
- 2026-04-10 — Stages 2, 2.5, 3 implemented — `feat/refined-proxy`
- 2026-04-10 — Proxy skeleton landed — `scholarsystem/proxy/`
- 2026-04-10 — Schema v2 landed — `shared/types/`
- 2026-04-10 — Chat landing, history, mobile, black-hole launch — `feat/chat-page`
- 2026-04-10 — Client scaffolded — `feat/chat-page`
- 2026-04-09 — Galaxy schema as Zod — `main`
- 2026-04-09 — Project scaffolded — `main`
