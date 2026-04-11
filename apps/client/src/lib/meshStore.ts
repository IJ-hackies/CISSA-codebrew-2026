/**
 * Reactive store for v4 GalaxyData.
 *
 * Owns:
 *   - `data`                — the current GalaxyData
 *   - `galaxyId`            — the current galaxy id (scopes persistence)
 *   - `collectedConceptIds` — Set of collected concept ids, persisted to
 *                             localStorage under `scholarSystem.souls:<galaxyId>`
 *   - `visitedPlanetIds`    — Set of visited planet ids, persisted to
 *                             localStorage under `scholarSystem.visited:<galaxyId>`
 *
 * On load, both sets are stale-id-filtered against the current data so
 * ids from regenerated galaxies don't leak into the new session.
 *
 * Usage:
 *   const { data, loadFromApi, loadFromFixture, collectConcept, markPlanetVisited } = useMeshStore()
 *   await loadFromApi('some-galaxy-id')
 *   collectConcept(conceptId)   // persists automatically
 */

import { ref } from 'vue'
import type { GalaxyData } from '@scholarsystem/shared'
import {
  fetchGalaxyEnvelope,
  loadMeshFromJson,
  type GalaxyEnvelope,
  type GalaxyJobStatus,
} from './meshApi'

const FIXTURE_ID = '__fixture__'

function soulsKey(galaxyId: string): string {
  return `scholarSystem.souls:${galaxyId}`
}
function visitedKey(galaxyId: string): string {
  return `scholarSystem.visited:${galaxyId}`
}
function presetsKey(galaxyId: string): string {
  return `scholarSystem.presets:${galaxyId}`
}

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function persistSetTo(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    /* noop */
  }
}

function loadPresetMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function persistPresetMap(key: string, presets: Record<string, string>) {
  try {
    localStorage.setItem(key, JSON.stringify(presets))
  } catch {
    /* noop */
  }
}

const current = ref<GalaxyData | null>(null)
const galaxyId = ref<string>(FIXTURE_ID)
const status = ref<GalaxyJobStatus>('complete')
const stageDetail = ref<string>('')
const error = ref<string | null>(null)
const visitedPlanetIds = ref<Set<string>>(new Set())
const collectedConceptIds = ref<Set<string>>(new Set())
/**
 * Per-system particle-formation preset chosen at first generation. Persisted
 * per galaxy so the GalaxyView and SolarSystemView always agree on which
 * shape a given system uses, and so the choice survives page refreshes.
 */
const systemPresets = ref<Record<string, string>>({})
let pollTimer: ReturnType<typeof setTimeout> | null = null
const POLL_INTERVAL_MS = 2500

function stopPolling() {
  if (!pollTimer) return
  clearTimeout(pollTimer)
  pollTimer = null
}

function applyEnvelope(envelope: GalaxyEnvelope) {
  current.value = envelope.galaxy
  galaxyId.value = envelope.id
  status.value = envelope.status
  stageDetail.value = envelope.stageDetail
  error.value = envelope.error
  hydrateSetsForCurrentGalaxy()
}

function schedulePoll(id: string) {
  stopPolling()
  pollTimer = setTimeout(async () => {
    try {
      const envelope = await fetchGalaxyEnvelope(id)
      applyEnvelope(envelope)
      if (envelope.status !== 'complete' && envelope.status !== 'error') {
        schedulePoll(id)
      }
    } catch {
      schedulePoll(id)
    }
  }, POLL_INTERVAL_MS)
}

/** Load persisted sets for the active galaxy id, filtering out ids that
 *  no longer exist in the loaded data. */
function hydrateSetsForCurrentGalaxy() {
  const data = current.value
  const id = galaxyId.value
  if (!data) {
    visitedPlanetIds.value = new Set()
    collectedConceptIds.value = new Set()
    systemPresets.value = {}
    return
  }

  const rawVisited = loadSet(visitedKey(id))
  const filteredVisited = new Set<string>()
  for (const pid of rawVisited) {
    if (data.planets[pid]) filteredVisited.add(pid)
  }
  visitedPlanetIds.value = filteredVisited
  // If we dropped any, persist the cleaned set
  if (filteredVisited.size !== rawVisited.size) persistSetTo(visitedKey(id), filteredVisited)

  const rawSouls = loadSet(soulsKey(id))
  const filteredSouls = new Set<string>()
  for (const cid of rawSouls) {
    if (data.concepts[cid]) filteredSouls.add(cid)
  }
  collectedConceptIds.value = filteredSouls
  if (filteredSouls.size !== rawSouls.size) persistSetTo(soulsKey(id), filteredSouls)

  // Load existing preset choices and prune any that point to systems that
  // no longer exist (e.g. galaxy regenerated under the same id).
  const rawPresets = loadPresetMap(presetsKey(id))
  const filteredPresets: Record<string, string> = {}
  let droppedAny = false
  for (const [sysId, preset] of Object.entries(rawPresets)) {
    if (data.solarSystems[sysId]) filteredPresets[sysId] = preset
    else droppedAny = true
  }
  systemPresets.value = filteredPresets
  if (droppedAny) persistPresetMap(presetsKey(id), filteredPresets)
}

export function useMeshStore() {
  /** Load GalaxyData from the mesh parser API. */
  async function loadFromApi(id: string): Promise<GalaxyData> {
    stopPolling()
    const envelope = await fetchGalaxyEnvelope(id)
    applyEnvelope(envelope)
    if (envelope.status !== 'complete' && envelope.status !== 'error') {
      schedulePoll(id)
    }
    return envelope.galaxy
  }

  /**
   * Load GalaxyData from a static JSON object (no server needed).
   * Pass an optional galaxy id to scope persistence; defaults to a shared
   * fixture id so dev work without a real id still persists consistently.
   */
  function loadFromFixture(json: unknown, id: string = FIXTURE_ID): GalaxyData {
    stopPolling()
    const data = loadMeshFromJson(json)
    current.value = data
    galaxyId.value = id
    status.value = 'complete'
    stageDetail.value = ''
    error.value = null
    hydrateSetsForCurrentGalaxy()
    return data
  }

  function clear() {
    stopPolling()
    current.value = null
    status.value = 'complete'
    stageDetail.value = ''
    error.value = null
    visitedPlanetIds.value = new Set()
    collectedConceptIds.value = new Set()
  }

  function markPlanetVisited(planetId: string) {
    if (visitedPlanetIds.value.has(planetId)) return
    const next = new Set(visitedPlanetIds.value)
    next.add(planetId)
    visitedPlanetIds.value = next
    persistSetTo(visitedKey(galaxyId.value), next)
  }

  function collectConcept(conceptId: string): boolean {
    if (collectedConceptIds.value.has(conceptId)) return false
    const next = new Set(collectedConceptIds.value)
    next.add(conceptId)
    collectedConceptIds.value = next
    persistSetTo(soulsKey(galaxyId.value), next)
    return true
  }

  function isConceptCollected(conceptId: string): boolean {
    return collectedConceptIds.value.has(conceptId)
  }

  /**
   * Return the persisted particle preset for a system, or pick one randomly
   * (`Math.random()`) on first generation and persist it. Subsequent calls
   * for the same system return the same preset, so GalaxyView's particle
   * formation and SolarSystemView's central sun always agree on the shape.
   *
   * @param systemId         the solar system's UUID
   * @param availablePresets the list of preset names callers know about
   */
  function getOrGenerateSystemPreset<T extends string>(
    systemId: string,
    availablePresets: readonly T[],
  ): T {
    const existing = systemPresets.value[systemId]
    if (existing && (availablePresets as readonly string[]).includes(existing)) {
      return existing as T
    }
    const choice = availablePresets[Math.floor(Math.random() * availablePresets.length)]
    const next = { ...systemPresets.value, [systemId]: choice }
    systemPresets.value = next
    persistPresetMap(presetsKey(galaxyId.value), next)
    return choice
  }

  return {
    data: current,
    galaxyId,
    status,
    stageDetail,
    error,
    visitedPlanetIds,
    collectedConceptIds,
    loadFromApi,
    loadFromFixture,
    clear,
    markPlanetVisited,
    collectConcept,
    isConceptCollected,
    getOrGenerateSystemPreset,
  }
}
