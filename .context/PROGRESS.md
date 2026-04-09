# Progress

Living log of what's done. Update this whenever a stage advances, a branch is published, or a meaningful piece lands on main. Keep entries short — one line, dated, with branch/PR if relevant. `/recontext` reads this file, so future sessions will know the current state.

## Stages

### Stage 1 — Ingest & Structure
Status: **not started**
- [ ] PDF/text ingest (`pdf-parse`)
- [ ] Structural analysis prompt (knowledge tree JSON)
- [ ] Two-pass parallel detail extraction for large inputs

### Stage 2 — Galaxy Generation
Status: **not started**
- [ ] Force-directed layout of systems/planets
- [ ] Claude-assigned visual parameters per body
- [ ] Serialize galaxy JSON + store in SQLite by UUID

### Stage 3 — Scene Generation (On-Demand)
Status: **not started**
- [ ] Scene generation prompt + archetype rotation
- [ ] Streamed scene delivery (SSE) to frontend
- [ ] Procedural SVG scene compositor + parallax layers

### Stage 4 — Progress Tracking
Status: **not started**
- [ ] Visited/challenge/score state in galaxy JSON
- [ ] `PATCH /api/galaxy/:id/progress` endpoint
- [ ] Feedback loop into scene generation (reinforce weak concepts)

### Pre-deployment — Claude Code Proxy Migration
Status: **not started** (development uses local Claude Code spawner scripts until this lands)
- [ ] Stand up proxy server wrapping a long-running Claude Code instance
- [ ] Expose HTTP + SSE endpoints mirroring the spawner's request/response shape
- [ ] Swap backend pipeline adapter from spawner → proxy client

---

## Changelog

_Append newest entries at the top. Format: `YYYY-MM-DD — what landed — branch/PR`._
