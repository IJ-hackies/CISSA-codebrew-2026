import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkspace } from "./manager";
import type {
  Cluster,
  Entry,
  Galaxy,
  Group,
  RelationshipEdge,
  Wrap,
} from "@scholarsystem/shared";

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
 *   stage2-wraps/         — one wrap note per knowledge node
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
  if (blob.knowledge && blob.pipeline.structure.status === "complete") {
    const structDir = join(dir, "stage1-structure");
    await mkdir(structDir, { recursive: true });

    const linksBySource = buildLinksBySource(blob.relationships.edges);
    const notes = [
      ...blob.knowledge.clusters.map((cluster) =>
        structureNoteMarkdown(cluster, linksBySource.get(cluster.id) ?? []),
      ),
      ...blob.knowledge.groups.map((group) =>
        structureNoteMarkdown(group, linksBySource.get(group.id) ?? []),
      ),
      ...blob.knowledge.entries.map((entry) =>
        structureNoteMarkdown(entry, linksBySource.get(entry.id) ?? []),
      ),
    ];

    for (const note of notes) {
      await writeFile(join(structDir, `${note.id}.md`), note.content, "utf-8");
    }
  }

  // --- Stage 2: Wraps ---
  if (blob.pipeline.wraps.status === "complete") {
    const wrapDir = join(dir, "stage2-wraps");
    await mkdir(wrapDir, { recursive: true });

    for (const wrap of Object.values(blob.wraps)) {
      await writeFile(
        join(wrapDir, `${wrap.nodeId}.md`),
        wrapNoteMarkdown(wrap),
        "utf-8",
      );
    }
  }

  return dir;
}

// ── Markdown serializers ──────────────────────────────────────────
// These produce the Obsidian-style frontmatter+body format that Claude
// Code reads natively. The compile step (server-side) parses them back.

function buildLinksBySource(edges: RelationshipEdge[]): Map<string, string[]> {
  const linksBySource = new Map<string, string[]>();
  for (const edge of edges) {
    const existing = linksBySource.get(edge.source) ?? [];
    existing.push(edge.target);
    linksBySource.set(edge.source, existing);
  }
  return linksBySource;
}

function structureNoteMarkdown(
  node: Cluster | Group | Entry,
  relatedIds: string[],
): { id: string; content: string } {
  const fm: Record<string, unknown> = {
    id: node.id,
    chapter: node.chapter,
    title: node.title,
    brief: node.brief,
    sourceRefs: node.sourceRefs,
  };

  if ("groupIds" in node) {
    fm.type = "cluster";
  } else if ("entryIds" in node) {
    fm.type = "group";
    fm.cluster = node.clusterId;
  } else {
    fm.type = "entry";
    fm.group = node.groupId;
    fm.kind = node.kind;
  }

  const sections = [`# ${node.title}`, "", node.brief];
  if (relatedIds.length > 0) {
    sections.push("", "## Links", "", ...relatedIds.map((id) => `[[${id}]]`));
  }

  return {
    id: node.id,
    content: `---\n${yamlBlock(fm)}---\n\n${sections.join("\n")}\n`,
  };
}

function wrapNoteMarkdown(wrap: Wrap): string {
  const derivativesSection =
    wrap.derivatives.length > 0
      ? "\n# Derivatives\n\n" +
        wrap.derivatives
          .map((derivative) => `## ${derivative.sourceRef}\n> "${derivative.quote}"`)
          .join("\n\n")
      : "";

  const fm: Record<string, unknown> = {
    nodeId: wrap.nodeId,
    level: wrap.level,
    headline: wrap.headline,
    summary: wrap.summary,
    mood: wrap.mood,
    color: wrap.color,
    stats: wrap.stats,
    highlights: wrap.highlights,
    sourceRefs: wrap.sourceRefs,
  };

  let body = `# ${wrap.headline}\n\n${wrap.summary}`;

  if (wrap.level === "cluster") {
    fm.dateRange = wrap.dateRange;
    fm.topEntries = wrap.topEntries;
    fm.themes = wrap.themes;
  } else if (wrap.level === "group") {
    fm.theme = wrap.theme;
  } else {
    fm.keyFacts = wrap.keyFacts;
    fm.connections = wrap.connections;
    body = `# ${wrap.headline}\n\n${wrap.body}`;
  }

  return `---\n${yamlBlock(fm)}---\n\n${body}${derivativesSection}\n`;
}

function yamlBlock(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.map((i) => JSON.stringify(i)).join(", ")}]`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join("\n") + "\n";
}
