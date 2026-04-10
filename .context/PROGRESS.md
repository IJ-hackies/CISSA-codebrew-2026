# Progress

Living log of what's done. Update this whenever a stage advances or a meaningful piece lands. `/recontext` reads this file.

> **PIVOT v3 (2026-04-11):** Project pivoted to wrap-based memory galaxy. Every node is a Spotify-Wrapped-style card. Pipeline simplified to 4 stages (0→1→2→2.5). Stages 3–6 dropped. Schema reduced to 7 scopes. `detail` merged into `wraps`. No narrative, no layout stage, no visuals stage, no scenes. Frontend derives all visuals from `EntryKind` + wrap `mood` + `color`. See REVAMP.md for full details.

## Stages

### Schema v3 (`shared/types/`)
Status: **not started** — first priority on `revamp/backend`

- [ ] `galaxy.ts` — 7 scopes (meta, source, knowledge, relationships, wraps, exploration, pipeline)
- [ ] `knowledge.ts` — Cluster, Group, Entry with `EntryKind` (7 kinds)
- [ ] `relationships.ts` — `RelationshipEdge` with `EdgeType` (6 types), `weight`, `label`
- [ ] `wraps.ts` — `ClusterWrap`, `GroupWrap`, `EntryWrap`, `Mood`, `WrapStat`, `WrapFact`, `WrapConnection`, `Derivative`
- [ ] `exploration.ts` — visited, bookmarked, optional positions
- [ ] `pipeline.ts` — 4 stages (ingest, structure, wraps, coverage)
- [ ] `meta.ts` / `source.ts` / `ids.ts` — minor updates
- [ ] Delete old scope files (detail, narrative, spatial, visuals, scenes, conversations, progress)
- [ ] Mock galaxy fixture for frontend development

### Frontend — Chat Landing
Status: **complete** (pre-pivot, survives as-is with minor copy changes)
- [x] Chat landing page (logo, wordmark, tagline, input, suggestion chips, drag-drop)
- [x] History system (HistoryButton + HistoryOverlay)
- [x] Mobile system (bottom-pinned input, safe-area)
- [x] Galaxy renderer foundation (ambient cosmic void, nebulae, stars)
- [x] Black-hole launch sequence
- [ ] **Stubbed** — submit handler + WebGL post-fx

### Frontend — 3D Galaxy (teammate's workstream)
Status: **not started** — planned on `revamp/frontend`

- [ ] Three.js scene manager
- [ ] 3D force-directed graph (galaxy view)
- [ ] Node rendering (EntryKind → mesh, mood+color → appearance)
- [ ] Edge rendering (EdgeType + weight → line style)
- [ ] Camera system (OrbitControls + GSAP transitions)
- [ ] Solar system drill-down
- [ ] Wrap card overlay (DOM, Spotify-Wrapped-style)
- [ ] Background / atmosphere (starfield, nebula, bloom, god rays)
- [ ] Stats page reframe

### Frontend — Superseded (to be deleted)
- 2D Canvas renderer, SVG skill tree, SVG planet view, concept scene view
- `visualEngine.ts`, `layoutEngine.ts`, `sceneAssets.ts`

### Backend — Pipeline Rebuild
Status: **not started** — planned on `revamp/backend`

**Reusable (no/minimal changes):**
- [x] Stage 0 chunker (`pipeline/chunker.ts`) — fully reusable
- [x] Stage 0 extractors (`pipeline/parsing/extract/`) — fully reusable
- [x] Proxy (`proxy/`) — fully reusable, zero changes
- [x] SQLite store (`db/store.ts`) — fully reusable
- [x] Proxy client (`lib/proxy-client.ts`) — fan-out infra reusable
- [x] Stage 2.5 coverage core logic (`pipeline/coverage.ts`) — mostly reusable

**Needs rewrite:**
- [ ] Stage 1 prompt (`prompts/structure.ts`) — new vocabulary, EntryKind, aggressive connection discovery
- [ ] Stage 1 logic (`pipeline/skeleton.ts`) — adapt for new knowledge shape
- [ ] Stage 2 prompt — new: wrap-structured output (headline, summary, body, mood, color, stats, highlights, keyFacts, connections, derivatives)
- [ ] Stage 2 logic — adapt fan-out for wrap generation (cluster/group wraps first, then entry wraps in parallel)
- [ ] Compile step (`pipeline/compile/`) — new scope shapes (wraps instead of detail+narrative+visuals)
- [ ] Pipeline runner (`runner.ts`) — simplified: just 0→1→2→2.5, no background path
- [ ] API routes — simplified endpoints

**To delete:**
- [ ] Stage 3 narrative (`pipeline/narrative.ts`, `prompts/narrative.ts`)
- [ ] Stage 4 layout (`pipeline/layout.ts`)
- [ ] Stage 5 visuals (`pipeline/visuals.ts`, `prompts/worldgen/visuals.ts`)
- [ ] Old compile functions (`compileNarrative`, `compileVisuals`, `compileSpatial`)

---

## Changelog

_Newest at top._

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
