// Scholar System workspace proxy entry point. Bun + Hono.
//
// This server runs on a VPS and manages per-galaxy workspace
// directories + a Claude Code worker pool. The API server talks
// to it over HTTP+SSE — it never calls Claude Code directly.
//
// Run with:   bun run src/index.ts
// Dev watch:  bun --watch run src/index.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { sessionRoutes } from "./routes/session";
import { recoverFromDisk, sweepIdle } from "./workspace/manager";
import { stats } from "./worker/pool";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) =>
  c.json({ ok: true, service: "scholarsystem-proxy", pool: stats() }),
);

app.route("/session", sessionRoutes);

// ── Startup ───────────────────────────────────────────────────────

await recoverFromDisk();

// Periodic idle-workspace sweep
setInterval(async () => {
  const swept = await sweepIdle();
  if (swept > 0) {
    console.log(`[sweep] cleaned up ${swept} idle workspaces`);
  }
}, config.sweepIntervalMs);

console.log(`[proxy] listening on http://localhost:${config.port}`);
console.log(
  `[proxy] workspaces: ${config.workspacesDir}, max concurrency: ${config.maxConcurrency}, idle TTL: ${config.idleTtlMs}ms`,
);

export default {
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 0, // disable — SSE streams for Claude Code runs can be silent for many minutes while the model thinks
};
