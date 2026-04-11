// Compile step: workspace folders → Galaxy blob scopes.
//
// Reads the flat record of { relativePath → content } returned by the
// proxy's GET /session/:id/compile endpoint. Each stage folder contains
// Obsidian-style markdown notes with YAML frontmatter + [[wikilinks]].
//
// This module walks the files, parses frontmatter, extracts wikilinks,
// validates everything against Zod, and returns partial Galaxy scopes
// that the orchestrator merges into the blob.
//
// Intentionally returns scopes individually rather than a full Galaxy —
// the orchestrator decides which scopes to write at each stage boundary.

import {
  Cluster,
  Group,
  Entry,
  EntryKind,
  EdgeType,
  RelationshipEdge,
  Mood,
  ClusterWrap,
  GroupWrap,
  EntryWrap,
  Slug,
} from "@scholarsystem/shared";
import type {
  Cluster as ClusterType,
  Group as GroupType,
  Entry as EntryType,
  EntryKind as EntryKindType,
  RelationshipEdge as RelationshipEdgeType,
  EdgeType as EdgeTypeType,
  Knowledge as KnowledgeType,
  ChapterId,
  ClusterWrap as ClusterWrapType,
  GroupWrap as GroupWrapType,
  EntryWrap as EntryWrapType,
} from "@scholarsystem/shared";
import { z } from "zod";
import {
  parseNote,
  extractWikilinks,
  extractDerivatives,
  type ParsedNote,
} from "./frontmatter";

// ─── Dispatch plan (output of skeleton compile) ──────────────────────

export interface DispatchPlan {
  /** All node IDs grouped by cluster for scoped fan-out. */
  clusterChunks: {
    clusterId: string;
    nodeIds: string[];
    sourceUnitIds: string[];
  }[];
  /** Loose entries not in any group. */
  looseEntryIds: string[];
}

// ─── Stage 1 compile: stage1-structure/ → Knowledge + Relationships ───

export interface CompiledStructure {
  knowledge: KnowledgeType;
  relationships: RelationshipEdgeType[];
  dispatchPlan: DispatchPlan;
}

/**
 * Compile Stage 1 skeleton output from workspace markdown files.
 *
 * Expects files under `stage1-structure/` with frontmatter fields:
 *   - id, chapter, type ("cluster" | "group" | "entry"), title
 *   - cluster nodes: brief, sourceRefs
 *   - group nodes: brief, sourceRefs, cluster (parent ref)
 *   - entry nodes: brief, sourceRefs, group (parent ref, nullable), kind (EntryKind)
 *
 * Returns Knowledge + Relationships + a DispatchPlan for Stage 2 fan-out.
 */
export function compileStructure(
  files: Record<string, string>,
): CompiledStructure {
  const notes = pickStageFiles(files, "stage1-structure/");

  const clusters: ClusterType[] = [];
  const groups: GroupType[] = [];
  const entries: EntryType[] = [];
  const relationships: RelationshipEdgeType[] = [];

  // Track parent references to wire up groupIds/entryIds.
  const groupsByCluster = new Map<string, string[]>();
  const entriesByGroup = new Map<string, string[]>();

  // Wikilinks accumulator: source note id → target ids.
  const wikilinkEdges: { from: string; to: string; sourceRefs: string[]; chapter: string }[] = [];

  for (const note of notes) {
    const d = note.data;
    const type = d.type as string;

    // Sanitize all slug-shaped fields before Zod validation.
    // Claude occasionally generates IDs with uppercase, underscores,
    // leading digits after hyphens, etc. Fix them here rather than
    // failing the entire stage.
    if (d.id) d.id = sanitizeSlug(d.id as string);
    if (d.cluster) d.cluster = sanitizeSlug(d.cluster as string);
    if (d.group) d.group = sanitizeSlug(d.group as string);
    if (d.sourceRefs) {
      d.sourceRefs = asStringArray(d.sourceRefs).map(sanitizeSlug);
    }

    switch (type) {
      case "cluster": {
        const c = Cluster.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          brief: d.brief ?? "",
          sourceRefs: asStringArray(d.sourceRefs),
          groupIds: [], // filled below
        });
        clusters.push(c);
        break;
      }
      case "group": {
        const g = Group.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          brief: d.brief ?? "",
          sourceRefs: asStringArray(d.sourceRefs),
          clusterId: d.cluster as string,
          entryIds: [], // filled below
        });
        groups.push(g);
        const parentCluster = d.cluster as string;
        if (parentCluster) {
          const arr = groupsByCluster.get(parentCluster) ?? [];
          arr.push(g.id);
          groupsByCluster.set(parentCluster, arr);
        }
        break;
      }
      case "entry": {
        const kind = coerceEnum(
          d.kind,
          EntryKind.options,
          "moment",
        );
        const e = Entry.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          brief: d.brief ?? "",
          sourceRefs: asStringArray(d.sourceRefs),
          groupId: (d.group as string) ?? null,
          kind,
        });
        entries.push(e);

        const parentGroup = d.group as string | undefined;
        if (parentGroup) {
          const arr = entriesByGroup.get(parentGroup) ?? [];
          arr.push(e.id);
          entriesByGroup.set(parentGroup, arr);
        }
        break;
      }
      case "summary": {
        // Handled by the caller (skeleton.ts reads _summary.md separately).
        continue;
      }
      default:
        continue;
    }

    // Extract wikilinks from body → relationship edges (sanitize targets too).
    const links = extractWikilinks(note.body).map(sanitizeSlug);
    const noteId = d.id as string;
    const sourceRefs = asStringArray(d.sourceRefs);
    const chapter = d.chapter as string;
    for (const target of links) {
      wikilinkEdges.push({ from: noteId, to: target, sourceRefs, chapter });
    }
  }

  // Wire up parent→child id arrays.
  for (const c of clusters) {
    c.groupIds = (groupsByCluster.get(c.id) ?? []) as typeof c.groupIds;
  }
  for (const g of groups) {
    g.entryIds = (entriesByGroup.get(g.id) ?? []) as typeof g.entryIds;
  }

  // Build a set of all known ids for filtering valid wikilink edges.
  const allIds = new Set<string>([
    ...clusters.map((c) => c.id),
    ...groups.map((g) => g.id),
    ...entries.map((e) => e.id),
  ]);

  // Convert wikilink edges into typed RelationshipEdges.
  let edgeCounter = 0;
  for (const edge of wikilinkEdges) {
    if (!allIds.has(edge.from) || !allIds.has(edge.to)) continue;
    if (edge.from === edge.to) continue;

    const rel = RelationshipEdge.parse({
      id: `${edge.chapter}-rel-${String(++edgeCounter).padStart(4, "0")}`,
      source: edge.from,
      target: edge.to,
      type: "related" as EdgeTypeType,
      weight: 0.5,
      sourceRefs: edge.sourceRefs,
      chapter: edge.chapter,
    });
    relationships.push(rel);
  }

  // Deduplicate relationships by source→target→type.
  const seen = new Set<string>();
  const dedupedRels = relationships.filter((r) => {
    const key = `${r.source}→${r.target}→${r.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const knowledge: KnowledgeType = {
    clusters,
    groups,
    entries,
  };

  // Build the dispatch plan for Stage 2 parallel fan-out.
  const dispatchPlan = buildDispatchPlan(knowledge);

  return {
    knowledge,
    relationships: dedupedRels,
    dispatchPlan,
  };
}

/**
 * Build a dispatch plan mapping each cluster to its node IDs and source units.
 */
function buildDispatchPlan(knowledge: KnowledgeType): DispatchPlan {
  const clusterChunks: DispatchPlan["clusterChunks"] = [];
  const looseEntryIds: string[] = [];

  const groupsByCluster = new Map<string, GroupType[]>();
  for (const g of knowledge.groups) {
    const arr = groupsByCluster.get(g.clusterId) ?? [];
    arr.push(g);
    groupsByCluster.set(g.clusterId, arr);
  }

  const entriesByGroup = new Map<string, EntryType[]>();
  for (const e of knowledge.entries) {
    if (e.groupId) {
      const arr = entriesByGroup.get(e.groupId) ?? [];
      arr.push(e);
      entriesByGroup.set(e.groupId, arr);
    } else {
      looseEntryIds.push(e.id);
    }
  }

  for (const cluster of knowledge.clusters) {
    const nodeIds: string[] = [cluster.id];
    const sourceUnitIds = new Set<string>(cluster.sourceRefs);

    const clusterGroups = groupsByCluster.get(cluster.id) ?? [];
    for (const g of clusterGroups) {
      nodeIds.push(g.id);
      for (const ref of g.sourceRefs) sourceUnitIds.add(ref);

      const groupEntries = entriesByGroup.get(g.id) ?? [];
      for (const e of groupEntries) {
        nodeIds.push(e.id);
        for (const ref of e.sourceRefs) sourceUnitIds.add(ref);
      }
    }

    clusterChunks.push({
      clusterId: cluster.id,
      nodeIds,
      sourceUnitIds: [...sourceUnitIds],
    });
  }

  return { clusterChunks, looseEntryIds };
}

// ─── Stage 2 compile: stage2-wraps/ → Wraps record ──────────────────

export interface CompiledWraps {
  wraps: Record<string, ClusterWrapType | GroupWrapType | EntryWrapType>;
  /** All derivatives extracted for coverage checking. */
  allDerivatives: { sourceRef: string; quote: string }[];
}

/**
 * Compile Stage 2 output from workspace markdown files.
 *
 * Expects files under `stage2-wraps/` with:
 *   - YAML frontmatter matching WrapBase + level-specific fields
 *   - Body text (for entry wraps: the 200-300 word content)
 *   - # Derivatives section with ## source-unit-id + > "quotes"
 *
 * Parses the `level` field to select the correct discriminated union variant.
 */
export function compileWraps(files: Record<string, string>): CompiledWraps {
  const notes = pickStageFiles(files, "stage2-wraps/");
  const wraps: Record<string, ClusterWrapType | GroupWrapType | EntryWrapType> = {};
  const allDerivatives: { sourceRef: string; quote: string }[] = [];

  for (const note of notes) {
    const d = note.data;
    const nodeId = (d.nodeId as string) ?? (d.id as string);
    if (!nodeId) continue;

    const level = d.level as string;
    if (!level || !["cluster", "group", "entry"].includes(level)) {
      console.warn(`compile: skipping wrap with invalid level "${level}": ${note.path}`);
      continue;
    }

    // Parse derivatives from the body's # Derivatives section.
    const parsedDerivs = extractDerivatives(note.body);
    const derivatives: { sourceRef: string; quote: string }[] = [];

    for (const pd of parsedDerivs) {
      for (const q of pd.quotes) {
        derivatives.push({ sourceRef: pd.sourceRef, quote: q });
        allDerivatives.push({ sourceRef: pd.sourceRef, quote: q });
      }
    }

    // Derive sourceRefs from derivatives, merged with frontmatter sourceRefs.
    const derivSourceRefs = new Set<string>(derivatives.map((d) => d.sourceRef));
    for (const ref of asStringArray(d.sourceRefs)) derivSourceRefs.add(ref);
    const sourceRefs = [...derivSourceRefs];

    // Extract body text before # Derivatives section.
    let bodyText = note.body.trim();
    const derivIdx = bodyText.search(/^#\s+Derivatives\s*$/m);
    if (derivIdx >= 0) {
      bodyText = bodyText.slice(0, derivIdx).trim();
    }

    // Coerce mood to valid enum.
    const mood = coerceEnum(d.mood, Mood.options, "curious");

    // Base fields shared by all levels.
    const base = {
      nodeId,
      headline: (d.headline as string) ?? "",
      summary: (d.summary as string) ?? "",
      mood,
      color: (d.color as string) ?? "#888888",
      stats: parseWrapStats(d.stats),
      highlights: asStringArray(d.highlights),
      derivatives,
      sourceRefs,
    };

    try {
      switch (level) {
        case "cluster": {
          const wrap = ClusterWrap.parse({
            ...base,
            level: "cluster",
            dateRange: (d.dateRange as string) ?? undefined,
            topEntries: asStringArray(d.topEntries),
            themes: asStringArray(d.themes),
          });
          wraps[nodeId] = wrap;
          break;
        }
        case "group": {
          const wrap = GroupWrap.parse({
            ...base,
            level: "group",
            theme: (d.theme as string) ?? "",
          });
          wraps[nodeId] = wrap;
          break;
        }
        case "entry": {
          const wrap = EntryWrap.parse({
            ...base,
            level: "entry",
            body: bodyText || ((d.body as string) ?? ""),
            keyFacts: parseWrapFacts(d.keyFacts),
            connections: parseWrapConnections(d.connections),
          });
          wraps[nodeId] = wrap;
          break;
        }
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.warn(
          `compile: wrap validation failed for ${note.path}:\n` +
            err.issues
              .map((i) => `  ${i.path.join(".")}: ${i.message}`)
              .join("\n"),
        );
      } else {
        console.warn(
          `compile: wrap validation failed for ${note.path}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  return { wraps, allDerivatives };
}

// ─── Wrap field parsers ─────────────────────────────────────────────

/** Parse stats from YAML — accepts array of {label, value} or similar. */
function parseWrapStats(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is Record<string, unknown> => s && typeof s === "object")
    .map((s) => ({
      label: String(s.label ?? ""),
      value: String(s.value ?? ""),
    }));
}

/** Parse keyFacts from YAML — accepts array of {label, value}. */
function parseWrapFacts(raw: unknown): { label: string; value: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => f && typeof f === "object")
    .map((f) => ({
      label: String(f.label ?? ""),
      value: String(f.value ?? ""),
    }));
}

/** Parse connections from YAML — accepts array of {targetId, reason}. */
function parseWrapConnections(raw: unknown): { targetId: string; reason: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => c && typeof c === "object")
    .map((c) => ({
      targetId: String(c.targetId ?? ""),
      reason: String(c.reason ?? ""),
    }));
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Filter files belonging to a specific stage folder prefix. */
function pickStageFiles(
  files: Record<string, string>,
  prefix: string,
): ParsedNote[] {
  const notes: ParsedNote[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!path.startsWith(prefix)) continue;
    if (!path.endsWith(".md")) continue;
    try {
      notes.push(parseNote(content, path));
    } catch (err) {
      // Skip files that fail to parse — don't cascade.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `compile: skipping unparseable file: ${path}\n  error: ${msg}\n  content (first 500 chars): ${content.slice(0, 500)}`,
      );
    }
  }
  return notes;
}

/**
 * Sanitize a Claude-generated ID into a valid Slug.
 * Handles: uppercase, underscores, leading digits after hyphens,
 * spaces, and other non-alphanumeric chars.
 */
function sanitizeSlug(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alnum → hyphen
    .replace(/-+/g, "-")          // deduplicate hyphens
    .replace(/^-|-$/g, "");       // trim edge hyphens

  // Ensure each segment after a hyphen starts with a letter.
  // e.g. "w1-1st-day" → "w1-s1st-day" (prefix digit segments with 's')
  s = s.replace(/-(\d)/g, "-s$1");

  // Ensure the slug starts with a letter.
  if (s && !/^[a-z]/.test(s)) s = "s" + s;

  return s || "x";
}

export function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}

/**
 * Claude sometimes puts multiple values or free-text in enum fields
 * (e.g. "joyful and energetic" instead of "joyful"). Extract the first
 * valid enum value from the string, falling back to a default if nothing
 * matches.
 */
export function coerceEnum<T extends string>(
  val: unknown,
  valid: readonly T[],
  fallback: T,
): T {
  if (typeof val !== "string") return fallback;
  // Exact match first.
  if ((valid as readonly string[]).includes(val)) return val as T;
  // Try to find a valid value embedded in the string.
  for (const v of valid) {
    if (val.toLowerCase().includes(v)) return v;
  }
  return fallback;
}
