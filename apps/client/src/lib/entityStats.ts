/**
 * Pure stat computation over v4 GalaxyData.
 *
 * Used by the drawer heroes, the soul HUD count, and StatsView.
 * No Vue, no reactivity — just functions of (entity, data).
 */

import type { GalaxyData, MeshPlanet, MeshConcept, MeshStory, UUID } from './meshApi'

export interface EntityStatPair {
  /** e.g. "linked from" */
  labelA: string
  valueA: number
  /** e.g. "tied to" */
  labelB: string
  valueB: number
}

// ── Planet ──────────────────────────────────────────────────────────────────

/** Count of other planets whose planetConnections include this planet. */
export function inboundPlanetLinks(planetId: UUID, data: GalaxyData): number {
  let n = 0
  for (const id in data.planets) {
    if (id === planetId) continue
    if (data.planets[id].planetConnections.includes(planetId)) n++
  }
  return n
}

/** Count of concepts whose planetConnections include this planet. */
export function conceptsTiedToPlanet(planetId: UUID, data: GalaxyData): number {
  let n = 0
  for (const id in data.concepts) {
    if (data.concepts[id].planetConnections.includes(planetId)) n++
  }
  return n
}

export function planetStats(planet: MeshPlanet, data: GalaxyData): EntityStatPair {
  return {
    labelA: 'linked from',
    valueA: inboundPlanetLinks(planet.id, data),
    labelB: 'tied to',
    valueB: conceptsTiedToPlanet(planet.id, data),
  }
}

// ── Concept ─────────────────────────────────────────────────────────────────

export function conceptStats(concept: MeshConcept): EntityStatPair {
  return {
    labelA: 'threads through',
    valueA: concept.planetConnections.length,
    labelB: 'linked to',
    valueB: concept.conceptConnections.length,
  }
}

/**
 * Stories whose intro or conclusion conceptIds include this concept.
 * This is the "Stories featuring this idea" list for the concept drawer footer.
 */
export function storiesFeaturingConcept(conceptId: UUID, data: GalaxyData): MeshStory[] {
  return data.stories.filter(
    (s) =>
      s.introduction.conceptIds.includes(conceptId) ||
      s.conclusion.conceptIds.includes(conceptId),
  )
}

// ── Story ───────────────────────────────────────────────────────────────────

/** Unique planet ids across all scenes in this story. */
export function storyPlanetIds(story: MeshStory): UUID[] {
  const set = new Set<UUID>()
  for (const scene of story.scenes) set.add(scene.planetId)
  return [...set]
}

/** Deduplicated motivating concept ids (intro + conclusion). */
export function storyConceptIds(story: MeshStory): UUID[] {
  const set = new Set<UUID>()
  for (const id of story.introduction.conceptIds) set.add(id)
  for (const id of story.conclusion.conceptIds) set.add(id)
  return [...set]
}

export function storyStats(story: MeshStory): EntityStatPair {
  return {
    labelA: 'visits',
    valueA: storyPlanetIds(story).length,
    labelB: 'driven by',
    valueB: storyConceptIds(story).length,
  }
}

// ── Word counts ─────────────────────────────────────────────────────────────

function countWords(md: string): number {
  const stripped = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/[#*_>\-]/g, ' ')
  return stripped.trim().split(/\s+/).filter(Boolean).length
}

export function planetWordCount(planet: MeshPlanet): number {
  return countWords(planet.markdown)
}

export function conceptWordCount(concept: MeshConcept): number {
  return countWords(concept.markdown)
}

export function storyWordCount(story: MeshStory): number {
  let n = countWords(story.introduction.markdown)
  for (const scene of story.scenes) n += countWords(scene.markdown)
  n += countWords(story.conclusion.markdown)
  return n
}

// ── Galaxy-wide inventory ───────────────────────────────────────────────────

export interface GalaxyInventory {
  solarSystems: number
  planets: number
  concepts: number
  stories: number
  totalConnections: number
  totalWordCount: number
}

export function galaxyInventory(data: GalaxyData): GalaxyInventory {
  let connections = 0
  for (const id in data.planets) connections += data.planets[id].planetConnections.length
  for (const id in data.concepts) {
    connections += data.concepts[id].planetConnections.length
    connections += data.concepts[id].conceptConnections.length
  }

  let words = 0
  for (const id in data.planets) words += planetWordCount(data.planets[id])
  for (const id in data.concepts) words += conceptWordCount(data.concepts[id])
  for (const story of data.stories) words += storyWordCount(story)

  return {
    solarSystems: Object.keys(data.solarSystems).length,
    planets: Object.keys(data.planets).length,
    concepts: Object.keys(data.concepts).length,
    stories: data.stories.length,
    totalConnections: connections,
    totalWordCount: words,
  }
}

// ── Galaxy-wide superlatives (for StatsView) ────────────────────────────────

export interface Superlative<T> {
  label: string
  entity: T
  value: number
}

/** Planet with the most total connections (inbound planets + concepts tied). */
export function mostConnectedPlanet(data: GalaxyData): Superlative<MeshPlanet> | null {
  const planets = Object.values(data.planets)
  if (!planets.length) return null
  let best = planets[0]
  let bestValue = -1
  for (const p of planets) {
    const v = inboundPlanetLinks(p.id, data) + conceptsTiedToPlanet(p.id, data) + p.planetConnections.length
    if (v > bestValue) {
      best = p
      bestValue = v
    }
  }
  return { label: 'Most connected planet', entity: best, value: bestValue }
}

/** Concept referenced by the most stories (intro or conclusion). */
export function mostReferencedConcept(data: GalaxyData): Superlative<MeshConcept> | null {
  const concepts = Object.values(data.concepts)
  if (!concepts.length) return null
  let best = concepts[0]
  let bestValue = -1
  for (const c of concepts) {
    const v = storiesFeaturingConcept(c.id, data).length
    if (v > bestValue) {
      best = c
      bestValue = v
    }
  }
  return { label: 'Most referenced concept', entity: best, value: bestValue }
}

/** Story with the highest total word count. */
export function longestStory(data: GalaxyData): Superlative<MeshStory> | null {
  if (!data.stories.length) return null
  let best = data.stories[0]
  let bestValue = -1
  for (const s of data.stories) {
    const v = storyWordCount(s)
    if (v > bestValue) {
      best = s
      bestValue = v
    }
  }
  return { label: 'Longest story', entity: best, value: bestValue }
}

/**
 * Solar system whose planets are visited most across all stories.
 * For each solar system, sum the count of scenes across all stories that land on any of its planets.
 */
export function mostVisitedSolarSystem(data: GalaxyData) {
  const systems = Object.values(data.solarSystems)
  if (!systems.length) return null
  const visitsPerSystem = new Map<UUID, number>()
  for (const sys of systems) {
    const planetSet = new Set(sys.planets)
    let count = 0
    for (const story of data.stories) {
      for (const scene of story.scenes) {
        if (planetSet.has(scene.planetId)) count++
      }
    }
    visitsPerSystem.set(sys.id, count)
  }
  let best = systems[0]
  let bestValue = -1
  for (const sys of systems) {
    const v = visitsPerSystem.get(sys.id) ?? 0
    if (v > bestValue) {
      best = sys
      bestValue = v
    }
  }
  return { label: 'Most visited solar system', entity: best, value: bestValue }
}
