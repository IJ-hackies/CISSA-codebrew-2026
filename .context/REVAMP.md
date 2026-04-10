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

### What's reusable from existing code

| Component | Status | Notes |
|---|---|---|
| Stage 0 chunker (`pipeline/chunker.ts`) | **Fully reusable** | Pure code, content-agnostic |
| Stage 0 extractors (`pipeline/parsing/extract/`) | **Fully reusable** | txt/pdf/docx/pptx |
| Stage 1 skeleton (`pipeline/skeleton.ts`) | **Partially reusable** | Logic reusable, prompt needs rewrite for new vocabulary + aggressive connection discovery + EntryKind assignment |
| Stage 1 prompt (`prompts/structure.ts`) | **Rewrite** | New vocabulary, new output shape (clusters/groups/entries, EntryKind, more relationship types) |
| Stage 2 fan-out infra (`lib/proxy-client.ts`) | **Fully reusable** | `fanOutSubSessions`, `mergeSubSessionFiles` |
| Stage 2 detail logic (`pipeline/detail.ts`) | **Partially reusable** | Fan-out pattern reusable, but output format changes to wraps |
| Stage 2 prompt (`prompts/detail.ts`) | **Rewrite** | New wrap-structured output (headline, summary, body, mood, color, stats, highlights, keyFacts, connections) |
| Stage 2.5 coverage (`pipeline/coverage.ts`) | **Mostly reusable** | Core logic unchanged, just validate wraps instead of detail entries |
| Compile step (`pipeline/compile/`) | **Partial rewrite** | New scope shapes to compile (wraps instead of detail+narrative+visuals) |
| Proxy (`proxy/`) | **Fully reusable** | Infrastructure, zero changes |
| SQLite store (`db/store.ts`) | **Fully reusable** | Blob store, content-agnostic |
| Proxy client (`lib/proxy-client.ts`) | **Fully reusable** | HTTP+SSE client for proxy |

### What's deleted

| Component | Why |
|---|---|
| Stage 3 narrative (`pipeline/narrative.ts`, `prompts/narrative.ts`) | No galaxy-wide narrative — each wrap has its own mood/color |
| Stage 4 layout (`pipeline/layout.ts`) | Frontend force-graph computes positions |
| Stage 5 visuals (`pipeline/visuals.ts`, `prompts/worldgen/visuals.ts`) | Frontend derives visuals from kind + mood + color |
| Pipeline runner's background path (stages 3→4→5) | Only stages 0→1→2→2.5 exist now |
| `compileNarrative()`, `compileVisuals()`, `compileSpatial()` | Scopes no longer exist |

---

## Schema Changes (`shared/types/`)

### Files to rewrite

| File | Change |
|---|---|
| `galaxy.ts` | 7 scopes instead of 12. Drop detail/narrative/spatial/visuals/scenes/conversations/progress. Add wraps/exploration. |
| `knowledge.ts` (or new name) | Cluster/Group/Entry with `EntryKind`. Replaces Topic/Subtopic/Concept. |
| `relationships.ts` | Expanded `EdgeType` (add `temporal`, `causal`, `involves`). Add `weight`, `label`. |
| `wraps.ts` (new) | `WrapBase`, `ClusterWrap`, `GroupWrap`, `EntryWrap`, `Mood`, `WrapStat`, `WrapFact`, `WrapConnection`, `Derivative`. |
| `exploration.ts` (new) | Visited, bookmarked, optional persisted positions. |
| `pipeline.ts` | 4 stages only (ingest, structure, wraps, coverage). |
| `ids.ts` | `Slug`, `ChapterId`, `SourceUnitId` — unchanged. |
| `source.ts` | Unchanged (maybe add optional `mediaUrl`/`mediaType` on units as stretch). |
| `meta.ts` | Mostly unchanged. `schemaVersion: 3`. `addedNodeIds` replaces `addedKnowledgeIds`/`addedBodyIds`. |

### Files to delete

| File | Why |
|---|---|
| `detail.ts` | Merged into wraps |
| `narrative.ts` | Dropped |
| `spatial.ts` | Dropped (frontend computes) |
| `visuals.ts` | Dropped (frontend derives) |
| `scenes.ts` | Dropped |
| `conversations.ts` | Dropped |
| `progress.ts` | Replaced by exploration |

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
