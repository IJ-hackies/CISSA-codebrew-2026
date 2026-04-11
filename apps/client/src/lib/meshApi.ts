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

/** Fetch GalaxyData from the mesh parser API. */
export async function fetchMeshData(id: string): Promise<GalaxyData> {
  const res = await fetch(`/api/mesh/${encodeURIComponent(id)}`)
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
  return (await res.json()) as GalaxyData
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
