/**
 * mesh-parser.ts — Parse a galaxy workspace Mesh/ directory into GalaxyData.
 *
 * Reads all .md files, parses YAML frontmatter and wikilinks,
 * resolves connections to UUIDs, and assembles the full GalaxyData response.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type {
  UUID,
  WikiLinkIndex,
  GalaxyData,
  MeshSource,
  MeshSolarSystem,
  MeshPlanet,
  MeshConcept,
  MeshStory,
  StoryScene,
} from "@scholarsystem/shared";

// ── Parsing helpers ──────────────────────────────────

/** Extract (Type) and Name from a filename like "(Planet) The Bellman Equation.md" */
function parseFilename(filename: string): { type: string; name: string } | null {
  const match = filename.match(/^\(([^)]+)\)\s+(.+)\.md$/);
  if (!match) return null;
  return { type: match[1], name: match[2] };
}

/** Split a markdown file into frontmatter (YAML string) and body */
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: "", body: content };

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      endIndex = i;
      break;
    }
  }
  if (endIndex === -1) return { frontmatter: "", body: content };

  return {
    frontmatter: lines.slice(1, endIndex).join("\n"),
    body: lines.slice(endIndex + 1).join("\n").trim(),
  };
}

/** Parse simple YAML frontmatter — handles scalars and arrays of strings */
function parseFrontmatter(yaml: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = yaml.split("\n");
  let currentKey: string | null = null;

  for (const line of lines) {
    const kvMatch = line.match(/^([a-z][a-z0-9-]*)\s*:\s*(.+)$/);
    if (kvMatch) {
      result[kvMatch[1]!] = kvMatch[2]!.trim().replace(/^"(.*)"$/, "$1");
      currentKey = null;
      continue;
    }

    const keyOnly = line.match(/^([a-z][a-z0-9-]*)\s*:\s*$/);
    if (keyOnly) {
      currentKey = keyOnly[1]!;
      result[currentKey] = [];
      continue;
    }

    const arrayItem = line.match(/^\s+-\s+"?(.+?)"?\s*$/);
    if (arrayItem && currentKey) {
      const arr = result[currentKey];
      if (Array.isArray(arr)) arr.push(arrayItem[1]!);
    }
  }

  return result;
}

/**
 * Extract the (Type) Name key from a wikilink.
 * Handles full-path wikilinks: [[some/path/(Planet) Name]] → "(Planet) Name"
 * And simple wikilinks: [[(Planet) Name]] → "(Planet) Name"
 */
function extractWikiLinkKey(wikilink: string): string {
  let inner = wikilink.replace(/^\[\[/, "").replace(/\]\]$/, "");
  if (inner.includes("/")) inner = inner.split("/").pop()!;
  return inner;
}

/** Resolve an array of wikilink strings to UUIDs via the index */
function resolveWikiLinks(links: string[], index: WikiLinkIndex): UUID[] {
  return links
    .map((link) => index[extractWikiLinkKey(link)])
    .filter((id): id is UUID => id !== undefined);
}

/** Extract all [[(Concept) Name]] references from markdown text, return UUIDs */
function extractConceptIds(markdown: string, index: WikiLinkIndex): UUID[] {
  const ids: UUID[] = [];
  const re = /\[\[([^\]]*\(Concept\)[^\]]*)\]\]/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const id = index[extractWikiLinkKey(`[[${m[1]}]]`)];
    if (id) ids.push(id);
  }
  return [...new Set(ids)];
}

/** Parse a story body into introduction, scenes, and conclusion */
function parseStoryBody(
  body: string,
  index: WikiLinkIndex,
): {
  introduction: { markdown: string; conceptIds: UUID[] };
  scenes: StoryScene[];
  conclusion: { markdown: string; conceptIds: UUID[] };
} {
  const introMatch = body.match(/## Introduction\s*\n([\s\S]*?)(?=\n---\n)/);
  const conclusionMatch = body.match(/## Conclusion\s*\n([\s\S]*?)$/);

  const introMarkdown = introMatch?.[1]?.trim() ?? "";
  const conclusionMarkdown = conclusionMatch?.[1]?.trim() ?? "";

  // Extract scene blocks between intro and conclusion
  const betweenMatch = body.match(
    /## Introduction[\s\S]*?\n---\n([\s\S]*?)(?=\n---\n\n## Conclusion|\n## Conclusion)/,
  );
  const scenesBlock = betweenMatch?.[1] ?? "";
  const scenes: StoryScene[] = [];

  for (const chunk of scenesBlock.split(/\n---\n/)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const planetMatch = trimmed.match(/^planet:\s*\[\[([^\]]+)\]\]/m);
    if (!planetMatch) continue;

    const planetId = index[extractWikiLinkKey(`[[${planetMatch[1]}]]`)];
    if (!planetId) continue;

    const sceneMarkdown = trimmed.replace(/^planet:\s*\[\[[^\]]+\]\]\s*\n?/m, "").trim();
    scenes.push({ planetId, markdown: sceneMarkdown });
  }

  return {
    introduction: { markdown: introMarkdown, conceptIds: extractConceptIds(introMarkdown, index) },
    scenes,
    conclusion: { markdown: conclusionMarkdown, conceptIds: extractConceptIds(conclusionMarkdown, index) },
  };
}

// ── Public API ───────────────────────────────────────

/**
 * Parse all markdown files in a Mesh/ directory and return GalaxyData.
 * @param meshDir Absolute path to the Mesh/ directory
 */
export async function parseMeshDirectory(meshDir: string): Promise<GalaxyData> {
  const files = await readdir(meshDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  // Step 1: Build WikiLink Index
  const wikiLinkIndex: WikiLinkIndex = {};
  const fileData: Map<
    string,
    { parsed: NonNullable<ReturnType<typeof parseFilename>>; fm: Record<string, string | string[]>; body: string }
  > = new Map();

  for (const file of mdFiles) {
    const parsed = parseFilename(file);
    if (!parsed) continue;

    const content = await readFile(join(meshDir, file), "utf-8");
    const { frontmatter, body } = splitFrontmatter(content);
    const fm = parseFrontmatter(frontmatter);
    const id = fm.id as string;
    if (!id) continue;

    wikiLinkIndex[`(${parsed.type}) ${parsed.name}`] = id;
    fileData.set(file, { parsed, fm, body });
  }

  // Step 2: Parse entities
  const solarSystems: Record<UUID, MeshSolarSystem> = {};
  const planets: Record<UUID, MeshPlanet> = {};
  const concepts: Record<UUID, MeshConcept> = {};
  const stories: MeshStory[] = [];
  const sources: Record<UUID, MeshSource> = {};

  for (const [, { parsed, fm, body }] of fileData) {
    const id = fm.id as string;
    const title = parsed.name;

    switch (parsed.type) {
      case "Source":
        sources[id] = {
          id,
          type: "source",
          title,
          filename: (fm.filename as string) ?? "",
          mediaRef: (fm["media-ref"] as string) ?? "",
          markdown: body,
        };
        break;

      case "Solar System":
        solarSystems[id] = {
          id,
          type: "solar-system",
          title,
          planets: resolveWikiLinks(Array.isArray(fm.planets) ? fm.planets : [], wikiLinkIndex),
          concepts: resolveWikiLinks(Array.isArray(fm.concepts) ? fm.concepts : [], wikiLinkIndex),
          markdown: body,
        };
        break;

      case "Planet":
        planets[id] = {
          id,
          type: "planet",
          title,
          planetConnections: resolveWikiLinks(
            Array.isArray(fm["planet-connections"]) ? fm["planet-connections"] : [],
            wikiLinkIndex,
          ),
          markdown: body,
        };
        break;

      case "Concept":
        concepts[id] = {
          id,
          type: "concept",
          title,
          planetConnections: resolveWikiLinks(
            Array.isArray(fm["planet-connections"]) ? fm["planet-connections"] : [],
            wikiLinkIndex,
          ),
          conceptConnections: resolveWikiLinks(
            Array.isArray(fm["concept-connections"]) ? fm["concept-connections"] : [],
            wikiLinkIndex,
          ),
          markdown: body,
        };
        break;

      case "Story":
        stories.push({ id, type: "story", title, ...parseStoryBody(body, wikiLinkIndex) });
        break;
    }
  }

  // Step 3: Assemble
  return { solarSystems, planets, concepts, stories, sources, media: {}, wikiLinkIndex };
}
