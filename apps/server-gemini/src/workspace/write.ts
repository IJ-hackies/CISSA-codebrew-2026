// Entity → markdown. Produces `(Type) Name.md` files with YAML frontmatter
// and `[[(Type) Name]]` wikilinks, matching the spec in .context/SCHEMA.md.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureGalaxyDirs } from "./layout";
import { meshFilename, sanitizeTitle, wikiLinkKey, type EntityType } from "../lib/sanitize";
import type {
  SolarSystem,
  Planet,
  Concept,
  Source,
  Story,
  UUID,
} from "../types";

// ── Frontmatter emitter ─────────────────────────────────────────────
// We hand-write YAML instead of pulling in a serializer. The shapes we
// emit are narrow: strings, string arrays, and the occasional quoted
// wikilink. Keeping it local means we own round-tripping with parse.ts.

function yamlQuote(s: string): string {
  // Single quotes let us embed the `(Type) Name` wikilink shape without
  // YAML treating `(` as special. Escape embedded single quotes.
  return `'${s.replace(/'/g, "''")}'`;
}

function yamlList(key: string, items: string[]): string {
  if (items.length === 0) return `${key}: []`;
  return `${key}:\n${items.map((v) => `  - ${yamlQuote(v)}`).join("\n")}`;
}

function frontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(yamlList(k, v as string[]));
    } else if (typeof v === "string") {
      lines.push(`${k}: ${yamlQuote(v)}`);
    } else {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function writeMesh(
  galaxyId: string,
  type: EntityType,
  title: string,
  contents: string,
): string {
  const paths = ensureGalaxyDirs(galaxyId);
  const fname = meshFilename(type, title);
  const full = join(paths.mesh, fname);
  writeFileSync(full, contents, "utf8");
  return full;
}

// ── Per-entity writers ──────────────────────────────────────────────

export function writeSource(
  galaxyId: string,
  s: { id: UUID; title: string; filename: string; mediaRef: string; body: string },
): string {
  const fm = frontmatter({
    id: s.id,
    type: "source",
    filename: s.filename,
    "media-ref": s.mediaRef,
  });
  const body = `# ${s.title}\n\n${s.body.trim()}\n`;
  return writeMesh(galaxyId, "source", s.title, fm + body);
}

export function writeSolarSystem(
  galaxyId: string,
  ss: {
    id: UUID;
    title: string;
    planetTitles: string[];
    conceptTitles: string[];
    body: string;
  },
): string {
  const fm = frontmatter({
    id: ss.id,
    type: "solar-system",
    planets: ss.planetTitles.map((t) => `[[${wikiLinkKey("planet", t)}]]`),
    concepts: ss.conceptTitles.map((t) => `[[${wikiLinkKey("concept", t)}]]`),
  });
  const body = `# ${sanitizeTitle(ss.title)}\n\n${ss.body.trim()}\n`;
  return writeMesh(galaxyId, "solar-system", ss.title, fm + body);
}

export function writePlanet(
  galaxyId: string,
  p: {
    id: UUID;
    title: string;
    planetConnections: string[]; // titles
    body: string;
  },
): string {
  const fm = frontmatter({
    id: p.id,
    type: "planet",
    "planet-connections": p.planetConnections.map(
      (t) => `[[${wikiLinkKey("planet", t)}]]`,
    ),
  });
  const body = `# ${sanitizeTitle(p.title)}\n\n${p.body.trim()}\n`;
  return writeMesh(galaxyId, "planet", p.title, fm + body);
}

export function writeConcept(
  galaxyId: string,
  c: {
    id: UUID;
    title: string;
    planetConnections: string[];
    conceptConnections: string[];
    body: string;
  },
): string {
  const fm = frontmatter({
    id: c.id,
    type: "concept",
    "planet-connections": c.planetConnections.map(
      (t) => `[[${wikiLinkKey("planet", t)}]]`,
    ),
    "concept-connections": c.conceptConnections.map(
      (t) => `[[${wikiLinkKey("concept", t)}]]`,
    ),
  });
  const body = `# ${sanitizeTitle(c.title)}\n\n${c.body.trim()}\n`;
  return writeMesh(galaxyId, "concept", c.title, fm + body);
}

export function writeStory(
  galaxyId: string,
  story: {
    id: UUID;
    title: string;
    introduction: string;
    scenes: { planetTitle: string; markdown: string }[];
    conclusion: string;
  },
): string {
  const fm = frontmatter({ id: story.id, type: "story" });

  const parts: string[] = [];
  parts.push(`# ${sanitizeTitle(story.title)}`);
  parts.push("");
  parts.push("## Introduction");
  parts.push("");
  parts.push(story.introduction.trim());
  parts.push("");
  for (const scene of story.scenes) {
    parts.push("---");
    parts.push(`planet: [[${wikiLinkKey("planet", scene.planetTitle)}]]`);
    parts.push("");
    parts.push(scene.markdown.trim());
    parts.push("");
  }
  parts.push("---");
  parts.push("");
  parts.push("## Conclusion");
  parts.push("");
  parts.push(story.conclusion.trim());
  parts.push("");

  return writeMesh(galaxyId, "story", story.title, fm + parts.join("\n"));
}
