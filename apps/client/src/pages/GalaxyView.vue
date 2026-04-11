<template>
  <div class="galaxy-view" ref="containerRef">

    <!-- Loading -->
    <Transition name="fade">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-orb" />
        <p class="loading-label">Mapping your galaxy…</p>
      </div>
    </Transition>

    <!-- HUD -->
    <Transition name="slide-up">
      <div v-if="!loading && meshData" class="hud">
        <div class="hud-title">{{ galaxyTitle }}</div>
        <div class="hud-meta">
          {{ solarSystemCount }} solar systems ·
          {{ planetCount }} planets ·
          {{ conceptCount }} concepts
        </div>
      </div>
    </Transition>

    <!-- HTML label overlays (solar system names) -->
    <div
      v-for="lbl in labelPositions"
      :key="lbl.id"
      class="node-label"
      :style="{ left: lbl.x + 'px', top: lbl.y + 'px', opacity: lbl.opacity, '--lc': lbl.color, fontSize: lbl.fontSize + 'px' }"
    >
      {{ lbl.title }}
      <svg class="sys-progress-ring" viewBox="0 0 14 14" width="14" height="14">
        <!-- track -->
        <circle cx="7" cy="7" r="5" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
        <!-- filled arc -->
        <circle
          cx="7" cy="7" r="5" fill="none"
          stroke="#5ba8ff"
          stroke-width="1.5"
          stroke-linecap="round"
          :stroke-dasharray="`${lbl.progress * 31.42} 31.42`"
          stroke-dashoffset="0"
          transform="rotate(-90 7 7)"
        />
      </svg>
    </div>

    <!-- Nav veil -->
    <div class="nav-veil" ref="veilRef" />

    <!-- Onboarding tooltip (first galaxy only) -->
    <OnboardingTooltip
      v-if="!loading && meshData && isFirstGalaxy"
      storage-key="ss.onboard.galaxy"
      text="Each cluster is a theme from your upload. Click one to enter."
      position="bottom-center"
    />

    <!-- Story reader (left rail). Galaxy view has no planet drawer to
         collapse, so no `@opened` handler is needed here. -->
    <StoryReader
      v-if="meshData"
      ref="storyReaderRef"
      :stories="meshData.stories"
      :galaxy-data="meshData"
      @visit-planet="onStoryVisitPlanet"
      @navigate-to-planet="onStoryNavigateToPlanet"
      @open-story="onStoryOpenStory"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as THREE from 'three'
import gsap from 'gsap'
// @ts-expect-error -- d3-force-3d ships incomplete typings
import { forceSimulation, forceManyBody, forceCenter, forceCollide } from 'd3-force-3d'
import { useThreeScene } from '@/composables/useThreeScene'
import { useWarpEffect } from '@/composables/useWarpEffect'
import { useMeshStore } from '@/lib/meshStore'
import OnboardingTooltip from '@/components/OnboardingTooltip.vue'
import StoryReader from '@/components/StoryReader.vue'
import type { UUID } from '@/lib/meshApi'

import galaxyFixture from '@/fixtures/galaxy-data.json'

// ── Store ─────────────────────────────────────────────────────────────────────
const router = useRouter()
const route  = useRoute()
const { data: meshData, galaxyId, visitedPlanetIds, loadFromFixture, getOrGenerateSystemPreset } = useMeshStore()

// ── Onboarding: only show for the user's very first galaxy ────────────────
const FIRST_GALAXY_KEY = 'ss.firstGalaxyId'
const isFirstGalaxy = computed(() => {
  const stored = localStorage.getItem(FIRST_GALAXY_KEY)
  return !!stored && stored === galaxyId.value
})

// ── Refs ──────────────────────────────────────────────────────────────────────
const containerRef   = ref<HTMLDivElement>()
const veilRef        = ref<HTMLDivElement>()
const loading        = ref(true)
const navigating     = ref(false)
const storyReaderRef = ref<InstanceType<typeof StoryReader>>()

// ── Story handlers ────────────────────────────────────────────────────────────
// Galaxy view doesn't have planet drawers — planet navigation animates the
// camera into the containing solar system, then the destination view opens
// the planet drawer (driven by the `openPlanet` query param).
function findSystemForPlanet(planetId: UUID): UUID | null {
  if (!meshData.value) return null
  for (const sys of Object.values(meshData.value.solarSystems)) {
    if (sys.planets.includes(planetId)) return sys.id
  }
  return null
}

function visitPlanetFromGalaxy(planetId: UUID) {
  const sysId = findSystemForPlanet(planetId)
  if (!sysId) return
  // Capture story state so the destination view can restore it on arrival
  const state = storyReaderRef.value?.getCurrentState()
  const wasOpen = state?.isOpen ?? false
  // Close the story drawer fully before kicking off the transition so the
  // panels don't overlap during the camera fly + route navigation.
  if (wasOpen) storyReaderRef.value?.collapse()
  const proceed = () => enterSystem(
    sysId,
    planetId,
    state?.storyId ?? undefined,
    state ? String(state.sceneIndex) : undefined,
  )
  if (wasOpen) setTimeout(proceed, 380)
  else proceed()
}

function onStoryVisitPlanet(planetId: UUID) {
  visitPlanetFromGalaxy(planetId)
}

function onStoryNavigateToPlanet(planetId: UUID) {
  visitPlanetFromGalaxy(planetId)
}

function onStoryOpenStory(storyId: UUID) {
  storyReaderRef.value?.openById(storyId)
}

// ── Computed ──────────────────────────────────────────────────────────────────
const galaxyTitle      = computed(() => 'Scholar Galaxy')
const solarSystemCount = computed(() => Object.keys(meshData.value?.solarSystems ?? {}).length)
const planetCount      = computed(() => Object.keys(meshData.value?.planets ?? {}).length)
const conceptCount     = computed(() => Object.keys(meshData.value?.concepts ?? {}).length)

// ── HTML overlays ─────────────────────────────────────────────────────────────
interface LabelPos { id: string; x: number; y: number; opacity: number; title: string; color: string; fontSize: number; progress: number }
const labelPositions = ref<LabelPos[]>([])
const labelWorldData: Array<{ id: string; mesh: THREE.Mesh; title: string; color: string }> = []

// ── Three.js state ─────────────────────────────────────────────────────────────
let sceneCtx: ReturnType<typeof useThreeScene> | null = null
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let clickableMeshes: THREE.Mesh[] = []
let particleTexture: THREE.CanvasTexture | null = null

/**
 * Soft circular particle texture used as the `map` on every system's
 * PointsMaterial. Each particle becomes a small soft glowing dot that emits
 * its own light — no bloom needed, no bubble halos around bright pixels.
 */
function makeParticleTexture(): THREE.CanvasTexture {
  const size = 64
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0.0, 'rgba(255,255,255,1)')
  g.addColorStop(0.30, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)')
  g.addColorStop(0.85, 'rgba(255,255,255,0.07)')
  g.addColorStop(1.0, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

// ── PRNG color seeding ─────────────────────────────────────────────────────────
const SYSTEM_COLORS = [
  '#6a8cff', '#ff7c6e', '#7de8c0', '#ffd166',
  '#c77dff', '#4cc9f0', '#f77f00', '#a8dadc',
]

function seededRng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 0xffffffff }
}

function systemColor(id: string) {
  const rng = seededRng(id)
  return SYSTEM_COLORS[Math.floor(rng() * SYSTEM_COLORS.length)]
}

// ── Particle formation presets ─────────────────────────────────────────────────
const PRESETS = ['sphere', 'helix', 'torus', 'crown', 'burst', 'atom', 'quantum', 'mobius', 'neutron', 'dna'] as const
type Preset = typeof PRESETS[number]

/**
 * Pick the particle preset for a system. The first time we see a system the
 * meshStore picks one randomly via Math.random() and persists it; subsequent
 * calls return the same choice so refreshes and the SolarSystemView agree.
 */
function randomPreset(id: string): Preset {
  return getOrGenerateSystemPreset(id, PRESETS) as Preset
}

// ── Animated preset type ───────────────────────────────────────────────────────
// AnimFn receives the raw position + color arrays to fill each frame.
// pos: Float32Array of length count*3 (x,y,z per particle)
// col: Float32Array of length count*3 (r,g,b per particle, 0–1)
// elapsed: seconds since scene start   nodeRadius: node's base size (~5–9)
type AnimFn = (pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number) => void

interface PresetConfig { axis: [number, number, number]; speed: number }
// Static presets: whole-object rotation. Animated presets use a dummy entry (never read).
const PRESET_ROTATION: Record<Preset, PresetConfig> = {
  sphere: { axis: [0.15, 1,   0.08], speed: 0.15 },
  helix:  { axis: [0,    1,   0   ], speed: 0.30 },
  torus:  { axis: [0.4,  1,   0.2 ], speed: 0.22 },
  crown:  { axis: [0,    1,   0   ], speed: 0.18 },
  burst:  { axis: [0.2,  1,   0.3 ], speed: 0.25 },
  atom:    { axis: [0,    1,   0   ], speed: 0    }, // unused — animated
  quantum: { axis: [0,    1,   0   ], speed: 0    }, // unused — animated
  mobius:  { axis: [0,    1,   0   ], speed: 0    }, // unused — animated
  neutron: { axis: [0,    1,   0   ], speed: 0    }, // unused — animated
  dna:     { axis: [0,    1,   0   ], speed: 0    }, // unused — animated
}

function buildParticleFormation(preset: Preset, count: number, radius: number): Float32Array {
  const pos = new Float32Array(count * 3)
  switch (preset) {
    case 'sphere': {
      // Fibonacci / golden-angle geodesic sphere
      for (let i = 0; i < count; i++) {
        const phi   = Math.acos(-1 + (2 * i) / count)
        const theta = Math.sqrt(count * Math.PI) * phi
        const r     = radius * (0.80 + Math.random() * 0.28)
        pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        pos[i * 3 + 2] = r * Math.cos(phi)
      }
      break
    }
    case 'helix': {
      // Double DNA strand
      for (let i = 0; i < count; i++) {
        const strand = i % 2
        const t  = (i / count) * Math.PI * 10
        pos[i * 3]     = Math.cos(t + strand * Math.PI) * radius * 0.55
        pos[i * 3 + 1] = (i / count - 0.5) * radius * 2.6
        pos[i * 3 + 2] = Math.sin(t + strand * Math.PI) * radius * 0.55
      }
      break
    }
    case 'torus': {
      // Torus / donut ring
      const R = radius * 0.88
      const rr = radius * 0.32
      for (let i = 0; i < count; i++) {
        const u = (i / count) * Math.PI * 2 * 7
        const v = Math.random() * Math.PI * 2
        pos[i * 3]     = (R + rr * Math.cos(v)) * Math.cos(u)
        pos[i * 3 + 1] = (R + rr * Math.cos(v)) * Math.sin(u)
        pos[i * 3 + 2] = rr * Math.sin(v)
      }
      break
    }
    case 'crown': {
      // Stacked concentric rings (crown / cylinder)
      const rings   = 6
      const perRing = Math.floor(count / rings)
      for (let i = 0; i < count; i++) {
        const ring  = Math.min(Math.floor(i / perRing), rings - 1)
        const j     = i % perRing
        const angle = (j / perRing) * Math.PI * 2
        const ringR = radius * (0.45 + ring * 0.11)
        const y     = (ring / (rings - 1) - 0.5) * radius * 1.6
        pos[i * 3]     = Math.cos(angle) * ringR + (Math.random() - 0.5) * radius * 0.07
        pos[i * 3 + 1] = y + (Math.random() - 0.5) * radius * 0.09
        pos[i * 3 + 2] = Math.sin(angle) * ringR + (Math.random() - 0.5) * radius * 0.07
      }
      break
    }
    case 'burst': {
      // Concentric shells — particles clustered at discrete radii like a shockwave
      const shells    = 5
      const perShell  = Math.floor(count / shells)
      for (let i = 0; i < count; i++) {
        const shell = Math.min(Math.floor(i / perShell), shells - 1)
        const r2    = radius * (0.2 + shell * 0.2) * (0.9 + Math.random() * 0.2)
        const phi   = Math.acos(-1 + Math.random() * 2)
        const theta = Math.random() * Math.PI * 2
        pos[i * 3]     = r2 * Math.sin(phi) * Math.cos(theta)
        pos[i * 3 + 1] = r2 * Math.sin(phi) * Math.sin(theta)
        pos[i * 3 + 2] = r2 * Math.cos(phi)
      }
      break
    }
  }
  return pos
}

// ── Animated preset implementations ───────────────────────────────────────────
// Paste code from particles.casberry.in custom editor here.
// Translate: time→elapsed, target.set(x,y,z)→pos writes, color.setRGB→col writes,
//            addControl(id,label,min,max,DEFAULT)→use DEFAULT directly.

function atomAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const speed       = 0.39
  const radius      = nodeRadius * 1.5
  const nucleusSize = nodeRadius * 0.55
  const trailLen    = 31.6

  const nucleusCount       = Math.floor(count * 0.10)
  const electronHeadCount  = 3 * 60
  const electronTrailCount = Math.floor(count * 0.22)
  const trailPerRing       = Math.floor(electronTrailCount / 3)
  const ringTotal          = count - nucleusCount - electronHeadCount - electronTrailCount
  const ringSize           = Math.floor(ringTotal / 3)
  const t = elapsed * speed

  const tlX0 = 0.44, tlX1 = 1.13, tlX2 = 1.45
  const tlZ0 = 0.17, tlZ1 = 0.73, tlZ2 = -0.38

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0, r = 0, g = 0, b = 0

    if (i < nucleusCount) {
      const golden = 2.399963
      const theta  = Math.acos(1 - 2 * (i + 0.5) / nucleusCount)
      const phi    = golden * i + t * 0.3
      const rr     = nucleusSize * (0.5 + 0.5 * Math.pow(Math.abs(Math.sin(t * 1.5 + i * 0.2)), 0.5))
      x = Math.sin(theta) * Math.cos(phi) * rr
      y = Math.sin(theta) * Math.sin(phi) * rr
      z = Math.cos(theta) * rr
      const pulse = 0.7 + 0.3 * Math.sin(t * 2.5 + i * 0.1)
      r = 0.65 * pulse; g = 0.35 * pulse; b = 1.0 * pulse

    } else if (i < nucleusCount + ringSize * 3) {
      const ri      = i - nucleusCount
      const ringIdx = Math.floor(ri / ringSize)
      const pi      = ri - ringIdx * ringSize
      const frac    = pi / ringSize
      const dir     = ringIdx === 1 ? -1 : 1
      const spd     = 1.0 + ringIdx * 0.3
      const angle   = frac * Math.PI * 2 + t * spd * dir
      const bx = Math.cos(angle) * radius
      const by = Math.sin(angle) * radius
      const tX = ringIdx === 0 ? tlX0 : ringIdx === 1 ? tlX1 : tlX2
      const tZ = ringIdx === 0 ? tlZ0 : ringIdx === 1 ? tlZ1 : tlZ2
      const cxr = Math.cos(tX), sxr = Math.sin(tX)
      const czr = Math.cos(tZ), szr = Math.sin(tZ)
      const ry = by * cxr, rz = by * sxr
      x = bx * czr - ry * szr; y = bx * szr + ry * czr; z = rz
      const bright = 0.5 + 0.2 * Math.sin(angle * 3 + t)
      if      (ringIdx === 0) { r = 0.49 * bright; g = 0.23 * bright; b = 0.93 * bright }
      else if (ringIdx === 1) { r = 0.02 * bright; g = 0.71 * bright; b = 0.83 * bright }
      else                    { r = 0.42 * bright; g = 0.30 * bright; b = 0.98 * bright }

    } else if (i < nucleusCount + ringSize * 3 + electronHeadCount) {
      const hi      = i - nucleusCount - ringSize * 3
      const ringIdx = Math.floor(hi / 60)
      const pi      = hi - ringIdx * 60
      const dir     = ringIdx === 1 ? -1 : 1
      const spd     = 1.0 + ringIdx * 0.3
      const eAngle  = t * spd * dir * 2.5
      const headR   = 0.5
      const angSpread = (pi / 60) * Math.PI * 2
      const rSpread   = headR * Math.sqrt((pi % 20) / 20.0)
      const offAngle  = eAngle + Math.cos(angSpread) * (rSpread / radius)
      const offR      = radius + Math.sin(angSpread) * rSpread
      const bx = Math.cos(offAngle) * offR, by = Math.sin(offAngle) * offR
      const tX = ringIdx === 0 ? tlX0 : ringIdx === 1 ? tlX1 : tlX2
      const tZ = ringIdx === 0 ? tlZ0 : ringIdx === 1 ? tlZ1 : tlZ2
      const cxr = Math.cos(tX), sxr = Math.sin(tX)
      const czr = Math.cos(tZ), szr = Math.sin(tZ)
      const ry = by * cxr, rz = by * sxr
      x = bx * czr - ry * szr; y = bx * szr + ry * czr; z = rz
      // Cap head brightness so additive accumulation doesn't blow out
      // into a hard white blob (former source of bloom-bubble halos).
      const glow = (1.0 - (rSpread / headR) * 0.4) * 0.55
      r = glow; g = glow; b = glow

    } else if (i < nucleusCount + ringSize * 3 + electronHeadCount + trailPerRing * 3) {
      const ei        = i - nucleusCount - ringSize * 3 - electronHeadCount
      const ringIdx   = Math.floor(ei / trailPerRing)
      const trailIdx  = ei - ringIdx * trailPerRing
      const trailFrac = trailIdx / trailPerRing
      const dir    = ringIdx === 1 ? -1 : 1
      const spd    = 1.0 + ringIdx * 0.3
      const offset = trailFrac * trailLen * 0.04
      const angle  = t * spd * dir * 2.5 - offset * dir
      const bx = Math.cos(angle) * radius, by = Math.sin(angle) * radius
      const tX = ringIdx === 0 ? tlX0 : ringIdx === 1 ? tlX1 : tlX2
      const tZ = ringIdx === 0 ? tlZ0 : ringIdx === 1 ? tlZ1 : tlZ2
      const cxr = Math.cos(tX), sxr = Math.sin(tX)
      const czr = Math.cos(tZ), szr = Math.sin(tZ)
      const ry = by * cxr, rz = by * sxr
      x = bx * czr - ry * szr; y = bx * szr + ry * czr; z = rz
      const fc = Math.pow(1.0 - trailFrac, 3)
      if      (ringIdx === 0) { r = 0.7 * fc; g = 0.4 * fc; b = 1.0 * fc }
      else if (ringIdx === 1) { r = 0.1 * fc; g = 0.9 * fc; b = 1.0 * fc }
      else                    { r = 0.6 * fc; g = 0.45 * fc; b = 1.0 * fc }
    }

    // Lerp toward target — smooth trailing motion
    pos[i * 3]     += (x - pos[i * 3])     * 0.1
    pos[i * 3 + 1] += (y - pos[i * 3 + 1]) * 0.1
    pos[i * 3 + 2] += (z - pos[i * 3 + 2]) * 0.1
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b
  }
}

// Reusable color object to avoid per-frame allocations in animated presets
const _tmpColor = new THREE.Color()

function quantumAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const radius = nodeRadius * 1.4
  const tube   = nodeRadius * 0.5
  const speed  = 0.8
  const chaos  = nodeRadius * 0.07
  const t      = elapsed * speed

  for (let i = 0; i < count; i++) {
    const n = i / count
    const u = n * Math.PI * 2 * 13.0 + t * 0.3
    const v = n * Math.PI * 2 * 412.0 - t * 1.5

    const harmonicTwist = Math.sin(u * 3.0 + t)
    const dynamicTube   = tube * (0.5 + 0.5 * harmonicTwist)
    const noise         = Math.sin(i * 789.123) * chaos
    const structureMod  = Math.cos(u * 5.0) * chaos * 0.5

    const cx = (radius + dynamicTube * Math.cos(v) + noise) * Math.cos(u)
    const cy = (radius + dynamicTube * Math.cos(v) + noise) * Math.sin(u)
    const cz = dynamicTube * Math.sin(v) + noise + Math.sin(u * 4.0) * structureMod

    // Lerp toward target — preserves the smooth trailing motion from the original
    pos[i * 3]     += (cx - pos[i * 3])     * 0.1
    pos[i * 3 + 1] += (cy - pos[i * 3 + 1]) * 0.1
    pos[i * 3 + 2] += (cz - pos[i * 3 + 2]) * 0.1

    const hue        = (0.55 + 0.35 * Math.sin(v * 0.2 + t * 0.5) + 0.1 * Math.cos(u * 2.0)) % 1.0
    const saturation = 0.8 + 0.2 * Math.cos(v)
    const lightness  = Math.max(0.1, Math.min(1.0, 0.3 + 0.5 * Math.abs(harmonicTwist) + noise * 0.05))
    _tmpColor.setHSL(hue, saturation, lightness)
    col[i * 3]     = _tmpColor.r
    col[i * 3 + 1] = _tmpColor.g
    col[i * 3 + 2] = _tmpColor.b
  }
}

function mobiusAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const scale     = nodeRadius * 1.43
  const twist     = 3.52
  const flow      = 0.78
  const thickness = nodeRadius * 0.12
  const bloom     = 0.58

  const TAU = Math.PI * 2
  const t   = elapsed * flow

  for (let i = 0; i < count; i++) {
    const u    = (i + 0.5) / count
    const g    = i * 0.6180339887498949
    const band = g - Math.floor(g)

    const a  = TAU * u
    const s1 = Math.sin(a + t * 0.35)
    const c1 = Math.cos(a + t * 0.35)
    const s2 = Math.sin((a + t * 0.35) * 2.0)

    const den = 1.0 + s1 * s1
    const r   = scale / den

    const bx = c1 * r
    const by = s1 * c1 * r * 0.9
    const bz = scale * 0.14 * Math.sin(a * 3.0 - t * 0.8) + scale * 0.08 * s2 * bloom

    const phi       = TAU * band + t * 0.75 + twist * Math.sin(a * 0.5 + t * 0.2)
    const halfTwist = 0.5 * (a + t * 0.35)
    const ring      = thickness * (0.55 + 0.28 * Math.sin(a * 5.0 - t * 1.3) + 0.17 * Math.cos(a * 9.0 + t * 0.7) * bloom)

    const cp = Math.cos(phi), sp = Math.sin(phi)
    const ch = Math.cos(halfTwist), sh = Math.sin(halfTwist)
    const ox = ring * cp * ch, oy = ring * sp, oz = ring * cp * sh

    const drift = 1.0 + 0.08 * Math.sin(a * 13.0 + t) + 0.05 * Math.cos(a * 21.0 - t * 1.7)

    const cx = (bx + ox + scale * 0.05 * Math.sin(phi * 2.0 + a * 4.0 + t)) * drift
    const cy = (by + oy + scale * 0.04 * Math.cos(phi * 2.0 - a * 3.0 - t * 0.6)) * drift
    const cz = (bz + oz + scale * 0.06 * Math.sin(a * 7.0 + phi - t * 0.5) * bloom) * drift

    pos[i * 3]     += (cx - pos[i * 3])     * 0.1
    pos[i * 3 + 1] += (cy - pos[i * 3 + 1]) * 0.1
    pos[i * 3 + 2] += (cz - pos[i * 3 + 2]) * 0.1

    const h   = band * 0.22 + 0.08 * Math.sin(a * 2.0 - t * 0.4) + 0.55 + 0.05 * s2
    const hue = h - Math.floor(h)
    const sat = 0.75 + 0.2 * Math.abs(Math.sin(phi + a))
    const lit = Math.max(0.1, Math.min(1.0, 0.42 + 0.18 * Math.sin(phi - t * 0.3) + 0.08 * Math.cos(a * 6.0 + t)))
    _tmpColor.setHSL(hue, sat, lit)
    col[i * 3]     = _tmpColor.r
    col[i * 3 + 1] = _tmpColor.g
    col[i * 3 + 2] = _tmpColor.b
  }
}

function neutronAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const speed      = 0.149
  const scale      = nodeRadius * 1.1
  const turbulence = 1.02
  const jetPower   = 1.02
  const T          = elapsed * speed

  const DISC_END = 0.70
  const JET_END  = 0.90

  for (let i = 0; i < count; i++) {
    const n = i / count

    const s1 = Math.sin(i * 73.13  + 1.7)
    const s2 = Math.sin(i * 157.9  + 3.3)
    const s3 = Math.sin(i * 311.2  + 7.1)
    const r1 = s1 * s1
    const r2 = s2 * s2
    const r3 = s3 * s3

    let px = 0, py = 0, pz = 0, hue = 0, sat = 0, lit = 0

    if (n < DISC_END) {
      // Accretion disk — Keplerian orbits with spiral density waves
      const dn     = n / DISC_END
      const radius = 0.08 + 0.77 * dn
      const omega  = 1.0 / Math.sqrt(radius * radius * radius + 1e-4)
      const angle  = r1 * Math.PI * 2.0 + omega * T

      const thickness   = (0.012 + radius * 0.06) * turbulence
      const yOff        = (r2 - 0.5) * 2.0 * thickness

      const wavePhase   = angle * 2.0 + Math.log(radius + 0.01) * 3.5 + T * 0.25
      const waveDensity = 1.0 + 0.18 * Math.sin(wavePhase)
      const rEff        = radius * waveDensity

      px = rEff * Math.cos(angle) + (r3 - 0.5) * turbulence * 0.025
      py = yOff
      pz = rEff * Math.sin(angle)

      hue = (1.0 - dn) * 0.10
      sat = 1.0
      lit = 0.22 + dn * 0.55 + Math.sin(wavePhase) * 0.07

    } else if (n < JET_END) {
      // Twin relativistic helical jets
      const jn     = (n - DISC_END) / 0.20
      const jetDir = jn < 0.5 ? 1.0 : -1.0
      const jt     = jn < 0.5 ? jn * 2.0 : (jn - 0.5) * 2.0

      const height = jt * 1.25 * jetPower
      const baseR  = 0.025 + height * 0.07 * (1.0 + turbulence * 0.4)

      const helix  = r1 * Math.PI * 2.0 + height * 9.0 + T * 2.5
      const helixR = baseR * (0.65 + 0.35 * Math.sin(helix * 3.0))

      const recoll = 1.0 - 0.35 * Math.exp(-((jt - 0.35) * (jt - 0.35)) / 0.01)
      px = helixR * recoll * Math.cos(helix)
      py = height * jetDir
      pz = helixR * recoll * Math.sin(helix)

      hue = 0.54 + jt * 0.08
      sat = 0.75 - jt * 0.35
      lit = 0.62 + (1.0 - jt) * 0.33

    } else {
      // X-ray corona — pulsating golden-angle sphere
      const cn   = (n - JET_END) / 0.10
      const phi  = cn * Math.PI * 2.0 * 7.618
      const cosT = 2.0 * r1 - 1.0
      const sinT = Math.sqrt(Math.max(0.0, 1.0 - cosT * cosT))

      const qpo = 1.0 + 0.22 * Math.sin(T * 3.1 + r3 * Math.PI * 2.0)
                      + 0.08 * Math.sin(T * 7.4 + r2 * Math.PI * 4.0)
      const cR  = (0.045 + r2 * 0.09) * qpo

      px = cR * sinT * Math.cos(phi)
      py = cR * cosT * 0.45
      pz = cR * sinT * Math.sin(phi)

      hue = 0.58 + r3 * 0.06
      sat = 0.35 + r2 * 0.30
      lit = 0.65 + r3 * 0.30 + (qpo - 1.0) * 0.15
    }

    const tx = px * scale, ty = py * scale, tz = pz * scale
    pos[i * 3]     += (tx - pos[i * 3])     * 0.1
    pos[i * 3 + 1] += (ty - pos[i * 3 + 1]) * 0.1
    pos[i * 3 + 2] += (tz - pos[i * 3 + 2]) * 0.1

    _tmpColor.setHSL(hue, sat, Math.min(0.97, Math.max(0.04, lit)))
    col[i * 3]     = _tmpColor.r
    col[i * 3 + 1] = _tmpColor.g
    col[i * 3 + 2] = _tmpColor.b
  }
}

function dnaAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const radius     = nodeRadius * 0.65
  const height     = nodeRadius * 2.2
  const turns      = 10
  const speed      = 1.0
  const separation = nodeRadius * 0.12
  const t          = elapsed * speed

  for (let i = 0; i < count; i++) {
    const fi = i / count
    const y  = (fi - 0.5) * height

    const angle       = turns * Math.PI * 2.0 * fi + t
    const strandShift = Math.sign(Math.sin(i * 3.1415926))
    const strandOffset = strandShift * separation

    const x = Math.cos(angle) * radius + strandOffset * Math.cos(angle + Math.PI * 0.5)
    const z = Math.sin(angle) * radius + strandOffset * Math.sin(angle + Math.PI * 0.5)

    pos[i * 3]     += (x - pos[i * 3])     * 0.1
    pos[i * 3 + 1] += (y - pos[i * 3 + 1]) * 0.1
    pos[i * 3 + 2] += (z - pos[i * 3 + 2]) * 0.1

    const baseHue = (strandShift + 1.0) * 0.25
    const hue     = (baseHue + 0.1 * Math.sin(angle)) % 1.0
    const lit     = 0.5 + 0.2 * Math.sin(fi * 20.0 + t)
    _tmpColor.setHSL(hue, 0.8, lit)
    col[i * 3]     = _tmpColor.r
    col[i * 3 + 1] = _tmpColor.g
    col[i * 3 + 2] = _tmpColor.b
  }
}

// Registry: add new animated presets here. Static presets (sphere/helix/etc.) don't need an entry.
const PRESET_ANIM: Partial<Record<Preset, AnimFn>> = {
  atom:    atomAnimFn,
  quantum: quantumAnimFn,
  mobius:  mobiusAnimFn,
  neutron: neutronAnimFn,
  dna:     dnaAnimFn,
}

// ── Build graph ────────────────────────────────────────────────────────────────
function buildGraph() {
  if (!sceneCtx || !meshData.value) return
  const { scene } = sceneCtx
  const systems = Object.values(meshData.value.solarSystems)
  // Soft textured particles mean each particle glows on its own — no bloom
  // needed. We can use larger sizes without flickering or aliasing.
  if (!particleTexture) particleTexture = makeParticleTexture()
  const isMobileView   = window.innerWidth < 768
  const particleSize   = isMobileView ? 1.10 : 0.85
  const animatedAlpha  = isMobileView ? 0.95 : 0.90
  const staticAlpha    = isMobileView ? 0.95 : 0.88

  interface SimNode {
    id: string; planetCount: number
    x: number; y: number; z: number
    vx?: number; vy?: number; vz?: number
  }

  const simNodes: SimNode[] = systems.map((s) => ({
    id: s.id,
    planetCount: s.planets.length,
    x: (Math.random() - 0.5) * 30,
    y: (Math.random() - 0.5) * 15,
    z: (Math.random() - 0.5) * 30,
  }))

  const sim = forceSimulation(simNodes, 3)
    .force('charge', forceManyBody().strength(-40))
    .force('center', forceCenter(0, 0, 0))
    .force('collide', forceCollide(10))
    .stop()
  for (let i = 0; i < 200; i++) sim.tick()

  clickableMeshes = []
  labelWorldData.splice(0)

  simNodes.forEach((n) => {
    const hex    = systemColor(n.id)
    const color  = new THREE.Color(hex)
    const r      = 5 + n.planetCount * 0.35
    const sys    = meshData.value!.solarSystems[n.id]
    const preset = randomPreset(n.id)

    // Particle count scales with planet count — denser formations now that
    // each particle is a soft textured glow rather than a tiny dot.
    const particleCount = 600 + n.planetCount * 30

    const animFn = PRESET_ANIM[preset]
    const ptGeo  = new THREE.BufferGeometry()
    let   points: THREE.Points

    if (animFn) {
      // Animated preset: per-particle positions + colors updated every frame
      const posArray = new Float32Array(particleCount * 3)
      const colArray = new Float32Array(particleCount * 3)
      ptGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
      ptGeo.setAttribute('color',    new THREE.BufferAttribute(colArray, 3))
      const ptMat = new THREE.PointsMaterial({
        map: particleTexture,
        size: particleSize, transparent: true, opacity: animatedAlpha,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        alphaTest: 0.01,
        vertexColors: true,
      })
      points = new THREE.Points(ptGeo, ptMat)
      points.userData = { animFn, posArray, colArray, particleCount, baseRadius: r, preset }
    } else {
      // Static preset: build once, rotate whole object each frame
      const positions = buildParticleFormation(preset, particleCount, r)
      ptGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const ptMat = new THREE.PointsMaterial({
        map: particleTexture,
        color, size: particleSize, transparent: true, opacity: staticAlpha,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        alphaTest: 0.01,
      })
      points = new THREE.Points(ptGeo, ptMat)
      const cfg  = PRESET_ROTATION[preset]
      const axis = new THREE.Vector3(...cfg.axis).normalize()
      points.userData = { rotationAxis: axis, rotationSpeed: cfg.speed, preset }
    }

    points.position.set(n.x, n.y, n.z)
    scene.add(points)

    // Invisible hit sphere for raycasting (generous radius for easy clicking)
    const hitGeo  = new THREE.SphereGeometry(r * 1.6, 10, 10)
    const hitMat  = new THREE.MeshBasicMaterial({ visible: false })
    const hitMesh = new THREE.Mesh(hitGeo, hitMat)
    hitMesh.position.set(n.x, n.y, n.z)
    hitMesh.userData = { systemId: n.id, title: sys.title, particlePoints: points }
    scene.add(hitMesh)
    clickableMeshes.push(hitMesh)

    labelWorldData.push({ id: n.id, mesh: hitMesh, title: sys.title, color: hex })
  })

  // Particle-stream edges between systems (faint connections)
  const sysList = [...simNodes]
  for (let i = 0; i < sysList.length - 1; i++) {
    const a = sysList[i], b = sysList[i + 1]
    const posA = new THREE.Vector3(a.x, a.y, a.z)
    const posB = new THREE.Vector3(b.x, b.y, b.z)
    const streamCount = 16
    const phases = new Float32Array(streamCount)
    const positions = new Float32Array(streamCount * 3)
    for (let j = 0; j < streamCount; j++) phases[j] = j / streamCount
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const color = new THREE.Color(systemColor(a.id)).lerp(new THREE.Color(systemColor(b.id)), 0.5)
    const mat = new THREE.PointsMaterial({
      color, size: 0.85, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    const pts = new THREE.Points(geo, mat)
    pts.userData = { posA, posB, phases, positions, streamCount, isEdge: true }
    scene.add(pts)
  }

}

// ── Per-frame ─────────────────────────────────────────────────────────────────
function onFrame(elapsed: number) {
  if (!sceneCtx || !containerRef.value) return
  const cam = sceneCtx.camera
  const w   = containerRef.value.clientWidth
  const h   = containerRef.value.clientHeight
  const tmp = new THREE.Vector3()

  // Animate particle formations — static presets rotate, animated presets update per-particle
  clickableMeshes.forEach((hitMesh) => {
    const pts = hitMesh.userData.particlePoints as THREE.Points | undefined
    if (!pts) return

    if (pts.userData.animFn) {
      // Animated preset: recompute positions + colors every frame
      const { animFn, posArray, colArray, particleCount, baseRadius } = pts.userData
      ;(animFn as AnimFn)(posArray, colArray, elapsed, particleCount, baseRadius)
      pts.geometry.attributes.position.needsUpdate = true
      pts.geometry.attributes.color.needsUpdate    = true
    } else {
      // Static preset: rotate whole object + gentle pulse
      const { rotationAxis, rotationSpeed } = pts.userData
      pts.rotateOnAxis(rotationAxis as THREE.Vector3, rotationSpeed * 0.01)
      const pulse = 1 + Math.sin(elapsed * 0.45 + pts.position.x * 0.08) * 0.035
      pts.scale.setScalar(pulse)
    }
  })

  // Animate stream edges
  sceneCtx.scene.children.forEach((obj) => {
    if (!(obj instanceof THREE.Points) || !obj.userData.isEdge) return
    const { posA, posB, phases, positions, streamCount } = obj.userData
    for (let i = 0; i < streamCount; i++) {
      const t = (phases[i] + elapsed * 0.06) % 1
      positions[i * 3]     = posA.x + (posB.x - posA.x) * t
      positions[i * 3 + 1] = posA.y + (posB.y - posA.y) * t
      positions[i * 3 + 2] = posA.z + (posB.z - posA.z) * t
    }
    obj.geometry.attributes.position.needsUpdate = true
  })

  // HTML label projection
  const updated: LabelPos[] = []
  for (const lbl of labelWorldData) {
    tmp.copy(lbl.mesh.position)
    tmp.project(cam)
    const sx = (tmp.x * 0.5 + 0.5) * w
    const sy = (-tmp.y * 0.5 + 0.5) * h
    const dist = cam.position.distanceTo(lbl.mesh.position)
    // Fully opaque until ~160, fades to 0 at 250
    const opacity = tmp.z < 1 ? Math.max(0, Math.min(1, (250 - dist) / 90)) : 0
    const r = (lbl.mesh.geometry as THREE.SphereGeometry).parameters.radius * lbl.mesh.scale.x
    // Perspective-correct font scale: bigger as camera closes in, min 9px max 20px
    const fontSize = Math.max(9, Math.min(20, 3.0 * h / dist))
    const sys      = meshData.value?.solarSystems[lbl.id]
    const total    = sys?.planets.length ?? 0
    const seen     = total > 0 ? sys!.planets.filter(pid => visitedPlanetIds.value.has(pid)).length : 0
    const progress = total > 0 ? seen / total : 0
    updated.push({ id: lbl.id, x: sx, y: sy - r * (h / (dist + 0.01)) - 16, opacity, title: lbl.title, color: lbl.color, fontSize, progress })
  }
  labelPositions.value = updated
}

// ── Raycasting ─────────────────────────────────────────────────────────────────
// Cursor-only hover: no tooltip, just changes the cursor to a pointer when
// hovering a clickable system so users know they can click into one.
function onMouseMove(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || navigating.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)

  const hits = raycaster.intersectObjects(clickableMeshes)
  containerRef.value.style.cursor = hits.length > 0 ? 'pointer' : 'grab'
}

/**
 * Animate camera into a system mesh, then route to its solar system view.
 * If `openPlanetId` is set, the destination view will fly to that planet
 * and open its drawer on arrival (cross-system traversal from a story).
 * If `fromStory` + `storyScene` are set, the destination will also reopen
 * the story reader at that scene index after the planet drawer settles.
 */
function enterSystem(
  systemId: string,
  openPlanetId?: string,
  fromStory?: string,
  storyScene?: string,
) {
  if (!sceneCtx || navigating.value) return
  const mesh = clickableMeshes.find((m) => m.userData.systemId === systemId)
  if (!mesh) return

  navigating.value = true
  sceneCtx.controls.enabled = false

  const target = mesh.position.clone()
  const camDir = sceneCtx.camera.position.clone().sub(target).normalize()
  const dest   = target.clone().addScaledVector(camDir, 20)

  const tl = gsap.timeline({ onUpdate: () => { sceneCtx!.controls.update() } })
  tl.to(sceneCtx.camera.position,  { x: dest.x,   y: dest.y,   z: dest.z,   duration: 0.65, ease: 'power2.in' }, 0)
  tl.to(sceneCtx.controls.target,  { x: target.x, y: target.y, z: target.z, duration: 0.65, ease: 'power2.in' }, 0)

  if (veilRef.value) gsap.to(veilRef.value, {
    opacity: 1, duration: 0.65, ease: 'power2.in',
    onComplete: () => {
      triggerWarp(700, 'out')
      setTimeout(() => {
        const query: Record<string, string> = {}
        if (openPlanetId) query.openPlanet = openPlanetId
        if (fromStory)    query.fromStory = fromStory
        if (storyScene)   query.storyScene = storyScene
        router.push({
          name: 'solar-system',
          params: { id: (route.params.id as string) ?? 'demo', clusterId: systemId },
          query: Object.keys(query).length ? query : undefined,
        })
      }, 380)
    },
  })
}

function onClick(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || navigating.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)

  const hits = raycaster.intersectObjects(clickableMeshes)
  if (!hits.length) return

  const mesh = hits[0].object as THREE.Mesh
  const systemId = mesh.userData.systemId as string
  if (systemId) enterSystem(systemId)
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
const { triggerWarp } = useWarpEffect()

onMounted(() => {
  const gid = (route.params.id as string) ?? 'fixture'
  loadFromFixture(galaxyFixture, gid)
  // Record the very first galaxy the user ever visits
  if (!localStorage.getItem(FIRST_GALAXY_KEY)) {
    localStorage.setItem(FIRST_GALAXY_KEY, gid)
  }

  if (!containerRef.value) return

  // Pull camera further back on mobile so the system labels don't crowd the
  // top of a small viewport
  const mobileInit = window.innerWidth < 768
  sceneCtx = useThreeScene(containerRef.value, {
    // Bloom completely off — every particle is now a soft textured point
    // that glows on its own, so bloom isn't needed. This eliminates the
    // bubble halos around bright pixels (electron heads, etc.) entirely.
    bloomStrength: 0.0,
    bloomRadius: 0.0,
    bloomThreshold: 1.0,
    cameraZ: mobileInit ? 195 : 170,
    autoRotate: true,
    autoRotateSpeed: 0.08,
    starCount: 1400,
    nebulaCount: 4,
  })

  raycaster = new THREE.Raycaster()
  mouse     = new THREE.Vector2()

  // Hook our per-frame logic into the existing RAF loop
  const originalRender = sceneCtx.composer.render.bind(sceneCtx.composer)
  sceneCtx.composer.render = function () {
    onFrame(sceneCtx!.clock.getElapsedTime())
    originalRender()
  }

  buildGraph()
  loading.value = false

  // Arrival: just fade the veil out — warp already played during departure from SolarSystemView
  if (veilRef.value) gsap.fromTo(veilRef.value, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.out' })

  // No mousemove on mobile — taps would briefly fire it and flash the
  // hover tooltip ("little div") on every system tap.
  if (!mobileInit) containerRef.value.addEventListener('mousemove', onMouseMove)
  containerRef.value.addEventListener('click', onClick)

  // Cross-system traversal: arrived here as a stop-over on the way to a
  // planet in a different solar system. Briefly show the galaxy, then
  // auto-enter the target system (which will open the planet on arrival).
  // Story state (fromStory + storyScene) is forwarded so the destination
  // solar view can reopen the story reader at the same scene.
  const goSystem   = route.query.goSystem   as string | undefined
  const openPlanet = route.query.openPlanet as string | undefined
  const fromStory  = route.query.fromStory  as string | undefined
  const storyScene = route.query.storyScene as string | undefined
  if (goSystem) {
    setTimeout(() => {
      enterSystem(goSystem, openPlanet, fromStory, storyScene)
    }, 850)
  }
})

onUnmounted(() => {
  containerRef.value?.removeEventListener('mousemove', onMouseMove)
  containerRef.value?.removeEventListener('click', onClick)
  sceneCtx?.dispose()
  particleTexture?.dispose()
  particleTexture = null
})
</script>

<style scoped>
.galaxy-view {
  position: fixed;
  inset: 0;
  /* Deep-space gradient: very subtle purple-blue core, mostly near-black so
     particle systems and planets retain contrast. The Three canvas above is
     transparent so this tints the whole scene. */
  background:
    radial-gradient(ellipse at 50% 35%, #0a0618 0%, #06051a 28%, #04040f 60%, #02030a 100%);
  overflow: hidden;
  cursor: grab;
}
.galaxy-view:active { cursor: grabbing; }

.loading-overlay {
  position: absolute; inset: 0; z-index: 80;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  background: #02040a;
}
.loading-orb {
  width: 36px; height: 36px; border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, #7c9ef8, #3b4a7a);
  animation: orb-pulse 1.4s ease-in-out infinite;
}
@keyframes orb-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
}
.loading-label { font-size: 13px; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; }

.hud {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  text-align: center; pointer-events: none; z-index: 10;
}
.hud-title { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.85); letter-spacing: 0.04em; }
.hud-meta  { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 3px; }

/* Mobile: hide galaxy title + counts to free the top bar for the
   Stories trigger pill (no text collision). */
@media (max-width: 768px) {
  .hud { display: none; }
}

.node-label {
  position: absolute;
  display: flex; align-items: center; gap: 5px;
  font-size: 15px; /* overridden per-element by inline style */
  font-weight: 600;
  color: rgba(255,255,255,0.88);
  pointer-events: none;
  transform: translateX(-50%);
  white-space: nowrap;
  text-shadow: 0 1px 12px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.8);
  letter-spacing: 0.02em;
}
.sys-progress-ring {
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px #5ba8ff);
}

.nav-veil {
  position: absolute; inset: 0; background: #02040a;
  opacity: 0; pointer-events: none; z-index: 70;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translate(-50%, 8px); }
</style>
