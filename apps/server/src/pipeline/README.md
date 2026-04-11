# Pipeline

The content engine. Takes raw user uploads and produces a galaxy workspace full of typed markdown files.

> **v4 NOTE:** The pipeline is being rewritten. The current code implements the v3 pipeline (JSON blob, 4 stages). The target is below.

## Target: 3-Stage Pipeline (v4)

```
1. Ingest     → (Source) files with summaries           (Claude Code session)
2. Structure  → (Solar System), (Planet), (Concept)     (Claude Code session)
3. Stories    → (Story) files                           (Claude Code session)
```

Each stage is a Claude Code session that writes markdown files into the galaxy workspace's `Mesh/` directory. Claude Code runs in a loop per stage until the output validates.

### Stage 1 — Ingest

Parse uploaded files from `Media/Sources/`. Create one `(Source) Name.md` per file with a summary. The summary must capture enough context that later stages can build planets and concepts without re-reading the raw file.

### Stage 2 — Structure

Read all `(Source)` files. Produce:
- 3-7 `(Solar System)` files — thematic groupings with planet/concept lists
- 5-10 `(Planet)` files per solar system — concrete knowledge nodes, self-contained
- 4-7 `(Concept)` files per solar system — flexible thematic nodes

Output should reflect the size and richness of the input.

### Stage 3 — Stories

Read all planets and concepts. Write `(Story)` files — long-form character-driven narratives (thousands of words). Each story follows one character on a themed exploration mission across planets from any solar system.

## Pipeline orchestration

The server invokes Claude Code sessions via the proxy worker pool. Each stage gets its own session with the workspace mounted. The Journey shard (in the Flint) provides the workflow definitions, templates, and validation rules for each stage.

## What carries over from v3

- File extractors (`pipeline/parsing/extract/`) — PDF, text, etc.
- Proxy client (`lib/proxy-client.ts`) — fan-out infrastructure
- Proxy server (`apps/proxy/`) — Claude Code worker pool
