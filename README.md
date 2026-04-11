# Scholar System

An AI-powered platform that transforms uploaded content — PDFs, lecture notes, journals, transcripts, and more — into a navigable 3D galaxy. The system parses source material into structured knowledge nodes, generates long-form character-driven narratives that thread through them, and renders the result as an interactive Three.js cosmos.

Built for **Codebrew 2026** by Team Gin (University of Melbourne).

## Overview

Users upload documents, and a three-stage AI pipeline processes them into a **markdown mesh** — a workspace of typed markdown files that serve as the source of truth:

1. **Ingest** — Parse uploaded files into `(Source)` summaries
2. **Structure** — Discover `(Solar System)` groupings, `(Planet)` knowledge nodes, and `(Concept)` thematic connections
3. **Stories** — Generate `(Story)` files: thousands-of-words narrative arcs where a character journeys across planets

The galaxy is then rendered as a 3D force-directed graph with three zoom levels: galaxy overview, solar system drill-down, and an inline story reader.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Vue 3, Vite, TypeScript, Tailwind CSS v4, Vue Router, Three.js, D3 Force-3D, GSAP |
| **Backend** | Bun, Hono, TypeScript, SQLite (metadata/cache) |
| **AI Pipeline** | Gemini API for content generation and structure extraction |
| **Shared** | TypeScript types via Zod schemas in `packages/shared/` |

Deliberately omitted: accounts/auth, Redis, Postgres, S3, AI image generation, WebSockets. UUIDs serve as access keys; SSE provides pipeline progress updates.

## Project Structure

```
.
├── .claude/                  # Claude Code configuration and skills
├── .context/                 # Project context documentation
├── apps/
│   ├── client/               # Vue 3 + Three.js frontend
│   ├── server-gemini/        # Bun + Hono backend (active — API, pipeline, mesh parsing)
│   ├── server/               # Legacy backend (deprecated)
│   └── proxy/                # Proxy server for worker pool (VPS deployment)
└── packages/
    └── shared/               # Shared TypeScript type definitions
```

## Prerequisites

- [Bun](https://bun.sh/)
- [Node.js](https://nodejs.org/)
- Git

## Getting Started

```bash
bun install              # Install all workspace dependencies
bun run dev              # Start client + server concurrently
```

Individual services:

```bash
bun run dev:client       # Frontend only (port 8888)
bun run dev:server       # Backend only (port 8889)
bun run dev:proxy        # Proxy only (port 8890)
bun run build            # Production build (client)
```

## Development Notes

- The frontend proxies `/api/*` requests from port `8888` to the backend on port `8889`.
- Detailed project context, architecture decisions, and progress tracking are in `.context/ABOUT.md`.
- Claude Code skills are configured in `.claude/` — run `/recontext` to load project context into a Claude Code session.