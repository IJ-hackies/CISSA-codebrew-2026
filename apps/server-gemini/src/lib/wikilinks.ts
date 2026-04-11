import { sanitizeTitle, wikiLinkKey, type EntityType } from "./sanitize";

interface WikilinkCatalog {
  planets: string[];
  concepts: string[];
}

function buildTypeMap(
  planets: string[],
  concepts: string[],
): Map<string, EntityType | "ambiguous"> {
  const map = new Map<string, EntityType | "ambiguous">();

  for (const title of planets) {
    const key = sanitizeTitle(title);
    map.set(key, map.has(key) ? "ambiguous" : "planet");
  }

  for (const title of concepts) {
    const key = sanitizeTitle(title);
    map.set(key, map.has(key) ? "ambiguous" : "concept");
  }

  return map;
}

function splitWikilink(inner: string): { title: string; typeHint?: EntityType } {
  const trimmed = inner.trim();
  const typed = trimmed.match(/^\(([^)]+)\)\s*(.+)$/);
  if (!typed) return { title: trimmed };

  const rawType = typed[1].trim().toLowerCase().replace(/\s+/g, "-");
  const title = typed[2].trim();
  const typeHint =
    rawType === "planet" || rawType === "concept" ? (rawType as EntityType) : undefined;

  return { title, typeHint };
}

export function canonicalizeGeneratedWikilinks(
  markdown: string,
  catalog: WikilinkCatalog,
): string {
  const typeByTitle = buildTypeMap(catalog.planets, catalog.concepts);

  return markdown.replace(/\[\[([^[\]]+)\]\]/g, (match, inner: string) => {
    const { title, typeHint } = splitWikilink(inner);
    const cleanTitle = sanitizeTitle(title);
    const resolvedType = typeByTitle.get(cleanTitle);

    if (!resolvedType || resolvedType === "ambiguous") return match;
    if (typeHint && typeHint === resolvedType) {
      return `[[${wikiLinkKey(resolvedType, cleanTitle)}]]`;
    }

    return `[[${wikiLinkKey(resolvedType, cleanTitle)}]]`;
  });
}
