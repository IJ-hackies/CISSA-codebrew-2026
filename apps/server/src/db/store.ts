// SQLite key-value store for Galaxy blobs.
//
// Single table: galaxies(id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at INTEGER).
// The blob is serialized as JSON — no joins, no columns to maintain. If we
// ever need to scale, the only hot write path is `progress`, and that's the
// clean split point called out in SCHEMA.md.
//
// File path is configurable via SCHOLARSYSTEM_DB env var. Defaults to
// ./scholarsystem.db relative to the server's CWD.

import { Database } from "bun:sqlite";
import { Galaxy } from "@scholarsystem/shared";

const dbPath = process.env.SCHOLARSYSTEM_DB ?? "scholarsystem.db";

const db = new Database(dbPath, { create: true });
db.run(`
  CREATE TABLE IF NOT EXISTS galaxies (
    id         TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// Upsert: pipeline re-runs and progress updates both hit the same row.
const upsertStmt = db.prepare(`
  INSERT INTO galaxies (id, data, created_at)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET data = excluded.data
`);

const selectStmt = db.prepare(`SELECT data FROM galaxies WHERE id = ?`);
const listStmt = db.prepare(`SELECT id, created_at FROM galaxies ORDER BY created_at DESC LIMIT ?`);

export function saveGalaxy(galaxy: Galaxy): void {
  // Validate once here so bad writes fail loudly at the storage boundary,
  // not at the next read. This is the last line of defence against a stage
  // corrupting the blob — it catches anything that slipped past per-stage
  // validation.
  const parsed = Galaxy.parse(galaxy);
  upsertStmt.run(parsed.meta.id, JSON.stringify(parsed), parsed.meta.createdAt);
}

export function loadGalaxy(id: string): Galaxy | null {
  const row = selectStmt.get(id) as { data: string } | null;
  if (!row) return null;
  // Re-parse on read so schema drift between writes and reads surfaces
  // immediately instead of turning into a mysterious frontend crash.
  return Galaxy.parse(JSON.parse(row.data));
}

export function listRecentGalaxies(limit = 20): { id: string; createdAt: number }[] {
  const rows = listStmt.all(limit) as { id: string; created_at: number }[];
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at }));
}
