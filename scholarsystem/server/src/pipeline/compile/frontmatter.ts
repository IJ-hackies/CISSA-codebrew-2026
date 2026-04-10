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
  const sanitized = sanitizeFrontmatter(content);
  const { data, content: body } = matter(sanitized);
  return { data: data as Record<string, unknown>, body, path };
}

/**
 * Pre-process raw markdown content to fix common YAML frontmatter issues
 * that Claude produces: unquoted colons, missing closing delimiters,
 * tabs in indentation, BOM characters.
 */
export function sanitizeFrontmatter(content: string): string {
  // Strip BOM.
  let s = content.replace(/^\uFEFF/, "");

  // Must start with --- to have frontmatter.
  if (!s.startsWith("---")) return s;

  // Find the closing --- delimiter.
  const lines = s.split("\n");
  let closingIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      closingIdx = i;
      break;
    }
  }

  // If no closing --- found, insert one before the first heading or first
  // blank line (whichever comes first after line 1).
  if (closingIdx === -1) {
    for (let i = 1; i < lines.length; i++) {
      if (/^#\s/.test(lines[i]) || lines[i].trim() === "") {
        lines.splice(i, 0, "---");
        closingIdx = i;
        break;
      }
    }
    // If still not found, append at end.
    if (closingIdx === -1) {
      lines.push("---");
      closingIdx = lines.length - 1;
    }
  }

  // Sanitize only the frontmatter block (lines 1..closingIdx-1).
  for (let i = 1; i < closingIdx; i++) {
    // Normalize tabs to 2-space indent.
    lines[i] = lines[i].replace(/\t/g, "  ");

    // Quote values that contain unquoted colons.
    // Match: `key: value: with colons` but not already-quoted values,
    // array lines (starting with -), or keys with nested objects.
    const m = lines[i].match(/^(\s*[\w][\w\s]*?):\s+(.+)$/);
    if (m) {
      const key = m[1];
      const value = m[2];
      // Only quote if value contains a colon and isn't already quoted or a
      // YAML array/object/anchor.
      if (
        value.includes(":") &&
        !/^["']/.test(value) &&
        !/^\[/.test(value) &&
        !/^\{/.test(value) &&
        !/^[&*]/.test(value) &&
        !/^>/.test(value) &&
        !/^\|/.test(value)
      ) {
        const escaped = value.replace(/"/g, '\\"');
        lines[i] = `${key}: "${escaped}"`;
      }
    }
  }

  return lines.join("\n");
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

// ─── Derivative parser ──────────────────────────────────────────────

export interface ParsedDerivative {
  sourceRef: string;
  quotes: string[];
}

/**
 * Parse a `# Derivatives` section from a concept's markdown body.
 *
 * Expected format:
 *   # Derivatives
 *   ## w1-s-0042
 *   > "verbatim quote..."
 *   > "another quote..."
 *   ## w1-s-0043
 *   > "quote from unit 43..."
 */
export function extractDerivatives(body: string): ParsedDerivative[] {
  // Find the # Derivatives section.
  const derivIdx = body.search(/^#\s+Derivatives\s*$/m);
  if (derivIdx === -1) return [];

  // Slice from # Derivatives to the next top-level heading or EOF.
  const rest = body.slice(derivIdx);
  const nextH1 = rest.search(/\n#\s+(?!#)/);
  const section = nextH1 !== -1 ? rest.slice(0, nextH1) : rest;

  const results: ParsedDerivative[] = [];
  let current: ParsedDerivative | null = null;

  for (const line of section.split("\n")) {
    // ## source-unit-id heading
    const headingMatch = line.match(/^##\s+(\S+)/);
    if (headingMatch) {
      if (current && current.quotes.length > 0) results.push(current);
      current = { sourceRef: headingMatch[1], quotes: [] };
      continue;
    }

    // > "quote text" or > quote text
    const quoteMatch = line.match(/^>\s*"?(.+?)"?\s*$/);
    if (quoteMatch && current) {
      const q = quoteMatch[1].trim();
      if (q) current.quotes.push(q);
    }
  }

  if (current && current.quotes.length > 0) results.push(current);
  return results;
}
