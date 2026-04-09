// Smoke test for the Claude Code spawner.
//
// Usage:
//   bun run src/scripts/test-spawner.ts "your prompt here"

import { runClaude } from "../lib/spawner";

const prompt = process.argv.slice(2).join(" ").trim();

if (!prompt) {
  console.error('Usage: bun run src/scripts/test-spawner.ts "your prompt"');
  process.exit(1);
}

console.log(`[spawner] prompt: ${prompt}`);
console.log(`[spawner] invoking claude...`);

const res = await runClaude({ prompt });

console.log(`[spawner] exitCode: ${res.exitCode}`);
console.log(`[spawner] durationMs: ${res.durationMs}`);
if (res.stderr) console.log(`[spawner] stderr:\n${res.stderr}`);
console.log(`[spawner] output:\n${res.output}`);

process.exit(res.ok ? 0 : 1);
