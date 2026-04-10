// Stage 3: Narrative.
//
// Generates the story spine for the galaxy. Two modes:
//
//   FIRST RUN — writes `narrative.canon` (frozen) + `narrative.arcs[0]`
//   EXTEND    — canon frozen as input, appends a new arc for the chapter
//
// Blocks on Stage 2.5 (coverage audit) so beats can reference real
// extracted content. Runs via the proxy workspace — Claude Code reads
// source material and knowledge structure, writes Obsidian markdown
// files into `stage3-narrative/`.

import type { Galaxy, NarrativeCanon, ChapterArc } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { pushFiles, runStage, compileFiles } from "../lib/proxy-client";
import { buildNarrativePrompt } from "../prompts/narrative";
import { compileNarrative } from "./compile";

/**
 * Run Stage 3. Mutates the galaxy blob in place, writing into
 * `galaxy.narrative`. Returns the same galaxy for chaining.
 *
 * Requires: knowledge (Stage 1), detail (Stage 2 — best-effort ok).
 */
export async function runNarrativeStage(galaxy: Galaxy): Promise<Galaxy> {
  if (!galaxy.knowledge) {
    throw new Error("runNarrativeStage: galaxy.knowledge is null");
  }

  stageStart(galaxy, "narrative");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("narrative: no source chapters");

    const isExtend = galaxy.narrative.canon != null;

    // Build concept summaries from detail for richer beat writing.
    const conceptSummaries: Record<string, string> = {};
    for (const [id, entry] of Object.entries(galaxy.detail)) {
      if (entry && "fullDefinition" in entry) {
        conceptSummaries[id] = (entry.fullDefinition as string).slice(0, 200);
      }
    }

    const prompt = buildNarrativePrompt({
      chapterId: chapter.id,
      knowledge: galaxy.knowledge,
      existingCanon: galaxy.narrative.canon,
      conceptSummaries,
    });

    // If extending, push existing canon so Claude can read it.
    if (isExtend && galaxy.narrative.canon) {
      await pushFiles(galaxy.meta.id, {
        "stage3-narrative/canon.md": renderCanonAsFile(galaxy.narrative.canon),
      });
    }

    const result = await runStage({
      galaxyId: galaxy.meta.id,
      prompt,
    });

    if (!result.ok) {
      throw new Error(`narrative: Claude Code exited with code ${result.exitCode}`);
    }

    // Compile workspace files into Narrative scopes.
    const files = await compileFiles(galaxy.meta.id);
    const compiled = compileNarrative(files);

    // Apply results: canon only on first run, arcs always append.
    if (!isExtend && compiled.canon) {
      galaxy.narrative.canon = compiled.canon;
    }

    if (compiled.arcs.length > 0) {
      // Append new arcs, avoiding duplicates by chapter id.
      const existingChapters = new Set(galaxy.narrative.arcs.map((a) => a.chapter));
      for (const arc of compiled.arcs) {
        if (!existingChapters.has(arc.chapter)) {
          galaxy.narrative.arcs.push(arc);
        }
      }
    }

    stageDone(galaxy, "narrative");
    return galaxy;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[narrative] stage failed: ${message}`);
    stageError(galaxy, "narrative", message);
    return galaxy;
  }
}

/**
 * Render canon as an Obsidian markdown file for extending galaxies.
 * This lets Claude Code read the existing canon from the workspace.
 */
function renderCanonAsFile(canon: NarrativeCanon): string {
  const chars = canon.recurringCharacters.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    description: c.description,
    voice: c.voice,
    arc: c.arc,
  }));

  // Use JSON-in-YAML for complex nested fields.
  return `---
type: canon
setting: ${yamlString(canon.setting)}
protagonist: ${yamlString(canon.protagonist)}
premise: ${yamlString(canon.premise)}
stakes: ${yamlString(canon.stakes)}
tone:
  primary: ${canon.tone.primary}
  secondary: ${canon.tone.secondary ?? "null"}
  genre: ${canon.tone.genre}
aesthetic:
  paletteDirection: ${yamlString(canon.aesthetic.paletteDirection)}
  atmosphereDirection: ${yamlString(canon.aesthetic.atmosphereDirection)}
  motifKeywords: [${canon.aesthetic.motifKeywords.map((k) => `"${k}"`).join(", ")}]
recurringCharacters: ${JSON.stringify(chars)}
finaleHook: ${yamlString(canon.finaleHook)}
hardConstraints: [${canon.hardConstraints.map((c) => `"${c}"`).join(", ")}]
---
`;
}

function yamlString(s: string): string {
  if (s.includes("\n") || s.includes('"') || s.includes(":")) {
    return `>\n  ${s.replace(/\n/g, "\n  ")}`;
  }
  return `"${s.replace(/"/g, '\\"')}"`;
}
