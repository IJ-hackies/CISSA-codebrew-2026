// server-gemini entry point. Bun + Hono.
//
// Alternate backend for Scholar System. Runs on the same port as
// apps/server/ (default 8889) so the frontend doesn't need to know which
// implementation is live. Full design lives in ../../plan.md at the repo
// root (gitignored) and .context/plan.md.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { galaxyRoutes } from "./routes/galaxy";
import { galleryRoutes } from "./routes/gallery";
import { db } from "./db/client";
import { galaxiesRoot } from "./workspace/layout";

// Warm up SQLite + ensure the galaxies root exists so failures surface at
// boot rather than on the first request.
db();
galaxiesRoot();

const app = new Hono();

app.use("*", cors());

app.get("/api/health", (c) =>
  c.json({ ok: true, service: "scholarsystem-server-gemini" }),
);

app.route("/api/galaxy", galaxyRoutes);
app.route("/api/gallery", galleryRoutes);

const port = Number(process.env.PORT ?? 8889);
console.log(`[server-gemini] listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  // Stages can take minutes — keep the socket alive.
  idleTimeout: 0,
};
