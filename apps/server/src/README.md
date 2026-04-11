# Server layout

Bun + Hono backend for Scholar System. Serves the Galaxy API and orchestrates the 3-stage content pipeline.

> **v4 NOTE:** The server is being rewritten for the markdown mesh architecture. The codebase currently contains v3 code (JSON blob, clusters/groups/entries, wraps) that will be replaced. The target architecture is described below.

## Target Architecture (v4)

The server's primary job is to:
1. **Parse galaxy workspaces** — read `Mesh/` directory, parse frontmatter from typed markdown files, build a WikiLinkIndex, assemble a `GalaxyData` JSON response
2. **Orchestrate the pipeline** — invoke Claude Code sessions for each of the 3 stages (Ingest, Structure, Stories)
3. **Serve media** — serve files from `Media/Media/` for image embeds

## Folder tree

```
src/
├── index.ts           # Hono entry point — wires routes, starts listener
├── routes/            # HTTP surface
│   └── galaxy.ts      # /api/galaxy/:id  (parses workspace, serves GalaxyData)
│
├── pipeline/          # Content pipeline
│   ├── parsing/       # File extraction
│   │   └── extract/   # PDF, text, image extractors (reusable from v3)
│   └── ...            # v3 pipeline code (to be rewritten)
│
├── db/                # SQLite storage (galaxy metadata, not content)
│
├── lib/               # Cross-cutting infrastructure
│   ├── proxy-client.ts  # Claude Code proxy client (reusable)
│   └── ...
│
├── fixtures/          # Sample data for local dev
│
└── scripts/           # Dev/debug CLIs
```

## Key change from v3

The server no longer compiles a JSON blob from pipeline stage outputs. Instead:
- Claude Code writes markdown files directly into the workspace
- The server **parses** those markdown files on demand to produce `GalaxyData`
- The markdown mesh is the source of truth, not a JSON blob

## Running the server

```bash
cd <repo-root>
bun install            # from workspace root
bun run dev:server     # watch mode on :8889
```

Health check: `GET http://localhost:8889/api/health`
