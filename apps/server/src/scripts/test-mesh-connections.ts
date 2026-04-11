#!/usr/bin/env bun
/**
 * test-mesh-connections.ts — Validate all wikilink connections resolve correctly.
 *
 * Checks that every UUID reference in connections actually points to a real entity.
 *
 * Usage:
 *   bun run src/scripts/test-mesh-connections.ts <mesh-directory>
 */

import { parseMeshDirectory } from "../lib/mesh-parser";
import { resolve } from "path";

const meshDir = process.argv[2];
if (!meshDir) {
  console.error("Usage: bun run test-mesh-connections.ts <mesh-directory>");
  process.exit(1);
}

const data = await parseMeshDirectory(resolve(meshDir));
let errors = 0;

console.log("\n=== Connection Validation ===\n");

// Check solar system references
for (const ss of Object.values(data.solarSystems)) {
  for (const pid of ss.planets) {
    if (!data.planets[pid]) {
      console.log(`  ERROR: Solar system "${ss.title}" references unknown planet ${pid}`);
      errors++;
    }
  }
  for (const cid of ss.concepts) {
    if (!data.concepts[cid]) {
      console.log(`  ERROR: Solar system "${ss.title}" references unknown concept ${cid}`);
      errors++;
    }
  }
}

// Check planet connections
for (const p of Object.values(data.planets)) {
  for (const cid of p.planetConnections) {
    if (!data.planets[cid]) {
      console.log(`  ERROR: Planet "${p.title}" connects to unknown planet ${cid}`);
      errors++;
    }
  }
}

// Check concept connections
for (const c of Object.values(data.concepts)) {
  for (const pid of c.planetConnections) {
    if (!data.planets[pid]) {
      console.log(`  ERROR: Concept "${c.title}" connects to unknown planet ${pid}`);
      errors++;
    }
  }
  for (const cid of c.conceptConnections) {
    if (!data.concepts[cid]) {
      console.log(`  ERROR: Concept "${c.title}" connects to unknown concept ${cid}`);
      errors++;
    }
  }
}

// Check story references
for (const s of data.stories) {
  for (const cid of s.introduction.conceptIds) {
    if (!data.concepts[cid]) {
      console.log(`  ERROR: Story "${s.title}" intro references unknown concept ${cid}`);
      errors++;
    }
  }
  for (const scene of s.scenes) {
    if (!data.planets[scene.planetId]) {
      console.log(`  ERROR: Story "${s.title}" scene references unknown planet ${scene.planetId}`);
      errors++;
    }
  }
  for (const cid of s.conclusion.conceptIds) {
    if (!data.concepts[cid]) {
      console.log(`  ERROR: Story "${s.title}" conclusion references unknown concept ${cid}`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log("  All connections valid!");
} else {
  console.log(`\n  ${errors} broken connection(s) found`);
}

// Print stats
const totalConnections =
  Object.values(data.solarSystems).reduce((n, ss) => n + ss.planets.length + ss.concepts.length, 0) +
  Object.values(data.planets).reduce((n, p) => n + p.planetConnections.length, 0) +
  Object.values(data.concepts).reduce((n, c) => n + c.planetConnections.length + c.conceptConnections.length, 0) +
  data.stories.reduce(
    (n, s) => n + s.introduction.conceptIds.length + s.scenes.length + s.conclusion.conceptIds.length,
    0,
  );

console.log(`\n  Total connections checked: ${totalConnections}`);
console.log(`\n=== Done ===\n`);
