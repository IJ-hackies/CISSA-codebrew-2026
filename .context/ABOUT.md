# Scholar System

> **PIVOT (v4): Narrative Galaxy — Markdown Mesh.** The data model moved from a JSON blob in SQLite to a **markdown mesh** — a workspace of typed markdown files that Claude Code writes directly. Entity types are now Solar System, Planet, Concept, and Story. Pipeline is 3 stages. Stories are long-form character-driven narratives. The markdown IS the data.

## What Is This?

Scholar System is an AI-powered platform that transforms any uploaded content — PDFs, lecture notes, journals, transcripts, code, PowerPoints — into a navigable 3D galaxy. Users upload data, and the system breaks it into **solar systems** (thematic groupings), **planets** (concrete knowledge nodes), and **concepts** (flexible thematic nodes), then generates long-form **stories** — character-driven narrative arcs where a character travels between planets and is transformed by what they find. The galaxy is rendered as an interactive 3D space with Three.js where planets orbit in solar systems, concepts float as soul fragments, and stories thread everything together.

**Think:** Claude builds you an entire Obsidian vault from a single upload, weaves a narrative through it, then you explore it as a 3D cosmos.

---

## How It Works

### User Experience

1. **Upload.** Paste text, upload PDFs, drop photos, or describe what you want organized. No account required.
2. **Watch your galaxy form.** The system parses content, discovers structure, and writes markdown files.
3. **Explore the galaxy.** A 3D force-directed graph — each solar system is a cluster of planets. Concepts float between them. Freely rotatable, zoomable.
4. **Click a solar system.** Drill into it — see its planets orbiting, concepts floating. Read the solar system description.
5. **Click a planet.** Read dense, detailed prose about that piece of knowledge. Follow wikilinks to related planets and concepts.
6. **Read stories.** Open the story reader — follow a character on their journey across planets, discovering what's there. Each story is thousands of words of real narrative.
7. **Extend.** Upload more data to an existing galaxy. New solar systems appear, new connections form.
8. **Share.** Every galaxy gets a unique URL.

### Content Pipeline

**Architecture: `apps/server-gemini/` is the live backend wired to the frontend.** Each galaxy has a workspace folder containing uploaded media plus a markdown mesh of typed `.md` files with YAML frontmatter and `[[(Type) Name]]` wikilinks. The Gemini pipeline writes the mesh, and the server parses that workspace into the `GalaxyData` JSON the client consumes.

**The markdown mesh is the source of truth.**

**Stage 1 — Ingest.** Parse uploaded files, create `(Source)` markdown files with summaries. One per uploaded file.

**Stage 2 — Structure.** Read all sources, produce `(Solar System)`, `(Planet)`, `(Concept)` files with connections. 3-7 solar systems, each with 5-10 planets and 4-7 concepts. Rich, detailed prose — not summaries. Entities can reclassify (concept <-> planet) during generation.

**Stage 3 — Stories.** Read planets and concepts, write `(Story)` files. Each story follows one character on a themed exploration mission across planets (from any solar system). Concepts define WHY the character goes on the journey. The character discovers what each planet contains. Stories are literature — thousands of words.

**That's the entire pipeline. Three stages.**

**Enrichment.** After Stage 2, if the galaxy feels thin relative to the input, run the Enrich skill — split oversized planets, fill gaps, expand sparse content, create more solar systems.

---

## The Visual System

**Philosophy: 3D force-directed graph with entity-type-driven rendering.**

The galaxy is a Three.js scene with a force-directed layout. Solar systems appear as clusters of orbiting planets. Concepts float between solar systems as soul fragments. Stories thread through the space as narrative paths.

**Three zoom levels:**
1. **Galaxy view** — all solar systems in a 3D force graph. Concepts visible as floating fragments between systems.
2. **Solar system view** — drill into a solar system. Planets visible as orbiting bodies. Local connections visible.
3. **Story reader** — sidebar narrative view. Follow a character through their journey, planet by planet.

---

## Tech Stack

**Frontend.** Vue 3 + Vite + TypeScript, Tailwind v4, Vue Router, Three.js, D3 Force-3D, GSAP.

**Backend.** Bun + Hono + TypeScript:
- **API server** (`apps/server-gemini/`) — live backend used by the frontend. Handles upload, pipeline orchestration, SQLite metadata/cache, mesh parsing, and the `/api/galaxy/*` API on port `8889`.

**Shared types** in `packages/shared/` — TypeScript types for the GalaxyData API.

**AI.** Content generation currently runs through direct Gemini API calls inside `apps/server-gemini/`.

**Deliberately not used.** No Redis, Postgres, S3, auth, SQLite for content. UUID URL = access key. SSE for pipeline progress.

---

## Project Structure

- `apps/client/` — Vue 3 + Three.js frontend
- `apps/server-gemini/` — active Bun + Hono backend used by the frontend
- `packages/shared/` — Shared TypeScript types

## Integration Status

- The frontend is now linked directly to `apps/server-gemini/`.
- Dev flow is `apps/client/` on port `8888` proxying `/api/*` to `apps/server-gemini/` on port `8889`.
- The old `apps/server/` + `apps/proxy/` stack is legacy and can be removed once repo scripts/docs are cleaned up.
