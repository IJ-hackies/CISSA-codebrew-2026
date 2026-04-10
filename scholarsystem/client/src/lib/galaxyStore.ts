/**
 * Reactive store for the currently loaded Galaxy blob (schema v3).
 *
 * ChatLanding sets the blob after createGalaxy() resolves, then navigates
 * to /galaxy/:id. GalaxyView reads the blob on mount; if the store is empty
 * (direct URL navigation), it falls back to loadGalaxy(id) from the API.
 *
 * Polling: when pipeline stages are still running (structure, wraps, coverage)
 * the store polls GET /api/galaxies/:id every 5 s so the frontend picks up
 * enriched data without a page reload.
 */

import { ref } from 'vue'
import type { Galaxy } from '@/lib/galaxyTypes'
import { getGalaxy } from './api'

const current = ref<Galaxy | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const POLL_INTERVAL_MS = 5000

function shouldPoll(g: Galaxy): boolean {
  const p = g.pipeline
  return (
    p.ingest.status === 'running' ||
    p.structure.status === 'running' ||
    p.wraps.status === 'running' ||
    p.coverage.status === 'running' ||
    (p.ingest.status === 'complete' && p.structure.status === 'pending') ||
    (p.structure.status === 'complete' && p.wraps.status === 'pending') ||
    (p.wraps.status === 'complete' && p.coverage.status === 'pending')
  )
}

function startPolling(id: string) {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const fresh = (await getGalaxy(id)) as unknown as Galaxy
      current.value = fresh
      if (!shouldPoll(fresh)) stopPolling()
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
    if (shouldPoll(galaxy)) startPolling(galaxy.meta.id)
  }

  function clearGalaxy() {
    stopPolling()
    current.value = null
  }

  async function loadGalaxy(id: string): Promise<Galaxy> {
    if (current.value?.meta.id === id) return current.value
    const blob = (await getGalaxy(id)) as unknown as Galaxy
    current.value = blob
    if (shouldPoll(blob)) startPolling(id)
    return blob
  }

  return {
    galaxy: current,
    setGalaxy,
    clearGalaxy,
    loadGalaxy,
  }
}
