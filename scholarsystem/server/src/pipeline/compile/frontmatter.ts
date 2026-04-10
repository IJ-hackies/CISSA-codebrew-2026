// Frontmatter parser for Obsidian-style markdown notes.
//
// Each pipeline stage writes notes like:
//   ---
//   id: w1-photosynthesis
//   chapter: w1
//   topic: w1-cellular-biology
//   ...
//   ---
//   # Photosynthesis
//   Body text with [[wikilinks]]...
//
// This module parses those into { data, body } pairs via gray-matter,
// then extracts wikilinks from the body for the relationships scope.

import matter from "gray-matter";

export interface ParsedNote {
  /** YAML frontmatter fields as a plain object. */
  data: Record<string, unknown>;
  /** Markdown body with frontmatter stripped. */
  body: string;
  /** Relative file path within the workspace. */
  path: string;
}

/** Parse a single markdown file's frontmatter + body. */
export function parseNote(content: string, path: string): ParsedNote {
  const { data, content: body } = matter(content);
  return { data: data as Record<string, unknown>, body, path };
}

/** Extract all [[wikilink]] targets from markdown body text. */
export function extractWikilinks(body: string): string[] {
  const matches = body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  const links: string[] = [];
  for (const m of matches) {
    const target = m[1].trim();
    if (target) links.push(target);
  }
  return links;
}
