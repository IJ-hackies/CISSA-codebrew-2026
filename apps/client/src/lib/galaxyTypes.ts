// Schema v3 — Galaxy type stubs matching shared/types/ (Zod) contract.
// Frontend uses these until shared/ package is wired up.

export type Slug = string
export type ChapterId = string
export type SourceUnitId = string

export type EntryKind =
  | 'moment'
  | 'person'
  | 'place'
  | 'theme'
  | 'artifact'
  | 'milestone'
  | 'period'

export type EdgeType =
  | 'related'
  | 'references'
  | 'temporal'
  | 'causal'
  | 'contrasts'
  | 'involves'

export type Mood =
  | 'joyful'
  | 'melancholic'
  | 'energetic'
  | 'peaceful'
  | 'tense'
  | 'nostalgic'
  | 'triumphant'
  | 'curious'
  | 'bittersweet'
  | 'determined'

export type StageStatus = {
  status: 'pending' | 'running' | 'complete' | 'error'
  startedAt?: number
  completedAt?: number
  error?: string
}

// ── Source ────────────────────────────────────────────────────────────────────

export type SourceUnit = {
  id: SourceUnitId
  text: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | 'audio'
}

export type SourceChapter = {
  id: ChapterId
  kind: 'text' | 'pdf' | 'docx' | 'pptx' | 'image' | 'chat-export'
  filename: string
  hash: string
  excerpt: string
  units: SourceUnit[]
}

export type SourceScope = {
  chapters: SourceChapter[]
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export type Cluster = {
  id: Slug
  chapter: ChapterId
  title: string
  brief: string
  sourceRefs: Slug[]
  groupIds: Slug[]
}

export type Group = {
  id: Slug
  chapter: ChapterId
  title: string
  brief: string
  sourceRefs: Slug[]
  clusterId: Slug
  entryIds: Slug[]
}

export type Entry = {
  id: Slug
  chapter: ChapterId
  title: string
  brief: string
  sourceRefs: Slug[]
  groupId: Slug | null
  kind: EntryKind
}

export type KnowledgeScope = {
  clusters: Cluster[]
  groups: Group[]
  entries: Entry[]
}

// ── Relationships ─────────────────────────────────────────────────────────────

export type RelationshipEdge = {
  id: Slug
  source: Slug
  target: Slug
  type: EdgeType
  label?: string
  weight: number
  sourceRefs: Slug[]
  chapter: ChapterId
}

export type RelationshipsScope = {
  edges: RelationshipEdge[]
}

// ── Wraps ─────────────────────────────────────────────────────────────────────

export type WrapStat = { label: string; value: string }
export type WrapFact = { label: string; value: string }
export type WrapConnection = { targetId: Slug; reason: string }
export type Derivative = { sourceRef: Slug; quote: string }

export type WrapBase = {
  nodeId: Slug
  level: 'cluster' | 'group' | 'entry'
  headline: string
  summary: string
  mood: Mood
  color: string
  stats: WrapStat[]
  highlights: string[]
  derivatives: Derivative[]
  sourceRefs: Slug[]
}

export type ClusterWrap = WrapBase & {
  level: 'cluster'
  dateRange?: string
  topEntries: Slug[]
  themes: string[]
}

export type GroupWrap = WrapBase & {
  level: 'group'
  theme: string
}

export type EntryWrap = WrapBase & {
  level: 'entry'
  body: string
  keyFacts: WrapFact[]
  connections: WrapConnection[]
}

export type AnyWrap = ClusterWrap | GroupWrap | EntryWrap

export type WrapsScope = Record<Slug, AnyWrap>

// ── Exploration ───────────────────────────────────────────────────────────────

export type ExplorationScope = {
  visited: Record<Slug, { firstVisitedAt: number; lastVisitedAt: number; visitCount: number }>
  bookmarked: Slug[]
  positions?: Record<Slug, { x: number; y: number; z: number }>
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export type PipelineScope = {
  ingest: StageStatus
  structure: StageStatus
  wraps: StageStatus
  coverage: StageStatus
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export type ChapterEntry = {
  id: ChapterId
  uploadedAt: number
  filename: string
  addedNodeIds: Slug[]
}

export type MetaScope = {
  id: string
  schemaVersion: 3
  title: string
  createdAt: number
  updatedAt: number
  chapters: ChapterEntry[]
}

// ── Galaxy (root blob) ────────────────────────────────────────────────────────

export type Galaxy = {
  meta: MetaScope
  source: SourceScope
  knowledge: KnowledgeScope | null
  relationships: RelationshipsScope
  wraps: WrapsScope
  exploration: ExplorationScope
  pipeline: PipelineScope
}
