import { mkdir, rm, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { config } from "../config";

// Stage subfolders created inside every workspace. Each stage reads
// from the previous folder and writes to its own — Claude Code
// operates on real files, which is the whole point of the proxy.
const STAGE_DIRS = [
  "sources",
  "stage1-structure",
  "stage2-wraps",
] as const;

export interface WorkspaceInfo {
  galaxyId: string;
  dir: string;
  createdAt: number;
  lastAccessedAt: number;
}

// In-memory registry of active workspaces. The proxy is a single
// process on a VPS so this is fine — no distributed coordination.
const workspaces = new Map<string, WorkspaceInfo>();

// Per-session single-writer lock. A galaxy can only have one active
// pipeline run at a time — concurrent writes to the same workspace
// directory would corrupt the stage folders. The lock is a simple
// Set of galaxy ids that currently have an active run.
const writeLocks = new Set<string>();

/** Resolve the absolute workspace path for a galaxy. */
export function workspaceDir(galaxyId: string): string {
  return resolve(config.workspacesDir, galaxyId);
}

/** Create a fresh workspace with the standard stage subfolders. */
export async function createWorkspace(galaxyId: string): Promise<string> {
  const dir = workspaceDir(galaxyId);
  await mkdir(dir, { recursive: true });

  // Create a .git marker so Claude Code treats this workspace as the
  // project root. Without it, Claude Code walks up to the repo's .git
  // and writes files relative to the repo root instead of the workspace.
  const gitDir = join(dir, ".git");
  await mkdir(gitDir, { recursive: true });
  await writeFile(join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  // Minimal git init so Claude Code recognizes this as a project root.
  await mkdir(join(gitDir, "refs", "heads"), { recursive: true });
  await mkdir(join(gitDir, "objects"), { recursive: true });

  await Promise.all(
    STAGE_DIRS.map((sub) => mkdir(join(dir, sub), { recursive: true })),
  );

  const now = Date.now();
  workspaces.set(galaxyId, {
    galaxyId,
    dir,
    createdAt: now,
    lastAccessedAt: now,
  });

  return dir;
}

/** Touch the workspace so it doesn't get swept by the idle TTL. */
export function touchWorkspace(galaxyId: string): void {
  const ws = workspaces.get(galaxyId);
  if (ws) ws.lastAccessedAt = Date.now();
}

/** Delete a workspace from disk and the registry. */
export async function destroyWorkspace(galaxyId: string): Promise<void> {
  const dir = workspaceDir(galaxyId);

  // On Windows, Claude Code subprocesses may still hold file handles
  // briefly after exit. Retry with backoff to avoid EBUSY failures.
  const MAX_RETRIES = 4;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await rm(dir, { recursive: true, force: true });
      break;
    } catch (err: any) {
      if (err?.code === "EBUSY" && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      // Non-EBUSY or exhausted retries — log and move on.
      console.warn(`[workspace] rm failed for ${galaxyId}: ${err?.message}`);
      break;
    }
  }

  workspaces.delete(galaxyId);
  writeLocks.delete(galaxyId);
}

/** Check whether this galaxy already has an active workspace. */
export function hasWorkspace(galaxyId: string): boolean {
  return workspaces.has(galaxyId);
}

/** Acquire single-writer lock. Returns false if already held. */
export function acquireWriteLock(galaxyId: string): boolean {
  if (writeLocks.has(galaxyId)) return false;
  writeLocks.add(galaxyId);
  return true;
}

/** Release single-writer lock. */
export function releaseWriteLock(galaxyId: string): void {
  writeLocks.delete(galaxyId);
}

/**
 * Sweep workspaces idle longer than the configured TTL.
 * Called on an interval from the server entry point.
 */
export async function sweepIdle(): Promise<number> {
  const cutoff = Date.now() - config.idleTtlMs;
  let swept = 0;

  for (const [id, ws] of workspaces) {
    if (ws.lastAccessedAt < cutoff && !writeLocks.has(id)) {
      await destroyWorkspace(id);
      swept++;
    }
  }

  return swept;
}

/**
 * On startup, scan the workspaces directory and rehydrate the
 * in-memory registry from whatever is on disk (crash recovery).
 */
export async function recoverFromDisk(): Promise<void> {
  try {
    const entries = await readdir(config.workspacesDir);
    for (const name of entries) {
      const dir = join(config.workspacesDir, name);
      const s = await stat(dir);
      if (s.isDirectory()) {
        workspaces.set(name, {
          galaxyId: name,
          dir,
          createdAt: s.birthtimeMs,
          lastAccessedAt: s.mtimeMs,
        });
      }
    }
    console.log(
      `[workspace] recovered ${workspaces.size} workspaces from disk`,
    );
  } catch {
    // First boot — directory doesn't exist yet, that's fine.
    await mkdir(config.workspacesDir, { recursive: true });
  }
}
