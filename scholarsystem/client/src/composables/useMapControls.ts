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

export interface MapControlsOptions {
  spatial: Ref<Spatial | null>
  isMobile: Ref<boolean>
}

// Zoom extents per level (how much of the coordinate space to show).
const GALAXY_PADDING = 200
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
    return {
      x: b.minX - GALAXY_PADDING,
      y: b.minY - GALAXY_PADDING,
      w: b.maxX - b.minX + GALAXY_PADDING * 2,
      h: b.maxY - b.minY + GALAXY_PADDING * 2,
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

  // ─── Desktop pointer handlers ──────────────────────────────────────

  let isDragging = false
  let dragStart = { x: 0, y: 0, vbX: 0, vbY: 0 }

  function onPointerDown(e: PointerEvent) {
    if (isMobile.value) return
    isDragging = true
    dragStart = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging || isMobile.value) return
    const svg = (e.currentTarget as SVGSVGElement)
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // Convert pixel drag distance to SVG coordinate space.
    const scaleX = vb.w / rect.width
    const scaleY = vb.h / rect.height
    const dx = (e.clientX - dragStart.x) * scaleX
    const dy = (e.clientY - dragStart.y) * scaleY
    vb.x = dragStart.vbX - dx
    vb.y = dragStart.vbY - dy
  }

  function onPointerUp() {
    isDragging = false
  }

  function onWheel(e: WheelEvent) {
    if (isMobile.value) return
    e.preventDefault()
    const svg = (e.currentTarget as SVGSVGElement)
    if (!svg) return
    const rect = svg.getBoundingClientRect()

    // Cursor position in SVG space.
    const cursorX = vb.x + ((e.clientX - rect.left) / rect.width) * vb.w
    const cursorY = vb.y + ((e.clientY - rect.top) / rect.height) * vb.h

    const factor = e.deltaY > 0 ? 1.1 : 0.9
    const newW = Math.max(100, Math.min(6000, vb.w * factor))
    const newH = Math.max(100, Math.min(6000, vb.h * factor))

    // Keep cursor position fixed in SVG space.
    vb.x = cursorX - ((e.clientX - rect.left) / rect.width) * newW
    vb.y = cursorY - ((e.clientY - rect.top) / rect.height) * newH
    vb.w = newW
    vb.h = newH
  }

  function onBackgroundClick() {
    if (isMobile.value) return
    zoomUp()
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

    drillIntoSystem,
    drillIntoPlanet,
    zoomToGalaxy,
    zoomToSystem,
    zoomUp,
    navigateTo,

    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onBackgroundClick,
  }
}
