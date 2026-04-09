// End-to-end smoke test for the parsing pipeline.
//
// Usage:
//   bun run src/scripts/test-pipeline.ts path/to/notes.txt
//   bun run src/scripts/test-pipeline.ts --inline "paste a short note here"
//   cat notes.md | bun run src/scripts/test-pipeline.ts --stdin
//
// What it does:
//   1. Reads raw text from a file, stdin, or the --inline arg
//   2. Runs ingest → structure → layout
//   3. Prints a human summary + the full validated Galaxy JSON
//   4. Persists the galaxy to SQLite so you can fetch it via the HTTP route
//
// Exits non-zero on any stage failure so CI can rely on it.

import { runPipeline } from "../pipeline/runner";
import { runDetail } from "../pipeline/parsing/detail";
import { saveGalaxy } from "../db/store";

async function main() {
  const args = process.argv.slice(2);
  let text: string | null = null;
  let filename: string | null = null;

  if (args[0] === "--inline" && args.length > 1) {
    text = args.slice(1).join(" ");
  } else if (args[0] === "--stdin") {
    text = await Bun.stdin.text();
  } else if (args[0]) {
    filename = args[0];
    text = await Bun.file(filename).text();
  } else {
    console.error(
      "Usage:\n" +
      "  bun run src/scripts/test-pipeline.ts <path>\n" +
      "  bun run src/scripts/test-pipeline.ts --inline \"short text\"\n" +
      "  bun run src/scripts/test-pipeline.ts --stdin",
    );
    process.exit(1);
  }

  if (!text || !text.trim()) {
    console.error("[test-pipeline] input is empty");
    process.exit(1);
  }

  console.log(`[test-pipeline] input: ${text.length} chars${filename ? ` from ${filename}` : ""}`);
  console.log(`[test-pipeline] running ingest → structure → layout → detail...`);

  const started = Date.now();
  const galaxy = await runPipeline({
    kind: filename ? "text" : "paste",
    filename,
    text,
  });
  // The HTTP route runs Stage 2 in the background after responding. The
  // CLI deliberately awaits it instead so the harness prints real
  // detail coverage — the whole point of this script is to exercise
  // the full pipeline synchronously.
  await runDetail(galaxy, text);
  const elapsed = Date.now() - started;

  saveGalaxy(galaxy);

  // ─── Summary ────────────────────────────────────────────
  const k = galaxy.knowledge!;
  const s = galaxy.spatial!;
  console.log("");
  console.log(`[test-pipeline] done in ${elapsed}ms`);
  console.log(`[test-pipeline] galaxy id:  ${galaxy.meta.id}`);
  console.log(`[test-pipeline] title:      ${galaxy.meta.title}`);
  console.log(`[test-pipeline] knowledge:  ${k.topics.length} topics, ${k.subtopics.length} subtopics, ${k.concepts.length} concepts (${k.looseConceptIds.length} loose)`);
  console.log(`[test-pipeline] relations:  ${galaxy.relationships.length}`);
  console.log(`[test-pipeline] bodies:     ${s.bodies.length} (${s.bodies.filter((b) => b.kind === "moon" || b.kind === "asteroid").length} playable)`);

  // Stage 2 coverage: how many concepts got detail extracted.
  const detailCount = Object.keys(galaxy.detail).length;
  const conceptCount = k.concepts.length;
  const coverage = conceptCount > 0 ? Math.round((detailCount / conceptCount) * 100) : 0;
  console.log(`[test-pipeline] detail:     ${detailCount}/${conceptCount} concepts (${coverage}% coverage)`);

  // Sample the first concept's detail block so prompt drift is obvious.
  const firstDetail = Object.values(galaxy.detail)[0];
  if (firstDetail) {
    console.log(`[test-pipeline] sample detail for '${firstDetail.conceptId}':`);
    console.log(`                  def: ${firstDetail.fullDefinition.slice(0, 120)}${firstDetail.fullDefinition.length > 120 ? "…" : ""}`);
    console.log(`                  formulas=${firstDetail.formulas.length} examples=${firstDetail.workedExamples.length} edgeCases=${firstDetail.edgeCases.length} mnemonics=${firstDetail.mnemonics.length} quotes=${firstDetail.sourceQuotes.length}`);
  }

  console.log(`[test-pipeline] pipeline:   ${Object.entries(galaxy.pipeline).map(([k, v]) => `${k}=${v.status}`).join(" ")}`);
  console.log("");
  console.log("[test-pipeline] fetch via:  GET /api/galaxy/" + galaxy.meta.id);
  console.log("");
  console.log("─── full galaxy blob ───");
  console.log(JSON.stringify(galaxy, null, 2));
}

main().catch((err) => {
  console.error("[test-pipeline] FAILED:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
