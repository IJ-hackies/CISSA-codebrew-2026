import { Hono } from "hono";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createWorkspace,
  destroyWorkspace,
  hasWorkspace,
  touchWorkspace,
  workspaceDir,
  acquireWriteLock,
  releaseWriteLock,
} from "../workspace/manager";
import { rehydrateWorkspace } from "../workspace/rehydrate";
import { submitStreaming } from "../worker/pool";
import { sseResponse } from "../lib/sse";
import type { Galaxy } from "@scholarsystem/shared";

export const sessionRoutes = new Hono();

// ─── POST /session/:id/files ──────────────────────────────────────
// Upload files into a workspace. The API server calls this to seed
// source files before running a stage, or to push a blob for
// rehydration on extension requests.
//
// Body: { files: Record<relativePath, content>, blob?: Galaxy }
//   - files: each key is a path relative to the workspace root
//     (e.g. "sources/w1/raw.md"), value is UTF-8 content
//   - blob: if present, rehydrate the workspace from this blob first
//     (used for chapter extensions — the proxy TTL'd the old workspace)
sessionRoutes.post("/:id/files", async (c) => {
  const galaxyId = c.req.param("id");
  const body = await c.req.json<{
    files?: Record<string, string>;
    blob?: Galaxy;
  }>();

  // Rehydrate from blob if this is an extension request
  if (body.blob) {
    await rehydrateWorkspace(galaxyId, body.blob);
  } else if (!hasWorkspace(galaxyId)) {
    await createWorkspace(galaxyId);
  }

  touchWorkspace(galaxyId);
  const dir = workspaceDir(galaxyId);

  // Write files into the workspace
  if (body.files) {
    const writes = Object.entries(body.files).map(async ([relPath, content]) => {
      const absPath = join(dir, relPath);
      await mkdir(join(absPath, ".."), { recursive: true });
      await writeFile(absPath, content, "utf-8");
    });
    await Promise.all(writes);
  }

  return c.json({ ok: true, workspace: dir });
});

// ─── POST /session/:id/run ────────────────────────────────────────
// Execute a Claude Code session against the workspace. Streams
// progress as SSE events and returns the final result as the last
// event. Requires the single-writer lock.
//
// Body: { prompt: string, model?: string }
sessionRoutes.post("/:id/run", async (c) => {
  const galaxyId = c.req.param("id");
  const { prompt, model } = await c.req.json<{
    prompt: string;
    model?: string;
  }>();

  if (!hasWorkspace(galaxyId)) {
    return c.json({ error: "no workspace — call /files first" }, 404);
  }

  if (!acquireWriteLock(galaxyId)) {
    return c.json(
      { error: "session already has an active run" },
      409,
    );
  }

  touchWorkspace(galaxyId);
  const dir = workspaceDir(galaxyId);
  const { response, send, close } = sseResponse(c);

  // Run in background — the response is the SSE stream
  (async () => {
    try {
      const result = await submitStreaming(
        { prompt, cwd: dir, model },
        (line) => send("progress", { line }),
      );
      send("done", {
        ok: result.ok,
        exitCode: result.exitCode,
        durationMs: result.durationMs,
      });
    } catch (err) {
      send("error", {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      releaseWriteLock(galaxyId);
      close();
    }
  })();

  return response;
});

// ─── GET /session/:id/compile ─────────────────────────────────────
// Read all stage folders and return the raw file listing for the
// API server's compile step. The compile logic (frontmatter parse +
// wikilink walk + Zod validation) lives server-side, not here —
// the proxy is dumb storage + Claude Code runner.
//
// Response: { files: Record<relativePath, content> }
sessionRoutes.get("/:id/compile", async (c) => {
  const galaxyId = c.req.param("id");

  if (!hasWorkspace(galaxyId)) {
    return c.json({ error: "no workspace" }, 404);
  }

  touchWorkspace(galaxyId);
  const dir = workspaceDir(galaxyId);
  const files: Record<string, string> = {};

  // Recursively read all .md files in the workspace
  async function walk(base: string, prefix: string): Promise<void> {
    const entries = await readdir(base, { withFileTypes: true });
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(join(base, entry.name), rel);
      } else if (entry.name.endsWith(".md")) {
        files[rel] = await readFile(join(base, entry.name), "utf-8");
      }
    }
  }

  await walk(dir, "");
  return c.json({ files });
});

// ─── DELETE /session/:id ──────────────────────────────────────────
// Tear down a workspace immediately (don't wait for TTL).
sessionRoutes.delete("/:id", async (c) => {
  const galaxyId = c.req.param("id");

  if (!hasWorkspace(galaxyId)) {
    return c.json({ ok: true }); // idempotent
  }

  await destroyWorkspace(galaxyId);
  return c.json({ ok: true });
});
