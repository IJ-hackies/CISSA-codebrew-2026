/**
 * Deterministic constellation glyph generator.
 *
 * Pure function: same UUID → same constellation, forever. No state.
 *
 * Output is a normalized point set + edge list in a [0,1] × [0,1] box, plus
 * a small palette hint. The component renders it via SVG.
 */

import { rngFromString } from './prng'

export interface ConstellationGlyph {
  points: { x: number; y: number; r: number }[]
  edges: [number, number][]
  brightStarIndex: number
}

/** Generate a stable glyph from a UUID (or any string). */
export function constellationFromUuid(uuid: string): ConstellationGlyph {
  const rand = rngFromString(uuid)

  // Vary count between 5 and 9.
  const count = 5 + Math.floor(rand() * 5)

  // Place points with light Poisson-ish jitter inside [0.08, 0.92] so they
  // don't kiss the box edges.
  const points: ConstellationGlyph['points'] = []
  const minDist = 0.18
  let attempts = 0
  while (points.length < count && attempts < 200) {
    attempts++
    const candidate = {
      x: 0.08 + rand() * 0.84,
      y: 0.08 + rand() * 0.84,
      r: 0.018 + rand() * 0.022,
    }
    let ok = true
    for (const p of points) {
      const dx = p.x - candidate.x
      const dy = p.y - candidate.y
      if (Math.hypot(dx, dy) < minDist) {
        ok = false
        break
      }
    }
    if (ok) points.push(candidate)
  }

  // Build a spanning path that traces nearest-unvisited neighbors. This
  // produces organic, constellation-like shapes (no obvious geometry).
  const edges: [number, number][] = []
  const visited = new Set<number>([0])
  let current = 0
  while (visited.size < points.length) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue
      const d = Math.hypot(points[i].x - points[current].x, points[i].y - points[current].y)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx === -1) break
    edges.push([current, bestIdx])
    visited.add(bestIdx)
    current = bestIdx
  }

  // Optional second-degree edge (a single "branch") to add variety.
  if (points.length >= 5 && rand() > 0.4) {
    const a = Math.floor(rand() * points.length)
    let b = Math.floor(rand() * points.length)
    if (b === a) b = (b + 1) % points.length
    if (!edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
      edges.push([a, b])
    }
  }

  // Pick the brightest star — biggest radius wins.
  let brightStarIndex = 0
  let biggest = 0
  points.forEach((p, i) => {
    if (p.r > biggest) {
      biggest = p.r
      brightStarIndex = i
    }
  })

  return { points, edges, brightStarIndex }
}
