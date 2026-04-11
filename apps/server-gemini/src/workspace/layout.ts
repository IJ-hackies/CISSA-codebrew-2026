// Paths for a galaxy's on-disk workspace. Everything a pipeline writes
// lives under `apps/server-gemini/galaxies/<id>/`.
//
// - mesh/                — typed markdown files (source of truth)
// - media/sources/       — original uploaded files
// - media/generated/     — generated images (stage 4, off by default)

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Anchor at the server-gemini app directory regardless of cwd so `bun run`
// from the monorepo root behaves the same as from inside the app.
const APP_ROOT = resolve(import.meta.dir, "..", "..");
const GALAXIES_ROOT = join(APP_ROOT, "galaxies");

export interface GalaxyPaths {
  root: string;
  mesh: string;
  mediaSources: string;
  mediaGenerated: string;
}

export function galaxyPaths(galaxyId: string): GalaxyPaths {
  const root = join(GALAXIES_ROOT, galaxyId);
  return {
    root,
    mesh: join(root, "mesh"),
    mediaSources: join(root, "media", "sources"),
    mediaGenerated: join(root, "media", "generated"),
  };
}

export function ensureGalaxyDirs(galaxyId: string): GalaxyPaths {
  const p = galaxyPaths(galaxyId);
  mkdirSync(p.mesh, { recursive: true });
  mkdirSync(p.mediaSources, { recursive: true });
  mkdirSync(p.mediaGenerated, { recursive: true });
  return p;
}

export function galaxiesRoot(): string {
  mkdirSync(GALAXIES_ROOT, { recursive: true });
  return GALAXIES_ROOT;
}

export function appRoot(): string {
  return APP_ROOT;
}
