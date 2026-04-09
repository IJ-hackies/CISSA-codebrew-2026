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
  const isMobile =
    /Mobi|Android/i.test(navigator.userAgent) || window.matchMedia('(max-width: 768px)').matches
  const isHigh = !isMobile && cores >= 8

  // Mobile always gets a sparse starfield — narrow viewports make the
  // same density look 4× as crowded as on desktop, and the warm void
  // should breathe.
  if (isMobile) {
    return {
      tier: 'low',
      starCount: 80,
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
