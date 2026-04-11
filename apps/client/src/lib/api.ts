/**
 * Thin fetch wrapper for the Stella Taco backend API.
 *
 * Uses relative URLs by default — the Vite dev server proxies `/api/*` to
 * the Bun backend (see vite.config.ts). Set VITE_API_URL to point at a
 * remote backend (e.g. "http://134.199.156.237:8889") for split deploys.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? ''

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
  /** Pasted text. Optional — can be combined with files or sent alone. */
  text?: string
  title?: string
  /** Uploaded files. When any are present, the request is sent as
   *  multipart and every file plus the pasted text is concatenated into
   *  a single blob server-side (Option A — boundary-header concat). */
  files?: File[]
  /** Legacy — only used on the pure-paste path when no files are attached. */
  filename?: string | null
}

export async function createGalaxy(input: CreateGalaxyInput): Promise<GalaxyBlob> {
  const hasFiles = (input.files?.length ?? 0) > 0
  let res: Response
  if (hasFiles) {
    // Multipart path: N files + optional title + optional text fallback.
    // The server merges everything into one blob with `# <filename>`
    // boundary markers before Stage 0.
    const form = new FormData()
    for (const f of input.files!) form.append('file', f, f.name)
    if (input.title) form.append('title', input.title)
    if (input.text) form.append('text', input.text)
    res = await fetch(`${API_BASE}/api/galaxy/create`, { method: 'POST', body: form })
  } else {
    // JSON paste path unchanged.
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
      // non-JSON error body — fall through with status
    }
    throw new Error(detail)
  }
  return (await res.json()) as GalaxyBlob
}

export async function getGalaxy(id: string): Promise<GalaxyBlob> {
  const res = await fetch(`${API_BASE}/api/galaxy/${encodeURIComponent(id)}`)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as GalaxyBlob
}

// ─── Scene endpoints ──────────────────────────────────────────────────

/**
 * Fetch a cached scene. Returns null if the scene hasn't been generated.
 */
export async function getScene(galaxyId: string, bodyId: string): Promise<unknown | null> {
  const res = await fetch(
    `${API_BASE}/api/galaxy/${encodeURIComponent(galaxyId)}/scene/${encodeURIComponent(bodyId)}`,
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Generate a scene on-demand. Calls Claude if needed, returns the Scene JSON.
 * Falls back to deterministic generation if Claude fails.
 */
export async function generateScene(galaxyId: string, bodyId: string): Promise<unknown> {
  const res = await fetch(
    `${API_BASE}/api/galaxy/${encodeURIComponent(galaxyId)}/scene/${encodeURIComponent(bodyId)}/generate`,
    { method: 'POST' },
  )
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
  return res.json()
}
