/**
 * v4 Mesh API client.
 *
 * Two ways to get GalaxyData:
 *   1. fetchMeshData(id)    — fetch from the server API
 *   2. loadMeshFromJson(json) — load from a static JSON object (no server needed)
 *
 * For dev without a server, import the fixture:
 *   import fixture from '@/fixtures/galaxy-data.json'
 *   const data = loadMeshFromJson(fixture)
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

import type { GalaxyData } from '@scholarsystem/shared'

// Re-export types so frontend components can import from one place
export type {
  GalaxyData,
  MeshSolarSystem,
  MeshPlanet,
  MeshConcept,
  MeshStory,
  MeshSource,
  MeshMedia,
  WikiLinkIndex,
  UUID,
  StoryScene,
} from '@scholarsystem/shared'

export type GalaxyJobStatus =
  | 'queued'
  | 'ingest'
  | 'cluster'
  | 'outline'
  | 'expand'
  | 'stories'
  | 'complete'
  | 'error'

export interface GalaxyEnvelope {
  id: string
  title: string
  status: GalaxyJobStatus
  stageDetail: string
  error: string | null
  createdAt: number
  updatedAt: number
  galaxy: GalaxyData
  isPublic?: boolean
  tagline?: string | null
  ownerToken?: string // only present on create response
}

export interface CreateGalaxyInput {
  text?: string
  title?: string
  files?: File[]
  filename?: string | null
}

export async function createGalaxy(input: CreateGalaxyInput): Promise<GalaxyEnvelope> {
  const hasFiles = (input.files?.length ?? 0) > 0
  let res: Response

  if (hasFiles) {
    const form = new FormData()
    for (const f of input.files!) form.append('file', f, f.name)
    if (input.title) form.append('title', input.title)
    if (input.text) form.append('text', input.text)
    res = await fetch(`${API_BASE}/api/galaxy/create`, { method: 'POST', body: form })
  } else {
    res = await fetch(`${API_BASE}/api/galaxy/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        title: input.title,
        filename: input.filename,
      }),
    })
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: string; message?: string }
      detail = err.message ?? err.error ?? detail
    } catch {
      // non-JSON error body
    }
    throw new Error(detail)
  }

  const envelope = (await res.json()) as GalaxyEnvelope
  // Persist the owner token so the user can manage this galaxy later.
  if (envelope.ownerToken) {
    try {
      localStorage.setItem(`stellaTaco.ownerToken:${envelope.id}`, envelope.ownerToken)
    } catch { /* storage full or private mode */ }
  }
  return envelope
}

export async function fetchGalaxyEnvelope(id: string): Promise<GalaxyEnvelope> {
  const res = await fetch(`${API_BASE}/api/galaxy/${encodeURIComponent(id)}`)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: string; message?: string }
      detail = err.message ?? err.error ?? detail
    } catch {
      // non-JSON error body
    }
    throw new Error(detail)
  }
  return (await res.json()) as GalaxyEnvelope
}

/** Fetch GalaxyData from the mesh parser API. */
export async function fetchMeshData(id: string): Promise<GalaxyData> {
  const envelope = await fetchGalaxyEnvelope(id)
  return envelope.galaxy
}

/**
 * Load GalaxyData from a raw JSON object — no server needed.
 * Use this with a static fixture or a JSON file loaded via import.
 *
 * Example:
 *   import fixture from '@/fixtures/galaxy-data.json'
 *   const data = loadMeshFromJson(fixture)
 */
export function loadMeshFromJson(json: unknown): GalaxyData {
  return json as GalaxyData
}

// ── Galaxy list ────────────────────────────────────────────────────

export interface GalaxyRowSummary {
  id: string
  title: string
  status: GalaxyJobStatus
  stageDetail: string
  error: string | null
  createdAt: number
  updatedAt: number
  isPublic: boolean
  tagline: string | null
}

export async function deleteGalaxy(id: string): Promise<void> {
  const res = await fetch(`/api/galaxy/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: string; message?: string }
      detail = err.message ?? err.error ?? detail
    } catch { /* non-JSON */ }
    throw new Error(detail)
  }
}

export async function fetchGalaxyList(): Promise<GalaxyRowSummary[]> {
  const res = await fetch('/api/galaxy')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { galaxies: GalaxyRowSummary[] }
  return body.galaxies
}

// ── Append ─────────────────────────────────────────────────────────

export async function appendGalaxy(id: string, input: CreateGalaxyInput): Promise<GalaxyEnvelope> {
  const hasFiles = (input.files?.length ?? 0) > 0
  let res: Response

  if (hasFiles) {
    const form = new FormData()
    for (const f of input.files!) form.append('file', f, f.name)
    if (input.title) form.append('title', input.title)
    if (input.text) form.append('text', input.text)
    res = await fetch(`/api/galaxy/${encodeURIComponent(id)}/append`, { method: 'POST', body: form })
  } else {
    res = await fetch(`/api/galaxy/${encodeURIComponent(id)}/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.text, title: input.title, filename: input.filename }),
    })
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: string; message?: string }
      detail = err.message ?? err.error ?? detail
    } catch { /* non-JSON */ }
    throw new Error(detail)
  }

  return (await res.json()) as GalaxyEnvelope
}

// ── Submissions ────────────────────────────────────────────────────

export interface Submission {
  id: string
  galaxyId: string
  text: string | null
  filenames: string[]
  createdAt: number
}

export async function fetchSubmissions(galaxyId: string): Promise<Submission[]> {
  const res = await fetch(`/api/galaxy/${encodeURIComponent(galaxyId)}/submissions`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { submissions: Submission[] }
  return body.submissions
}

// ── Owner token helpers ────────────────────────────────────────────

export function getOwnerToken(galaxyId: string): string | null {
  try {
    return localStorage.getItem(`stellaTaco.ownerToken:${galaxyId}`)
  } catch {
    return null
  }
}

/** True if the current browser owns this galaxy. */
export function isOwner(galaxyId: string): boolean {
  return !!getOwnerToken(galaxyId)
}

/**
 * Collect all {galaxyId, ownerToken} pairs from localStorage for reconcile.
 * Reads all stellaTaco.ownerToken:* keys.
 */
export function getAllOwnedPairs(): Array<{ galaxyId: string; ownerToken: string }> {
  const pairs: Array<{ galaxyId: string; ownerToken: string }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('stellaTaco.ownerToken:')) {
        const galaxyId = key.slice('stellaTaco.ownerToken:'.length)
        const ownerToken = localStorage.getItem(key)
        if (galaxyId && ownerToken) pairs.push({ galaxyId, ownerToken })
      }
    }
  } catch { /* storage unavailable */ }
  return pairs
}

// ── Gallery ("The Taco") API ───────────────────────────────────────

export interface GalleryCard {
  id: string
  title: string
  tagline: string | null
  updatedAt: number
  solarSystemCount: number
  planetCount: number
}

export type GallerySortOrder = 'newest' | 'planets' | 'alpha'

export async function fetchGallery(
  sort: GallerySortOrder = 'newest',
  q = '',
): Promise<GalleryCard[]> {
  const params = new URLSearchParams()
  if (sort !== 'newest') params.set('sort', sort)
  if (q) params.set('q', q)
  const url = `/api/gallery${params.size ? `?${params}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { cards: GalleryCard[] }
  return body.cards
}

export async function publishToTaco(
  galaxyId: string,
  tagline: string,
): Promise<void> {
  const ownerToken = getOwnerToken(galaxyId)
  if (!ownerToken) throw new Error('no owner token for this galaxy')
  const res = await fetch('/api/gallery/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galaxyId, ownerToken, tagline }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; reason?: string }
    throw new Error(err.reason ?? err.error ?? `HTTP ${res.status}`)
  }
}

export async function unpublishFromTaco(galaxyId: string): Promise<void> {
  const ownerToken = getOwnerToken(galaxyId)
  if (!ownerToken) throw new Error('no owner token for this galaxy')
  const res = await fetch('/api/gallery/unpublish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ galaxyId, ownerToken }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

export async function updateTacoTagline(
  galaxyId: string,
  tagline: string,
): Promise<void> {
  const ownerToken = getOwnerToken(galaxyId)
  if (!ownerToken) throw new Error('no owner token for this galaxy')
  const res = await fetch(`/api/gallery/${encodeURIComponent(galaxyId)}/tagline`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerToken, tagline }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; reason?: string }
    throw new Error(err.reason ?? err.error ?? `HTTP ${res.status}`)
  }
}

export async function reconcileOwnership(): Promise<void> {
  const owned = getAllOwnedPairs()
  if (owned.length === 0) return
  try {
    await fetch('/api/gallery/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owned }),
    })
  } catch { /* non-fatal — reconcile is best-effort */ }
}
