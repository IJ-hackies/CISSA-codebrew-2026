# Galaxy Schema (v3)

The canonical data contract for Scholar System. Everything the pipeline produces, everything the frontend renders, and everything the user's exploration state touches lives inside a single `Galaxy` blob stored as JSON in SQLite, keyed by `meta.id`.

Source of truth: `scholarsystem/shared/types/` (Zod). TypeScript types are derived via `z.infer`.

## 7 scopes

| # | Scope | Produced by | Holds |
|---|---|---|---|
| 1 | `meta` | Stage 0 | id, schemaVersion, timestamps, title, chapters[] |
| 2 | `source` | Stage 0 | per-chapter source units (accuracy foundation) |
| 3 | `knowledge` | Stage 1 | clusters → groups → entries (hierarchy, flat arrays with id refs) |
| 4 | `relationships` | Stage 1 + Stage 2 wikilinks | edges between ANY nodes — **hero data for the graph** |
| 5 | `wraps` | Stage 2 | per-node wrap cards (the product the user sees) |
| 6 | `exploration` | User interaction | visited / bookmarked / persisted positions |
| 7 | `pipeline` | Every stage | per-stage status |

**Dropped from v2:** `detail` (merged into `wraps`), `narrative`/`aesthetic` (each wrap has its own mood/color), `spatial` (frontend computes positions), `visuals` (frontend derives from kind+mood+color), `scenes` (wraps ARE the content), `conversations`, `progress` (replaced by `exploration`).

## Pipeline

```
0.   Ingest & Chunk  →  meta, source                     (pure code)
1.   Structure       →  knowledge, relationships          (Claude, Sonnet 4.6)
2.   Wraps           →  wraps (parallel per-node)         (Claude, Sonnet 4.6)
2.5  Coverage Audit  →  wraps adjustments                 (pure code + targeted Claude)
```

Four stages. No layout, no visuals, no scenes, no narrative.

## Scope definitions

### `meta`

```typescript
{
  id: string                    // UUID
  schemaVersion: 3
  title: string                 // user-supplied or AI-generated
  createdAt: number
  updatedAt: number
  chapters: ChapterEntry[]
}

interface ChapterEntry {
  id: ChapterId                 // "w1", "w2", etc.
  uploadedAt: number
  filename: string
  addedNodeIds: Slug[]          // which knowledge nodes this chapter added
}
```

### `source`

```typescript
{
  chapters: SourceChapter[]
}

interface SourceChapter {
  id: ChapterId
  kind: "text" | "pdf" | "docx" | "pptx" | "image" | "chat-export"
  filename: string
  hash: string
  excerpt: string               // first ~200 chars for preview
  units: SourceUnit[]
}

interface SourceUnit {
  id: SourceUnitId              // "w1-s-0001"
  text: string
  mediaUrl?: string             // for image/video source units (stretch)
  mediaType?: "image" | "video" | "audio"
}
```

### `knowledge`

Three flat arrays with id refs. Every node carries `chapter` + `sourceRefs`.

```typescript
{
  clusters: Cluster[]
  groups: Group[]
  entries: Entry[]
}

interface Cluster {
  id: Slug                      // "w1-march-2024"
  chapter: ChapterId
  title: string
  brief: string                 // ≤30 words
  sourceRefs: Slug[]            // .min(1)
  groupIds: Slug[]
}

interface Group {
  id: Slug                      // "w1-new-friendships"
  chapter: ChapterId
  title: string
  brief: string
  sourceRefs: Slug[]
  clusterId: Slug               // parent
  entryIds: Slug[]
}

interface Entry {
  id: Slug                      // "w1-first-day-at-uni"
  chapter: ChapterId
  title: string
  brief: string                 // ≤30 words
  sourceRefs: Slug[]
  groupId: Slug | null          // null = loose entry (asteroid)
  kind: EntryKind
}

type EntryKind =
  | "moment"                    // a specific event/memory → moon
  | "person"                    // a person/relationship → planet
  | "place"                     // a location → planet
  | "theme"                     // a recurring idea/pattern → star
  | "artifact"                  // a specific object/document/photo → comet
  | "milestone"                 // a turning point → large moon
  | "period"                    // a time span → ringed planet
```

### `relationships`

The hero data. Powers the visible edges in the 3D force graph.

```typescript
{
  edges: RelationshipEdge[]
}

interface RelationshipEdge {
  id: Slug
  source: Slug                  // any node id (cluster, group, or entry)
  target: Slug
  type: EdgeType
  label?: string                // human-readable: "both mention Sarah"
  weight: number                // 0–1, drives edge brightness/thickness
  sourceRefs: Slug[]
  chapter: ChapterId
}

type EdgeType =
  | "related"                   // general semantic connection
  | "references"                // one explicitly mentions the other
  | "temporal"                  // chronological ordering
  | "causal"                    // source caused/led to target
  | "contrasts"                 // in tension or opposition
  | "involves"                  // shares a person/place/artifact
```

Cross-chapter edges are first-class. A person appearing in March and July creates an `involves` edge across clusters.

### `wraps`

Every node (cluster, group, entry) gets a wrap. This is what the user sees when they click anything. Keyed by node id.

```typescript
{
  [nodeId: Slug]: ClusterWrap | GroupWrap | EntryWrap
}
```

**Base fields (shared by all levels):**

```typescript
interface WrapBase {
  nodeId: Slug
  level: "cluster" | "group" | "entry"
  headline: string              // catchy one-liner ("The month everything changed")
  summary: string               // 2–4 sentences
  mood: Mood
  color: string                 // hex color hint, AI-picked
  stats: WrapStat[]             // key numbers
  highlights: string[]          // 2–5 standout quotes or moments
  derivatives: Derivative[]     // verbatim source quotes (accuracy)
  sourceRefs: Slug[]            // derived from derivatives
}
```

**Cluster wrap (solar system):**

```typescript
interface ClusterWrap extends WrapBase {
  level: "cluster"
  dateRange?: string            // "March 2024", "2023 Q1"
  topEntries: Slug[]            // 3–5 most significant entries
  themes: string[]              // recurring themes across the cluster
}
```

**Group wrap (orbital group):**

```typescript
interface GroupWrap extends WrapBase {
  level: "group"
  theme: string                 // what ties these entries together
}
```

**Entry wrap (planet/moon/comet — the main product):**

```typescript
interface EntryWrap extends WrapBase {
  level: "entry"
  body: string                  // 200–300 word rich content
  keyFacts: WrapFact[]          // extracted data points
  connections: WrapConnection[] // highlighted links with reasons
}
```

**Supporting types:**

```typescript
type Mood =
  | "joyful" | "melancholic" | "energetic" | "peaceful"
  | "tense" | "nostalgic" | "triumphant" | "curious"
  | "bittersweet" | "determined"

interface WrapStat {
  label: string                 // "Times mentioned"
  value: string                 // "5"
}

interface WrapFact {
  label: string                 // "When"
  value: string                 // "March 15, 2024"
}

interface WrapConnection {
  targetId: Slug
  reason: string                // "Both involve Sarah"
}

interface Derivative {
  sourceRef: Slug               // which source unit
  quote: string                 // verbatim passage
}
```

### `exploration`

```typescript
{
  visited: Record<Slug, {
    firstVisitedAt: number
    lastVisitedAt: number
    visitCount: number
  }>
  bookmarked: Slug[]
  positions?: Record<Slug, { x: number; y: number; z: number }>
}
```

`positions` is optional — lets the frontend persist the force-graph layout between sessions so nodes don't jump around on reload. Written by the frontend, not the pipeline.

### `pipeline`

```typescript
{
  ingest:    StageStatus        // Stage 0
  structure: StageStatus        // Stage 1
  wraps:     StageStatus        // Stage 2
  coverage:  StageStatus        // Stage 2.5
}

interface StageStatus {
  status: "pending" | "running" | "complete" | "error"
  startedAt?: number
  completedAt?: number
  error?: string
}
```

## Source units & accuracy model

Unchanged. The derivative/coverage system carries over exactly.

- Ingest chunks every source into stable numbered units at Stage 0
- Every wrap carries `derivatives[]` (verbatim quotes) and `sourceRefs`
- Hybrid coverage check after Stage 2: unit-level (95% gate) + word-level (quality metric)
- Gap auditor closes coverage gaps (max 3 rounds)

## Knowledge hierarchy

| Level | Galaxy analogy | Interactive? |
|---|---|---|
| Cluster | Solar system | Click to drill in, see cluster wrap |
| Group | Orbital group | Visual grouping, see group wrap |
| Entry | Planet / moon / comet / star | Click for entry wrap card |

Body type derived from `EntryKind`:
| Kind | Body mesh |
|---|---|
| `moment` | Moon (small, smooth) |
| `person` | Planet (large, atmospheric) |
| `place` | Planet (textured) |
| `theme` | Star (glowing, emissive) |
| `artifact` | Comet (trailing particles) |
| `milestone` | Large moon (bright, prominent) |
| `period` | Ringed planet |

Visual appearance (color, glow, particles) derived from wrap `mood` + `color`. Zero Claude calls for visuals.

## ID discipline

Unchanged. Chapter-prefixed kebab-case slugs everywhere, validated via `Slug` Zod schema (`^[a-z][a-z0-9]*-[a-z][a-z0-9-]*$`).

## Mutability zones

- **Immutable once written**: `meta.id`, `meta.createdAt`, existing source units
- **Append-only across chapters**: `meta.chapters[]`, `knowledge.*[]`, `relationships.edges[]`, `wraps` (existing wraps frozen, new wraps added)
- **Mutable**: `exploration`, `pipeline`, `meta.updatedAt`, `meta.title`

## Partial validity

The blob must be loadable at every intermediate pipeline state. Frontend must not assume any scope beyond `meta` + `source` + `pipeline` is populated.

- `knowledge` is nullable (null = Stage 1 hasn't run)
- `relationships` defaults to `{ edges: [] }`
- `wraps` defaults to `{}`
- `exploration` starts with empty visited/bookmarked
- Always check `pipeline[stageName].status`, never infer state from data presence

## Chapter extensions

Additive, not destructive. Upload more data → Stage 0 chunks new → Stage 1 adds new nodes + discovers cross-chapter edges → Stage 2 generates wraps for new nodes only → Stage 2.5 audits. Existing wraps frozen. Frontend force-graph incorporates new nodes naturally.

## What the frontend needs

The frontend builds entirely from:
1. `knowledge` — nodes and hierarchy (what to render in the force graph)
2. `relationships` — edges (connections between nodes)
3. `wraps` — content for click interactions (what to show)
4. Entry `kind` + wrap `mood` + `color` — visual appearance (how to render)
5. `pipeline` — loading states

Clean, complete contract. Frontend can start with mock data immediately.

## What the blob does NOT contain

- Raw uploaded files (discarded after extraction)
- Workspace markdown files (scratchpad, rehydrated on demand)
- 3D positions from the pipeline (computed client-side by force-graph)
- Visual parameters (derived client-side from kind + mood + color)
- Prompt strings or raw model outputs
- Client-side view state beyond exploration (zoom, pan → URL/localStorage)
- User identity (UUID URL = access key)
