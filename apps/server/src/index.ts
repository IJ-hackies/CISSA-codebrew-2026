// Scholar System server entry point. Bun + Hono.
//
// Run with:   bun run src/index.ts
// Dev watch:  bun --watch run src/index.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import { galaxyRoutes } from "./routes/galaxy";

const app = new Hono();

// CORS open during dev so the Vite dev server can hit the API from a
// different port. Tighten before deployment.
app.use("*", cors());

app.get("/api/health", (c) => c.json({ ok: true, service: "scholarsystem" }));

app.route("/api/galaxy", galaxyRoutes);

const port = Number(process.env.PORT ?? 8889);
console.log(`[server] listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 255, // seconds — Claude Code stages can take minutes
};
