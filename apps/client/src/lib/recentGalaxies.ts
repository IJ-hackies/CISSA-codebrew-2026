/**
 * localStorage helper for the "Recent galaxies" strip on the chat landing.
 *
 * Schema in storage: GalaxyEntry[]
 * Newest first. Capped to MAX_ENTRIES.
 *
 * This module is the ONLY place that touches the recentGalaxies key.
 * Components import these helpers — never read localStorage directly.
 */

export interface GalaxyEntry {
  uuid: string
  title: string
  createdAt: number
}

const STORAGE_KEY = 'scholarSystem.recentGalaxies'
const MAX_ENTRIES = 24

function safeRead(): GalaxyEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Be tolerant of partial/corrupt entries.
    return parsed.filter(
      (e: unknown): e is GalaxyEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as GalaxyEntry).uuid === 'string' &&
        typeof (e as GalaxyEntry).title === 'string' &&
        typeof (e as GalaxyEntry).createdAt === 'number',
    )
  } catch {
    return []
  }
}

function safeWrite(entries: GalaxyEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded or storage disabled — silently drop. The strip is
    // a convenience, not load-bearing state.
  }
}

export function listRecentGalaxies(): GalaxyEntry[] {
  return safeRead()
}

export function hasAnyRecentGalaxies(): boolean {
  // First-visit detection. Used to gate the suggestion chips.
  return safeRead().length > 0
}

export function addRecentGalaxy(entry: GalaxyEntry): void {
  const existing = safeRead().filter((e) => e.uuid !== entry.uuid)
  existing.unshift(entry)
  if (existing.length > MAX_ENTRIES) existing.length = MAX_ENTRIES
  safeWrite(existing)
}

export function removeRecentGalaxy(uuid: string): void {
  safeWrite(safeRead().filter((e) => e.uuid !== uuid))
}

export function clearRecentGalaxies(): void {
  safeWrite([])
}

/** Generate a v4-ish UUID. crypto.randomUUID is widely available; fall back if not. */
export function generateUuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  // RFC4122 v4 fallback.
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}
