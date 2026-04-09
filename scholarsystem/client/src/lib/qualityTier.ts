/**
 * Detects a "quality tier" for the renderer to scale particle counts and
 * effects on weak devices. Cheap, runs once at boot.
 */

export type QualityTier = 'low' | 'medium' | 'high'

export interface QualityProfile {
  tier: QualityTier
  starCount: number
  nebulaCount: number
  parallaxLayers: number
  enablePostFx: boolean
  dpr: number
}

export function detectQualityTier(): QualityProfile {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cores = navigator.hardwareConcurrency || 4
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)
  // Rough heuristic: low end of the market gets the small budget.
  const isLow = isMobile && cores <= 4
  const isHigh = !isMobile && cores >= 8

  if (isLow) {
    return {
      tier: 'low',
      starCount: 220,
      nebulaCount: 3,
      parallaxLayers: 2,
      enablePostFx: false,
      dpr: 1,
    }
  }
  if (isHigh) {
    return {
      tier: 'high',
      starCount: 900,
      nebulaCount: 6,
      parallaxLayers: 4,
      enablePostFx: true,
      dpr,
    }
  }
  return {
    tier: 'medium',
    starCount: 520,
    nebulaCount: 5,
    parallaxLayers: 3,
    enablePostFx: false,
    dpr,
  }
}
