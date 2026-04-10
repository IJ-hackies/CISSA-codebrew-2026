# Scholar System — Wrap-Based Memory Galaxy

## The Concept

**Upload anything → AI discovers structure and connections → every node gets a Spotify-Wrapped-style card → explore it as a 3D galaxy.**

Every cluster is a solar system. Every entry is a planet, moon, comet, or star. Click any node and you get a *wrap* — a beautiful, self-contained summary with stats, highlights, mood, source provenance, and connection links. The galaxy is an Obsidian vault rendered as a cosmos, where every note is a wrap.

---

## What Changed (v2 → v3)

| Aspect | v2 (memory bank) | v3 (wrap galaxy) |
|---|---|---|
| **Per-node content** | Detail text + source refs | **Wrap card** (headline, summary, stats, mood, color, highlights, key facts, connections) |
| **Stage 3** | Theming (aesthetic) | **Dropped** — each wrap has its own mood/color |
| **Stage 4** | Layout (3D positions) | **Dropped** — frontend force-graph computes positions |
| **Stage 5** | Visuals (Three.js params) | **Dropped** — frontend derives from kind + mood + color |
| **Pipeline** | 5 stages (0→1→2→2.5→3) | **4 stages** (0→1→2→2.5) |
| **Schema scopes** | 10 | **7** |
| **`detail` scope** | Separate scope | **Merged into `wraps`** |
| **Visual params** | AI-generated per body | **Client-derived** from `EntryKind` + `Mood` + hex color |

**What's preserved from v2:**
- 3D force-directed graph concept (Three.js + three-forcegraph)
- Vocabulary: Clusters → Groups → Entries
- Relationships as hero feature
- Derivative/coverage accuracy model
- Proxy architecture (unchanged)
- Vue 3 shell + chat landing + history

---

## The Pipeline (Rebuilt)

```
0.  Ingest & Chunk   →  meta, source                    (pure code, mostly reusable)
1.  Structure        →  knowledge, relationships         (Claude — prompts need update)
2.  Wraps            →  wraps{}                          (Claude — new stage, replaces old detail)
2.5 Coverage Audit   →  wraps adjustments                (pure code + Claude — mostly reusable)
```

### Pipeline component status

| Component | Status | Notes |
|---|---|---|
| Stage 0 chunker (`pipeline/chunker.ts`) | **Done** | Patched for v3 ChapterEntry shape |
| Stage 0 extractors (`pipeline/parsing/extract/`) | **Done** | Unchanged, fully reusable |
| Stage 1 skeleton (`pipeline/skeleton.ts`) | **Done** | Rewritten for v3 knowledge shape, addedNodeIds |
| Stage 1 prompt (`prompts/structure.ts`) | **Done** | cluster/group/entry vocabulary, EntryKind, aggressive relationship discovery |
| Stage 2 wraps (`pipeline/wraps.ts`) | **Done** | NEW file, replaces detail.ts. Fans out ALL nodes. |
| Stage 2 prompt (`prompts/wraps.ts`) | **Done** | NEW file. Per-node wrap prompt with cluster/group/entry variants |
| Stage 2.5 coverage (`pipeline/coverage.ts`) | **Done** | Adapted for v3 wraps derivatives, EntryKind, stage name "coverage" |
| Compile step (`pipeline/compile/index.ts`) | **Done** | compileStructure() v3, compileWraps() replaces compileDetail/Narrative/Visuals |
| `lib/blob.ts` | **Done** | v3 pipeline (4 stages), v3 galaxy shape (7 scopes) |
| Stage 2 fan-out infra (`lib/proxy-client.ts`) | **Done** | Unchanged, fully reusable |
| Proxy (`proxy/`) | **Done** | Unchanged, fully reusable |
| SQLite store (`db/store.ts`) | **Done** | Unchanged, fully reusable |
| Pipeline runner (`runner.ts`) | **Done** | Sequential 0→1→2→2.5, no background path |
| API routes (`routes/galaxy.ts`) | **Done** | Scene endpoints removed |
| Test script (`scripts/test-pipeline.ts`) | **Done** | Updated for v3 summary |

### Deleted (Phase 4) — COMPLETE

18 files removed. All old pipeline stages, prompts, parsing, and spawner code deleted. Typecheck clean (only pre-existing pdf-parse library type mismatch remains).

---

## Schema Changes (`shared/types/`) — COMPLETE

All v3 type files are written and exported. Phase 1 is done.

| File | Status |
|---|---|
| `galaxy.ts` | **Done** — 7 scopes (meta, source, knowledge, relationships, wraps, exploration, pipeline) |
| `knowledge.ts` | **Done** — Cluster/Group/Entry with `EntryKind` (7 kinds) |
| `relationships.ts` | **Done** — `RelationshipEdge` with `EdgeType` (6 types), `weight`, `label` |
| `wraps.ts` | **Done** — `ClusterWrap`, `GroupWrap`, `EntryWrap` discriminated union on `level`, `Mood`, `Derivative` |
| `exploration.ts` | **Done** — visited, bookmarked, optional positions |
| `pipeline.ts` | **Done** — 4 stages (ingest, structure, wraps, coverage), `StageState` |
| `ids.ts` | **Done** — unchanged (`Slug`, `ChapterId`, `SourceUnitId`) |
| `source.ts` | **Done** — unchanged |
| `meta.ts` | **Done** — `schemaVersion: 3`, `addedNodeIds` |
| `index.ts` | **Done** — re-exports all |

Old scope files to delete (Phase 4): `detail.ts`, `narrative.ts`, `spatial.ts`, `visuals.ts`, `scenes.ts`, `conversations.ts`, `progress.ts`

---

## Frontend (teammate's workstream)

### What to build

| Component | Description |
|---|---|
| Three.js scene manager | Renderer, camera, controls, post-processing |
| 3D force-directed graph | `three-forcegraph` — nodes from `knowledge`, edges from `relationships` |
| Node rendering | `EntryKind` → mesh shape. `wrap.mood` + `wrap.color` → color/glow/particles |
| Edge rendering | `edge.type` + `edge.weight` → line style/brightness |
| Camera system | OrbitControls + GSAP fly-in/fly-out |
| Solar system drill-down | Click cluster → local force graph of its entries |
| Wrap card overlay | DOM overlay — renders the wrap for any clicked node |
| Background / atmosphere | Starfield particles, nebula fog, bloom, god rays |

### Routes

```
/                                     → Chat landing
/galaxy/:id                           → 3D galaxy graph
/galaxy/:id/cluster/:clusterId        → Solar system drill-down
/galaxy/:id/entry/:entryId            → Wrap card overlay
/galaxy/:id/stats                     → Exploration stats
```

### What the frontend needs from the schema

1. `knowledge` — nodes + hierarchy → force graph structure
2. `relationships.edges` — connections → force graph edges
3. `wraps[nodeId]` — wrap content → click interaction
4. `entries[].kind` + `wraps[].mood` + `wraps[].color` — visual appearance
5. `pipeline` — loading states

---

## Parallel Development Strategy

```
main
 └── feat/major-revamp              ← integration branch
      ├── revamp/frontend            ← teammate: Three.js galaxy + wrap cards
      └── revamp/backend             ← you: schema rewrite + pipeline rebuild
```

**Schema lands first.** Backend writes Zod types in `shared/`, merges to `feat/major-revamp`. Frontend rebases to get real types + builds mock data fixture.

---

## Hackathon Priority

### P0 — Must Ship

1. **Schema v3** in `shared/types/` — the contract both sides build against
2. **3D galaxy graph** — Three.js force-directed, cosmic-themed
3. **Wrap card UI** — click any node → Spotify-Wrapped-style card
4. **Pipeline stages 0→1→2→2.5** — end-to-end from upload to wraps
5. **Upload flow** — landing → upload → galaxy appears
6. **Demo dataset** — pre-processed for instant demo

### P1 — Should Ship

7. **Source provenance** in wrap cards — "built from these passages"
8. **Edge visualization** — type/weight differentiation
9. **Post-processing** — bloom, god rays, cosmic atmosphere
10. **Drill-down transitions** — GSAP camera flights

### P2 — Stretch

11. **Image ingest** — vision model extractor
12. **Chat/message ingest** — WhatsApp/iMessage parsing
13. **Search/filter** — find entries across galaxy
14. **Bookmarks** — save entries for quick return
15. **Position persistence** — `exploration.positions`

---

## The One-Liner

**"Upload your data. Every memory gets wrapped. Explore it as a galaxy."**
