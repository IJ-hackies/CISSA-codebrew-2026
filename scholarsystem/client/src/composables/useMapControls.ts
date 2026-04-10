/**
 * Map navigation controls for the galaxy view.
 *
 * Manages three zoom levels (galaxy → system → planet), an animated SVG
 * viewBox, and input handling that differs between desktop and mobile:
 *
 *   Desktop: wheel-zoom + drag-pan + click-empty-to-zoom-out + click-body-to-drill
 *   Mobile:  tap-to-drill + breadcrumb-to-zoom-out (no free pan/zoom)
 */

import { computed, reactive, ref, watch, type Ref } from 'vue'
import gsap from 'gsap'
import type { Body, Spatial } from '@/types/galaxy'

export type ZoomLevel = 'galaxy' | 'system' | 'planet'

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface CameraState {
  vb: ViewBox
  zoomLevel: ZoomLevel
  focusedSystemId: string | null
  focusedPlanetId: string | null
}

export interface MapControlsOptions {
  spatial: Ref<Spatial | null>
  isMobile: Ref<boolean>
}

// Zoom extents per level (how much of the coordinate space to show).
const GALAXY_CONTENT_PAD = 80   // tight padding around actual body bounds
const SYSTEM_EXTENT = 300
const PLANET_EXTENT = 80

export function useMapControls({ spatial, isMobile }: MapControlsOptions) {
  const zoomLevel = ref<ZoomLevel>('galaxy')
  const focusedSystemId = ref<string | null>(null)
  const focusedPlanetId = ref<string | null>(null)

  // Animated viewBox — GSAP tweens these values directly.
  const vb = reactive<ViewBox>({ x: -1100, y: -1100, w: 2200, h: 2200 })

  const viewBox = computed(() => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)

  // ─── Zoom transitions ─────────────────────────────────────────────

  function animateViewBox(target: ViewBox, duration = 0.8) {
    return gsap.to(vb, {
      x: target.x,
      y: target.y,
      w: target.w,
      h: target.h,
      duration,
      ease: 'power2.inOut',
    })
  }

  function galaxyViewBox(): ViewBox {
    const b = spatial.value?.bounds
    if (!b) return { x: -1100, y: -1100, w: 2200, h: 2200 }

    const pad = GALAXY_CONTENT_PAD
    const screenAR = window.innerWidth / window.innerHeight

    if (screenAR < 0.85) {
      // ── Portrait mode ──────────────────────────────────────────────
      // The SVG content group is rotated 90°, so the galaxy arm runs
      // top-to-bottom. In the rotated coordinate space:
      //   screen-width  ≈ original y-extent  (the arm's "thickness")
      //   screen-height ≈ original x-extent  (the arm's "length")
      //
      // We show the full arm thickness + enough height to fill the screen,
      // centred on the origin.
      const armThicknessW = (b.maxY - b.minY) + pad * 2  // narrow dimension
      const armLengthH    = (b.maxX - b.minX) + pad * 2  // long dimension

      // Width: fit the full arm thickness into screen width.
      const w = armThicknessW
      // Height: fill the screen given that width.
      const h = w / screenAR
      // Center: origin is 0,0; after rotate(90) the arm centre is still at 0.
      // But in the rotated space the y-axis of viewBox tracks the arm length.
      return { x: -w / 2, y: -armLengthH / 2, w, h: Math.min(h, armLengthH) }
    }

    // ── Landscape mode ────────────────────────────────────────────────
    // Expand the short dimension so the viewBox fills the screen exactly
    // (no letterboxing — the starfield background fills any extra void).
    const contentW = b.maxX - b.minX + pad * 2
    const contentH = b.maxY - b.minY + pad * 2
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const contentAR = contentW / contentH

    if (contentAR >= screenAR) {
      const h = contentW / screenAR
      return { x: cx - contentW / 2, y: cy - h / 2, w: contentW, h }
    } else {
      const w = contentH * screenAR
      return { x: cx - w / 2, y: cy - contentH / 2, w, h: contentH }
    }
  }

  function systemViewBox(systemId: string): ViewBox | null {
    const body = spatial.value?.bodies.find((b) => b.id === systemId)
    if (!body) return null
    const ext = SYSTEM_EXTENT
    return {
      x: body.position.x - ext,
      y: body.position.y - ext,
      w: ext * 2,
      h: ext * 2,
    }
  }

  function planetViewBox(planetId: string): ViewBox | null {
    const body = spatial.value?.bodies.find((b) => b.id === planetId)
    if (!body) return null
    const ext = PLANET_EXTENT
    return {
      x: body.position.x - ext,
      y: body.position.y - ext,
      w: ext * 2,
      h: ext * 2,
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────

  function drillIntoSystem(systemId: string) {
    const target = systemViewBox(systemId)
    if (!target) return
    focusedSystemId.value = systemId
    focusedPlanetId.value = null
    zoomLevel.value = 'system'
    animateViewBox(target)
  }

  function drillIntoPlanet(planetId: string) {
    const body = spatial.value?.bodies.find((b) => b.id === planetId)
    if (!body || body.kind !== 'planet') return
    const target = planetViewBox(planetId)
    if (!target) return
    focusedPlanetId.value = planetId
    zoomLevel.value = 'planet'
    animateViewBox(target, 0.6)
  }

  function zoomToGalaxy() {
    focusedSystemId.value = null
    focusedPlanetId.value = null
    zoomLevel.value = 'galaxy'
    animateViewBox(galaxyViewBox())
  }

  function zoomToSystem(systemId?: string) {
    const id = systemId ?? focusedSystemId.value
    if (!id) {
      zoomToGalaxy()
      return
    }
    focusedPlanetId.value = null
    focusedSystemId.value = id
    zoomLevel.value = 'system'
    const target = systemViewBox(id)
    if (target) animateViewBox(target, 0.6)
  }

  function zoomUp() {
    if (zoomLevel.value === 'planet') {
      zoomToSystem()
    } else if (zoomLevel.value === 'system') {
      zoomToGalaxy()
    }
  }

  // ─── Breadcrumb navigation ─────────────────────────────────────────

  function navigateTo(level: ZoomLevel, id?: string) {
    switch (level) {
      case 'galaxy':
        zoomToGalaxy()
        break
      case 'system':
        if (id) drillIntoSystem(id)
        break
      case 'planet':
        if (id) drillIntoPlanet(id)
        break
    }
  }

  // ─── Portrait detection ────────────────────────────────────────────
  // Computed once and updated on resize.
  const isPortrait = ref(window.innerWidth / window.innerHeight < 0.85)
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      isPortrait.value = window.innerWidth / window.innerHeight < 0.85
    }, { passive: true })
  }

  // ─── Pan bounds clamping ───────────────────────────────────────────
  // Ensures at least 30% of the viewport always overlaps the galaxy content,
  // so the user can never drag the map completely off screen.

  function clampPan() {
    const b = spatial.value?.bounds
    if (!b) return

    // In portrait-galaxy mode the content group is rotate(90)'d, which maps
    // original (x,y) → screen (-y, x).  So the effective bounds in viewBox
    // space swap: x-axis tracks the original y-extent, y-axis tracks x-extent.
    let cMinX: number, cMaxX: number, cMinY: number, cMaxY: number
    if (isPortrait.value && zoomLevel.value === 'galaxy') {
      cMinX = -b.maxY; cMaxX = -b.minY   // arm thickness (narrow)
      cMinY =  b.minX; cMaxY =  b.maxX   // arm length (long)
    } else {
      cMinX = b.minX; cMaxX = b.maxX
      cMinY = b.minY; cMaxY = b.maxY
    }

    // Keep at least 30% of the viewport overlapping the content on each axis.
    const ox = vb.w * 0.30
    const oy = vb.h * 0.30
    vb.x = Math.max(cMinX - vb.w + ox, Math.min(cMaxX - ox, vb.x))
    vb.y = Math.max(cMinY - vb.h + oy, Math.min(cMaxY - oy, vb.y))
  }

  // ─── Unified pointer handlers (desktop + mobile) ───────────────────

  let isDragging  = false
  let hasMoved    = false
  let justDragged = false   // stays true between pointerup and the subsequent click event
  let dragStart   = { x: 0, y: 0, vbX: 0, vbY: 0 }
  const DRAG_THRESHOLD = 6  // px — below this it's a tap, not a pan

  function onPointerDown(e: PointerEvent) {
    // Do NOT setPointerCapture here — we only capture once the threshold is
    // exceeded so that body-node taps still receive their own click events.
    isDragging = true
    hasMoved   = false
    dragStart  = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return

    if (!hasMoved) {
      // First frame past threshold — capture so drag never drops even if the
      // cursor leaves the SVG boundary mid-pan.
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      hasMoved = true
    }

    const svg = (e.currentTarget as SVGSVGElement)
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    vb.x = dragStart.vbX - dx * (vb.w / rect.width)
    vb.y = dragStart.vbY - dy * (vb.h / rect.height)
    clampPan()
  }

  function onPointerUp(_e: PointerEvent) {
    justDragged = hasMoved   // read before reset so onBackgroundClick can see it
    isDragging  = false
    hasMoved    = false
    // Background-click (zoom-out) is handled by the SVG's @click listener so
    // it's suppressed naturally on body-node taps via @click.stop.
  }

  function onWheel(e: WheelEvent) {
    if (isMobile.value) return
    e.preventDefault()
    const svg = (e.currentTarget as SVGSVGElement)
    if (!svg) return
    const rect = svg.getBoundingClientRect()

    const cursorX = vb.x + ((e.clientX - rect.left) / rect.width) * vb.w
    const cursorY = vb.y + ((e.clientY - rect.top) / rect.height) * vb.h

    const factor = e.deltaY > 0 ? 1.1 : 0.9
    const newW = Math.max(100, Math.min(6000, vb.w * factor))
    const newH = Math.max(100, Math.min(6000, vb.h * factor))

    vb.x = cursorX - ((e.clientX - rect.left) / rect.width) * newW
    vb.y = cursorY - ((e.clientY - rect.top) / rect.height) * newH
    vb.w = newW
    vb.h = newH
    clampPan()
  }

  function onBackgroundClick() {
    // Suppress if this click is the tail-end of a completed drag, or on mobile
    // (mobile uses tap-to-drill, not background-click-to-zoom-out).
    if (isMobile.value || justDragged) {
      justDragged = false
      return
    }
    zoomUp()
  }

  // ─── Camera state snapshot / restore ───────────────────────────────

  function getState(): CameraState {
    return {
      vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h },
      zoomLevel: zoomLevel.value,
      focusedSystemId: focusedSystemId.value,
      focusedPlanetId: focusedPlanetId.value,
    }
  }

  function restoreState(state: CameraState) {
    vb.x = state.vb.x
    vb.y = state.vb.y
    vb.w = state.vb.w
    vb.h = state.vb.h
    zoomLevel.value = state.zoomLevel
    focusedSystemId.value = state.focusedSystemId
    focusedPlanetId.value = state.focusedPlanetId
  }

  // ─── Initialize on spatial data load ───────────────────────────────

  watch(spatial, (s) => {
    if (s) {
      const target = galaxyViewBox()
      vb.x = target.x
      vb.y = target.y
      vb.w = target.w
      vb.h = target.h
    }
  }, { immediate: true })

  return {
    zoomLevel,
    focusedSystemId,
    focusedPlanetId,
    viewBox,
    vb,
    isPortrait,

    drillIntoSystem,
    drillIntoPlanet,
    zoomToGalaxy,
    zoomToSystem,
    zoomUp,
    navigateTo,
    getState,
    restoreState,

    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onBackgroundClick,
  }
}
