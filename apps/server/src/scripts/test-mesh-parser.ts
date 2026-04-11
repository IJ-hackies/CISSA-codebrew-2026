#!/usr/bin/env bun
/**
 * test-mesh-parser.ts — Run the mesh parser and print the data structures.
 *
 * Usage:
 *   bun run src/scripts/test-mesh-parser.ts <mesh-directory>
 *
 * Example:
 *   bun run src/scripts/test-mesh-parser.ts ../../../../Workspace/Bench/Test/Mesh
 */

import { parseMeshDirectory } from "../lib/mesh-parser";
import { resolve } from "path";

const meshDir = process.argv[2];
if (!meshDir) {
  console.error("Usage: bun run test-mesh-parser.ts <mesh-directory>");
  process.exit(1);
}

const resolvedPath = resolve(meshDir);
console.log(`\n=== Mesh Parser Test ===`);
console.log(`Parsing: ${resolvedPath}\n`);

const data = await parseMeshDirectory(resolvedPath);

// ── Summary ──
console.log("── Summary ──");
console.log(`  Solar Systems: ${Object.keys(data.solarSystems).length}`);
console.log(`  Planets:       ${Object.keys(data.planets).length}`);
console.log(`  Concepts:      ${Object.keys(data.concepts).length}`);
console.log(`  Stories:        ${data.stories.length}`);
console.log(`  Sources:        ${Object.keys(data.sources).length}`);
console.log(`  WikiLink Index: ${Object.keys(data.wikiLinkIndex).length} entries`);

// ── Solar Systems ──
console.log("\n── Solar Systems ──");
for (const ss of Object.values(data.solarSystems)) {
  console.log(`  [${ss.id.slice(0, 8)}] ${ss.title}`);
  console.log(`    planets: ${ss.planets.length}, concepts: ${ss.concepts.length}`);
  console.log(`    markdown: ${ss.markdown.length} chars`);
}

// ── Planets (first 5) ──
const planetList = Object.values(data.planets);
console.log(`\n── Planets (showing ${Math.min(5, planetList.length)} of ${planetList.length}) ──`);
for (const p of planetList.slice(0, 5)) {
  console.log(`  [${p.id.slice(0, 8)}] ${p.title}`);
  console.log(`    connections: ${p.planetConnections.length}`);
  console.log(`    markdown: ${p.markdown.length} chars`);
}

// ── Concepts (first 5) ──
const conceptList = Object.values(data.concepts);
console.log(`\n── Concepts (showing ${Math.min(5, conceptList.length)} of ${conceptList.length}) ──`);
for (const c of conceptList.slice(0, 5)) {
  console.log(`  [${c.id.slice(0, 8)}] ${c.title}`);
  console.log(`    planet-connections: ${c.planetConnections.length}, concept-connections: ${c.conceptConnections.length}`);
  console.log(`    markdown: ${c.markdown.length} chars`);
}

// ── Stories ──
console.log(`\n── Stories ──`);
for (const s of data.stories) {
  console.log(`  [${s.id.slice(0, 8)}] ${s.title}`);
  console.log(`    intro: ${s.introduction.markdown.length} chars, ${s.introduction.conceptIds.length} concepts`);
  console.log(`    scenes: ${s.scenes.length}`);
  for (const scene of s.scenes) {
    const planet = data.planets[scene.planetId];
    console.log(`      → ${planet?.title ?? scene.planetId.slice(0, 8)} (${scene.markdown.length} chars)`);
  }
  console.log(`    conclusion: ${s.conclusion.markdown.length} chars, ${s.conclusion.conceptIds.length} concepts`);
}

// ── Sources ──
console.log(`\n── Sources ──`);
for (const src of Object.values(data.sources)) {
  console.log(`  [${src.id.slice(0, 8)}] ${src.title}`);
  console.log(`    filename: ${src.filename}, mediaRef: ${src.mediaRef}`);
  console.log(`    markdown: ${src.markdown.length} chars`);
}

// ── WikiLink Index (first 10) ──
const indexEntries = Object.entries(data.wikiLinkIndex);
console.log(`\n── WikiLink Index (showing ${Math.min(10, indexEntries.length)} of ${indexEntries.length}) ──`);
for (const [key, uuid] of indexEntries.slice(0, 10)) {
  console.log(`  "${key}" → ${uuid.slice(0, 8)}...`);
}

console.log("\n=== Done ===\n");
