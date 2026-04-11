// SQLite index for galaxies + uploaded sources + the cached GalaxyData
// parse. The markdown mesh under galaxies/<id>/mesh/ is the source of truth
// for generated content; SQLite is just the bit the filesystem is bad at:
// job status, upload metadata, and fast `GET /api/galaxy/:id` reads.

import { Database } from "bun:sqlite";
import { join } from "node:path";
import { appRoot } from "../workspace/layout";
import type { GalaxyData, GalaxyRow, GalaxyCreateResult, JobStatus } from "../types";

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

    CREATE TABLE IF NOT EXISTS submissions (
      id          TEXT PRIMARY KEY,
      galaxy_id   TEXT NOT NULL REFERENCES galaxies(id) ON DELETE CASCADE,
      text        TEXT,
      filenames   TEXT NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS submissions_galaxy_idx ON submissions(galaxy_id);
  `);

  // Idempotent migrations — ALTER TABLE fails silently if column exists.
  const migrations = [
    `ALTER TABLE galaxies ADD COLUMN owner_token TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE galaxies ADD COLUMN is_public   INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE galaxies ADD COLUMN tagline      TEXT`,
    `ALTER TABLE galaxies ADD COLUMN last_owner_seen_at INTEGER`,
  ];
  for (const sql of migrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  return _db;
}

// ── Galaxy rows ────────────────────────────────────────────────────

export function createGalaxyRow(id: string, title: string, ownerToken: string): GalaxyCreateResult {
  const now = Date.now();
  db()
    .prepare(
      `INSERT INTO galaxies (id, title, status, stage_detail, owner_token, created_at, updated_at)
       VALUES (?, ?, 'queued', '', ?, ?, ?)`,
    )
    .run(id, title, ownerToken, now, now);
  return {
    id,
    title,
    status: "queued",
    stageDetail: "",
    error: null,
    createdAt: now,
    updatedAt: now,
    isPublic: false,
    tagline: null,
    lastOwnerSeenAt: null,
    ownerToken,
  };
}

export function getGalaxyRow(id: string): GalaxyRow | null {
  const row = db()
    .prepare(
      `SELECT id, title, status, stage_detail, error, created_at, updated_at,
              is_public, tagline, last_owner_seen_at
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
        is_public: number;
        tagline: string | null;
        last_owner_seen_at: number | null;
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
    isPublic: row.is_public === 1,
    tagline: row.tagline,
    lastOwnerSeenAt: row.last_owner_seen_at,
  };
}

export function deleteGalaxyRow(id: string): void {
  db().prepare(`DELETE FROM galaxies WHERE id = ?`).run(id);
}

export function listGalaxies(): GalaxyRow[] {
  const rows = db()
    .prepare(
      `SELECT id, title, status, stage_detail, error, created_at, updated_at,
              is_public, tagline, last_owner_seen_at
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
    is_public: number;
    tagline: string | null;
    last_owner_seen_at: number | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    stageDetail: row.stage_detail,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublic: row.is_public === 1,
    tagline: row.tagline,
    lastOwnerSeenAt: row.last_owner_seen_at,
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

export function updateGalaxyTitle(id: string, title: string): void {
  db()
    .prepare(`UPDATE galaxies SET title = ?, updated_at = ? WHERE id = ?`)
    .run(title, Date.now(), id);
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

// ── Submission rows ────────────────────────────────────────────────

export interface SubmissionRow {
  id: string;
  galaxyId: string;
  text: string | null;
  filenames: string[]; // stored as JSON
  createdAt: number;
}

export function insertSubmission(row: SubmissionRow): void {
  db()
    .prepare(
      `INSERT INTO submissions (id, galaxy_id, text, filenames, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(row.id, row.galaxyId, row.text ?? null, JSON.stringify(row.filenames), row.createdAt);
}

export function listSubmissions(galaxyId: string): SubmissionRow[] {
  const rows = db()
    .prepare(
      `SELECT id, galaxy_id, text, filenames, created_at
       FROM submissions WHERE galaxy_id = ? ORDER BY created_at ASC`,
    )
    .all(galaxyId) as Array<{
    id: string;
    galaxy_id: string;
    text: string | null;
    filenames: string;
    created_at: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    galaxyId: r.galaxy_id,
    text: r.text,
    filenames: (() => { try { return JSON.parse(r.filenames) as string[]; } catch { return []; } })(),
    createdAt: r.created_at,
  }));
}

// ── Gallery / Taco functions ───────────────────────────────────────

/** Shape of a public gallery card (no owner_token, no galaxy_data_json). */
export interface GalleryCard {
  id: string;
  title: string;
  tagline: string | null;
  updatedAt: number;
  solarSystemCount: number;
  planetCount: number;
}

/**
 * Check that an owner_token matches a galaxy. Returns the row if valid,
 * null otherwise. Never exposes the token in the return value.
 */
export function verifyOwnerToken(galaxyId: string, ownerToken: string): GalaxyRow | null {
  const row = db()
    .prepare(`SELECT owner_token FROM galaxies WHERE id = ?`)
    .get(galaxyId) as { owner_token: string } | undefined;
  if (!row || row.owner_token !== ownerToken || !ownerToken) return null;
  return getGalaxyRow(galaxyId);
}

export function publishGalaxy(galaxyId: string, tagline: string): void {
  db()
    .prepare(
      `UPDATE galaxies SET is_public = 1, tagline = ?, last_owner_seen_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(tagline, Date.now(), Date.now(), galaxyId);
}

export function unpublishGalaxy(galaxyId: string): void {
  db()
    .prepare(
      `UPDATE galaxies SET is_public = 0, updated_at = ? WHERE id = ?`,
    )
    .run(Date.now(), galaxyId);
}

export function updateGalaxyTagline(galaxyId: string, tagline: string): void {
  db()
    .prepare(`UPDATE galaxies SET tagline = ?, updated_at = ? WHERE id = ?`)
    .run(tagline, Date.now(), galaxyId);
}

/**
 * Touch last_owner_seen_at for all provided galaxyIds where the token matches.
 * Returns the set of IDs that were actually updated (valid token).
 */
export function reconcileOwnership(owned: Array<{ galaxyId: string; ownerToken: string }>): string[] {
  const now = Date.now();
  const updated: string[] = [];
  const stmt = db().prepare(
    `UPDATE galaxies SET last_owner_seen_at = ? WHERE id = ? AND owner_token = ? AND owner_token != ''`,
  );
  for (const { galaxyId, ownerToken } of owned) {
    const result = stmt.run(now, galaxyId, ownerToken);
    if (result.changes > 0) updated.push(galaxyId);
  }
  return updated;
}

/** 7-day TTL in ms */
const OWNER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * List all public galaxies. Auto-unpublishes stale ones (owner not seen in 7 days).
 * Returns galaxy cards with counts derived from the cached galaxy_data_json.
 */
export function listPublicGalaxies(): GalleryCard[] {
  const cutoff = Date.now() - OWNER_TTL_MS;

  // Auto-unpublish galaxies whose owner hasn't been seen in 7 days.
  db()
    .prepare(
      `UPDATE galaxies SET is_public = 0
       WHERE is_public = 1
         AND (last_owner_seen_at IS NULL OR last_owner_seen_at < ?)`,
    )
    .run(cutoff);

  const rows = db()
    .prepare(
      `SELECT id, title, tagline, updated_at, galaxy_data_json
       FROM galaxies WHERE is_public = 1 AND status = 'complete'`,
    )
    .all() as Array<{
    id: string;
    title: string;
    tagline: string | null;
    updated_at: number;
    galaxy_data_json: string | null;
  }>;

  return rows.map((row) => {
    let solarSystemCount = 0;
    let planetCount = 0;
    if (row.galaxy_data_json) {
      try {
        const data = JSON.parse(row.galaxy_data_json) as {
          solarSystems?: Record<string, unknown>;
          planets?: Record<string, unknown>;
        };
        solarSystemCount = Object.keys(data.solarSystems ?? {}).length;
        planetCount = Object.keys(data.planets ?? {}).length;
      } catch { /* corrupt cache — skip counts */ }
    }
    return {
      id: row.id,
      title: row.title,
      tagline: row.tagline,
      updatedAt: row.updated_at,
      solarSystemCount,
      planetCount,
    };
  });
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
