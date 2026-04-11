// Turn an arbitrary title into a safe `(Type) Name.md` filename component.
// The wikilink format is `[[(Type) Name]]` so the sanitized name is what
// BOTH the filename and the wikilink use — they must match exactly.

const UNSAFE = /[<>:"/\\|?*\x00-\x1F]/g;

export function sanitizeTitle(title: string): string {
  // Strip filesystem-unsafe chars, collapse whitespace, trim.
  // Preserve most punctuation (apostrophes, commas, parens) because the
  // galaxy-data 1.json fixture uses titles like "The Cartographer of Consequences"
  // and we want the wikilink to round-trip cleanly.
  const cleaned = title
    .replace(UNSAFE, "")
    .replace(/\s+/g, " ")
    .trim();
  // Trailing dots/spaces are illegal on Windows filenames.
  return cleaned.replace(/[\s.]+$/, "");
}

export type EntityType = "source" | "solar-system" | "planet" | "concept" | "story";

export function entityTypeLabel(type: EntityType): string {
  switch (type) {
    case "source":
      return "Source";
    case "solar-system":
      return "Solar System";
    case "planet":
      return "Planet";
    case "concept":
      return "Concept";
    case "story":
      return "Story";
  }
}

export function meshFilename(type: EntityType, title: string): string {
  return `(${entityTypeLabel(type)}) ${sanitizeTitle(title)}.md`;
}

export function wikiLinkKey(type: EntityType, title: string): string {
  return `(${entityTypeLabel(type)}) ${sanitizeTitle(title)}`;
}
