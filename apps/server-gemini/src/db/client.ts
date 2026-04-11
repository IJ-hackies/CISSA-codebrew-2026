// SQLite index for galaxies + uploaded sources + the cached GalaxyData
// parse. The markdown mesh under galaxies/<id>/mesh/ is the source of truth
// for generated content; SQLite is just the bit the filesystem is bad at:
// job status, upload metadata, and fast `GET /api/galaxy/:id` reads.

import { Database } from "bun:sqlite";
import { join } from "node:path";
import { appRoot } from "../workspace/layout";
import type { GalaxyData, GalaxyRow, JobStatus } from "../types";

const DB_PATH = join(appRoot(), "galaxies.db");

let _db: Database | null = null;

export function db(): Database {
  if (_db) return _db;
  _db = new Database(DB_PATH, { create: true });
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS galaxies (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      status          TEXT NOT NULL,
      stage_detail    TEXT NOT NULL DEFAULT '',
      error           TEXT,
      galaxy_data_json TEXT,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id          TEXT PRIMARY KEY,
      galaxy_id   TEXT NOT NULL REFERENCES galaxies(id) ON DELETE CASCADE,
      filename    TEXT NOT NULL,
      media_path  TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      byte_size   INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sources_galaxy_idx ON sources(galaxy_id);
  `);
  return _db;
}

// ── Galaxy rows ────────────────────────────────────────────────────

export function createGalaxyRow(id: string, title: string): GalaxyRow {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO galaxies (id, title, status, stage_detail, created_at, updated_at)
       VALUES (?, ?, 'queued', '', ?, ?)`,
    )
    .run(id, title, now, now);
  return {
    id,
    title,
    status: "queued",
    stageDetail: "",
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getGalaxyRow(id: string): GalaxyRow | null {
  const row = db()
    .prepare(
      `SELECT id, title, status, stage_detail, error, created_at, updated_at
       FROM galaxies WHERE id = ?`,
    )
    .get(id) as
    | {
        id: string;
        title: string;
        status: JobStatus;
        stage_detail: string;
        error: string | null;
        created_at: number;
        updated_at: number;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    stageDetail: row.stage_detail,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listGalaxies(): GalaxyRow[] {
  const rows = db()
    .prepare(
      `SELECT id, title, status, stage_detail, error, created_at, updated_at
       FROM galaxies ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    title: string;
    status: JobStatus;
    stage_detail: string;
    error: string | null;
    created_at: number;
    updated_at: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    stageDetail: row.stage_detail,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateGalaxyStatus(
  id: string,
  status: JobStatus,
  stageDetail = "",
  error: string | null = null,
): void {
  db()
    .prepare(
      `UPDATE galaxies
       SET status = ?, stage_detail = ?, error = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(status, stageDetail, error, Date.now(), id);
}

export function cacheGalaxyData(id: string, data: GalaxyData): void {
  db()
    .prepare(
      `UPDATE galaxies SET galaxy_data_json = ?, updated_at = ? WHERE id = ?`,
    )
    .run(JSON.stringify(data), Date.now(), id);
}

export function loadCachedGalaxyData(id: string): GalaxyData | null {
  const row = db()
    .prepare(`SELECT galaxy_data_json FROM galaxies WHERE id = ?`)
    .get(id) as { galaxy_data_json: string | null } | undefined;
  if (!row || !row.galaxy_data_json) return null;
  try {
    return JSON.parse(row.galaxy_data_json) as GalaxyData;
  } catch {
    return null;
  }
}

// ── Source rows ────────────────────────────────────────────────────

export interface SourceRow {
  id: string;
  galaxyId: string;
  filename: string;
  mediaPath: string; // path relative to galaxies/<id>/media/sources/
  mimeType: string;
  byteSize: number;
  createdAt: number;
}

export function insertSourceRow(row: SourceRow): void {
  db()
    .prepare(
      `INSERT INTO sources (id, galaxy_id, filename, media_path, mime_type, byte_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      row.id,
      row.galaxyId,
      row.filename,
      row.mediaPath,
      row.mimeType,
      row.byteSize,
      row.createdAt,
    );
}

export function listSourceRows(galaxyId: string): SourceRow[] {
  const rows = db()
    .prepare(
      `SELECT id, galaxy_id, filename, media_path, mime_type, byte_size, created_at
       FROM sources WHERE galaxy_id = ? ORDER BY created_at ASC`,
    )
    .all(galaxyId) as Array<{
    id: string;
    galaxy_id: string;
    filename: string;
    media_path: string;
    mime_type: string;
    byte_size: number;
    created_at: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    galaxyId: r.galaxy_id,
    filename: r.filename,
    mediaPath: r.media_path,
    mimeType: r.mime_type,
    byteSize: r.byte_size,
    createdAt: r.created_at,
  }));
}
