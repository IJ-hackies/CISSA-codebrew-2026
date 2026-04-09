// End-to-end runner for the current pipeline slice.
//
// ─── Execution model ──────────────────────────────────────────────────────
//
// The pipeline is split into two phases so the HTTP create request doesn't
// block on every Claude call:
//
//   FAST PATH (foreground, awaited by the HTTP route):
//     0. Ingest       — mint id, hash, init blob        (pure code)
//     1. Structure    — Claude call → knowledge + rels  (Claude)
//     4. Layout       — deterministic spatial placement (pure code)
//
//   BACKGROUND PATH (fire-and-forget from the HTTP route, after response):
//     2. Detail       — Claude calls → per-concept deep content
//
// The fast path alone produces a galaxy that is already fully renderable
// as an interactive map (knowledge + relationships + spatial is all the
// frontend needs). Detail enriches concepts for downstream narrative and
// scene generation, but nothing rendered today depends on it, so there's
// no reason to make the user wait for it during creation.
//
// When detail finishes in the background, it writes into `galaxy.detail`
// and the caller is responsible for re-persisting the blob — this module
// does NOT import the db layer, to keep the pipeline testable without a
// SQLite dependency. See `routes/galaxy.ts` for the wiring.
//
// Stages 3 (narrative), 5 (visuals), 6 (scene) are not yet implemented
// and remain `pending` in the returned blob's pipeline scope.
//
// ─── Client awareness of background detail ───────────────────────────────
//
// Today the frontend is NOT notified when background detail completes. It
// receives the galaxy with `pipeline.detail.status === "running"` and
// empty `detail: {}`, and never re-fetches. This is deliberate for now:
// nothing the frontend currently renders consumes detail, so silent
// population is the simplest correct behavior.
//
// When a UI surface eventually wants to show detail (loading state in a
// scene opener, for example), upgrade the client to either:
//   (b) poll GET /api/galaxy/:id until pipeline.detail.status !== "running", or
//   (c) add an SSE stream that pushes pipeline-stage transitions.
// Both are purely additive — no server-side pipeline change needed.

import { Galaxy, SourceKind } from "../../../shared/types";
import { runIngest } from "./parsing/ingest";
import { runStructureFromText } from "./parsing/structure";
import { runDetail } from "./parsing/detail";
import { runLayout } from "./worldgen/layout";
import type { SourcePart } from "../../../shared/types";

export interface RunPipelineInput {
  kind: SourceKind;
  filename: string | null;
  text: string;
  title?: string;
  /** Optional per-part provenance for multi-input uploads. */
  parts?: SourcePart[];
}

/**
 * Fast path: runs ingest → structure → layout and returns the galaxy.
 * The returned blob is fully renderable but has no `detail` yet —
 * `pipeline.detail.status` will be `"pending"`. The caller should kick
 * off {@link runDetailBackground} immediately after persisting.
 */
export async function runPipeline(input: RunPipelineInput): Promise<Galaxy> {
  const { galaxy } = runIngest(input);
  await runStructureFromText(galaxy, input.text);
  runLayout(galaxy);
  return galaxy;
}

/**
 * Background path: runs Stage 2 (detail) against a galaxy that's already
 * been through the fast path. Never throws — `runDetail` itself is
 * non-fatal (marks `pipeline.detail.status` as `error` on failure so the
 * galaxy stays valid) and this wrapper swallows any lingering rejection
 * from the persist callback so an unhandled rejection can't crash the
 * server from a fire-and-forget call site.
 *
 * `persist` is injected instead of importing `saveGalaxy` directly so
 * this module stays free of a db dependency.
 */
export async function runDetailBackground(
  galaxy: Galaxy,
  rawText: string,
  persist: (galaxy: Galaxy) => void,
): Promise<void> {
  try {
    await runDetail(galaxy, rawText);
  } catch (err) {
    // runDetail should already be non-throwing, but belt-and-braces:
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runDetailBackground] runDetail threw (unexpected): ${message}`);
  }

  try {
    persist(galaxy);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runDetailBackground] persist failed: ${message}`);
  }
}
