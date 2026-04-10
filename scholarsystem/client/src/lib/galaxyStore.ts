/**
 * Shared reactive store for the currently loaded Galaxy blob.
 *
 * ChatLanding writes the blob after createGalaxy() completes, then navigates
 * to /galaxy/:id. GalaxyMap reads the blob on mount. If the blob isn't in the
 * store (e.g. direct URL navigation), GalaxyMap falls back to getGalaxy(id).
 */

import { ref } from 'vue'
import type { Galaxy } from '@/types/galaxy'
import { getGalaxy } from './api'

const current = ref<Galaxy | null>(null)

export function useGalaxyStore() {
  function setGalaxy(galaxy: Galaxy) {
    current.value = galaxy
  }

  function clearGalaxy() {
    current.value = null
  }

  async function loadGalaxy(id: string): Promise<Galaxy> {
    if (current.value?.meta.id === id) return current.value
    const blob = (await getGalaxy(id)) as unknown as Galaxy
    current.value = blob
    return blob
  }

  return {
    galaxy: current,
    setGalaxy,
    clearGalaxy,
    loadGalaxy,
  }
}
