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

const current = ref<GalaxyData | null>(null)

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
    loadFromApi,
    loadFromFixture,
    clear,
  }
}
