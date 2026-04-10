# Server layout

Bun + Hono backend for Scholar System. The folder structure mirrors the content pipeline so you can find any piece of work by the phase it belongs to.

## Folder tree

```
src/
├── index.ts           # Hono entry point — wires routes, starts listener
├── routes/            # HTTP surface — one file per resource
│   └── galaxy.ts      # /api/galaxy/:id  (serves fixture today, db-backed later)
│
├── pipeline/          # The content pipeline, grouped by phase
│   ├── parsing/       # Stages 0-2: input → knowledge
│   │   ├── ingest.ts      # Stage 0: PDF/text extract, hash, init blob
│   │   ├── structure.ts   # Stage 1: hierarchical knowledge + relationships
│   │   └── detail.ts      # Stage 2: parallel per-concept deep extraction
│   ├── storyline/     # Stage 3: narrative spine
│   │   └── narrative.ts   # Stage 3: galaxy-wide story, arc beats, cast
│   ├── worldgen/      # Stages 4-5: building the game world
│   │   ├── layout.ts      # Stage 4: force-directed spatial layout (pure code)
│   │   └── visuals.ts     # Stage 5: per-body theming
│   └── gameplay/      # Stage 6: on-demand interactive content
│       └── scene.ts       # Stage 6: per-concept scene generation
│
├── prompts/           # All Claude prompts — MIRRORS pipeline/ structure
│   ├── parsing/       # structure.ts, detail.ts
│   ├── storyline/     # narrative.ts
│   ├── worldgen/      # visuals.ts
│   └── gameplay/      # scene.ts
│
├── db/                # SQLite storage (single table: galaxies(id, data JSON))
│
├── lib/               # Cross-cutting infrastructure
│   └── spawner.ts     # Claude Code spawner (dev); swapped for proxy client pre-deploy
│
├── fixtures/          # Hand-authored sample data for local dev
│   └── sample-galaxy.ts  # Valid Galaxy blob, validated at import time
│
└── scripts/           # Dev/debug CLIs, not shipped
    └── test-spawner.ts   # Smoke test for the Claude Code spawner
```

## How to navigate

**"Where does my new file go?"** — pick the phase:

- Parsing a PDF, extracting structure, pulling out details → `pipeline/parsing/`
- Writing the story arc, character voices, narrative tone → `pipeline/storyline/`
- Positioning planets, assigning visuals, building the game world → `pipeline/worldgen/`
- Generating the actual interactive scene the user plays → `pipeline/gameplay/`
- Writing the prompt Claude sees → `prompts/<same-phase>/`
- Adding an HTTP endpoint → `routes/`
- Adding a shared helper (hashing, parallelism, spawning Claude) → `lib/`
- Storing or loading a galaxy from SQLite → `db/`

**"Where does the Galaxy type live?"** — `packages/shared/types/` (imported as `@scholarsystem/shared`). Every file in the pipeline validates its output against the Zod schema there before writing to the blob. Never hand-write types that duplicate those schemas.

**"Where does the pipeline stage order come from?"** — see `pipeline/README.md` and `.context/SCHEMA.md` at the repo root. The stage order is load-bearing: Stage 3 (narrative) blocks on Stage 2 (detail), Stage 4 (layout) runs in parallel with Stage 3, etc.

## Running the server

The repo root is a Bun workspace, so dependencies install from the top (not from inside `apps/server/`). This lets `packages/shared/` resolve its own `zod` out of the hoisted root `node_modules`.

```bash
cd scholarsystem
bun install                        # first time only, from the workspace root
cd server
bun run dev                        # watch mode on :3000
bun run test:spawner "hello"       # smoke test the Claude spawner
```

Health check: `GET http://localhost:8889/api/health`
Fixture galaxy: `GET http://localhost:8889/api/galaxy/anything`
