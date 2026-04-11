// Galaxy routes. Mirrors the call shapes the existing client in
// `apps/client/src/lib/api.ts` already uses so the frontend doesn't need
// to know which backend is live:
//
//   POST /api/galaxy/create             → { id, title, status, galaxy }
//   GET  /api/galaxy/:id                → full GalaxyData (+ status envelope)
//   GET  /api/galaxy/:id/media/:filename → streamed file
//
// The frontend polls GET /api/galaxy/:id while the pipeline runs. We
// re-parse the mesh after every stage in the orchestrator, so each poll
// returns progressively more solar systems / planets / stories.

import { Hono, type Context } from "hono";
import { writeFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { ensureGalaxyDirs, galaxyPaths } from "../workspace/layout";
import {
  createGalaxyRow,
  getGalaxyRow,
  insertSourceRow,
  insertSubmission,
  listSubmissions,
  loadCachedGalaxyData,
  updateGalaxyStatus,
  deleteGalaxyRow,
  listGalaxiesByUser,
  setGalaxyUserId,
  type SourceRow,
} from "../db/client";
import { runPipeline } from "../pipeline/run";
import { runAppendPipeline } from "../pipeline/append";
import { emptyGalaxy, type GalaxyData } from "../types";

const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB cumulative

export const galaxyRoutes = new Hono();

// ── Mime inference ─────────────────────────────────────────────────
//
// Bun File.type is often empty for drag-drop, so fall back to extension.

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".tiff": "image/tiff",
};

function inferMime(file: File): string {
  if (file.type) return file.type;
  const ext = extname(file.name).toLowerCase();
  return EXT_MIME[ext] ?? "application/octet-stream";
}

// Filenames are user-provided — strip path separators so we can't write
// outside the galaxy's media directory.
function sanitizeUploadName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/\s+/g, "_").trim();
  return base || `upload-${randomUUID().slice(0, 8)}`;
}

// ── Input resolution ───────────────────────────────────────────────
//
// Two paths: multipart (with files + optional text) and JSON (pure paste).
// Returns the list of files we want to persist to media/sources along
// with the derived galaxy title.

interface ResolvedInput {
  title: string;
  files: Array<{ buf: Buffer; name: string; mimeType: string }>;
  rawText?: string; // pasted text (for submission log)
}

async function resolveCreateInput(c: Context): Promise<ResolvedInput> {
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.parseBody({ all: true });

    const rawFiles = form["file"];
    const fileArr: File[] = Array.isArray(rawFiles)
      ? rawFiles.filter((f): f is File => typeof f !== "string")
      : rawFiles && typeof rawFiles !== "string"
        ? [rawFiles as File]
        : [];

    const titleField = typeof form["title"] === "string" ? (form["title"] as string).trim() : "";
    const textField = typeof form["text"] === "string" ? (form["text"] as string).trim() : "";

    if (fileArr.length === 0 && !textField) {
      throw new Error("at least one file or a non-empty text field is required");
    }

    const totalFileBytes = fileArr.reduce((sum, f) => sum + f.size, 0);
    const textBytes = textField ? Buffer.byteLength(textField, "utf8") : 0;
    if (totalFileBytes + textBytes > MAX_TOTAL_BYTES) {
      throw new Error(`combined upload exceeds ${MAX_TOTAL_BYTES} byte limit`);
    }

    const files: ResolvedInput["files"] = [];
    for (const f of fileArr) {
      const buf = Buffer.from(await f.arrayBuffer());
      files.push({ buf, name: f.name, mimeType: inferMime(f) });
    }

    // Pasted text becomes its own synthetic source file.
    if (textField) {
      files.push({
        buf: Buffer.from(textField, "utf8"),
        name: "pasted.txt",
        mimeType: "text/plain",
      });
    }

    const title = titleField || "Untitled";
    return { title, files, rawText: textField || undefined };
  }

  // JSON (pure paste)
  let body: { text?: string; title?: string; filename?: string | null };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    throw new Error("invalid JSON body");
  }
  const text = (body.text ?? "").trim();
  if (!text) throw new Error("text is required");

  return {
    title: (body.title ?? body.filename ?? "Untitled").trim() || "Untitled",
    rawText: text,
    files: [
      {
        buf: Buffer.from(text, "utf8"),
        name: body.filename ?? "pasted.txt",
        mimeType: "text/plain",
      },
    ],
  };
}

// ── POST /api/galaxy/create ────────────────────────────────────────

galaxyRoutes.post("/create", async (c) => {
  let resolved: ResolvedInput;
  try {
    resolved = await resolveCreateInput(c);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "invalid request", message }, 400);
  }

  const galaxyId = randomUUID();
  const ownerToken = randomUUID();
  const paths = ensureGalaxyDirs(galaxyId);
  createGalaxyRow(galaxyId, resolved.title, ownerToken);

  // Tie galaxy to authenticated user
  const jwtPayload = c.get("jwtPayload") as { sub?: string };
  if (jwtPayload?.sub) setGalaxyUserId(galaxyId, jwtPayload.sub as string);

  // Persist files to media/sources/ and index them in SQLite.
  const now = Date.now();
  for (const f of resolved.files) {
    const safeName = sanitizeUploadName(f.name);
    const destRelative = safeName;
    const destAbsolute = join(paths.mediaSources, safeName);
    writeFileSync(destAbsolute, f.buf);

    const row: SourceRow = {
      id: randomUUID(),
      galaxyId,
      filename: f.name,
      mediaPath: destRelative,
      mimeType: f.mimeType,
      byteSize: f.buf.byteLength,
      createdAt: now,
    };
    insertSourceRow(row);
  }

  // Record the submission for the chat log.
  insertSubmission({
    id: randomUUID(),
    galaxyId,
    text: resolved.rawText ?? null,
    filenames: resolved.files.filter((f) => f.name !== "pasted.txt").map((f) => f.name),
    createdAt: now,
  });

  // Kick off the pipeline in the background. The route returns immediately.
  runPipeline(galaxyId).catch((err) => {
    console.error(`[routes/create] pipeline crashed for ${galaxyId}:`, err);
  });

  const row = getGalaxyRow(galaxyId)!;
  return c.json(
    {
      id: row.id,
      title: row.title,
      status: row.status,
      stageDetail: row.stageDetail,
      ownerToken,
      galaxy: emptyGalaxy(),
    },
    201,
  );
});

// ── GET /api/galaxy/:id ────────────────────────────────────────────

galaxyRoutes.get("/:id", (c) => {
  const id = c.req.param("id");
  const row = getGalaxyRow(id);
  if (!row) return c.json({ error: "galaxy not found", id }, 404);

  const galaxy: GalaxyData = loadCachedGalaxyData(id) ?? emptyGalaxy();

  return c.json({
    id: row.id,
    title: row.title,
    status: row.status,
    stageDetail: row.stageDetail,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isPublic: row.isPublic,
    tagline: row.tagline,
    galaxy,
  });
});

// ── GET /api/galaxy/:id/raw ────────────────────────────────────────
// Returns the GalaxyData directly, matching the byte shape of the
// `galaxy-data 1.json` fixture — useful for diffing against the old
// backend's output and for a future frontend that doesn't need the
// status envelope.

galaxyRoutes.get("/:id/raw", (c) => {
  const id = c.req.param("id");
  const row = getGalaxyRow(id);
  if (!row) return c.json({ error: "galaxy not found", id }, 404);
  const galaxy = loadCachedGalaxyData(id) ?? emptyGalaxy();
  return c.json(galaxy);
});

// ── GET /api/galaxy/:id/media/:filename ────────────────────────────

galaxyRoutes.get("/:id/media/:filename", async (c) => {
  const id = c.req.param("id");
  const filename = c.req.param("filename");
  // Defense in depth — never let a `..` component through.
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return c.json({ error: "invalid filename" }, 400);
  }
  const paths = galaxyPaths(id);
  // Look in sources/ first, then generated/
  for (const dir of [paths.mediaSources, paths.mediaGenerated]) {
    const full = join(dir, filename);
    if (existsSync(full) && statSync(full).isFile()) {
      const file = Bun.file(full);
      return new Response(file);
    }
  }
  return c.json({ error: "media not found", id, filename }, 404);
});

// ── POST /api/galaxy/:id/append ────────────────────────────────────
// Add new content to an existing galaxy. Same input shape as /create.
// Returns an envelope immediately; the append pipeline runs in background.

galaxyRoutes.post("/:id/append", async (c) => {
  const id = c.req.param("id");
  const row = getGalaxyRow(id);
  if (!row) return c.json({ error: "galaxy not found", id }, 404);
  if (row.status !== "complete" && row.status !== "error") {
    return c.json({ error: "galaxy is still processing", status: row.status }, 409);
  }

  let resolved: ResolvedInput;
  try {
    resolved = await resolveCreateInput(c);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "invalid request", message }, 400);
  }

  const paths = ensureGalaxyDirs(id);
  const now = Date.now();
  for (const f of resolved.files) {
    const safeName = sanitizeUploadName(f.name);
    const destAbsolute = join(paths.mediaSources, safeName);
    writeFileSync(destAbsolute, f.buf);

    insertSourceRow({
      id: randomUUID(),
      galaxyId: id,
      filename: f.name,
      mediaPath: safeName,
      mimeType: f.mimeType,
      byteSize: f.buf.byteLength,
      createdAt: now,
    });
  }

  insertSubmission({
    id: randomUUID(),
    galaxyId: id,
    text: resolved.rawText ?? null,
    filenames: resolved.files.filter((f) => f.name !== "pasted.txt").map((f) => f.name),
    createdAt: now,
  });

  // Mark as queued and run the append pipeline in background.
  updateGalaxyStatus(id, "queued", "appending new content");

  runAppendPipeline(id).catch((err) => {
    console.error(`[routes/append] pipeline crashed for ${id}:`, err);
  });

  const updatedRow = getGalaxyRow(id)!;
  const galaxy = loadCachedGalaxyData(id) ?? emptyGalaxy();

  return c.json({
    id: updatedRow.id,
    title: updatedRow.title,
    status: updatedRow.status,
    stageDetail: updatedRow.stageDetail,
    galaxy,
  }, 202);
});

// ── GET /api/galaxy/:id/submissions ────────────────────────────────

galaxyRoutes.get("/:id/submissions", (c) => {
  const id = c.req.param("id");
  const row = getGalaxyRow(id);
  if (!row) return c.json({ error: "galaxy not found", id }, 404);
  return c.json({ submissions: listSubmissions(id) });
});

// ── DELETE /api/galaxy/:id ─────────────────────────────────────────

galaxyRoutes.delete("/:id", (c) => {
  const id = c.req.param("id");
  const row = getGalaxyRow(id);
  if (!row) return c.json({ error: "galaxy not found", id }, 404);
  deleteGalaxyRow(id);
  return c.json({ ok: true, id });
});

// ── GET /api/galaxy (list) ─────────────────────────────────────────

galaxyRoutes.get("/", (c) => {
  const jwtPayload = c.get("jwtPayload") as { sub?: string };
  const userId = jwtPayload?.sub as string | undefined;
  if (!userId) return c.json({ galaxies: [] });
  return c.json({ galaxies: listGalaxiesByUser(userId) });
});
