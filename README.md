## PLS READ OMG

1. **Get context fast.** Run the `/recontext` skill in Claude Code. It reads the relevant context files. If you don't know anything about this project, run recontext then ask claude
2. **Read `.context/ABOUT.md` yourself too.** Almost all details about this project and how it works is in there
3. **`.claude/` and `.context/` live at the repo root.** All actual project code lives inside `scholarsystem/`.
4. **When you finish a feature, tell Claude "update progress.md".** `.context/PROGRESS.md` is our living log of what's done across the four pipeline stages. You can also use `/reupdate` which does that too.

## Prerequisites

Install these before you touch the code:

- **[Bun](https://bun.sh/)**
- **[Node.js](https://nodejs.org/)**
- **[Claude Code](https://docs.claude.com/en/docs/claude-code)** 
- **Git** 

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

## Jorvan's updates
- implemented working claude code spawner
- implemented parser schema (structure can be found in schema.md)
- parser now actually works but not fully refined and complete (stage 2/6)
- parser speed is optimised, stage 2 runs in parallel in the background
- frontend linked to the backend server, can test parser via frontend UI
- implemented support for pdf, docx, pptx, md, markdown

## Jorvan's todo
- add image support (jpg, png, jpeg .etc)
- finish up the parser (stage 3-6), may require frontend coordination
- prepare proxy server (test and debug proxy deployment)
- prepare deployment environment and domain