/**
 * Tiny deterministic PRNG (mulberry32) + a 32-bit string hash.
 *
 * Used for: constellation glyphs (UUID → reproducible shape) and
 * any other "seeded" decoration. Same seed → same sequence forever.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit hash of a string. Stable across runs. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function rngFromString(input: string): () => number {
  return mulberry32(hashString(input))
}
