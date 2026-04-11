// Dump a parsed galaxy as GalaxyData JSON to stdout. Useful for diffing
// against the `galaxy-data 1.json` fixture at the repo root.
//
// Usage:
//   bun run src/scripts/dump-galaxy.ts <galaxy-id>            → pretty JSON
//   bun run src/scripts/dump-galaxy.ts <galaxy-id> --raw      → re-parse mesh (ignore cache)
//   bun run src/scripts/dump-galaxy.ts <galaxy-id> > out.json

import { loadCachedGalaxyData, getGalaxyRow } from "../db/client";
import { parseWorkspace } from "../workspace/parse";

const args = process.argv.slice(2);
const galaxyId = args.find((a) => !a.startsWith("--"));
const raw = args.includes("--raw");

if (!galaxyId) {
  console.error("Usage: bun run src/scripts/dump-galaxy.ts <galaxy-id> [--raw]");
  process.exit(1);
}

const row = getGalaxyRow(galaxyId);
if (!row) {
  console.error(`[error] galaxy not found: ${galaxyId}`);
  process.exit(1);
}

const galaxy = raw ? parseWorkspace(galaxyId) : loadCachedGalaxyData(galaxyId) ?? parseWorkspace(galaxyId);
process.stdout.write(JSON.stringify(galaxy, null, 2) + "\n");
