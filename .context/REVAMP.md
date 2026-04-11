# Scholar System — Pivot History

---

## v4: Narrative Galaxy — Markdown Mesh (current)

### The Concept

**Upload anything -> AI writes a workspace of typed markdown files -> explore it as a 3D galaxy with stories.**

The data model moved from a JSON blob in SQLite to a **markdown mesh** — a workspace folder of typed markdown files that Claude Code writes directly. No JSON compilation step, no SQLite for content. The markdown IS the data.

### What Changed (v3 -> v4)

| Aspect | v3 (wrap galaxy) | v4 (narrative galaxy) |
|---|---|---|
| **Data model** | JSON blob in SQLite | **Markdown mesh** (workspace of `.md` files) |
| **Entity types** | Cluster, Group, Entry, Wrap | **Solar System, Planet, Concept, Story** |
| **Pipeline** | 4 stages (0->1->2->2.5) | **3 stages** (Ingest/Structure/Stories) |
| **Per-node content** | Wrap card (headline, stats, mood) | **Rich prose** (planets) + **narrative** (stories) |
| **Stories** | None | **Character-driven narratives** (thousands of words) |
| **Source of truth** | JSON blob in SQLite | **Markdown files in workspace** |
| **Connections** | Relationship edges (6 types, weight) | **Wikilinks** `[[(Type) Name]]` in frontmatter |
| **Visual params** | EntryKind + mood + color | **Entity type** (solar system/planet/concept) |
| **Coverage model** | Derivatives, source units, 95% gate | **Dropped** — CC writes directly from sources |

### What's Preserved from v3

- 3D force-directed graph concept (Three.js)
- Chat landing + history UI
- Backend swapability at the client boundary (the old proxy/Claude worker architecture was preserved during the bake-off, but `apps/server-gemini/` is now the live backend)
- File extractors (PDF, text, etc.)
- Solar system drill-down navigation (repurposed for new entity types)

### The v4 Pipeline

```
1. Ingest     -> (Source) files with summaries           (Claude Code session)
2. Structure  -> (Solar System), (Planet), (Concept)     (Claude Code session)
3. Stories    -> (Story) files                           (Claude Code session)
```

Each stage is a Claude Code session that runs in a loop until the output validates.

### Entity Types

| Type | What it is | Visual |
|---|---|---|
| **(Source)** | Summary of an uploaded file. Ground truth. | Not rendered |
| **(Solar System)** | Root document. Description + planet/concept lists. | Solar system overview |
| **(Planet)** | Concrete knowledge node. Self-contained. | Orbiting body |
| **(Concept)** | Flexible node — theme, technique, pattern, person. | Floating soul fragment |
| **(Story)** | Long-form narrative arc. Character visits planets. | Story reader sidebar |

### Key Design Decisions

- **Planets are self-contained** — no concept-connections on planets. Concepts connect TO planets.
- **Stories are independent** — not owned by a solar system. Can span across solar systems.
- **Stories are literature** — thousands of words with character development.
- **Concepts define character motivation** — each story character goes on the journey because of the concepts.
- **Journeys are themed, not geographic** — a character visits planets from any solar system.
- **WikiLinks bridge markdown and JSON** — markdown uses `[[(Type) Name]]`, JSON API uses UUIDs. Server builds a `WikiLinkIndex` to bridge them.

---

## v3: Wrap-Based Memory Galaxy (superseded)

### The Concept

**Upload anything -> AI discovers structure -> every node gets a Spotify-Wrapped-style card -> explore as 3D galaxy.**

Every cluster was a solar system. Every entry was a planet/moon/comet/star. Click any node for a *wrap* — headline, summary, stats, mood, source provenance. Pipeline was 4 stages (0->1->2->2.5). Schema was 7 scopes in a JSON blob stored in SQLite.

### What Changed (v2 -> v3)

| Aspect | v2 (memory bank) | v3 (wrap galaxy) |
|---|---|---|
| **Per-node content** | Detail text + source refs | **Wrap card** (headline, summary, stats, mood, color, highlights, key facts, connections) |
| **Stage 3** | Theming (aesthetic) | **Dropped** — each wrap has its own mood/color |
| **Stage 4** | Layout (3D positions) | **Dropped** — frontend force-graph computes positions |
| **Stage 5** | Visuals (Three.js params) | **Dropped** — frontend derives from kind + mood + color |
| **Pipeline** | 5 stages (0->1->2->2.5->3) | **4 stages** (0->1->2->2.5) |
| **Schema scopes** | 10 | **7** |

---

## The One-Liner

**"Upload your data. AI builds a galaxy. Explore it with stories."**
