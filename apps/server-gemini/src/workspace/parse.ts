// Mesh → GalaxyData. Implements the 3-step parser from .context/SCHEMA.md:
//   1. Build wikilink index across all Mesh/ files
//   2. Parse each entity type, resolving wikilinks to UUIDs
//   3. Assemble into a single GalaxyData JSON object
//
// The output of this function is byte-compatible with `galaxy-data 1.json`
// at the repo root.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";
import matter from "gray-matter";
import { galaxyPaths } from "./layout";
import type {
  GalaxyData,
  SolarSystem,
  Planet,
  Concept,
  Source,
  Story,
  StoryScene,
  UUID,
  WikiLinkIndex,
} from "../types";
import { emptyGalaxy } from "../types";

// ── Filename + wikilink helpers ─────────────────────────────────────

interface ParsedFilename {
  type: "source" | "solar-system" | "planet" | "concept" | "story";
  name: string;
  wikiKey: string;
}

const LABEL_TO_TYPE: Record<string, ParsedFilename["type"]> = {
  Source: "source",
  "Solar System": "solar-system",
  Planet: "planet",
  Concept: "concept",
  Story: "story",
};

function parseMeshFilename(file: string): ParsedFilename | null {
  if (extname(file) !== ".md") return null;
  const stem = basename(file, ".md");
  const m = /^\(([^)]+)\)\s+(.+)$/.exec(stem);
  if (!m) return null;
  const label = m[1].trim();
  const name = m[2].trim();
  const type = LABEL_TO_TYPE[label];
  if (!type) return null;
  return { type, name, wikiKey: `(${label}) ${name}` };
}

// Match `[[(Type) Name]]`, tolerating extra spaces. Returns the wikiKey in
// canonical `(Type) Name` form so it can be looked up in wikiLinkIndex.
const WIKILINK_RE = /\[\[\s*(\([^)]+\)\s*[^\]]+?)\s*\]\]/g;

function extractWikiKeys(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(WIKILINK_RE)) {
    out.push(m[1].replace(/\s+/g, " ").trim());
  }
  return out;
}

function resolveAll(keys: string[], index: WikiLinkIndex): UUID[] {
  const out: UUID[] = [];
  const seen = new Set<UUID>();
  for (const k of keys) {
    const id = index[k];
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// Coerce frontmatter list fields (which may be absent, a single string, or
// an array) into a clean string[] of raw wikilink bodies.
function asLinkList(raw: unknown): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .filter((x): x is string => typeof x === "string")
    .map((s) => {
      const m = /\[\[\s*(.+?)\s*\]\]/.exec(s);
      return (m ? m[1] : s).replace(/\s+/g, " ").trim();
    });
}

// ── Main entry ──────────────────────────────────────────────────────

export function parseWorkspace(galaxyId: string): GalaxyData {
  const paths = galaxyPaths(galaxyId);
  if (!existsSync(paths.mesh)) return emptyGalaxy();

  const entries = readdirSync(paths.mesh).filter((f) => {
    const full = join(paths.mesh, f);
    return statSync(full).isFile() && f.endsWith(".md");
  });

  // ── Step 1: build wikilink index ──
  interface Raw {
    file: string;
    parsed: ParsedFilename;
    frontmatter: Record<string, unknown>;
    body: string;
  }
  const raws: Raw[] = [];
  const wikiLinkIndex: WikiLinkIndex = {};

  for (const file of entries) {
    const parsed = parseMeshFilename(file);
    if (!parsed) continue;
    const full = join(paths.mesh, file);
    const source = readFileSync(full, "utf8");
    const fm = matter(source);
    const id = typeof fm.data.id === "string" ? fm.data.id : null;
    if (!id) continue; // skip files without a real id — they aren't loadable
    wikiLinkIndex[parsed.wikiKey] = id;
    raws.push({ file, parsed, frontmatter: fm.data, body: fm.content });
  }

  // ── Step 2: parse entities ──
  const galaxy = emptyGalaxy();
  galaxy.wikiLinkIndex = wikiLinkIndex;

  for (const r of raws) {
    const id = r.frontmatter.id as string;
    const title = r.parsed.name;
    const markdown = r.body.trim();

    switch (r.parsed.type) {
      case "source": {
        const src: Source = {
          id,
          type: "source",
          title,
          filename:
            typeof r.frontmatter.filename === "string"
              ? (r.frontmatter.filename as string)
              : title,
          mediaRef:
            typeof r.frontmatter["media-ref"] === "string"
              ? (r.frontmatter["media-ref"] as string)
              : "",
          markdown,
        };
        galaxy.sources[id] = src;
        break;
      }
      case "solar-system": {
        const planets = resolveAll(asLinkList(r.frontmatter.planets), wikiLinkIndex);
        const concepts = resolveAll(asLinkList(r.frontmatter.concepts), wikiLinkIndex);
        const ss: SolarSystem = {
          id,
          type: "solar-system",
          title,
          planets,
          concepts,
          markdown,
        };
        galaxy.solarSystems[id] = ss;
        break;
      }
      case "planet": {
        const planetConnections = resolveAll(
          asLinkList(r.frontmatter["planet-connections"]),
          wikiLinkIndex,
        );
        const p: Planet = {
          id,
          type: "planet",
          title,
          planetConnections,
          markdown,
        };
        galaxy.planets[id] = p;
        break;
      }
      case "concept": {
        const planetConnections = resolveAll(
          asLinkList(r.frontmatter["planet-connections"]),
          wikiLinkIndex,
        );
        const conceptConnections = resolveAll(
          asLinkList(r.frontmatter["concept-connections"]),
          wikiLinkIndex,
        );
        const c: Concept = {
          id,
          type: "concept",
          title,
          planetConnections,
          conceptConnections,
          markdown,
        };
        galaxy.concepts[id] = c;
        break;
      }
      case "story": {
        const story = parseStoryBody(id, title, markdown, wikiLinkIndex);
        if (story) galaxy.stories.push(story);
        break;
      }
    }
  }

  // Stable story ordering by title — deterministic output across runs.
  galaxy.stories.sort((a, b) => a.title.localeCompare(b.title));

  return galaxy;
}

// ── Story body splitter ─────────────────────────────────────────────
//
// Input layout (per SCHEMA.md):
//
//   # Title
//
//   ## Introduction
//   <intro prose>
//
//   ---
//   planet: [[(Planet) Name]]
//   <scene prose>
//
//   ---
//   planet: [[(Planet) Name]]
//   <scene prose>
//
//   ---
//
//   ## Conclusion
//   <conclusion prose>
//
// We split on `^---$` lines. The first chunk is the header + intro; the
// last `---` block is always the conclusion (it contains `## Conclusion`).
// Everything in between is a scene with a `planet:` directive.

function parseStoryBody(
  id: UUID,
  title: string,
  body: string,
  wikiLinkIndex: WikiLinkIndex,
): Story | null {
  const chunks = body.split(/^---\s*$/m).map((c) => c.trim());
  if (chunks.length < 2) return null;

  // First chunk: header + introduction
  let introRaw = chunks[0];
  introRaw = introRaw.replace(/^#\s+[^\n]*\n/, ""); // strip title line if present
  introRaw = introRaw.replace(/##\s+Introduction\s*\n?/i, "").trim();

  // Last chunk: conclusion
  const lastChunk = chunks[chunks.length - 1];
  const conclusionRaw = lastChunk.replace(/##\s+Conclusion\s*\n?/i, "").trim();

  // Middle chunks: scenes
  const scenes: StoryScene[] = [];
  for (let i = 1; i < chunks.length - 1; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    // Pull the `planet: [[(Planet) Name]]` directive off the top.
    const m = /^planet:\s*\[\[\s*([^\]]+?)\s*\]\]\s*\n?/i.exec(chunk);
    if (!m) continue;
    const key = m[1].replace(/\s+/g, " ").trim();
    const planetId = wikiLinkIndex[key];
    if (!planetId) continue;
    const sceneBody = chunk.slice(m[0].length).trim();
    scenes.push({ planetId, markdown: sceneBody });
  }

  return {
    id,
    type: "story",
    title,
    introduction: {
      markdown: introRaw,
      conceptIds: resolveAll(
        extractWikiKeys(introRaw).filter((k) => k.startsWith("(Concept)")),
        wikiLinkIndex,
      ),
    },
    scenes,
    conclusion: {
      markdown: conclusionRaw,
      conceptIds: resolveAll(
        extractWikiKeys(conclusionRaw).filter((k) => k.startsWith("(Concept)")),
        wikiLinkIndex,
      ),
    },
  };
}
