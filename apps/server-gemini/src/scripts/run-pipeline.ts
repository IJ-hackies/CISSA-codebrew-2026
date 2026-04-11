// Manual pipeline smoke test.
//
// Usage (from apps/server-gemini):
//   bun run run-pipeline <path1> [path2] [...] [--title "Name"]
//
// Each path can be a file OR a directory. Directories are walked
// recursively; hidden dotfiles and node_modules/.git folders are
// skipped. Everything else is uploaded as a source.
//
// Creates a galaxy, copies the collected files into its media/sources
// folder, starts a filesystem watcher on mesh/, and runs the full
// pipeline in this process so you see every new markdown file as Gemini
// writes it.
//
// Requires GOOGLE_API_KEY in apps/server-gemini/.env (or exported).

import { readFileSync, watch, existsSync, statSync, readdirSync } from "node:fs";
import { basename, extname, resolve, relative, join as pathJoin } from "node:path";
import { randomUUID } from "node:crypto";
import { ensureGalaxyDirs, galaxyPaths } from "../workspace/layout";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGalaxyRow,
  insertSourceRow,
  getGalaxyRow,
  type SourceRow,
} from "../db/client";
import { runPipeline } from "../pipeline/run";

// Best-effort .env loader — the SDK wants process.env.GOOGLE_API_KEY and
// this script runs outside `bun --watch` which picks up .env automatically.
function loadDotEnv() {
  const path = resolve(import.meta.dir, "..", "..", ".env");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnv();

// ── Arg parsing ────────────────────────────────────────────────────

function parseArgs(argv: string[]): { paths: string[]; title: string } {
  const paths: string[] = [];
  let title = "Smoke Test";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--title" || a === "-t") {
      title = argv[++i] ?? title;
    } else {
      paths.push(a);
    }
  }
  return { paths, title };
}

// Walk a path (file or directory) and return every regular file under it.
// Skips dotfiles, node_modules, and .git so you can point at a repo dir
// without accidentally ingesting build artifacts.
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);

function collectFiles(target: string): string[] {
  if (!existsSync(target)) {
    console.error(`[error] path not found: ${target}`);
    process.exit(1);
  }
  const st = statSync(target);
  if (st.isFile()) return [target];
  if (!st.isDirectory()) {
    console.error(`[error] not a file or directory: ${target}`);
    process.exit(1);
  }

  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      if (SKIP_DIRS.has(name)) continue;
      const full = pathJoin(dir, name);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (s.isFile()) out.push(full);
    }
  };
  walk(target);
  return out;
}

const { paths: argPaths, title } = parseArgs(process.argv.slice(2));

if (argPaths.length === 0) {
  console.error(
    "Usage: bun run run-pipeline <file-or-dir> [more ...] [--title 'Name']",
  );
  process.exit(1);
}

const files = argPaths.flatMap(collectFiles);

if (files.length === 0) {
  console.error(`[error] no files found under: ${argPaths.join(", ")}`);
  process.exit(1);
}

if (!process.env.GOOGLE_API_KEY) {
  console.error(
    "[error] GOOGLE_API_KEY is not set. Add it to apps/server-gemini/.env or export it.",
  );
  process.exit(1);
}

// ── Mime inference (same table as routes/galaxy.ts) ────────────────

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

function inferMime(filename: string): string {
  return EXT_MIME[extname(filename).toLowerCase()] ?? "application/octet-stream";
}

// ── Setup galaxy ───────────────────────────────────────────────────

const galaxyId = randomUUID();
const paths = ensureGalaxyDirs(galaxyId);
createGalaxyRow(galaxyId, title);

const now = Date.now();
for (const src of files) {
  const buf = readFileSync(src);
  const safeName = basename(src).replace(/\s+/g, "_");
  const destAbs = join(paths.mediaSources, safeName);
  writeFileSync(destAbs, buf);

  const row: SourceRow = {
    id: randomUUID(),
    galaxyId,
    filename: basename(src),
    mediaPath: safeName,
    mimeType: inferMime(basename(src)),
    byteSize: buf.byteLength,
    createdAt: now,
  };
  insertSourceRow(row);
}

console.log("─".repeat(60));
console.log(`galaxy: ${galaxyId}`);
console.log(`title:  ${title}`);
console.log(`inputs: ${files.length} file(s)`);
for (const f of files) {
  console.log(`  - ${basename(f)} (${statSync(f).size} bytes)`);
}
console.log(`workspace: ${relative(process.cwd(), paths.root)}`);
console.log("─".repeat(60));
console.log();

// ── Watch mesh/ for new files ──────────────────────────────────────
//
// fs.watch fires on every change (create, write, rename). We track the
// set of files we've already announced so we only print each file once,
// when it first appears, not on every byte written during a streamed
// response.

const seen = new Set<string>();

function listMesh(): string[] {
  try {
    return readdirSync(paths.mesh).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
}

// Print any files that appeared since the last tick. fs.watch on Windows
// coalesces events weirdly, so we poll the directory too — a cheap 500ms
// poll is reliable regardless of platform.
const tick = () => {
  for (const f of listMesh()) {
    if (!seen.has(f)) {
      seen.add(f);
      const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
      console.log(`  + [${elapsed.padStart(5)}s] mesh/${f}`);
    }
  }
};

const watcher = watch(paths.mesh, { persistent: false }, tick);
const pollTimer = setInterval(tick, 500);

// ── Run pipeline ───────────────────────────────────────────────────

const runStart = Date.now();
console.log("pipeline starting...\n");

try {
  await runPipeline(galaxyId);
} finally {
  // Final tick to catch anything written between the last poll and now.
  tick();
  clearInterval(pollTimer);
  watcher.close();
}

const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
const row = getGalaxyRow(galaxyId);

console.log();
console.log("─".repeat(60));
console.log(`finished in ${elapsed}s — status: ${row?.status ?? "unknown"}`);
if (row?.error) {
  console.log(`error: ${row.error.slice(0, 500)}`);
}

// Summarize what landed in the mesh.
const final = listMesh();
const byType = final.reduce<Record<string, number>>((acc, f) => {
  const m = /^\(([^)]+)\)/.exec(f);
  const label = m?.[1] ?? "unknown";
  acc[label] = (acc[label] ?? 0) + 1;
  return acc;
}, {});
console.log(`mesh/: ${final.length} file(s)`);
for (const [label, count] of Object.entries(byType).sort()) {
  console.log(`  ${label.padEnd(14)} ${count}`);
}
console.log("─".repeat(60));
console.log(`\nbrowse the output:  ${paths.root}`);
console.log(`final JSON:         ${join(paths.root, "galaxy-data.json")}`);
console.log(`re-dump from cache: bun run dump-galaxy ${galaxyId}`);
