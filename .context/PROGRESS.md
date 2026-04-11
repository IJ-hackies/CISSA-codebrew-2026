# Progress

Living log of what's done. Update this whenever a stage advances or a meaningful piece lands.

> **PIVOT v4 (2026-04-11):** Project pivoted to narrative galaxy with markdown mesh. Data model moved from JSON blob in SQLite to typed markdown files. Entity types changed from clusters/groups/entries/wraps to solar systems/planets/concepts/stories. Pipeline simplified from 4 stages to 3 (Ingest/Structure/Stories). Stories are long-form character-driven narratives. See REVAMP.md for full history.

## Current State

### Schema & Design (Flint)
Status: **complete**

- [x] v4 entity type definitions (Source, Solar System, Planet, Concept, Story)
- [x] JSON API types (GalaxyData, SolarSystem, Planet, Concept, Story, WikiLinkIndex)
- [x] Server parsing specification (3-step: index, parse, assemble)
- [x] Frontend wikilink resolution spec
- [x] Journey shard with complete pipeline workflows, templates, and skills
- [x] Onboarding document for teammates

### Frontend — Chat Landing
Status: **complete** (carries over from v3)
- [x] Chat landing page (logo, wordmark, tagline, input, drag-drop)
- [x] History system (HistoryButton + HistoryOverlay)
- [x] Mobile system (bottom-pinned input, safe-area)
- [x] Galaxy renderer foundation (ambient cosmic void, nebulae, stars, shooting stars)
- [x] Black-hole launch sequence (submit -> rocket -> warp -> galaxy)
- [x] Background polish — drifting/breathing nebula blobs, dot grid overlay, hero glow, noise texture, edge vignette

### Frontend — 3D Galaxy
Status: **partially carries over** — Three.js scene, force-graph, camera system carry over. Data model integration needs rewrite for v4 entity types.

- [x] Three.js scene manager (useThreeScene composable — bloom, OrbitControls, starfield, resize)
- [x] 3D force-directed graph — galaxy view (GalaxyView.vue, d3-force-3d)
- [x] Particle stream edges
- [x] Camera fly-in + GSAP transition with warp-speed effect
- [x] Solar system drill-down (SolarSystemView.vue)
- [x] HTML overlay labels (3D->2D projection)
- [x] Warp-speed effect
- [x] Stats page (StatsView.vue)
- [x] Mobile support
- [ ] Rewrite data layer for v4 entity types (SolarSystem/Planet/Concept instead of Cluster/Group/Entry)
- [ ] Story reader sidebar
- [ ] Concept overlay (floating soul fragment)
- [ ] Wikilink rendering in markdown bodies

### Backend — Pipeline
Status: **needs rewrite for v4**

The v3 pipeline code exists but operates on the old data model (JSON blob, clusters/groups/entries, wraps). For v4:
- [ ] Workspace parser — read `Mesh/` directory, parse frontmatter, build WikiLinkIndex, assemble GalaxyData
- [ ] API route — serve GalaxyData JSON from parsed workspace
- [ ] Pipeline orchestration — invoke Claude Code sessions for each stage (Ingest/Structure/Stories)
- [ ] Media serving — serve files from `Media/Media/`

Existing infrastructure that carries over:
- [x] Proxy (apps/proxy/) — Claude Code worker pool, per-galaxy workspaces
- [x] File extractors (pipeline/parsing/extract/) — PDF, text, etc.
- [x] Proxy client (lib/proxy-client.ts) — fan-out infra

### Shared Types
Status: **needs rewrite for v4**

- [ ] Rewrite `packages/shared/types/` for v4 types (SolarSystem, Planet, Concept, Story, GalaxyData)
- [ ] Remove v3 types (Cluster, Group, Entry, Wrap, etc.)

---

## Changelog

_Newest at top._

- 2026-04-11 — **PIVOT v4: Narrative Galaxy — Markdown Mesh** — data model moved from JSON blob to markdown mesh. Entity types: Source, Solar System, Planet, Concept, Story. Pipeline: 3 stages (Ingest/Structure/Stories). Stories are character-driven narratives. Journey shard built with workflows, templates, skills. Schema spec complete.
- 2026-04-11 — (superseded) PIVOT v3: Wrap-based Memory Galaxy — every node is a Spotify-Wrapped card. Pipeline 4 stages. Schema 7 scopes. Replaced by v4 same day.
- 2026-04-11 — (superseded) Phase 4: v3 pipeline cleanup — 18 old files deleted
- 2026-04-11 — (superseded) Phase 3: v3 runner + API
- 2026-04-11 — (superseded) Phase 2: v3 pipeline rebuild
- 2026-04-11 — (superseded) Phase 1: v3 Schema
- 2026-04-11 — Frontend polish pass — galaxy/solar system labels, bloom tuning, warp-speed effect, exploration UI, mobile fixes, landing page background effects
- 2026-04-11 — 3D frontend complete — GalaxyView, SolarSystemView, WrapCard, StatsView, useThreeScene, useWarpEffect, mockGalaxy fixture
- 2026-04-10 — Stages 2, 2.5, 3 implemented (v2 pipeline, superseded)
- 2026-04-10 — Proxy skeleton landed
- 2026-04-10 — Chat landing, history, mobile, black-hole launch
- 2026-04-09 — Project scaffolded
