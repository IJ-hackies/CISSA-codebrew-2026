# Galaxy Schema

The canonical data contract for Scholar System. Everything the pipeline produces, everything the frontend renders, and everything the user's progress touches lives inside a single `Galaxy` blob stored as JSON in SQLite, keyed by `meta.id`.

Source of truth: `scholarsystem/shared/types/` (Zod). TypeScript types are derived via `z.infer` — never hand-write types that duplicate the Zod schemas.

## The 12 scopes

| # | Scope | Produced by | Holds |
|---|---|---|---|
| 1 | `meta` | Stage 0 (ingest) | id, schemaVersion, timestamps, title |
| 2 | `source` | Stage 0 | input provenance (kind, filename, hash, excerpt) |
| 3 | `knowledge` | Stage 1 (structure) | hierarchical tree: topics → subtopics → concepts (flat arrays with id refs) |
| 4 | `detail` | Stage 2 (detail) | deep per-concept content, keyed by concept id |
| 5 | `relationships` | Stage 1 | flat graph of cross-node edges (prerequisite/related/contrasts/example-of) |
| 6 | `narrative` | Stage 3 | galaxy-wide story spine: setting, tone, arc beats per topic, recurring cast |
| 7 | `spatial` | Stage 4 (layout) | polymorphic body layout, discriminated by `kind` |
| 8 | `visuals` | Stage 5 | per-body visual params, discriminated union by body kind |
| 9 | `scenes` | On-demand | per-concept cached interactive scenes, keyed by body id |
| 10 | `conversations` | On-demand (reserved) | per-body player↔NPC chat turns, keyed by body id. Scope reserved in schema; chat feature not yet implemented |
| 11 | `progress` | User interaction | per-body mastery state + aggregates |
| 12 | `pipeline` | Every stage | per-stage status for the streaming UI |

## Pipeline stage order

```
0. Ingest      →  meta, source, pipeline
1. Structure   →  knowledge, relationships
2. Detail      →  detail                     (parallel chunks)
3. Narrative   →  narrative                  (blocks on 2)
4. Layout      →  spatial                    (runs in parallel with 3)
5. Visuals     →  visuals                    (blocks on 3 + 4)
6. Scene       →  scenes[bodyId]             (on-demand, per landing)
```

Layout is pure code (force-directed algorithm, no Claude call) so it runs the moment Stage 1 finishes, in parallel with Detail + Narrative.

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

Decorative bodies — `star`, `nebula`, `comet`, `black-hole`, `dust-cloud`, `asteroid-belt` — carry no knowledge, are placed and themed entirely by code, and cost zero Claude calls.

## Multi-galaxy support

The schema permits multiple galaxies per blob. The layout engine clusters topics into galaxies by relationship density: tightly-linked topics share a galaxy, loosely-linked clusters become separate galaxies in a shared spatial cluster. Most uploads will produce a single galaxy; a "whole semester of notes" upload naturally produces several. **No knowledge-tree change is required** to support this — it's a layout decision only.

## ID discipline

Every id across every scope is a **kebab-case slug** (`^[a-z][a-z0-9-]*$`), validated via the `Slug` schema in `ids.ts`. Cross-scope references are literal id matches — spatial bodies store the knowledge id they represent in `knowledgeRef`, scenes key off body id, progress keys off body id, visuals key off body id. No translation layers.

## Mutability zones

Different scopes have different mutability contracts. Enforce these in code, not just docs.

- **Write-once** (to change: regenerate the whole galaxy): `meta.id`, `meta.createdAt`, `source`, `knowledge`, `detail`, `relationships`, `narrative`, `spatial`, `visuals`
- **Append-only**: `scenes` (once generated for a body, never mutated), `conversations` (turns appended, never rewritten)
- **Mutable**: `progress`, `pipeline`, `meta.updatedAt`, `meta.title`

If progress writes ever become hot, it's the clean split point for moving off single-blob storage — the scope boundary is already isolated.

## Partial validity

**The blob must be loadable and renderable at every intermediate pipeline state.** Frontend must not assume any scope beyond `meta` + `source` + `pipeline` is populated. Rules:

- `knowledge`, `narrative`, `spatial` are nullable — null means "not yet produced."
- `detail`, `visuals`, `scenes`, `conversations` default to empty objects `{}` when the stage hasn't run (or, for `conversations`, when the user hasn't chatted in any scene yet).
- `relationships` defaults to empty array `[]`.
- `progress` starts with zeroed aggregates and an empty `bodies` record.
- `pipeline` starts with every stage in `"pending"` status.

**Never use a scope being empty/null as a signal of pipeline state.** Always check `pipeline[stageName].status`. This decouples "is the data there" from "what stage is running."

## Schema versioning

`meta.schemaVersion` starts at `1`. Any change to the shape that existing blobs can't satisfy requires a version bump and a migration function that transforms old → new. Shared URLs live indefinitely, so forward-migrating old blobs is a real requirement, not hypothetical.

Adding fields with defaults or widening enums is **not** a breaking change — existing blobs still parse. Renaming, removing, or narrowing fields **is** a breaking change and requires the bump.

## Model-tier routing

Each concept has a `modelTier: "light" | "standard" | "heavy"` assigned by Stage 1 based on inherent reasoning complexity. Scene generation reads this hint and picks a cheaper or stronger model accordingly:

- **light** — isolated facts, names, single-sentence definitions → Haiku 4.5
- **standard** — typical explanations, worked examples → Sonnet 4.6 (default)
- **heavy** — multi-step reasoning, proofs, dependency-heavy concepts → Opus 4.6

Tier is a hint, not a mandate. Scene gen may override based on archetype coupling. The spawner will need per-tier model routing before Stage 6 lands — today's spawner uses a single model.

## Design decisions worth remembering

- **Flat knowledge, not nested.** Topics/subtopics/concepts are three sibling arrays with id references, not nested children. Flat is easier to traverse, partially populate, and diff. Rendering code builds the nested view if it needs it.
- **Narrative runs after detail (option B).** Beats can reference specific content from Stage 2 instead of guessing at it. Costs latency; recovered by running Layout in parallel with Narrative.
- **Per-concept scenes, not per-subtopic.** Enables model-tier routing, matches the "every concept is a place" thesis, and concept-level mastery tracking. Higher Claude call count is fine because scenes are on-demand (you never pay for what the user doesn't visit).
- **Scene archetypes are code templates, not freeform.** Claude picks an archetype and fills in the content slots. Animation sequences live in hand-authored GSAP timelines per archetype — Claude does not generate frontend behavior as JSON.
- **Decorative bodies are code-authored, not Claude-authored.** They pull palette/shape from `narrative.aesthetic` + `narrative.tone` via a hand-authored SVG library. Saves Claude calls and keeps cosmic atmosphere cheap.
- **`hardConstraints` is soft guidance.** Appended to the scene gen prompt as "avoid these." No post-hoc validator runs (hackathon scope). Revisit if demo scenes visibly break the rules.
- **Zod as the single source of truth.** Every pipeline stage validates its output against Zod before writing back to the blob. This catches prompt drift early — subtle shape errors fail loudly at the boundary instead of surfacing three stages downstream.

## What the blob does NOT contain

- Raw uploaded files (discarded after extraction)
- Prompt strings / raw model outputs (those are debug logs)
- Client-side view state (zoom, pan, selection → URL/localStorage)
- User identity (there is none — UUID URL is the access key)
- Multi-user sharing semantics (same URL = same blob, that's it)
