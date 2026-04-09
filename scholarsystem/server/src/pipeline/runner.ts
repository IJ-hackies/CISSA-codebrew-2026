// End-to-end runner for the current pipeline slice: ingest → structure → layout.
//
// This is what the HTTP route and the CLI test script both call. Keeping
// the sequence in one place means there's exactly one definition of "what
// running the pipeline means right now", and when detail/narrative/visuals
// land they slot into this single function.

import { Galaxy, SourceKind } from "../../../shared/types";
import { runIngest } from "./parsing/ingest";
import { runStructureFromText } from "./parsing/structure";
import { runLayout } from "./worldgen/layout";

export interface RunPipelineInput {
  kind: SourceKind;
  filename: string | null;
  text: string;
  title?: string;
}

/**
 * Runs the full currently-implemented pipeline slice end-to-end:
 *   0. Ingest       — mint id, hash, init blob
 *   1. Structure    — Claude call → knowledge + relationships
 *   4. Layout       — deterministic spatial placement (no Claude)
 *
 * Stages 2 (detail), 3 (narrative), 5 (visuals), 6 (scene) are not yet
 * implemented and remain `pending` in the returned blob's pipeline scope.
 * The blob is still fully schema-valid and renderable from what's here.
 */
export async function runPipeline(input: RunPipelineInput): Promise<Galaxy> {
  const { galaxy } = runIngest(input);
  await runStructureFromText(galaxy, input.text);
  runLayout(galaxy);
  return galaxy;
}
