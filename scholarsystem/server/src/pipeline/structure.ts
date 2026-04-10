// Stage 1: Structure.
//
// Sends source units to the proxy workspace, runs the structure prompt
// via Claude Code, then compiles the resulting Obsidian markdown files
// into Knowledge + Relationships scopes on the Galaxy blob.
//
// When page images are available (PDF uploads), they are pushed to the
// workspace so Claude Code can read them with its vision capability —
// this is how rendered math/formulas/diagrams are preserved.

import type { Galaxy, SourceUnit } from "@scholarsystem/shared";
import { stageStart, stageDone, stageError } from "../lib/blob";
import { pushFiles, runStage, compileFiles } from "../lib/proxy-client";
import { buildStructurePrompt } from "../prompts/structure";
import { compileStructure } from "./compile";

/**
 * Run Stage 1 against the proxy workspace.
 *
 * @param pageImages - Optional PNG images of PDF pages for vision-based extraction.
 */
export async function runStructureStage(
  galaxy: Galaxy,
  pageImages?: { page: number; png: Buffer }[],
): Promise<void> {
  stageStart(galaxy, "structure");

  try {
    const chapter = galaxy.source.chapters[galaxy.source.chapters.length - 1];
    if (!chapter) throw new Error("structure: no source chapters");

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

    await pushFiles(galaxy.meta.id, sourceFiles, undefined, binaryFiles);

    // 2. Build and run the structure prompt.
    const hasImages = binaryFiles && Object.keys(binaryFiles).length > 0;
    const prompt = buildStructurePrompt({
      chapterId: chapter.id,
      sourceUnitIds: chapter.units.map((u: SourceUnit) => u.id),
      hasPageImages: !!hasImages,
      pageCount: pageImages?.length ?? 0,
    });

    const result = await runStage({
      galaxyId: galaxy.meta.id,
      prompt,
    });

    if (!result.ok) {
      throw new Error(`structure: Claude Code exited with code ${result.exitCode}`);
    }

    // 3. Compile workspace files into Knowledge + Relationships.
    const files = await compileFiles(galaxy.meta.id);
    const { knowledge, relationships } = compileStructure(
      files,
      galaxy.meta.title,
      "",
    );

    // Check if a _summary.md was produced and use its fields.
    const summaryFile = Object.entries(files).find(
      ([p]) => p.includes("_summary.md"),
    );
    if (summaryFile) {
      const { parseNote } = await import("./compile/frontmatter");
      const summary = parseNote(summaryFile[1], summaryFile[0]);
      if (summary.data.title) knowledge.title = summary.data.title as string;
      if (summary.data.summary) knowledge.summary = summary.data.summary as string;
    }

    // 4. Write scopes to the blob.
    galaxy.knowledge = knowledge;
    galaxy.relationships = relationships;

    // Update meta.chapters with the knowledge IDs this chapter added.
    const chapterEntry = galaxy.meta.chapters.find((c) => c.id === chapter.id);
    if (chapterEntry) {
      chapterEntry.addedKnowledgeIds = [
        ...knowledge.topics.map((t) => t.id),
        ...knowledge.subtopics.map((s) => s.id),
        ...knowledge.concepts.map((c) => c.id),
      ];
    }

    stageDone(galaxy, "structure");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stageError(galaxy, "structure", message);
    throw err;
  }
}
