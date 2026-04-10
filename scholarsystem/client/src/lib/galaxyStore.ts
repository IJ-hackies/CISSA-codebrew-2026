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
import type { CameraState } from '@/composables/useMapControls'

const current = ref<Galaxy | null>(null)
const savedCamera = ref<CameraState | null>(null)

export function useGalaxyStore() {
  function setGalaxy(galaxy: Galaxy) {
    current.value = galaxy
  }

  function clearGalaxy() {
    current.value = null
    savedCamera.value = null
  }

  async function loadGalaxy(id: string): Promise<Galaxy> {
    if (current.value?.meta.id === id) return current.value
    const blob = (await getGalaxy(id)) as unknown as Galaxy
    current.value = blob
    return blob
  }

  function saveCameraState(state: CameraState) {
    savedCamera.value = state
  }

  function restoreCameraState(): CameraState | null {
    return savedCamera.value
  }

  return {
    galaxy: current,
    setGalaxy,
    clearGalaxy,
    loadGalaxy,
    saveCameraState,
    restoreCameraState,
  }
}
