# server-gemini

Alternate backend for Scholar System — direct Gemini API calls, 3-stage
pipeline, SQLite + filesystem hybrid storage. Runs on the same port as
`apps/server/` (default `8889`) so the frontend doesn't need to know
which backend is live.

Full design rationale: `.context/plan.md`.

## Dev

```bash
cp .env.example .env           # then edit and add GOOGLE_API_KEY
bun install                    # from the repo root
bun run dev                    # from this folder
```

Stop the Claude-Code stack (`apps/server/` + `apps/proxy/`) before running
this one — only one backend binds port 8889 at a time.

## API

| Method | Path | What |
|---|---|---|
| `GET` | `/api/health` | liveness |
| `POST` | `/api/galaxy/create` | multipart (files + optional text) OR JSON `{text, title}` → creates a galaxy, kicks off the pipeline in the background, returns the status envelope immediately |
| `GET` | `/api/galaxy/:id` | status envelope + cached `GalaxyData` (fills in progressively as stages complete) |
| `GET` | `/api/galaxy/:id/raw` | just the `GalaxyData` — byte shape matches `galaxy-data 1.json` |
| `GET` | `/api/galaxy/:id/media/:filename` | streams an uploaded source file |
| `GET` | `/api/galaxy` | list all galaxies |

Frontend polling: the orchestrator re-parses the mesh after every stage
and caches the result in SQLite, so each poll of `GET /api/galaxy/:id`
returns strictly more content than the previous one.

## Pipeline

```
upload
  ↓
ingest         ── parallel per source  (Gemini 2.5 Flash, inlineData for PDFs/images)
  ↓
cluster        ── one Flash call       (partition sources → 3-7 solar systems)
  ↓
outline        ── parallel per system  (Gemini 2.5 Pro, planet+concept outlines)
  ↓
expand-planet  ─┐
                ├ parallel fan-out     (Gemini 2.5 Pro, 1500+ word bodies)
expand-concept ─┘
  ↓
story-pitch    ── one Pro call         (3-6 story plans)
  ↓
write-stories  ── parallel per story   (Pro, full long-form narratives)
  ↓
parse mesh → GalaxyData → cache in SQLite → done
```

Every parallel fan-out goes through `lib/concurrency.ts` — one knob (the
`concurrency` arg) per stage controls how many in-flight Gemini calls it
allows. Start small and raise until you hit per-minute quota.

## Workspace layout

Runtime state lives under this app's folder (gitignored):

```
apps/server-gemini/
  galaxies.db                    SQLite index + cached GalaxyData
  galaxies/<galaxy-id>/
    media/
      sources/<filename>         original uploaded files
      generated/                 (stage 4, reserved)
    mesh/
      (Source) <Title>.md        one per upload
      (Solar System) <Title>.md
      (Planet) <Title>.md
      (Concept) <Title>.md
      (Story) <Title>.md
```

The markdown mesh is the source of truth for generated content — you can
`ls` it, read the files directly, or hand-edit during debugging. The
SQLite db just holds upload metadata, job status, and a cached parse of
the mesh for fast `GET /:id` reads.

## Deleting the experiment

This folder is self-contained and disposable per the plan. To drop the
whole bake-off:

```bash
rm -rf apps/server-gemini
```

Nothing in `apps/server/`, `apps/proxy/`, `apps/client/`, or
`packages/shared/` imports from here.
