/**
 * Reactive store for v4 GalaxyData.
 *
 * Usage:
 *   const { data, loadFromApi, loadFromFixture } = useMeshStore()
 *
 *   // Load from server:
 *   await loadFromApi('some-galaxy-id')
 *
 *   // Load from static fixture (no server):
 *   import fixture from '@/fixtures/galaxy-data.json'
 *   loadFromFixture(fixture)
 *
 *   // Access data:
 *   data.value.planets, data.value.stories, etc.
 */

import { ref } from 'vue'
import type { GalaxyData } from '@scholarsystem/shared'
import { fetchMeshData, loadMeshFromJson } from './meshApi'

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

function persistSet(key: string, ids: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...ids])) } catch { /* noop */ }
}

const current            = ref<GalaxyData | null>(null)
const visitedPlanetIds   = ref<Set<string>>(loadSet('scholarSystem.visitedPlanets'))
const collectedConceptIds = ref<Set<string>>(loadSet('scholarSystem.collectedConcepts'))

export function useMeshStore() {
  /** Load GalaxyData from the mesh parser API. */
  async function loadFromApi(id: string): Promise<GalaxyData> {
    const data = await fetchMeshData(id)
    current.value = data
    return data
  }

  /** Load GalaxyData from a static JSON object (no server needed). */
  function loadFromFixture(json: unknown): GalaxyData {
    const data = loadMeshFromJson(json)
    current.value = data
    return data
  }

  function clear() {
    current.value = null
  }

  return {
    data: current,
    visitedPlanetIds,
    collectedConceptIds,
    persistSet,
    loadFromApi,
    loadFromFixture,
    clear,
  }
}
