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
  Topic,
  Subtopic,
  Concept,
  Knowledge,
  Relationship,
  Relationships,
  ConceptDetail,
  NarrativeCanon,
  ChapterArc,
  ArcBeat,
  Character,
  Slug,
  BodyVisual,
  Terrain,
  AtmosphereType,
  Lighting,
  Biome,
  SceneCharacterRole,
} from "@scholarsystem/shared";
import type {
  ConceptKind,
  ModelTier,
  RelationshipKind,
  ChapterId,
  NarrativeCanon as NarrativeCanonType,
  ChapterArc as ChapterArcType,
  BodyVisual as BodyVisualType,
  ThematicGroup,
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
  topicChunks: {
    topicId: string;
    conceptIds: string[];
    sourceUnitIds: string[];
    sharedSourceUnitIds: string[];
  }[];
  structureUnitIds: string[];
  etcUnitIds: string[];
}

// ─── Stage 1 compile: stage1-structure/ → Knowledge + Relationships ───

export interface CompiledStructure {
  knowledge: Knowledge;
  relationships: Relationship[];
  dispatchPlan: DispatchPlan;
  thematicGroups: ThematicGroup[];
  structureNote: string | null;
  etcContent: string | null;
}

/**
 * Compile Stage 1 skeleton output from workspace markdown files.
 *
 * Expects files under `stage1-structure/` with frontmatter fields:
 *   - id, chapter, type ("topic" | "subtopic" | "concept"), title
 *   - topic/subtopic nodes: summary, sourceRefs
 *   - concept nodes: kind, modelTier, brief, sourceRefs, sharedWith (optional)
 *
 * Also parses _map.md, _structure.md, _etc.md auxiliary files.
 *
 * Returns Knowledge + Relationships + a DispatchPlan for Stage 2 fan-out.
 */
export function compileStructure(
  files: Record<string, string>,
  galaxyTitle: string,
  galaxySummary: string,
): CompiledStructure {
  const notes = pickStageFiles(files, "stage1-structure/");

  const topics: Topic[] = [];
  const subtopics: Subtopic[] = [];
  const concepts: Concept[] = [];
  const relationships: Relationship[] = [];
  const looseConceptIds: Slug[] = [];

  // Track parent references to wire up subtopicIds/conceptIds.
  const subtopicsByTopic = new Map<string, string[]>();
  const conceptsBySubtopic = new Map<string, string[]>();

  // Track source-unit assignments for the dispatch plan.
  const conceptSourceRefs = new Map<string, string[]>();
  const conceptSharedWith = new Map<string, string[]>();
  const conceptToTopic = new Map<string, string>();

  // Auxiliary file data.
  let thematicGroups: ThematicGroup[] = [];
  let structureNote: string | null = null;
  let etcContent: string | null = null;
  const structureUnitIds: string[] = [];
  const etcUnitIds: string[] = [];

  // Wikilinks accumulator: source note id → target ids.
  const wikilinkEdges: { from: string; to: string; sourceRefs: string[] }[] = [];

  for (const note of notes) {
    const d = note.data;
    const type = d.type as string;

    switch (type) {
      case "topic": {
        const t = Topic.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          summary: d.summary ?? "",
          subtopicIds: [], // filled below
          sourceRefs: asStringArray(d.sourceRefs),
        });
        topics.push(t);
        break;
      }
      case "subtopic": {
        const s = Subtopic.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          summary: d.summary ?? "",
          conceptIds: [], // filled below
          sourceRefs: asStringArray(d.sourceRefs),
        });
        subtopics.push(s);
        const parentTopic = d.topic as string;
        if (parentTopic) {
          const arr = subtopicsByTopic.get(parentTopic) ?? [];
          arr.push(s.id);
          subtopicsByTopic.set(parentTopic, arr);
        }
        break;
      }
      case "concept": {
        const c = Concept.parse({
          id: d.id,
          chapter: d.chapter,
          title: d.title,
          kind: d.kind as ConceptKind,
          brief: d.brief ?? "",
          modelTier: (d.modelTier ?? "standard") as ModelTier,
          sourceRefs: asStringArray(d.sourceRefs),
        });
        concepts.push(c);

        // Track source refs and sharedWith for dispatch plan.
        conceptSourceRefs.set(c.id, asStringArray(d.sourceRefs));
        conceptSharedWith.set(c.id, asStringArray(d.sharedWith));

        const parentSubtopic = d.subtopic as string | undefined;
        if (parentSubtopic) {
          const arr = conceptsBySubtopic.get(parentSubtopic) ?? [];
          arr.push(c.id);
          conceptsBySubtopic.set(parentSubtopic, arr);
        } else {
          looseConceptIds.push(c.id as Slug);
        }
        break;
      }
      case "map": {
        // Parse thematic groups from _map.md.
        const groups = d.groups as unknown;
        if (Array.isArray(groups)) {
          thematicGroups = groups.map((g: any) => ({
            name: g.name ?? "",
            conceptIds: asStringArray(g.conceptIds) as Slug[],
          }));
        }
        continue; // Don't extract wikilinks from aux files.
      }
      case "structure": {
        // Parse structural source-unit assignments.
        const units = d.sourceUnits as unknown;
        if (Array.isArray(units)) {
          for (const u of units) {
            const uid = typeof u === "string" ? u : (u as any)?.id;
            if (uid) structureUnitIds.push(uid);
          }
          structureNote = units
            .map((u: any) => `${u.id}: ${u.role ?? ""} — ${u.note ?? ""}`)
            .join("\n");
        }
        continue;
      }
      case "etc": {
        // Parse non-knowledge source-unit assignments.
        const units = d.sourceUnits as unknown;
        if (Array.isArray(units)) {
          for (const u of units) {
            const uid = typeof u === "string" ? u : (u as any)?.id;
            if (uid) etcUnitIds.push(uid);
          }
          etcContent = units
            .map((u: any) => `${u.id}: ${u.reason ?? ""}`)
            .join("\n");
        }
        continue;
      }
      case "summary": {
        // Handled by the caller (structure.ts reads _summary.md separately).
        continue;
      }
    }

    // Extract wikilinks from body → relationship edges.
    const links = extractWikilinks(note.body);
    const noteId = d.id as string;
    const sourceRefs = asStringArray(d.sourceRefs);
    for (const target of links) {
      wikilinkEdges.push({ from: noteId, to: target, sourceRefs });
    }
  }

  // Wire up parent→child id arrays.
  for (const t of topics) {
    t.subtopicIds = (subtopicsByTopic.get(t.id) ?? []) as Slug[];
  }
  for (const s of subtopics) {
    s.conceptIds = (conceptsBySubtopic.get(s.id) ?? []) as Slug[];
  }

  // Build concept → topic mapping via subtopics.
  for (const t of topics) {
    for (const sid of t.subtopicIds) {
      const sub = subtopics.find((s) => s.id === sid);
      if (!sub) continue;
      for (const cid of sub.conceptIds) {
        conceptToTopic.set(cid, t.id);
      }
    }
  }

  // Build a set of all known ids for filtering valid wikilink edges.
  const allIds = new Set<string>([
    ...topics.map((t) => t.id),
    ...subtopics.map((s) => s.id),
    ...concepts.map((c) => c.id),
  ]);

  // Convert wikilink edges into typed Relationships.
  for (const edge of wikilinkEdges) {
    if (!allIds.has(edge.from) || !allIds.has(edge.to)) continue;
    if (edge.from === edge.to) continue;

    const kind: RelationshipKind = "related";

    const rel = Relationship.parse({
      from: edge.from,
      to: edge.to,
      kind,
      sourceRefs: edge.sourceRefs,
    });
    relationships.push(rel);
  }

  // Deduplicate relationships.
  const seen = new Set<string>();
  const dedupedRels = relationships.filter((r) => {
    const key = `${r.from}→${r.to}→${r.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const knowledge = Knowledge.parse({
    title: galaxyTitle,
    summary: galaxySummary,
    topics,
    subtopics,
    concepts,
    looseConceptIds,
  });

  // Build the dispatch plan for Stage 2 parallel fan-out.
  const dispatchPlan = buildDispatchPlan(
    knowledge,
    conceptSourceRefs,
    conceptSharedWith,
    conceptToTopic,
    structureUnitIds,
    etcUnitIds,
  );

  return {
    knowledge,
    relationships: dedupedRels,
    dispatchPlan,
    thematicGroups,
    structureNote,
    etcContent,
  };
}

/**
 * Build a dispatch plan mapping each topic to its source units and concepts.
 */
function buildDispatchPlan(
  knowledge: Knowledge,
  conceptSourceRefs: Map<string, string[]>,
  conceptSharedWith: Map<string, string[]>,
  conceptToTopic: Map<string, string>,
  structureUnitIds: string[],
  etcUnitIds: string[],
): DispatchPlan {
  // Group concepts and their source units by topic.
  const topicMap = new Map<string, { conceptIds: Set<string>; sourceUnitIds: Set<string>; sharedSourceUnitIds: Set<string> }>();

  for (const topic of knowledge.topics) {
    topicMap.set(topic.id, {
      conceptIds: new Set(),
      sourceUnitIds: new Set(),
      sharedSourceUnitIds: new Set(),
    });
  }

  for (const concept of knowledge.concepts) {
    const topicId = conceptToTopic.get(concept.id);
    if (!topicId) continue;

    const entry = topicMap.get(topicId);
    if (!entry) continue;

    entry.conceptIds.add(concept.id);
    const refs = conceptSourceRefs.get(concept.id) ?? [];
    for (const ref of refs) entry.sourceUnitIds.add(ref);

    // Handle sharedWith: push source units to other topics too.
    const shared = conceptSharedWith.get(concept.id) ?? [];
    for (const otherTopicId of shared) {
      const otherEntry = topicMap.get(otherTopicId);
      if (otherEntry) {
        for (const ref of refs) otherEntry.sharedSourceUnitIds.add(ref);
      }
    }
  }

  // Also add loose concepts as their own chunk (handled separately by caller).

  const topicChunks: DispatchPlan["topicChunks"] = [];
  for (const [topicId, entry] of topicMap) {
    if (entry.conceptIds.size === 0) continue;
    topicChunks.push({
      topicId,
      conceptIds: [...entry.conceptIds],
      sourceUnitIds: [...entry.sourceUnitIds],
      sharedSourceUnitIds: [...entry.sharedSourceUnitIds],
    });
  }

  return {
    topicChunks,
    structureUnitIds,
    etcUnitIds,
  };
}

// ─── Stage 2 compile: stage2-detail/<topic-id>/ → Detail record ───────

export interface CompiledDetail {
  detail: Record<string, ConceptDetail>;
  /** All derivatives extracted (concept + structure + etc) for coverage checking. */
  allDerivatives: { sourceRef: string; quote: string }[];
}

/**
 * Compile Stage 2 output from workspace markdown files.
 *
 * Expects files under `stage2-detail/` with:
 *   - YAML frontmatter (conceptId, chapter, fullDefinition, etc.)
 *   - Body text (the 200-300 word explanation)
 *   - # Derivatives section with ## source-unit-id + > "quotes"
 *
 * Also collects derivatives from _structure.md and _etc.md files.
 */
export function compileDetail(files: Record<string, string>): CompiledDetail {
  const notes = pickStageFiles(files, "stage2-detail/");
  const detail: Record<string, ConceptDetail> = {};
  const allDerivatives: { sourceRef: string; quote: string }[] = [];

  for (const note of notes) {
    const d = note.data;
    const type = d.type as string;

    // Handle _structure.md and _etc.md — extract derivatives only.
    if (type === "structure" || type === "etc") {
      const derivs = extractDerivatives(note.body);
      for (const pd of derivs) {
        for (const q of pd.quotes) {
          allDerivatives.push({ sourceRef: pd.sourceRef, quote: q });
        }
      }
      continue;
    }

    const conceptId = (d.conceptId as string) ?? (d.id as string);
    if (!conceptId) continue;

    // Parse derivatives from the body's # Derivatives section.
    const parsedDerivs = extractDerivatives(note.body);
    const derivatives: { sourceRef: string; quote: string }[] = [];
    const derivSourceRefs = new Set<string>();

    for (const pd of parsedDerivs) {
      derivSourceRefs.add(pd.sourceRef);
      for (const q of pd.quotes) {
        derivatives.push({ sourceRef: pd.sourceRef, quote: q });
        allDerivatives.push({ sourceRef: pd.sourceRef, quote: q });
      }
    }

    // Fall back to sourceQuotes + sourceRefs from frontmatter if no # Derivatives section.
    if (derivatives.length === 0) {
      const fmSourceRefs = asStringArray(d.sourceRefs);
      const fmSourceQuotes = asStringArray(d.sourceQuotes);
      if (fmSourceQuotes.length > 0 && fmSourceRefs.length > 0) {
        for (const q of fmSourceQuotes) {
          derivatives.push({ sourceRef: fmSourceRefs[0], quote: q });
          allDerivatives.push({ sourceRef: fmSourceRefs[0], quote: q });
        }
        for (const ref of fmSourceRefs) derivSourceRefs.add(ref);
      }
    }

    // Extract body text before # Relations and # Derivatives.
    let bodyText = note.body.trim();
    const relIdx = bodyText.search(/^#\s+Relations\s*$/m);
    const derivIdx = bodyText.search(/^#\s+Derivatives\s*$/m);
    const cutoff = Math.min(
      relIdx >= 0 ? relIdx : bodyText.length,
      derivIdx >= 0 ? derivIdx : bodyText.length,
    );
    bodyText = bodyText.slice(0, cutoff).trim();

    // Use body text as fullDefinition if frontmatter doesn't have one.
    const fullDef = (d.fullDefinition as string) || bodyText || "";

    // Merge frontmatter sourceRefs with derivative-derived refs.
    const fmRefs = asStringArray(d.sourceRefs);
    for (const ref of fmRefs) derivSourceRefs.add(ref);
    const sourceRefs = derivSourceRefs.size > 0
      ? [...derivSourceRefs]
      : fmRefs;

    // Derive sourceQuotes from derivatives.
    const sourceQuotes = derivatives.map((deriv) => deriv.quote);

    const entry = ConceptDetail.parse({
      conceptId,
      chapter: d.chapter,
      fullDefinition: fullDef,
      derivatives: derivatives.length > 0
        ? derivatives
        : [{ sourceRef: sourceRefs[0] ?? "unknown", quote: fullDef.slice(0, 100) }],
      formulas: asStringArray(d.formulas),
      workedExamples: asStringArray(d.workedExamples),
      edgeCases: asStringArray(d.edgeCases),
      mnemonics: asStringArray(d.mnemonics),
      emphasisMarkers: asStringArray(d.emphasisMarkers),
      sourceQuotes: sourceQuotes.length > 0 ? sourceQuotes : asStringArray(d.sourceQuotes),
      sourceRefs,
      extractedAt: typeof d.extractedAt === "number" ? d.extractedAt : Date.now(),
    });

    detail[conceptId] = entry;
  }

  return { detail, allDerivatives };
}

// ─── Stage 3 compile: stage3-narrative/ → Narrative scopes ──────────

export interface CompiledNarrative {
  canon: NarrativeCanonType | null;
  arcs: ChapterArcType[];
}

/**
 * Compile Stage 3 output from workspace markdown files.
 *
 * Expects:
 *   - `stage3-narrative/canon.md` with NarrativeCanon frontmatter (first run)
 *   - `stage3-narrative/arcs/<chapter>.md` with ChapterArc frontmatter
 */
export function compileNarrative(
  files: Record<string, string>,
): CompiledNarrative {
  const notes = pickStageFiles(files, "stage3-narrative/");
  let canon: NarrativeCanonType | null = null;
  const arcs: ChapterArcType[] = [];

  for (const note of notes) {
    const type = note.data.type as string;

    if (type === "canon") {
      try {
        const tone = note.data.tone as Record<string, unknown> | undefined;
        const aesthetic = note.data.aesthetic as Record<string, unknown> | undefined;

        // Parse recurring characters — may be a JSON string or array.
        let chars: unknown[] = [];
        if (typeof note.data.recurringCharacters === "string") {
          try {
            chars = JSON.parse(note.data.recurringCharacters);
          } catch {
            chars = [];
          }
        } else if (Array.isArray(note.data.recurringCharacters)) {
          chars = note.data.recurringCharacters;
        }

        canon = NarrativeCanon.parse({
          setting: note.data.setting ?? "",
          protagonist: note.data.protagonist ?? "",
          premise: note.data.premise ?? "",
          stakes: note.data.stakes ?? "",
          tone: {
            primary: coerceEnum(tone?.primary, ["mysterious", "heroic", "investigative", "comedic", "melancholic", "wondrous", "ominous", "reverent"], "wondrous"),
            secondary: tone?.secondary ?? null,
            genre: coerceEnum(tone?.genre, ["hard-sf", "space-opera", "cosmic-horror", "archaeological", "exploration", "mythic"], "exploration"),
          },
          aesthetic: {
            paletteDirection: aesthetic?.paletteDirection ?? "",
            atmosphereDirection: aesthetic?.atmosphereDirection ?? "",
            motifKeywords: asStringArray(aesthetic?.motifKeywords),
          },
          recurringCharacters: chars.map((c: any) =>
            Character.parse({
              id: c.id,
              name: c.name ?? "",
              role: c.role ?? "",
              description: c.description ?? "",
              voice: c.voice ?? "",
              arc: c.arc ?? "",
            }),
          ),
          finaleHook: (note.data.finaleHook as string) ?? "",
          hardConstraints: asStringArray(note.data.hardConstraints),
        });
      } catch (err) {
        console.warn(
          `compile: canon validation failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    } else if (type === "arc") {
      try {
        const beats = Array.isArray(note.data.beats) ? note.data.beats : [];

        const arc = ChapterArc.parse({
          chapter: note.data.chapter ?? "",
          arcSummary: (note.data.arcSummary as string) ?? "",
          beats: beats.map((b: any) =>
            ArcBeat.parse({
              topicId: b.topicId ?? "",
              role: b.role ?? "opening",
              beat: b.beat ?? "",
              emotionalTarget: b.emotionalTarget ?? "",
              connectsTo: asStringArray(b.connectsTo),
            }),
          ),
          chapterHook: (note.data.chapterHook as string) ?? "",
        });

        arcs.push(arc);
      } catch (err) {
        console.warn(
          `compile: arc validation failed for ${note.path}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  return { canon, arcs };
}

// ─── Stage 5 compile: stage5-visuals/ → Visuals record ──────────────

export interface CompiledVisuals {
  visuals: Record<string, BodyVisualType>;
}

/**
 * Compile Stage 5 output from workspace markdown files.
 *
 * Expects files under `stage5-visuals/` with frontmatter matching a
 * BodyVisual discriminated union shape (must include `kind`).
 */
export function compileVisuals(files: Record<string, string>): CompiledVisuals {
  const notes = pickStageFiles(files, "stage5-visuals/");
  const visuals: Record<string, BodyVisualType> = {};

  for (const note of notes) {
    const d = note.data;
    const bodyId = (d.bodyId as string) ?? (d.id as string);
    if (!bodyId) {
      console.warn(`compile: skipping visual note without bodyId: ${note.path}`);
      continue;
    }

    try {
      // Build the visual object from frontmatter. The `kind` field drives
      // the discriminated union — Zod picks the right variant automatically.
      const raw: Record<string, unknown> = { ...d };
      delete raw.bodyId;
      delete raw.id;

      // Parse palette from nested YAML or flat fields.
      if (!raw.palette && raw.primary) {
        raw.palette = {
          primary: raw.primary,
          secondary: raw.secondary,
          accent: raw.accent,
          atmosphere: raw.atmosphere,
        };
        delete raw.primary;
        delete raw.secondary;
        delete raw.accent;
        // Don't delete atmosphere — planets need it as an enum too.
      }

      // When palette was built from flat fields, atmosphere was consumed
      // for palette.atmosphere (rgba). But planets also need atmosphere as
      // an AtmosphereType enum. If both exist, keep the enum version.
      if (raw.palette && typeof raw.atmosphere === "string" && raw.kind === "planet") {
        // atmosphere is the enum; palette.atmosphere is the rgba color.
        // Don't delete — coercion below handles the enum.
      } else {
        delete raw.atmosphere;
      }

      // features may come as a YAML array or comma-separated string.
      if (typeof raw.features === "string") {
        raw.features = (raw.features as string).split(",").map((s) => s.trim());
      }

      // ── Coerce enums to nearest valid value ──
      const kind = raw.kind as string;
      if (raw.terrain !== undefined) {
        raw.terrain = coerceEnum(raw.terrain, Terrain.options, "rocky");
      }
      if (kind === "planet" && raw.atmosphere !== undefined) {
        raw.atmosphere = coerceEnum(raw.atmosphere, AtmosphereType.options, "thin");
      }
      if (raw.lighting !== undefined) {
        raw.lighting = coerceEnum(raw.lighting, Lighting.options, "starlight");
      }
      if (raw.biome !== undefined) {
        raw.biome = coerceEnum(raw.biome, Biome.options, "alien-ruins");
      }
      if (raw.character !== undefined) {
        raw.character = coerceEnum(raw.character, SceneCharacterRole.options, "sage");
      }
      if (kind === "asteroid" && raw.shape !== undefined) {
        raw.shape = coerceEnum(raw.shape, ["angular", "elongated", "clustered"] as const, "angular");
      }
      if (kind === "galaxy" && raw.armStyle !== undefined) {
        raw.armStyle = coerceEnum(raw.armStyle, ["spiral", "barred", "elliptical", "irregular"] as const, "spiral");
      }

      // ── Coerce string booleans ──
      for (const boolKey of ["ring", "cratered", "glow", "orbitRingVisible"]) {
        if (typeof raw[boolKey] === "string") {
          const v = (raw[boolKey] as string).toLowerCase();
          raw[boolKey] = v === "true" || v === "yes" || v === "1";
        }
      }

      // ── Default missing fields ──
      if (kind === "planet") {
        raw.mood ??= "mysterious";
        raw.ring ??= false;
        raw.features ??= [];
      }
      if (kind === "moon") {
        raw.cratered ??= false;
        raw.glow ??= false;
      }

      const visual = BodyVisual.parse(raw);
      visuals[bodyId] = visual;
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.warn(
          `compile: visual validation failed for ${note.path}:\n` +
            err.issues
              .map((i) => `  ${i.path.join(".")}: ${i.message}`)
              .join("\n"),
        );
      } else {
        console.warn(
          `compile: visual validation failed for ${note.path}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  return { visuals };
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

function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") return [val];
  return [];
}

/**
 * Claude sometimes puts multiple values or free-text in enum fields
 * (e.g. "archaeological exploration, mathematical mystery" instead of
 * "archaeological"). Extract the first valid enum value from the string,
 * falling back to a default if nothing matches.
 */
function coerceEnum<T extends string>(
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
