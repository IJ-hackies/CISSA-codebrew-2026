/**
 * Client-side type definitions for the Galaxy blob.
 *
 * These mirror the Zod schemas in `shared/types/` but are plain TS interfaces
 * because the frontend doesn't need runtime validation — the server handles that.
 * Once Bun workspace imports are wired up, these can be replaced with z.infer
 * imports from shared.
 */

// ─── Primitives ──────────────────────────────────────────────────────

export interface Position {
  x: number
  y: number
}

export interface Palette {
  primary: string
  secondary: string
  accent: string
  atmosphere: string
}

// ─── Spatial Bodies ──────────────────────────────────────────────────

interface BaseBody {
  id: string
  position: Position
  parentId: string | null
  radius: number
}

export interface GalaxyBody extends BaseBody {
  kind: 'galaxy'
  knowledgeRef: null
}
export interface SystemBody extends BaseBody {
  kind: 'system'
  knowledgeRef: string
}
export interface PlanetBody extends BaseBody {
  kind: 'planet'
  knowledgeRef: string
  orbitRadius: number
  orbitAngle: number
}
export interface MoonBody extends BaseBody {
  kind: 'moon'
  knowledgeRef: string
  orbitRadius: number
  orbitAngle: number
}
export interface AsteroidBody extends BaseBody {
  kind: 'asteroid'
  knowledgeRef: string
}
export interface StarBody extends BaseBody {
  kind: 'star'
  spectralClass: string
}
export interface NebulaBody extends BaseBody {
  kind: 'nebula'
}
export interface CometBody extends BaseBody {
  kind: 'comet'
  trajectoryAngle: number
}
export interface BlackHoleBody extends BaseBody {
  kind: 'black-hole'
}
export interface DustCloudBody extends BaseBody {
  kind: 'dust-cloud'
}
export interface AsteroidBeltBody extends BaseBody {
  kind: 'asteroid-belt'
  innerRadius: number
  outerRadius: number
}

export type Body =
  | GalaxyBody
  | SystemBody
  | PlanetBody
  | MoonBody
  | AsteroidBody
  | StarBody
  | NebulaBody
  | CometBody
  | BlackHoleBody
  | DustCloudBody
  | AsteroidBeltBody

export type KnowledgeBearingBody = SystemBody | PlanetBody | MoonBody | AsteroidBody
export type DecorativeBody = StarBody | NebulaBody | CometBody | BlackHoleBody | DustCloudBody | AsteroidBeltBody

export const KNOWLEDGE_BEARING_KINDS = ['galaxy', 'system', 'planet', 'moon', 'asteroid'] as const
export const INTERACTIVE_KINDS = ['moon', 'asteroid'] as const

export interface Spatial {
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  bodies: Body[]
}

// ─── Knowledge ───────────────────────────────────────────────────────

export type ConceptKind = 'definition' | 'formula' | 'example' | 'fact' | 'principle' | 'process'
export type ModelTier = 'light' | 'standard' | 'heavy'

export interface Concept {
  id: string
  chapter: string
  title: string
  kind: ConceptKind
  brief: string
  modelTier: ModelTier
  sourceRefs: string[]
}

export interface Subtopic {
  id: string
  chapter: string
  title: string
  summary: string
  conceptIds: string[]
  sourceRefs: string[]
}

export interface Topic {
  id: string
  chapter: string
  title: string
  summary: string
  subtopicIds: string[]
  sourceRefs: string[]
}

export interface Knowledge {
  title: string
  summary: string
  topics: Topic[]
  subtopics: Subtopic[]
  concepts: Concept[]
  looseConceptIds: string[]
}

// ─── Visuals ─────────────────────────────────────────────────────────

export interface GalaxyVisual { kind: 'galaxy'; palette: Palette; armStyle: string; starDensity: number }
export interface SystemVisual { kind: 'system'; palette: Palette; starGlow: number; orbitRingVisible: boolean }
export interface PlanetVisual { kind: 'planet'; palette: Palette; terrain: string; atmosphere: string; lighting: string; features: string[]; mood: string; ring: boolean }
export interface MoonVisual { kind: 'moon'; palette: Palette; terrain: string; cratered: boolean; glow: boolean }
export interface AsteroidVisual { kind: 'asteroid'; palette: Palette; shape: string }
export interface StarVisual { kind: 'star'; palette: Palette; coronaIntensity: number; pulseRate: number }
export interface NebulaVisual { kind: 'nebula'; palette: Palette; density: number; swirl: number }
export interface CometVisual { kind: 'comet'; palette: Palette; tailLength: number }
export interface BlackHoleVisual { kind: 'black-hole'; palette: Palette; accretionIntensity: number }
export interface DustCloudVisual { kind: 'dust-cloud'; palette: Palette; opacity: number }
export interface AsteroidBeltVisual { kind: 'asteroid-belt'; palette: Palette; density: number }

export type BodyVisual =
  | GalaxyVisual | SystemVisual | PlanetVisual | MoonVisual | AsteroidVisual
  | StarVisual | NebulaVisual | CometVisual | BlackHoleVisual | DustCloudVisual | AsteroidBeltVisual

export type Visuals = Record<string, BodyVisual>

// ─── Relationships ───────────────────────────────────────────────────

export type RelationshipKind = 'prerequisite' | 'related' | 'contrasts' | 'example-of'

export interface Relationship {
  from: string
  to: string
  kind: RelationshipKind
  sourceRefs: string[]
}

// ─── Progress ────────────────────────────────────────────────────────

export interface BodyProgress {
  visited: boolean
  attemptCount: number
  bestScore: number | null
  lastScore: number | null
  hintsUsed: number
  timeSpentMs: number
  masteryEstimate: number
  attempts: Array<{ at: number; score: number; chosenOptionId: string }>
}

export interface Progress {
  bodies: Record<string, BodyProgress>
  totalBodies: number
  visitedCount: number
  completedCount: number
  overallMastery: number
}

// ─── Pipeline ────────────────────────────────────────────────────────

export interface StageState {
  status: 'pending' | 'running' | 'done' | 'error'
  progress: number
  startedAt: number | null
  finishedAt: number | null
  error: string | null
}

export interface Pipeline {
  ingest: StageState
  structure: StageState
  detail: StageState
  coverageAudit: StageState
  narrative: StageState
  layout: StageState
  visuals: StageState
}

// ─── Galaxy (full blob) ──────────────────────────────────────────────

export interface Galaxy {
  meta: {
    id: string
    schemaVersion: number
    createdAt: number
    updatedAt: number
    title: string
    chapters: Array<{
      id: string
      uploadedAt: number
      filename: string | null
      addedKnowledgeIds: string[]
      addedBodyIds: string[]
    }>
  }
  source: unknown
  knowledge: Knowledge | null
  detail: Record<string, unknown>
  relationships: Relationship[]
  narrative: unknown
  spatial: Spatial | null
  visuals: Visuals
  scenes: Record<string, unknown>
  conversations: Record<string, unknown>
  progress: Progress
  pipeline: Pipeline
}
