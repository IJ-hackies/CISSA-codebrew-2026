/**
 * Thin fetch wrapper for the Scholar System backend API.
 *
 * Uses relative URLs — the Vite dev server proxies `/api/*` to the Bun
 * backend (see vite.config.ts). In production the frontend is served by
 * the same origin as the API, so relative URLs keep working.
 */

/**
 * Minimal shape of what the frontend currently consumes from a Galaxy blob.
 * The full schema lives in `shared/types/` — import from there once the
 * client is wired to the workspace package. For now, keep a local surface
 * type so ChatLanding can route off the real id/title.
 */
export interface GalaxyBlob {
  meta: {
    id: string
    title: string
    schemaVersion: number
    createdAt: number
    updatedAt: number
  }
  // Other scopes exist but aren't needed here yet.
  [key: string]: unknown
}

export interface CreateGalaxyInput {
  text: string
  title?: string
  filename?: string | null
}

export async function createGalaxy(input: CreateGalaxyInput): Promise<GalaxyBlob> {
  const res = await fetch('/api/galaxy/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const err = (await res.json()) as { error?: string; message?: string }
      detail = err.message ?? err.error ?? detail
    } catch {
      // non-JSON error body — fall through with status
    }
    throw new Error(detail)
  }
  return (await res.json()) as GalaxyBlob
}

export async function getGalaxy(id: string): Promise<GalaxyBlob> {
  const res = await fetch(`/api/galaxy/${encodeURIComponent(id)}`)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as GalaxyBlob
}
