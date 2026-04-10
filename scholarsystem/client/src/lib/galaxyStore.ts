/**
 * Shared reactive store for the currently loaded Galaxy blob.
 *
 * ChatLanding writes the blob after createGalaxy() completes, then navigates
 * to /galaxy/:id. GalaxyMap reads the blob on mount. If the blob isn't in the
 * store (e.g. direct URL navigation), GalaxyMap falls back to getGalaxy(id).
 *
 * Polling: when background stages are still running (detail, narrative,
 * visuals), the store polls GET /api/galaxy/:id every few seconds so the
 * frontend picks up enriched data without a page reload.
 */

import { ref, watch } from 'vue'
import type { Galaxy } from '@/types/galaxy'
import { getGalaxy } from './api'
import type { CameraState } from '@/composables/useMapControls'

const current = ref<Galaxy | null>(null)
const savedCamera = ref<CameraState | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL_MS = 5000

/** Check whether any background stage is still running. */
function hasRunningStages(g: Galaxy): boolean {
  const p = g.pipeline
  return (
    p.detail.status === 'running' ||
    p.coverageAudit.status === 'running' ||
    p.narrative.status === 'running' ||
    p.visuals.status === 'running'
  )
}

/** Check whether any background stage is still pending (hasn't started yet). */
function hasPendingBackgroundStages(g: Galaxy): boolean {
  const p = g.pipeline
  // If structure is done but detail hasn't completed, background is still going.
  if (p.structure.status === 'done') {
    if (p.detail.status !== 'done' && p.detail.status !== 'error') return true
    if (p.narrative.status !== 'done' && p.narrative.status !== 'error') return true
    if (p.visuals.status !== 'done' && p.visuals.status !== 'error') return true
  }
  return false
}

function shouldPoll(g: Galaxy): boolean {
  return hasRunningStages(g) || hasPendingBackgroundStages(g)
}

function startPolling(id: string) {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const fresh = (await getGalaxy(id)) as unknown as Galaxy
      // Merge: keep client-side progress (it's more up-to-date),
      // take everything else from the server.
      const clientProgress = current.value?.progress
      current.value = fresh
      if (clientProgress) {
        // Preserve in-memory progress mutations not yet persisted.
        current.value.progress = clientProgress
      }
      // Stop polling once all background stages are done.
      if (!shouldPoll(fresh)) {
        stopPolling()
      }
    } catch {
      // Silent — transient network errors shouldn't break the UI.
    }
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function useGalaxyStore() {
  function setGalaxy(galaxy: Galaxy) {
    current.value = galaxy
    // Start polling if background stages are still running.
    if (shouldPoll(galaxy)) {
      startPolling(galaxy.meta.id)
    }
  }

  function clearGalaxy() {
    stopPolling()
    current.value = null
    savedCamera.value = null
  }

  async function loadGalaxy(id: string): Promise<Galaxy> {
    if (current.value?.meta.id === id) return current.value
    const blob = (await getGalaxy(id)) as unknown as Galaxy
    current.value = blob
    // Start polling if background stages are still running.
    if (shouldPoll(blob)) {
      startPolling(id)
    }
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
