// Stage 1: Skeleton pass.
//
// Sends source units to the proxy workspace, runs the skeleton prompt
// via Claude Code, then compiles the resulting Obsidian markdown files
// into Knowledge + Relationships + DispatchPlan on the Galaxy blob.
//
// The skeleton is a lightweight classification pass — it identifies the
// topic/subtopic/concept hierarchy and assigns source units to topics.
// Deep extraction (bodies, derivatives) is deferred to Stage 2's parallel
// detail fan-out, using the DispatchPlan produced here.
//
// When page images are available (PDF uploads), they are pushed to the
// workspace so Claude Code can read them with its vision capability.

import type { Galaxy, SourceUnit } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { pushFiles, runStage, compileFiles } from "../lib/proxy-client";
import { buildSkeletonPrompt } from "../prompts/structure";
import { compileStructure, type DispatchPlan } from "./compile";

export interface SkeletonResult {
  galaxy: Galaxy;
  dispatchPlan: DispatchPlan;
}

/**
 * Run Stage 1 skeleton pass against the proxy workspace.
 *
 * Returns the galaxy (with knowledge + relationships written) and a
 * DispatchPlan that Stage 2 uses to fan out parallel detail agents.
 *
 * @param pageImages - Optional PNG images of PDF pages for vision-based extraction.
 */
export async function runSkeletonStage(
  galaxy: Galaxy,
  pageImages?: { page: number; png: Buffer }[],
): Promise<SkeletonResult> {
  stageStart(galaxy, "structure");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("skeleton: no source chapters");

    // 1. Push source unit files to the workspace.
    const sourceFiles: Record<string, string> = {};
    for (const unit of chapter.units) {
      sourceFiles[`sources/${chapter.id}/${unit.id}.md`] = unit.text;
    }

    // Also push a manifest so the prompt can reference available units.
    const manifest = chapter.units
      .map((u: SourceUnit) => `- ${u.id}: ${u.text.slice(0, 80).replace(/\n/g, " ")}…`)
      .join("\n");
    sourceFiles[`sources/${chapter.id}/_manifest.md`] =
      `# Source Units for ${chapter.id}\n\n${manifest}`;

    // Push page images as binary files if available (PDF uploads).
    const binaryFiles: Record<string, string> | undefined =
      pageImages && pageImages.length > 0
        ? Object.fromEntries(
            pageImages.map((img) => [
              `sources/${chapter.id}/pages/page-${String(img.page).padStart(3, "0")}.png`,
              img.png.toString("base64"),
            ]),
          )
        : undefined;

    console.log(`[skeleton] pushing ${Object.keys(sourceFiles).length} source files to workspace`);
    await pushFiles(galaxy.meta.id, sourceFiles, undefined, binaryFiles);

    // 2. Build and run the skeleton prompt.
    const hasImages = binaryFiles && Object.keys(binaryFiles).length > 0;
    const prompt = buildSkeletonPrompt({
      chapterId: chapter.id,
      sourceUnitIds: chapter.units.map((u: SourceUnit) => u.id),
      hasPageImages: !!hasImages,
      pageCount: pageImages?.length ?? 0,
    });

    console.log(`[skeleton] running Claude Code (prompt ~${Math.round(prompt.length / 1000)}k chars)`);
    const result = await runStage({
      galaxyId: galaxy.meta.id,
      prompt,
    });

    console.log(`[skeleton] Claude Code finished: ok=${result.ok}, exitCode=${result.exitCode}, duration=${result.durationMs}ms`);

    if (!result.ok) {
      throw new Error(`skeleton: Claude Code exited with code ${result.exitCode}`);
    }

    // 3. Compile workspace files into Knowledge + Relationships + DispatchPlan.
    const files = await compileFiles(galaxy.meta.id);

    // Diagnostic: log what the workspace contains.
    const allPaths = Object.keys(files);
    const stage1Paths = allPaths.filter((p) => p.startsWith("stage1-structure/"));
    console.log(
      `[skeleton] workspace has ${allPaths.length} files total, ${stage1Paths.length} in stage1-structure/. Prefixes: ${[...new Set(allPaths.map((p) => p.split("/")[0]))].join(", ")}`,
    );
    if (stage1Paths.length === 0) {
      // Log all paths so we can see where Claude wrote files.
      console.warn(
        `[skeleton] no stage1-structure/ files found! All paths:\n  ${allPaths.slice(0, 30).join("\n  ")}`,
      );
    }

    const compiled = compileStructure(
      files,
      galaxy.meta.title,
      "",
    );

    if (compiled.knowledge.concepts.length === 0) {
      console.warn(
        `[skeleton] compileStructure produced 0 concepts from ${stage1Paths.length} files. ` +
        `Topics: ${compiled.knowledge.topics.length}, Subtopics: ${compiled.knowledge.subtopics.length}`,
      );
      // Log a sample of stage1 files to diagnose parse/type issues.
      for (const p of stage1Paths.slice(0, 5)) {
        console.warn(`[skeleton] sample file "${p}" (first 300 chars): ${files[p].slice(0, 300)}`);
      }
      if (stage1Paths.length === 0) {
        throw new Error(
          "skeleton: Claude produced no stage1-structure/ files — check proxy workspace and prompt",
        );
      }
    }

    // Check if a _summary.md was produced and use its fields.
    const summaryFile = Object.entries(files).find(
      ([p]) => p.includes("_summary.md"),
    );
    if (summaryFile) {
      const { parseNote } = await import("./compile/frontmatter");
      const summary = parseNote(summaryFile[1], summaryFile[0]);
      if (summary.data.title) compiled.knowledge.title = summary.data.title as string;
      if (summary.data.summary) compiled.knowledge.summary = summary.data.summary as string;
    }

    // 4. Write scopes to the blob.
    galaxy.knowledge = compiled.knowledge;
    galaxy.relationships = compiled.relationships;

    // Update meta.chapters with knowledge IDs and chapter metadata.
    const chapterEntry = galaxy.meta.chapters.find((c) => c.id === chapter.id);
    if (chapterEntry) {
      chapterEntry.addedKnowledgeIds = [
        ...compiled.knowledge.topics.map((t) => t.id),
        ...compiled.knowledge.subtopics.map((s) => s.id),
        ...compiled.knowledge.concepts.map((c) => c.id),
      ];
      chapterEntry.structureNote = compiled.structureNote;
      chapterEntry.thematicGroups = compiled.thematicGroups;
      chapterEntry.etcContent = compiled.etcContent;
    }

    stageDone(galaxy, "structure");

    return { galaxy, dispatchPlan: compiled.dispatchPlan };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "structure", message);
    throw err;
  }
}

// Re-export for backward compat during transition.
export const runStructureStage = async (
  galaxy: Galaxy,
  pageImages?: { page: number; png: Buffer }[],
): Promise<void> => {
  await runSkeletonStage(galaxy, pageImages);
};
