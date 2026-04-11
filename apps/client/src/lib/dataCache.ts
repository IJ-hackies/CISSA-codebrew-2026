/**
 * App-wide data cache.
 *
 * Reactive singleton refs that are:
 *  1. Hydrated immediately from localStorage on import (zero-wait initial render)
 *  2. Refreshed from the network in the background
 *  3. Written back to localStorage on success
 *
 * Call prefetchAll() in App.vue onMounted to kick off all requests the moment
 * the app loads — before any page component mounts.
 */

import { ref } from 'vue'
import {
  fetchGalaxyList,
  fetchGallery,
  fetchGalaxyEnvelope,
  fetchSubmissions,
  type GalaxyRowSummary,
  type GalleryCard,
  type GalaxyEnvelope,
  type Submission,
  type GallerySortOrder,
} from './meshApi'

// ── localStorage helpers ───────────────────────────────────────────
const LS_TTL_MS = 5 * 60 * 1000 // 5 minutes

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { d, t } = JSON.parse(raw) as { d: T; t: number }
    if (Date.now() - t > LS_TTL_MS) return null
    return d
  } catch { return null }
}

function lsWrite<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ d: data, t: Date.now() }))
  } catch { /* quota exceeded */ }
}

// ── In-session fetch dedup TTL ─────────────────────────────────────
// After the first successful fetch this session, skip re-fetching for
// SESSION_TTL_MS to avoid redundant requests on within-session navigation.
const SESSION_TTL_MS = 2 * 60 * 1000 // 2 minutes

// ── Galaxy list ────────────────────────────────────────────────────
const _cachedGalaxies = lsRead<GalaxyRowSummary[]>('stc.gl')
export const galaxyList = ref<GalaxyRowSummary[]>(_cachedGalaxies ?? [])
export const galaxyListLoading = ref(_cachedGalaxies === null)

let _glFetch: Promise<void> | null = null
let _glLastFetch = 0

/** Write the current in-memory galaxyList back to localStorage immediately.
 *  Call after any local mutation (delete, publish toggle, tagline edit) so
 *  the cache stays consistent and a page refresh shows the correct state. */
export function syncGalaxyListCache() {
  lsWrite('stc.gl', galaxyList.value)
  _glLastFetch = Date.now()
}

export function fetchGalaxyListCached(force = false): Promise<void> {
  // Deduplicate in-flight requests
  if (_glFetch) return _glFetch
  // Skip if data is fresh within this session
  if (!force && galaxyList.value.length > 0 && Date.now() - _glLastFetch < SESSION_TTL_MS) {
    return Promise.resolve()
  }
  _glFetch = (async () => {
    try {
      const data = await fetchGalaxyList()
      galaxyList.value = data
      lsWrite('stc.gl', data)
      _glLastFetch = Date.now()
    } catch { /* keep existing data */ }
    finally {
      galaxyListLoading.value = false
      _glFetch = null
    }
  })()
  return _glFetch
}

// ── Gallery ("The Taco") ───────────────────────────────────────────
const _cachedGallery = lsRead<GalleryCard[]>('stc.gallery')
export const galleryCards = ref<GalleryCard[]>(_cachedGallery ?? [])
export const galleryCardsLoading = ref(false)
export const galleryError = ref('')

let _galFetch: Promise<void> | null = null
let _galLastFetch = 0

export function fetchGalleryCached(sort: GallerySortOrder = 'newest', q = ''): Promise<void> {
  const isDefault = sort === 'newest' && !q
  // Deduplicate only for the default (unfiltered) query
  if (_galFetch && isDefault) return _galFetch
  // Skip if default data is fresh within this session
  if (isDefault && galleryCards.value.length > 0 && Date.now() - _galLastFetch < SESSION_TTL_MS) {
    return Promise.resolve()
  }

  const p = (async () => {
    galleryCardsLoading.value = true
    galleryError.value = ''
    try {
      const data = await fetchGallery(sort, q)
      galleryCards.value = data
      if (isDefault) {
        lsWrite('stc.gallery', data)
        _galLastFetch = Date.now()
      }
    } catch {
      galleryError.value = 'Failed to load gallery'
    } finally {
      galleryCardsLoading.value = false
      if (isDefault) _galFetch = null
    }
  })()

  if (isDefault) _galFetch = p
  return p
}

// ── Envelope per galaxy ────────────────────────────────────────────
// Only caches completed galaxies. Returns null for in-progress ones.

export function getCachedEnvelope(id: string): GalaxyEnvelope | null {
  return lsRead<GalaxyEnvelope>(`stc.env:${id}`)
}

export async function fetchEnvelopeCached(id: string): Promise<GalaxyEnvelope> {
  const env = await fetchGalaxyEnvelope(id)
  if (env.status === 'complete') lsWrite(`stc.env:${id}`, env)
  return env
}

// ── Submissions per galaxy ─────────────────────────────────────────
export function getCachedSubmissions(id: string): Submission[] | null {
  return lsRead<Submission[]>(`stc.subs:${id}`)
}

export async function fetchSubmissionsCached(id: string): Promise<Submission[]> {
  const data = await fetchSubmissions(id)
  lsWrite(`stc.subs:${id}`, data)
  return data
}

// ── App-start prefetch ─────────────────────────────────────────────
// Call this in App.vue onMounted so data is in-flight before any page mounts.
export function prefetchAll() {
  // Galaxy list + gallery fire immediately in parallel.
  const listReady = fetchGalaxyListCached().catch(() => {})
  fetchGalleryCached().catch(() => {})

  // Once the galaxy list resolves, kick off submission prefetch for the 8
  // most-recently-updated complete galaxies — covers the common case where
  // the user navigates straight from the dashboard into a galaxy they own.
  listReady.then(() => {
    const ids = galaxyList.value
      .filter(g => g.status === 'complete')
      .slice(0, 8)
      .map(g => g.id)
    for (const id of ids) {
      fetchSubmissionsCached(id).catch(() => {})
    }
  })
}
