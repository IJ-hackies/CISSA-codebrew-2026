/**
 * Pure function: deterministic horizontal offset for a galaxy in the
 * mobile vertical-path history. Same UUID always produces the same
 * normalized offset in [-1, 1].
 */
import { hashString } from './prng'

export function uuidHorizontalOffset(uuid: string): number {
  const h = hashString(uuid)
  // Use cosine of a hash-derived angle so the distribution is smooth
  // and concentrated near the column center, with rare extremes.
  const angle = (h % 1000) / 1000 * Math.PI * 2
  // Bias slightly toward edges so glyphs don't all bunch in the middle.
  const raw = Math.cos(angle)
  const sign = raw >= 0 ? 1 : -1
  const magnitude = Math.pow(Math.abs(raw), 0.7)
  return sign * magnitude
}
