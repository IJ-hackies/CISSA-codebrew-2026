// End-to-end smoke test for the v3 pipeline (wrap-based memory galaxy).
//
// Usage:
//   bun run src/scripts/test-pipeline.ts path/to/notes.txt
//   bun run src/scripts/test-pipeline.ts --inline "paste a short note here"
//   cat notes.md | bun run src/scripts/test-pipeline.ts --stdin
//
// What it does:
//   1. Reads raw text from a file, stdin, or the --inline arg
//   2. Runs chunk → structure → wraps → coverage
//   3. Prints a human summary + the full validated Galaxy JSON
//   4. Persists the galaxy to SQLite so you can fetch it via the HTTP route
//
// Requires the proxy server to be running on localhost:8890.
// Exits non-zero on any stage failure so CI can rely on it.

import { runPipeline, sanitizeChapterId } from "../pipeline/runner";
import { saveGalaxy } from "../db/store";
import { extractFile, EXTENSION_TO_KIND } from "../pipeline/parsing/extract";
import type { PdfExtracted } from "../pipeline/parsing/extract/pdf";

async function main() {
  const args = process.argv.slice(2);
  let text: string | null = null;
  let filename: string | null = null;
  let kind: import("@scholarsystem/shared").SourceKind = "paste";
  let pageImages: { page: number; png: Buffer }[] | undefined;

  if (args[0] === "--inline" && args.length > 1) {
    text = args.slice(1).join(" ");
  } else if (args[0] === "--stdin") {
    text = await Bun.stdin.text();
  } else if (args[0]) {
    filename = args[0];
    // Detect file format by extension and use the proper extractor
    // (e.g. PDF extraction instead of reading raw binary as text).
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    const detectedKind = EXTENSION_TO_KIND[ext];
    if (detectedKind && detectedKind !== "text") {
      const buf = Buffer.from(await Bun.file(filename).arrayBuffer());
      const extracted = await extractFile(buf, filename);
      text = extracted.text;
      kind = extracted.kind;
      if ((extracted as PdfExtracted).pageImages) {
        pageImages = (extracted as PdfExtracted).pageImages;
      }
    } else {
      text = await Bun.file(filename).text();
      kind = "text";
    }
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

  console.log(`[test-pipeline] input: ${text.length} chars${filename ? ` from ${filename}` : ""} (kind: ${kind})`);
  if (pageImages?.length) {
    console.log(`[test-pipeline] extracted ${pageImages.length} page images for vision`);
  }
  console.log(`[test-pipeline] running chunk → structure → wraps → coverage...`);
  console.log(`[test-pipeline] (requires proxy on localhost:8890)`);

  const started = Date.now();
  const galaxy = await runPipeline(
    {
      chapterId: sanitizeChapterId(filename ?? "w1"),
      kind,
      filename,
      text,
      pageImages,
    },
    {
      onStageComplete: (g, stage) => {
        saveGalaxy(g);
        console.log(`[test-pipeline] persisted after stage: ${stage}`);
      },
    },
  );
  const elapsed = Date.now() - started;

  saveGalaxy(galaxy);

  // ─── Summary ────────────────────────────────────────────
  const k = galaxy.knowledge;
  const wrapCount = Object.keys(galaxy.wraps).length;
  console.log("");
  console.log(`[test-pipeline] done in ${elapsed}ms`);
  console.log(`[test-pipeline] galaxy id:  ${galaxy.meta.id}`);
  console.log(`[test-pipeline] title:      ${galaxy.meta.title}`);
  if (k) {
    console.log(`[test-pipeline] knowledge:  ${k.clusters.length} clusters, ${k.groups.length} groups, ${k.entries.length} entries`);
  } else {
    console.log(`[test-pipeline] knowledge:  null (structure not yet run)`);
  }
  console.log(`[test-pipeline] relations:  ${galaxy.relationships.edges.length} edges`);
  console.log(`[test-pipeline] wraps:      ${wrapCount}`);
  console.log(`[test-pipeline] pipeline:   ${Object.entries(galaxy.pipeline).map(([k, v]) => `${k}=${v.status}`).join(" ")}`);
  console.log("");
  console.log("[test-pipeline] fetch via:  GET /api/galaxy/" + galaxy.meta.id);
  console.log("");
  console.log("─── full galaxy blob ───");
  console.log(JSON.stringify(galaxy, null, 2));
}

main().catch((err) => {
  // Use console.log (stdout) instead of console.error (stderr) so
  // output always appears even when Windows redirects are flaky.
  console.log("[test-pipeline] FAILED");
  console.log("[test-pipeline] error type:", typeof err, err?.constructor?.name);
  if (err instanceof Error) {
    console.log("[test-pipeline] message:", err.message);
    console.log("[test-pipeline] stack:", err.stack);
  } else {
    console.log("[test-pipeline] raw:", JSON.stringify(err));
  }
  process.exit(1);
});
