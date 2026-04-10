import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspace, workspaceDir } from "./manager";
import type { Galaxy, ConceptDetail } from "@scholarsystem/shared";

/**
 * Reconstruct a workspace directory from a stored Galaxy blob.
 *
 * Called when the API server sends a chapter-extension request: the
 * proxy doesn't keep workspace state long-term (TTL), so it rebuilds
 * the folder tree from the blob before running the delta stages.
 *
 * Writes:
 *   sources/<chapter>/    — one file per source chapter (unit listing)
 *   stage1-structure/     — knowledge notes as frontmatter+markdown
 *   stage2-detail/<topic>/ — detail notes per topic
 *   stage3-narrative/     — canon.md + arcs/<chapter>.md
 *
 * Only populates what earlier stages produced (checks pipeline status).
 */
export async function rehydrateWorkspace(
  galaxyId: string,
  blob: Galaxy,
): Promise<string> {
  const dir = await createWorkspace(galaxyId);

  // --- Sources ---
  for (const chapter of blob.source.chapters) {
    const chapterDir = join(dir, "sources", chapter.id);
    await mkdir(chapterDir, { recursive: true });

    // Write each source unit as a numbered file for Claude Code to read
    for (const unit of chapter.units) {
      await writeFile(
        join(chapterDir, `${unit.id}.md`),
        unit.text,
        "utf-8",
      );
    }
  }

  // --- Stage 1: Structure ---
  if (blob.knowledge && blob.pipeline.structure.status === "done") {
    const structDir = join(dir, "stage1-structure");

    for (const topic of blob.knowledge.topics) {
      const content = knowledgeNoteMarkdown("topic", topic);
      await writeFile(join(structDir, `${topic.id}.md`), content, "utf-8");
    }
    for (const subtopic of blob.knowledge.subtopics) {
      const content = knowledgeNoteMarkdown("subtopic", subtopic);
      await writeFile(
        join(structDir, `${subtopic.id}.md`),
        content,
        "utf-8",
      );
    }
    for (const concept of blob.knowledge.concepts) {
      const content = knowledgeNoteMarkdown("concept", concept);
      await writeFile(
        join(structDir, `${concept.id}.md`),
        content,
        "utf-8",
      );
    }
  }

  // --- Stage 2: Detail ---
  if (blob.pipeline.detail.status === "done") {
    for (const [conceptId, detail] of Object.entries(blob.detail)) {
      if (!detail) continue;

      // Find the parent topic for this concept to determine the subfolder
      const concept = blob.knowledge?.concepts.find(
        (c: { id: string }) => c.id === conceptId,
      );
      if (!concept) continue;

      const subtopic = blob.knowledge?.subtopics.find((s: { conceptIds: string[] }) =>
        s.conceptIds.includes(concept.id),
      );
      const topic = subtopic
        ? blob.knowledge?.topics.find((t: { subtopicIds: string[] }) =>
            t.subtopicIds.includes(subtopic.id),
          )
        : null;

      const topicDir = join(
        dir,
        "stage2-detail",
        topic?.id ?? "uncategorized",
      );
      await mkdir(topicDir, { recursive: true });
      await writeFile(
        join(topicDir, `${conceptId}.md`),
        detailNoteMarkdown(detail as ConceptDetail),
        "utf-8",
      );
    }
  }

  // --- Stage 3: Narrative ---
  if (blob.narrative.canon && blob.pipeline.narrative.status === "done") {
    const narrativeDir = join(dir, "stage3-narrative");
    await writeFile(
      join(narrativeDir, "canon.md"),
      canonMarkdown(blob.narrative.canon),
      "utf-8",
    );

    const arcsDir = join(narrativeDir, "arcs");
    await mkdir(arcsDir, { recursive: true });
    for (const arc of blob.narrative.arcs) {
      await writeFile(
        join(arcsDir, `${arc.chapter}.md`),
        arcMarkdown(arc),
        "utf-8",
      );
    }
  }

  return dir;
}

// ── Markdown serializers ──────────────────────────────────────────
// These produce the Obsidian-style frontmatter+body format that Claude
// Code reads natively. The compile step (server-side) parses them back.

function knowledgeNoteMarkdown(
  level: "topic" | "subtopic" | "concept",
  node: { id: string; title: string; chapter: string; sourceRefs: string[] } & Record<string, unknown>,
): string {
  const fm: Record<string, unknown> = {
    id: node.id,
    chapter: node.chapter,
    level,
    sourceRefs: node.sourceRefs,
  };

  if ("kind" in node) fm.kind = node.kind;
  if ("modelTier" in node) fm.modelTier = node.modelTier;
  if ("subtopicIds" in node) fm.children = node.subtopicIds;
  if ("conceptIds" in node) fm.children = node.conceptIds;

  return `---\n${yamlBlock(fm)}---\n\n# ${node.title}\n\n${
    "summary" in node ? (node.summary as string) : (node as Record<string, unknown>).brief ?? ""
  }\n`;
}

function detailNoteMarkdown(
  d: { conceptId: string; fullDefinition: string; sourceRefs: string[] } & Record<string, unknown>,
): string {
  const fm = {
    id: d.conceptId,
    sourceRefs: d.sourceRefs,
  };
  let body = `# ${d.conceptId}\n\n## Definition\n${d.fullDefinition}\n`;
  if (Array.isArray(d.workedExamples) && d.workedExamples.length) {
    body += `\n## Worked Examples\n${d.workedExamples.map((e: string) => `- ${e}`).join("\n")}\n`;
  }
  return `---\n${yamlBlock(fm)}---\n\n${body}`;
}

function canonMarkdown(
  canon: { setting: string; protagonist: string; premise: string; tone: { primary: string; genre: string } },
): string {
  return `---\ntype: canon\n---\n\n# Setting\n${canon.setting}\n\n# Protagonist\n${canon.protagonist}\n\n# Premise\n${canon.premise}\n\n# Tone\n${canon.tone.primary} / ${canon.tone.genre}\n`;
}

function arcMarkdown(
  arc: { chapter: string; arcSummary: string; chapterHook: string },
): string {
  return `---\nchapter: ${arc.chapter}\n---\n\n# Arc Summary\n${arc.arcSummary}\n\n# Hook\n${arc.chapterHook}\n`;
}

function yamlBlock(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.map((i) => JSON.stringify(i)).join(", ")}]`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join("\n") + "\n";
}
