# Galaxy Schema

The canonical data contract for Scholar System. Everything the pipeline produces, everything the frontend renders, and everything the user's progress touches lives inside a single `Galaxy` blob stored as JSON in SQLite, keyed by `meta.id`.

Source of truth: `scholarsystem/shared/types/` (Zod). TypeScript types are derived via `z.infer` — never hand-write types that duplicate the Zod schemas.

## The 12 scopes

| # | Scope | Produced by | Holds |
|---|---|---|---|
| 1 | `meta` | Stage 0 (ingest) | id, schemaVersion, timestamps, title, **chapters[]** (upload history + which knowledge/body ids each chapter added) |
| 2 | `source` | Stage 0 | per-chapter input provenance (kind, filename, hash, excerpt) **+ stable numbered source units** that every downstream artifact cites |
| 3 | `knowledge` | Stage 1 (structure) | hierarchical tree: topics → subtopics → concepts (flat arrays with id refs); every node carries `sourceRefs` + `chapter` |
| 4 | `detail` | Stage 2 (detail) | deep per-concept content, keyed by concept id; every entry carries `derivatives[]` (verbatim quotes, `.min(1)`) + derived `sourceRefs` + `sourceQuotes` |
| 5 | `relationships` | Stage 1 + wikilinks | flat graph of cross-node edges (prerequisite/related/contrasts/example-of), may cross chapters |
| 6 | `narrative` | Stage 3 | split into **`canon`** (setting, protagonist, cast, aesthetic, tone — frozen after first generation) and **`arcs[]`** (per-chapter beats, extendable) |
| 7 | `spatial` | Stage 4 (layout) | polymorphic body layout, discriminated by `kind`; positions pinned across chapter extensions |
| 8 | `visuals` | Stage 5 | per-body visual params, discriminated union by body kind; append-only across chapters |
| 9 | `scenes` | On-demand | per-concept cached interactive scenes, keyed by body id |
| 10 | `conversations` | On-demand (reserved) | per-body player↔NPC chat turns, keyed by body id. Scope reserved in schema; chat feature not yet implemented |
| 11 | `progress` | User interaction | per-body mastery state + aggregates |
| 12 | `pipeline` | Every stage | per-stage status for the streaming UI |

## Pipeline stage order

```
0.   Ingest & Chunk →  meta, source (with numbered units), pipeline   (pure code)
1.   Structure      →  knowledge, relationships (initial)             (Claude Code, Sonnet 4.6)
2.   Detail         →  detail                                         (parallel per-topic, Sonnet 4.6)
2.5. Coverage Audit →  detail, knowledge (gap concepts), relationships (pure code + targeted Claude call)
3.   Narrative      →  narrative.canon (first run) / narrative.arcs[] (extend)  (blocks on 2.5)
4.   Layout         →  spatial                                        (pure code, parallel with 3, position-locked)
5.   Visuals        →  visuals                                        (blocks on 3 + 4, append-only)
6.   Scene          →  scenes[bodyId]                                 (on-demand, per landing; modelTier-routed)
```

Stage 4 is pure code and runs in parallel with Stage 3 the moment Stage 1 finishes. Stage 2.5 is the accuracy backstop — pure-code coverage check followed by a targeted gap-audit Claude call for any uncited source units.

## Source units & the accuracy model

The guarantee "no source content silently dropped" is mechanical, not trust-based.

- **Ingest chunks every source into stable numbered units** (`w1-s-0001`, `w1-s-0002`, …) at Stage 0. Units are immutable once written and stored under `source.chapters[].units`.
- **Every derived artifact carries derivatives and cites source units.** Every `detail` entry carries a `derivatives: Derivative[]` array (`.min(1)`) of `{ sourceRef: Slug, quote: string }` pairs — verbatim passages from the source. `sourceRefs` and `sourceQuotes` are derived from derivatives. Every `knowledge` node and `relationships` edge also carries `sourceRefs: Slug[]` (`.min(1)`).
- **After Stage 2, a hybrid coverage check runs.** (1) **Unit-level** (primary gate): pure-code pass computes `uncited = allUnitIds - unionOf(everySourceRefs)`, 95% threshold. (2) **Word-level** (supplementary): `computeWordCoverage()` tokenizes source text and derivative quotes, matches word runs with gap tolerance, reports exact coverage percentage.
- **Gap auditor.** If unit-level < 95%, a sequential Claude call receives uncited units and decides for each: attach to existing concept (with derivative quotes), create new concept, or justify as non-knowledge-bearing. Loops at most 3 rounds.

This is why `sourceRefs` is load-bearing. Wikilinks and `tags` are not — they serve other purposes (see Design Decisions below).

## Chapter extensions

A galaxy can grow over time by ingesting additional chapters (e.g. week 2 of lecture notes added to a week-1 galaxy). The schema is designed so this is additive, not destructive.

- **`meta.chapters[]`** records every upload: `{ id, uploadedAt, filename, addedKnowledgeIds, addedBodyIds }`. This is the provenance table and powers UX affordances ("new constellation unlocked").
- **Chapter id is a mandatory slug prefix** on every id produced during that chapter's ingest — `w1-photosynthesis`, `w1-s-0042`, `w1-cellular-biology`. Enforced by the `Slug` Zod schema. Prevents cross-chapter collision by construction.
- **Extensions rehydrate the workspace from the stored blob**, add the new source files, and run Stages 0 → 2.5 over the new chapter only. Stage 3 runs in extend mode (canon frozen, new arc appended). Stages 4 and 5 place/theme only the new bodies.
- **Cross-chapter wikilinks are first-class.** A week-2 concept may link `[[w1-energy-flow]]` — the compile step resolves this to a relationship edge with the appropriate type. These cross-chapter edges are the mechanism that makes "the story extends" feel earned rather than bolted on.

## Knowledge → Spatial mapping

Knowledge is fixed at **three levels**: topic → subtopic → concept. All cosmic variety is a presentational concern handled by the spatial/visuals scopes.

| Knowledge node | Spatial body kind | Interactive? |
|---|---|---|
| *root document* | `galaxy` | no (navigation only) |
| topic | `system` | no (zoom target) |
| subtopic | `planet` | no (orbital hub) |
| concept (attached to a subtopic) | `moon` | **yes — scene anchor** |
| concept (loose, not in any subtopic) | `asteroid` | **yes — scene anchor** |

Scenes are generated **per concept** (per moon / asteroid), not per subtopic. This keeps scene units tight, enables per-concept model-tier routing (cheap model for light concepts, strong model for heavy ones), and matches the "every concept is a place you visited" thesis.

Decorative bodies — `star`, `nebula`, `comet`, `black-hole`, `dust-cloud`, `asteroid-belt` — carry no knowledge, are placed and themed entirely by code from `narrative.canon.aesthetic`, and cost zero Claude calls.

## Multi-galaxy support

The schema permits multiple galaxies per blob. The layout engine clusters topics into galaxies by relationship density: tightly-linked topics share a galaxy, loosely-linked clusters become separate galaxies in a shared spatial cluster. Most uploads will produce a single galaxy; a "whole semester of notes" upload naturally produces several. **No knowledge-tree change is required** to support this — it's a layout decision only.

## ID discipline

Every id across every scope is a **chapter-prefixed kebab-case slug** (`^[a-z][a-z0-9]*-[a-z][a-z0-9-]*$`), validated via the `Slug` schema in `ids.ts`. The chapter prefix is **mandatory** — an unprefixed id is a hard validation failure at the stage boundary. Cross-scope references are literal id matches: spatial bodies store the knowledge id they represent in `knowledgeRef`, scenes key off body id, progress keys off body id, visuals key off body id. No translation layers.

Special cases:

- Source units use `<chapter>-s-<4-digit-seq>` (`w1-s-0042`).
- The chapter id itself is the plain prefix (`w1`, `w2`, `lecture-3`, …) — a user-supplied label sanitized to a slug at ingest.

## Mutability zones

Different scopes have different mutability contracts. Enforce these in code, not just docs. Chapter extensions make the zones tighter than before — most scopes are now **append-only**, not write-once.

- **Immutable once written** (to change: regenerate the whole galaxy): `meta.id`, `meta.createdAt`, `narrative.canon`, existing entries in `source.chapters[]`, existing entries in `source.chapters[].units`
- **Append-only across chapters** (existing entries frozen, new entries may be added): `meta.chapters[]`, `knowledge.topics[]`, `knowledge.subtopics[]`, `knowledge.concepts[]`, `detail`, `relationships`, `narrative.arcs[]`, `spatial.bodies[]`, `visuals`
- **Append-only within a galaxy's lifetime**: `scenes` (once generated for a body, never mutated), `conversations` (turns appended, never rewritten)
- **Mutable**: `progress`, `pipeline`, `meta.updatedAt`, `meta.title`

Position-lock note: `spatial.bodies[].position` is frozen once set, even though the `bodies[]` array itself is append-only. A visited moon must never teleport when a later chapter lands.

If progress writes ever become hot, it's still the clean split point for moving off single-blob storage — the scope boundary is already isolated.

## Partial validity

**The blob must be loadable and renderable at every intermediate pipeline state.** Frontend must not assume any scope beyond `meta` + `source` + `pipeline` is populated. Rules:

- `knowledge`, `narrative`, `spatial` are nullable — null means "not yet produced."
- `detail`, `visuals`, `scenes`, `conversations` default to empty objects `{}` when the stage hasn't run (or, for `conversations`, when the user hasn't chatted in any scene yet).
- `relationships` defaults to empty array `[]`.
- `narrative.canon` is null until first generation; `narrative.arcs[]` defaults to `[]`.
- `progress` starts with zeroed aggregates and an empty `bodies` record.
- `pipeline` starts with every stage in `"pending"` status.

**Never use a scope being empty/null as a signal of pipeline state.** Always check `pipeline[stageName].status`. This decouples "is the data there" from "what stage is running."

## Schema versioning

`meta.schemaVersion` starts at `1`. Any change to the shape that existing blobs can't satisfy requires a version bump and a migration function that transforms old → new. Shared URLs live indefinitely, so forward-migrating old blobs is a real requirement, not hypothetical.

Adding fields with defaults or widening enums is **not** a breaking change — existing blobs still parse. Renaming, removing, or narrowing fields **is** a breaking change and requires the bump.

## Model-tier routing

Each concept has a `modelTier: "light" | "standard" | "heavy"` assigned by Stage 1 based on inherent reasoning complexity. The pipeline treats this as a hint across most stages but as a hard routing signal in Stage 6:

- **Stages 1–5** — default Sonnet 4.6 regardless of tier. Opus at this scale would blow the generation-time budget; Haiku risks extraction quality.
- **Stage 6 (scenes)** — per-concept routing:
  - **light** — isolated facts, names, single-sentence definitions → **Haiku 4.5**
  - **standard** — typical explanations, worked examples → **Sonnet 4.6** (default)
  - **heavy** — multi-step reasoning, proofs, dependency-heavy concepts → **Opus 4.6**

Tier is a hint at the prompt level, not a mandate — scene gen may override based on archetype coupling.

## Design decisions worth remembering

- **Accuracy-by-derivative, not accuracy-by-trust.** `derivatives[]` on every `ConceptDetail` — verbatim quoted passages that word-match the source text. A model cannot hallucinate a passage that matches. `sourceRefs` is derived from derivatives. Unit-level coverage (95% gate) + word-level coverage (quality metric) verified by pure code. Self-reported markers ("I read this") are explicitly rejected — they're unverifiable.
- **Four distinct cross-reference/traceability primitives.** `derivatives` (verbatim quotes, load-bearing for word-level accuracy), `sourceRefs` (unit-level citations, load-bearing for unit coverage), wikilinks/relations (edges between nodes, load-bearing for story continuity), `tags` (free-form polish, never load-bearing). Do not conflate.
- **Obsidian markdown is the native wire format.** Every stage reads/writes frontmatter + body + `[[wikilinks]]`. Claude Code handles this format natively; the compile step parses it into Zod-validated scopes. Replaces the earlier TAB-delimited Stage 1 output.
- **Chapter-prefixed slugs everywhere.** Always-namespace prevents collisions by construction across chapter extensions. Enforced in the `Slug` Zod schema, not at runtime.
- **Narrative canon is frozen; arcs extend.** Split into `narrative.canon` (immutable after first generation — setting, cast, tone, aesthetic) and `narrative.arcs[]` (append per chapter). Prevents tonal drift across multi-chapter uploads.
- **Positions are pinned across chapter extensions.** A visited moon never teleports when a new chapter lands. The layout engine's "extend mode" only places new bodies; existing positions are immutable.
- **Flat knowledge, not nested.** Topics/subtopics/concepts are three sibling arrays with id references, not nested children. Flat is easier to traverse, partially populate, diff, and extend.
- **Narrative runs after detail + coverage.** Beats reference real extracted content instead of guessing. Costs latency; recovered by running Layout in parallel with Narrative.
- **Per-concept scenes, not per-subtopic.** Enables model-tier routing, matches the "every concept is a place" thesis, supports concept-level mastery tracking. Higher Claude call count is fine because scenes are on-demand.
- **Scene archetypes are code templates, not freeform.** Claude picks an archetype and fills content slots. Animation sequences live in hand-authored GSAP timelines per archetype — Claude does not generate frontend behavior as JSON.
- **Decorative bodies are code-authored, not Claude-authored.** They pull palette/shape from `narrative.canon.aesthetic` via a hand-authored SVG library. Saves Claude calls and keeps cosmic atmosphere cheap.
- **Zod as the single source of truth.** Every pipeline stage validates its output against Zod before writing back to the blob. This catches prompt drift early — subtle shape errors fail loudly at the boundary instead of surfacing three stages downstream.

## What the blob does NOT contain

- Raw uploaded files (discarded after extraction; only unit chunks survive)
- Workspace markdown files (the workspace is scratchpad, not state — it's rehydrated from the blob on demand)
- Prompt strings / raw model outputs (those are debug logs)
- Client-side view state (zoom, pan, selection → URL/localStorage)
- User identity (there is none — UUID URL is the access key)
- Multi-user sharing semantics (same URL = same blob, that's it)
