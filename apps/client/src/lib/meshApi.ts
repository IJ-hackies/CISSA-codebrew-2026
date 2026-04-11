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
    res = await fetch('/api/galaxy/create', { method: 'POST', body: form })
  } else {
    res = await fetch('/api/galaxy/create', {
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

  return (await res.json()) as GalaxyEnvelope
}

export async function fetchGalaxyEnvelope(id: string): Promise<GalaxyEnvelope> {
  const res = await fetch(`/api/galaxy/${encodeURIComponent(id)}`)
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
