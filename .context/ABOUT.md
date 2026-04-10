# Scholar System

> **PIVOT (v3): Wrap-based Memory Galaxy.** Every node in the galaxy is a "wrap" — like Spotify Wrapped or TikTok Wrap. Upload your data, AI discovers structure and connections, every cluster/group/entry gets its own rich wrap card. Explore the result as a 3D force-directed galaxy. Pipeline is 4 stages (down from 7). No narrative, no visuals stage, no scene generation. The wrap IS the product.

## What Is This?

Scholar System is an AI-powered knowledge organizer that transforms any body of information — a year of journal entries, historical texts, photo archives, text message exports, lecture notes — into a navigable 3D galaxy where every node is a wrap.

**Think:** Claude builds you an entire Obsidian vault from a single upload, wraps every node like Spotify Wrapped, then you explore it as a 3D cosmos.

Core thesis: spatial exploration + visible connections + engaging wrap-style presentation makes data *alive*. A filing cabinet stores information; a galaxy lets you *see* how everything relates and experience each piece as a beautiful, self-contained summary.

---

## How It Works

### User Experience

1. **Upload.** Paste text, upload PDFs, drop photos, or describe what you want organized. No account required.
2. **Watch your galaxy form.** The system parses content in real time. Solar systems appear as clusters are identified.
3. **Explore the galaxy.** A 3D force-directed graph — like Obsidian's graph view, but cosmic-themed. Each solar system is a cluster (a month, a theme, a person). Glowing edges show cross-cluster connections. Freely rotatable, zoomable.
4. **Click a solar system.** See its cluster wrap — "Your March 2024: 23 memories, 5 key people, the month you moved." Stats, highlights, mood. Then drill in to see individual entries.
5. **Click an entry.** See its wrap card — a Spotify-Wrapped-style presentation with headline, summary, key facts, mood, source provenance, and links to related entries. Every planet/moon/comet is its own wrap.
6. **Follow connections.** Cross-cluster links let you jump from a March memory to a July one that references the same person. The graph makes these connections visible and navigable.
7. **Extend.** Upload more data to an existing galaxy. New solar systems appear, new connections form, wraps generate for new nodes.
8. **Share.** Every galaxy gets a unique URL.

### Content Pipeline

**Architecture: Claude Code + Obsidian-markdown workspace on a proxy server.** Each galaxy has a session directory containing stage folders populated with markdown notes carrying YAML frontmatter and `[[wikilink]]` cross-references. Pipeline stages are Claude Code sessions invoked through the proxy's HTTP+SSE API. A compile step produces the canonical `Galaxy` JSON blob stored in SQLite.

**The blob is the source of truth; the workspace is scratchpad.**

**Accuracy model — derivatives, not trust.** Every wrap entry carries `derivatives[]` — verbatim quoted passages that word-match the source text. Unit-level coverage (95% gate) + word-level coverage (quality metric) verified by pure code after Stage 2.

**Stage 0 — Ingest & Chunk.** Pure code. Extracts text, hashes for provenance, chunks into stable numbered units (`w1-s-0001`, `w1-s-0002`, …). Mints an empty blob.

**Stage 1 — Structure.** Single Claude Code session, Sonnet 4.6. Reads ALL source units and produces: clusters → groups → entries hierarchy, initial relationship edges, and a dispatch plan routing source units to Stage 2 agents. Also produces auxiliary files (`_map.md` for thematic groupings, `_structure.md`, `_etc.md`). The relationship graph is the hero output — Stage 1 should aggressively discover connections (temporal, causal, involves, references, contrasts).

**Stage 2 — Wraps (parallel per-node sub-sessions).** Each entry gets its own isolated proxy sub-session with a focused Claude Code agent (Sonnet 4.6) that produces a wrap. Sub-sessions run in parallel, bounded by the proxy worker pool. Output: a wrap file per node with headline, summary, body (entries only), mood, color, stats, highlights, key facts, connections, `# Derivatives` section, and `# Relations` section. Cluster and group wraps run first (they see the full picture), then entry wraps fan out in parallel. Implementation reuses the existing `fanOutSubSessions` infrastructure.

**Stage 2.5 — Coverage Audit.** Unchanged. Unit-level (95% gate) + word-level. Gap auditor closes coverage gaps with derivative quotes. Max 3 rounds.

**That's the entire pipeline. Four stages.**

**What's gone:**
- Stage 3 (narrative/theming) — no galaxy-wide narrative. Each node's wrap has its own mood/color.
- Stage 4 (layout) — frontend force-graph computes 3D positions from knowledge + relationships.
- Stage 5 (visuals) — frontend derives body appearance from `EntryKind` + wrap `mood` + `color`. All procedural.
- Stage 6 (scenes) — the wrap IS the content. No NPCs, no challenges, no dialogue.

**Chapter extensions.** Upload additional data → Stage 0 chunks new data → Stage 1 structures new nodes + discovers cross-chapter relationships → Stage 2 generates wraps for new nodes only → Stage 2.5 audits coverage. Existing wraps and positions untouched.

---

## The Visual System

**Philosophy: 3D force-directed graph with wrap-driven theming.**

The galaxy is a Three.js scene with a force-directed layout. Node appearance is derived from two things the pipeline already produces: `EntryKind` (which mesh shape) and wrap `mood` + `color` (which colors/effects).

**EntryKind → body mesh:**
| Kind | Body | Visual |
|---|---|---|
| `moment` | Moon | Small, smooth |
| `person` | Planet | Large, atmospheric |
| `place` | Planet | Textured, grounded |
| `theme` | Star | Glowing, emissive |
| `artifact` | Comet | Trailing particles |
| `milestone` | Large moon | Bright, prominent |
| `period` | Ringed planet | Rings, expansive |

**Mood → color/effects:** The wrap's `mood` and `color` fields drive the node's color palette, glow intensity, and particle effects. "Joyful" = warm glow; "melancholic" = cool, dim; "energetic" = bright, fast particles. All computed client-side from two scalar fields — zero Claude calls.

**Three zoom levels:**
1. **Galaxy view** — all clusters as solar systems in a 3D force graph. Edges visible between systems.
2. **Solar system view** — drill into a cluster. Entries visible as planets/moons/comets. Local connections visible.
3. **Wrap view** — click any node. DOM overlay with the wrap card (Spotify-Wrapped-style). Blurred 3D background.

---

## Tech Stack

**Frontend.** Vue 3 + Vite + TypeScript, Tailwind v4, Vue Router, Three.js, three-forcegraph (or 3d-force-graph), GSAP.

**Backend.** Bun + Hono + TypeScript:
- **API server** (`scholarsystem/server/`) — SQLite blob store, pipeline orchestrator, pure-code stages.
- **Workspace proxy** (`scholarsystem/proxy/`) — Claude Code worker pool, per-galaxy workspaces.

**Shared types** in `shared/` — Zod schemas, single source of truth.

**AI.** All Claude calls via Claude Code. Sonnet 4.6 for Stages 1–2. No model-tier routing needed (no heavy/light distinction without scenes).

**Storage.** SQLite, single table. Blob is source of truth.

**Deliberately not used.** No Redis, Postgres, S3, auth, AI image gen, WebSocket. UUID URL = access key. SSE for pipeline progress.

---

## Project Structure

- `scholarsystem/client/` — Vue 3 + Three.js frontend
- `scholarsystem/server/` — Bun + Hono API server, pipeline stages, prompts, compile step
- `scholarsystem/proxy/` — Workspace manager + Claude Code worker pool (unchanged)
- `scholarsystem/shared/` — Zod schemas + derived TS types
