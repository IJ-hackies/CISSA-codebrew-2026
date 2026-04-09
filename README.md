# Scholar System

AI-powered learning platform that turns study material into an explorable galaxy — topics are solar systems, subtopics are planets, concepts are interactive scenes generated on demand by Claude.

## PLS READ OMG  (yes claude wrote most of these)

1. **Get context fast.** Run the `/recontext` skill in Claude Code. It reads `.context/ABOUT.md` and grounds Claude in what this project is, how the pipeline works, and the conventions we've agreed on.
2. **Read `.context/ABOUT.md` yourself too.** It's the single source of truth for product vision, the four-stage content pipeline, visual system, API design, prompt engineering notes, and key design decisions. If something about the project isn't clear, the answer is probably in there.
3. **`.claude/` and `.context/` live at the repo root.** All actual project code lives inside `scholarsystem/`.
4. **When you finish a feature, tell Claude "update progress.md".** `.context/PROGRESS.md` is our living log of what's done across the four pipeline stages. Every time you land something meaningful (a stage checkbox, a branch merged, a feature working end-to-end), ask Claude to update it so the next person running `/recontext` sees the current state. Don't skip this — it's how we stay coherent when we're all working async.

## Prerequisites

Install these before you touch the code:

- **[Bun](https://bun.sh/)** — our backend runtime. `curl -fsSL https://bun.sh/install | bash` (or the Windows installer). Check with `bun --version`.
- **[Node.js](https://nodejs.org/)** (LTS) — needed for the Vue/Vite frontend tooling even though the backend uses Bun. Check with `node --version`.
- **[Claude Code](https://docs.claude.com/en/docs/claude-code)** — the dev pipeline shells out to local Claude Code spawner scripts, so you need it installed and authenticated. Run `claude` once to log in before trying to run the content pipeline.
- **Git** — obviously.

## Tech stack

**Frontend (Vue + Vite)** — Vue 3, Vite, TypeScript, Tailwind, Vue Router, HTML Canvas / SVG for galaxy & scene rendering. (cos vue is good for animation frontend apparently)

**Backend (Bun + Hono)** — Bun runtime, Hono web framework, TypeScript, SQLite (via Bun built-in) for storage. (bun fast, fast is nice)

**AI / content** — abuse claude code + sonnet 4.6 for structure extraction, galaxy theming, and streamed scene generation. `pdf-parse` for PDF ingest.

**Deployment** — we figure out later lol, gonna need to deploy a seperate proxy server to host a claude code instance as well

Deliberately **not** using: accounts/auth, Redis, Postgres, S3, AI image gen, WebSockets. See ABOUT.md for the reasoning.

## File structure

```
CISSA-codebrew-2026/
├── .claude/                  # Claude Code config, skills
├── .context/                 # Project context (ABOUT.md — read this)
└── scholarsystem/            # All project code lives here
    ├── client/               # Vue 3 frontend (components, composables, lib, types)
    ├── server/               # Bun + Hono backend (routes, pipeline, prompts, db, lib)
    └── shared/               # Shared TypeScript types between client & server
```

Detailed per-file breakdown (every component, composable, pipeline stage, prompt file) is in `.context/ABOUT.md` under **Project Structure**.
