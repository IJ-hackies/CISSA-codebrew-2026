# Stella Taco

Upload anything. Build a galaxy. Explore it. Share it to The Taco

You drop in a PDF, some lecture notes, a journal, a transcript, and Stella Taco breaks it apart into a 3D cosmos you can actually navigate. Solar systems cluster related themes, planets hold content, Little soul fragments float between them representing key concepts. Travel through the galaxy to understand the story and share your galaxies with others on **The Taco**.

---

## What it does

Drop files into the chat. The AI runs three stages:

1. **Ingest**: reads everything you uploaded and summarises each source
2. **Structure**: organises the material into solar systems (thematic clusters), planets (specific knowledge nodes), and concepts (themes, patterns, key figures)
3. **Stories**: writes narratives where a character journeys across the planets, discovering what's on each one.

The output is a navigable 3D space built with Three.js. You can orbit the whole galaxy, click into a solar system to see its planets, open a planet to read dense prose about that piece of knowledge, collect concept "souls", and follow a character through a story that threads everything together.

---

## Why we built it

The tools for preserving knowledge already exist: Wikipedia, Obsidian, Notion, museum digital archives, and they all do the job of storing information. What they don't do well is make you *want* to explore it. What makes the best knowledge experiences actually stick isn't storage but instead navigation. The sense that you're moving through something, not just querying it. The spatial and narrative dimensions are what create memory and connection, and almost every digital knowledge tool strips those out completely.

We took what actually works about those experiences and rebuilt it for personal and cultural archives. The 3D galaxy gives you the spatial quality, you can orbit, zoom in, and notice things at the edges of your view. The stories give you the narrative layer instead of reading a flat summary, and Gemini does the structural work that Obsidian makes you do by hand.

The other problem is access, a cultural archive that only one person can see isn't really preserved, it's just stored. That's where **The Taco** comes in. Every galaxy can be published to a shared public feed where anyone can browse, search, and explore what other people have built, all of it can live in the same place, each with its own galaxy, each discoverable by anyone who stumbles across it.

---

## Tech

- **Frontend**: Vue 3, TypeScript, Tailwind v4, Three.js, D3 Force-3D, GSAP
- **Backend**: Bun, Hono, TypeScript, SQLite (for metadata/cache only)
- **AI**: Gemini API for the content pipeline

---

## Running it locally

```bash
bun install
bun run dev
```

Frontend runs on port `8888`, backend on `8889`. The client proxies `/api/*` to the server automatically.

You'll need a `.env` in `apps/server-gemini/` with a `GEMINI_API_KEY`.

---

## Project structure

```
apps/
  client/          Vue 3 + Three.js frontend
  server-gemini/   Bun + Hono backend (pipeline, mesh parsing, API)
packages/
  shared/          TypeScript types shared between client and server
```
