<template>
  <div class="solar-view" ref="containerRef">

    <!-- Back button -->
    <button class="back-btn" @click="navigateBack">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Galaxy
    </button>

    <!-- System HUD -->
    <Transition name="fade">
      <div v-if="solarSystem && !selectedPlanet" class="system-hud">
        <div class="system-name">{{ solarSystem.title }}</div>
        <div class="system-meta">{{ solarSystem.planets.length }} planets · {{ solarSystem.concepts.length }} concepts</div>
      </div>
    </Transition>

    <!-- HTML planet label overlays -->
    <template v-if="!selectedPlanet">
      <div
        v-for="lbl in labelPositions"
        :key="lbl.id"
        class="planet-label"
        :style="{ left: lbl.x + 'px', top: lbl.y + 'px', opacity: lbl.opacity, '--lc': lbl.color }"
      >
        {{ lbl.title }}
        <span class="planet-dot" :class="{ visited: lbl.visited }" />
      </div>
    </template>

    <!-- Flying soul (GSAP DOM element) -->
    <div ref="flyingSoulRef" class="flying-soul" style="display:none;">
      <svg viewBox="0 0 24 28" fill="none">
        <path
          d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
          id="fly-soul-path"
          fill="white"
          fill-opacity="0.9"
        />
      </svg>
    </div>

    <!-- Nav veil -->
    <div class="nav-veil" ref="veilRef" />

    <!-- Story reader (left) -->
    <StoryReader
      v-if="meshData"
      ref="storyReaderRef"
      :stories="meshData.stories"
      :galaxy-data="meshData"
      @visit-planet="onStoryVisitPlanet"
      @highlight-concepts="onHighlightConcepts"
      @navigate-to-planet="onNavigateToPlanet"
      @open-concept="onOpenConcept"
    />

    <!-- Planet drawer (right) -->
    <PlanetDrawer
      :planet="selectedPlanet"
      :galaxy-data="meshData"
      :planet-color="selectedPlanetColor"
      @close="closeDrawer"
      @navigate-to-planet="onNavigateToPlanet"
      @open-concept="onOpenConcept"
      @open-story="onOpenStory"
    />

    <!-- Concept HUD (bottom-right) -->
    <ConceptHUD ref="conceptHudRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as THREE from 'three'
import gsap from 'gsap'
import { useThreeScene } from '@/composables/useThreeScene'
import { useWarpEffect } from '@/composables/useWarpEffect'
import { useMeshStore } from '@/lib/meshStore'
import type { MeshPlanet, MeshSolarSystem } from '@/lib/meshApi'
import StoryReader from '@/components/StoryReader.vue'
import PlanetDrawer from '@/components/PlanetDrawer.vue'
import ConceptHUD from '@/components/ConceptHUD.vue'
import type { CollectedConcept } from '@/components/ConceptHUD.vue'

import galaxyFixture from '@/fixtures/galaxy-data.json'

// ── Store & route ─────────────────────────────────────────────────────────────
const route  = useRoute()
const router = useRouter()
const { data: meshData, visitedPlanetIds, collectedConceptIds, persistSet, loadFromFixture } = useMeshStore()

const systemId = computed(() => route.params.clusterId as string)
const solarSystem = computed<MeshSolarSystem | null>(() =>
  meshData.value?.solarSystems[systemId.value] ?? null
)

// ── UI refs ───────────────────────────────────────────────────────────────────
const containerRef   = ref<HTMLDivElement>()
const veilRef        = ref<HTMLDivElement>()
const flyingSoulRef  = ref<HTMLDivElement>()
const conceptHudRef  = ref<InstanceType<typeof ConceptHUD>>()
const storyReaderRef = ref<InstanceType<typeof StoryReader>>()

const navigating    = ref(false)
const selectedPlanet      = ref<MeshPlanet | null>(null)
const selectedPlanetColor = ref('#7c9ef8')
const highlightedConceptIds = ref<string[]>([])

// ── Overlay types ─────────────────────────────────────────────────────────────
interface LabelPos { id: string; x: number; y: number; opacity: number; title: string; color: string; visited: boolean }
const labelPositions = ref<LabelPos[]>([])

// Per-frame world anchors (labels only — souls are now 3D sprites)
const labelWorldData: Array<{ id: string; pos: THREE.Vector3; title: string; color: string; baseRadius: number }> = []

// ── Three.js state ─────────────────────────────────────────────────────────────
let sceneCtx: ReturnType<typeof useThreeScene> | null = null
let raycaster: THREE.Raycaster
let occlusionRay: THREE.Raycaster
let mouse: THREE.Vector2
const planetMeshes = new Map<string, THREE.Mesh>()
let clickableMeshes: THREE.Mesh[] = []
let occlusionMeshes: THREE.Mesh[] = []  // planets + sun for occlusion testing

// Soul 3D sprite state
const soulMeshes   = new Map<string, THREE.Sprite>()
const soulBasePos  = new Map<string, THREE.Vector3>()
const soulPhases   = new Map<string, number>()
let soulClickables: THREE.Sprite[] = []

// ── Sun particle system state ──────────────────────────────────────────────────
let sunParticle:         THREE.Points | null = null
let sunParticleAnimFn:   SunAnimFn    | null = null
let sunParticlePosArray: Float32Array | null = null
let sunParticleColArray: Float32Array | null = null
let sunParticleCount   = 0
let sunParticleRadius  = 0

// ── Planet texture cache ───────────────────────────────────────────────────────
const planetTextures   = new Map<string, THREE.Texture>()
let   saturnRingTex: THREE.Texture | null = null

// ── PRNG visual seeding ────────────────────────────────────────────────────────
function seededRng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 0xffffffff }
}

const PLANET_COLORS = [
  '#6a8cff', '#ff7c6e', '#7de8c0', '#ffd166',
  '#c77dff', '#4cc9f0', '#f77f00', '#a8dadc',
  '#84a98c', '#e63946', '#457b9d', '#e9c46a',
]
const CONCEPT_COLORS = [
  '#b5a0ff', '#ffc8e8', '#a0f0d0', '#ffeaa7',
  '#dfe0ff', '#c8f0ff', '#ffd8b8', '#e8f4a0',
]

// ── Planet type definitions ────────────────────────────────────────────────────
interface PlanetTypeDef {
  id: string; radius: number; texKey: string | null
  atmosphereColor: string | null; atmosphereOpacity: number; hasRings: boolean
}

const PLANET_TYPE_DEFS: PlanetTypeDef[] = [
  { id: 'earth',      radius: 2.8, texKey: 'earth',   atmosphereColor: '#3a7bd5', atmosphereOpacity: 0.10, hasRings: false },
  { id: 'mars',       radius: 2.0, texKey: 'mars',    atmosphereColor: '#c1440e', atmosphereOpacity: 0.07, hasRings: false },
  { id: 'moon',       radius: 1.8, texKey: 'moon',    atmosphereColor: null,      atmosphereOpacity: 0,    hasRings: false },
  { id: 'jupiter',    radius: 3.8, texKey: 'jupiter', atmosphereColor: '#c88b3a', atmosphereOpacity: 0.08, hasRings: false },
  { id: 'saturn',     radius: 3.4, texKey: 'saturn',  atmosphereColor: '#c4a46b', atmosphereOpacity: 0.08, hasRings: true  },
  { id: 'uranus',     radius: 3.1, texKey: 'uranus',  atmosphereColor: '#7de8e8', atmosphereOpacity: 0.09, hasRings: false },
  { id: 'neptune',    radius: 2.9, texKey: 'neptune', atmosphereColor: '#3470c8', atmosphereOpacity: 0.09, hasRings: false },
  { id: 'venus',      radius: 2.6, texKey: 'venus',   atmosphereColor: '#e8c040', atmosphereOpacity: 0.12, hasRings: false },
  { id: 'mercury',    radius: 1.6, texKey: 'mercury', atmosphereColor: null,      atmosphereOpacity: 0,    hasRings: false },
  { id: 'lava',       radius: 2.3, texKey: null,      atmosphereColor: '#ff3a00', atmosphereOpacity: 0.10, hasRings: false },
  { id: 'ice',        radius: 2.4, texKey: null,      atmosphereColor: '#80d0ff', atmosphereOpacity: 0.09, hasRings: false },
  { id: 'desert',     radius: 2.1, texKey: null,      atmosphereColor: '#c8903a', atmosphereOpacity: 0.06, hasRings: false },
  { id: 'toxic',      radius: 2.5, texKey: null,      atmosphereColor: '#80c830', atmosphereOpacity: 0.08, hasRings: false },
  { id: 'crystal',    radius: 2.0, texKey: null,      atmosphereColor: '#c0a0ff', atmosphereOpacity: 0.08, hasRings: false },
  { id: 'dead_rock',  radius: 1.7, texKey: null,      atmosphereColor: null,      atmosphereOpacity: 0,    hasRings: false },
  { id: 'ocean',      radius: 2.7, texKey: null,      atmosphereColor: '#1050d0', atmosphereOpacity: 0.11, hasRings: false },
  { id: 'gas_purple', radius: 3.6, texKey: null,      atmosphereColor: '#9060d0', atmosphereOpacity: 0.09, hasRings: false },
  { id: 'ice_giant',  radius: 3.2, texKey: null,      atmosphereColor: '#40c0c8', atmosphereOpacity: 0.09, hasRings: false },
  { id: 'molten',     radius: 2.2, texKey: null,      atmosphereColor: '#ff6020', atmosphereOpacity: 0.10, hasRings: false },
  { id: 'void',       radius: 1.9, texKey: null,      atmosphereColor: '#8040ff', atmosphereOpacity: 0.06, hasRings: false },
]

function pickPlanetType(id: string): PlanetTypeDef {
  const rng = seededRng(id + '_type')
  return PLANET_TYPE_DEFS[Math.floor(rng() * PLANET_TYPE_DEFS.length)]
}

// ── Texture preloading ─────────────────────────────────────────────────────────
const TEXTURE_URLS: Record<string, string> = {
  earth:       '/textures/planets/earth.jpg',
  mars:        '/textures/planets/mars.jpg',
  moon:        '/textures/planets/moon.jpg',
  jupiter:     '/textures/planets/jupiter.jpg',
  saturn:      '/textures/planets/saturn.jpg',
  uranus:      '/textures/planets/uranus.jpg',
  neptune:     '/textures/planets/neptune.jpg',
  venus:       '/textures/planets/venus.jpg',
  mercury:     '/textures/planets/mercury.jpg',
  saturn_ring: '/textures/planets/saturn_ring.png',
}

function preloadPlanetTextures(onReady: () => void) {
  const loader  = new THREE.TextureLoader()
  const keys    = Object.keys(TEXTURE_URLS)
  let pending   = keys.length

  const done = () => { if (--pending === 0) onReady() }

  for (const key of keys) {
    loader.load(
      TEXTURE_URLS[key],
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        if (key === 'saturn_ring') saturnRingTex = tex
        else planetTextures.set(key, tex)
        done()
      },
      undefined,
      () => done(),   // silently skip 404s — exotic procedural fills in
    )
  }
}

function planetHex(id: string) {
  const rng = seededRng(id); return PLANET_COLORS[Math.floor(rng() * PLANET_COLORS.length)]
}
function conceptHex(id: string) {
  const rng = seededRng(id); return CONCEPT_COLORS[Math.floor(rng() * CONCEPT_COLORS.length)]
}
function planetRadius(id: string) {
  const rng = seededRng(id); rng()
  return 1.8 + rng() * 2.0 // 1.8–3.8
}

// ── Procedural planet texture ─────────────────────────────────────────────────
function makePlanetTexture(id: string, hexColor: string): THREE.CanvasTexture {
  const rng = seededRng(id + 'tex')
  const S   = 256
  const cv  = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const c   = new THREE.Color(hexColor)
  const ri  = Math.round(c.r * 255)
  const gi  = Math.round(c.g * 255)
  const bi  = Math.round(c.b * 255)
  const base  = `rgb(${ri},${gi},${bi})`
  const dark  = `rgb(${Math.round(ri*0.3)},${Math.round(gi*0.3)},${Math.round(bi*0.3)})`
  const light = `rgb(${Math.min(255,Math.round(ri*1.7))},${Math.min(255,Math.round(gi*1.7))},${Math.min(255,Math.round(bi*1.7))})`

  // Pick a texture style based on seeded rng
  const style = Math.floor(rng() * 4)
  switch (style) {
    case 0: {
      // Banded gas giant
      const grad = ctx.createLinearGradient(0, 0, 0, S)
      grad.addColorStop(0, light); grad.addColorStop(0.2, base)
      grad.addColorStop(0.55, dark); grad.addColorStop(0.8, base); grad.addColorStop(1, light)
      ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 6; i++) {
        const y = rng() * S, bh = 5 + rng() * 20
        ctx.fillStyle = i % 2 === 0
          ? `rgba(${Math.round(ri*0.25)},${Math.round(gi*0.25)},${Math.round(bi*0.25)},0.4)`
          : `rgba(${Math.min(255,ri+50)},${Math.min(255,gi+50)},${Math.min(255,bi+50)},0.2)`
        ctx.fillRect(0, y, S, bh)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, S, 16); ctx.fillRect(0, S-16, S, 16)
      break
    }
    case 1: {
      // Cratered moon
      const bg = ctx.createRadialGradient(S*0.38, S*0.33, S*0.04, S/2, S/2, S/2)
      bg.addColorStop(0, light); bg.addColorStop(0.6, base); bg.addColorStop(1, dark)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 12; i++) {
        const cx = rng()*S, cy = rng()*S, cr = 5 + rng()*16
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.round(ri*0.2)},${Math.round(gi*0.2)},${Math.round(bi*0.2)},0.55)`; ctx.fill()
        ctx.beginPath(); ctx.arc(cx-cr*0.2, cy-cr*0.2, cr*0.6, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.min(255,ri+50)},${Math.min(255,gi+50)},${Math.min(255,bi+50)},0.18)`; ctx.fill()
      }
      break
    }
    case 2: {
      // Ocean + continents
      ctx.fillStyle = dark; ctx.fillRect(0, 0, S, S)
      const og = ctx.createRadialGradient(S/2, S/2, S*0.1, S/2, S/2, S*0.6)
      og.addColorStop(0, `rgba(${Math.min(255,ri+30)},${Math.min(255,gi+30)},${Math.min(255,bi+60)},0.35)`)
      og.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = og; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 4; i++) {
        const cx = 20 + rng()*(S-40), cy = 20 + rng()*(S-40), w = 28 + rng()*65, h = 20 + rng()*50
        ctx.beginPath(); ctx.ellipse(cx, cy, w/2, h/2, rng()*Math.PI, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.min(255,ri+20)},${Math.min(255,gi+30)},${Math.round(bi*0.65)},0.7)`; ctx.fill()
      }
      break
    }
    default: {
      // Radiant star-like
      const rg = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2)
      rg.addColorStop(0, 'white'); rg.addColorStop(0.12, light); rg.addColorStop(0.45, base)
      rg.addColorStop(0.82, `rgba(${ri},${gi},${bi},0.3)`); rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg; ctx.fillRect(0, 0, S, S)
      ctx.save(); ctx.translate(S/2, S/2)
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI/4)
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(S*0.44, S*0.03); ctx.lineTo(S*0.5, 0); ctx.lineTo(S*0.44, -S*0.03)
        ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill()
      }
      ctx.restore()
    }
  }
  return new THREE.CanvasTexture(cv)
}

// ── Fibonacci sphere distribution ─────────────────────────────────────────────
function fibSphere(count: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = phi * i
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
  }
  return pts
}

// ── Exotic procedural planet textures ─────────────────────────────────────────
function makeExoticTexture(typeId: string, planetId: string): THREE.CanvasTexture {
  const S   = 512
  const cv  = document.createElement('canvas')
  cv.width  = cv.height = S
  const ctx = cv.getContext('2d')!
  const rng = seededRng(planetId + '_' + typeId + '_exotic')

  switch (typeId) {
    case 'lava': {
      ctx.fillStyle = '#140500'; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 22; i++) {
        const x1 = rng() * S, y1 = rng() * S
        ctx.strokeStyle = `rgba(255,${Math.round(60 + rng() * 90)},0,${0.5 + rng() * 0.5})`
        ctx.lineWidth = 0.8 + rng() * 2.5
        ctx.beginPath(); ctx.moveTo(x1, y1)
        let cx2 = x1, cy2 = y1, ang = rng() * Math.PI * 2
        for (let j = 0; j < 10; j++) {
          ang += (rng() - 0.5) * 0.9
          cx2 += Math.cos(ang) * (8 + rng() * 14); cy2 += Math.sin(ang) * (8 + rng() * 14)
          ctx.lineTo(cx2, cy2)
        }
        ctx.stroke()
      }
      for (let i = 0; i < 10; i++) {
        const hx = rng() * S, hy = rng() * S, hr = 4 + rng() * 18
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr)
        g.addColorStop(0, 'rgba(255,210,0,0.9)'); g.addColorStop(0.4, 'rgba(255,80,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g; ctx.fillRect(0, 0, S, S)
      }
      break
    }
    case 'ice': {
      const bg = ctx.createLinearGradient(0, 0, S, S)
      bg.addColorStop(0, '#c8eeff'); bg.addColorStop(0.5, '#a0d8f0'); bg.addColorStop(1, '#e0f6ff')
      ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 35; i++) {
        ctx.strokeStyle = `rgba(50,110,180,${0.15 + rng() * 0.35})`
        ctx.lineWidth = 0.4 + rng() * 1.4
        ctx.beginPath(); ctx.moveTo(rng() * S, rng() * S)
        let cx2 = rng() * S, cy2 = rng() * S, ang = rng() * Math.PI * 2
        for (let j = 0; j < 5; j++) {
          ang += (rng() - 0.5) * 0.7
          cx2 += Math.cos(ang) * (15 + rng() * 35); cy2 += Math.sin(ang) * (15 + rng() * 35)
          ctx.lineTo(cx2, cy2)
        }
        ctx.stroke()
      }
      for (let i = 0; i < 5; i++) {
        const px = rng() * S, py = rng() * S
        const pg = ctx.createRadialGradient(px, py, 0, px, py, 35 + rng() * 65)
        pg.addColorStop(0, 'rgba(255,255,255,0.35)'); pg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = pg; ctx.fillRect(0, 0, S, S)
      }
      break
    }
    case 'desert': {
      const db = ctx.createLinearGradient(0, 0, 0, S)
      db.addColorStop(0, '#e8c87a'); db.addColorStop(0.5, '#c8903a'); db.addColorStop(1, '#d4a050')
      ctx.fillStyle = db; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 22; i++) {
        const y = rng() * S
        ctx.strokeStyle = `rgba(160,100,30,${0.12 + rng() * 0.18})`
        ctx.lineWidth = 0.8 + rng()
        ctx.beginPath(); ctx.moveTo(0, y)
        for (let x = 0; x <= S; x += 6) {
          ctx.lineTo(x, y + Math.sin(x * 0.04 + rng() * Math.PI) * (2 + rng() * 9))
        }
        ctx.stroke()
      }
      break
    }
    case 'toxic': {
      const tg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 1.5)
      tg.addColorStop(0, '#b8e040'); tg.addColorStop(0.5, '#5aaa08'); tg.addColorStop(1, '#2a5804')
      ctx.fillStyle = tg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 28; i++) {
        const bx = rng() * S, by = rng() * S, br = 3 + rng() * 22
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(190,240,20,${0.18 + rng() * 0.35})`;  ctx.lineWidth = 0.5 + rng(); ctx.stroke()
      }
      for (let i = 0; i < 8; i++) {
        const mx = rng() * S, my = rng() * S
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 15 + rng() * 55)
        mg.addColorStop(0, `rgba(30,65,0,${0.25 + rng() * 0.3})`); mg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = mg; ctx.fillRect(0, 0, S, S)
      }
      break
    }
    case 'crystal': {
      ctx.fillStyle = '#070616'; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 45; i++) {
        const cx2 = rng() * S, cy2 = rng() * S, cr = 8 + rng() * 38
        const hue = rng() * 360, sides = 4 + Math.floor(rng() * 4)
        ctx.beginPath()
        for (let j = 0; j <= sides; j++) {
          const a = (j / sides) * Math.PI * 2 + rng() * 0.25
          const r2 = cr * (0.65 + rng() * 0.35)
          j === 0 ? ctx.moveTo(cx2 + Math.cos(a) * r2, cy2 + Math.sin(a) * r2)
                  : ctx.lineTo(cx2 + Math.cos(a) * r2, cy2 + Math.sin(a) * r2)
        }
        ctx.fillStyle = `hsla(${hue},80%,60%,${0.08 + rng() * 0.18})`; ctx.fill()
        ctx.strokeStyle = `hsla(${hue},90%,78%,${0.25 + rng() * 0.4})`; ctx.lineWidth = 0.5; ctx.stroke()
      }
      break
    }
    case 'dead_rock': {
      const drg = ctx.createRadialGradient(S * 0.4, S * 0.35, S * 0.05, S / 2, S / 2, S / 2)
      drg.addColorStop(0, '#686868'); drg.addColorStop(0.6, '#383838'); drg.addColorStop(1, '#181818')
      ctx.fillStyle = drg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 22; i++) {
        const dcx = rng() * S, dcy = rng() * S, dcr = 7 + rng() * 32
        ctx.beginPath(); ctx.arc(dcx, dcy, dcr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(8,8,8,${0.35 + rng() * 0.4})`; ctx.fill()
        ctx.beginPath(); ctx.arc(dcx - dcr * 0.2, dcy - dcr * 0.2, dcr * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(90,90,90,0.12)'; ctx.fill()
      }
      break
    }
    case 'ocean': {
      const og = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
      og.addColorStop(0, '#2468d8'); og.addColorStop(0.5, '#1040a0'); og.addColorStop(1, '#081e60')
      ctx.fillStyle = og; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 18; i++) {
        const wy = rng() * S
        ctx.strokeStyle = `rgba(70,150,255,${0.05 + rng() * 0.07})`; ctx.lineWidth = 1 + rng() * 2
        ctx.beginPath(); ctx.moveTo(0, wy)
        for (let x = 0; x <= S; x += 5) { ctx.lineTo(x, wy + Math.sin(x * 0.05 + rng() * Math.PI) * (2 + rng() * 7)) }
        ctx.stroke()
      }
      break
    }
    case 'gas_purple': {
      const pg = ctx.createLinearGradient(0, 0, 0, S)
      pg.addColorStop(0, '#b070f0'); pg.addColorStop(0.25, '#4018a0'); pg.addColorStop(0.5, '#9050d8'); pg.addColorStop(0.75, '#300890'); pg.addColorStop(1, '#a060e0')
      ctx.fillStyle = pg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 18; i++) {
        const y = rng() * S, bh = 4 + rng() * 28
        ctx.fillStyle = i % 2 === 0 ? `rgba(10,0,40,${0.45 + rng() * 0.3})` : `rgba(200,140,255,${0.18 + rng() * 0.15})`
        ctx.fillRect(0, y, S, bh)
      }
      // Swirl highlight
      const sw = ctx.createRadialGradient(S*0.35, S*0.4, 0, S*0.35, S*0.4, S*0.25)
      sw.addColorStop(0, 'rgba(230,180,255,0.35)'); sw.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = sw; ctx.fillRect(0, 0, S, S)
      break
    }
    case 'ice_giant': {
      const ig = ctx.createLinearGradient(0, 0, 0, S)
      ig.addColorStop(0, '#40d8d0'); ig.addColorStop(0.4, '#20a8b0'); ig.addColorStop(0.7, '#35c0c0'); ig.addColorStop(1, '#168090')
      ctx.fillStyle = ig; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 8; i++) {
        const y = rng() * S, bh = 2 + rng() * 14
        ctx.fillStyle = `rgba(0,55,75,${0.18 + rng() * 0.18})`; ctx.fillRect(0, y, S, bh)
      }
      const pc = ctx.createLinearGradient(0, 0, 0, S * 0.2)
      pc.addColorStop(0, 'rgba(255,255,255,0.22)'); pc.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = pc; ctx.fillRect(0, 0, S, S * 0.2)
      break
    }
    case 'molten': {
      const mg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
      mg.addColorStop(0, '#d04010'); mg.addColorStop(0.5, '#a02808'); mg.addColorStop(1, '#601000')
      ctx.fillStyle = mg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 18; i++) {
        const mcx = rng() * S, mcy = rng() * S, mcr = 5 + rng() * 25
        ctx.beginPath(); ctx.arc(mcx, mcy, mcr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(16,4,0,${0.45 + rng() * 0.35})`; ctx.fill()
      }
      for (let i = 0; i < 7; i++) {
        const hx = rng() * S, hy = rng() * S
        const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7 + rng() * 22)
        hg.addColorStop(0, 'rgba(255,165,0,0.75)'); hg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = hg; ctx.fillRect(0, 0, S, S)
      }
      break
    }
    case 'void': {
      ctx.fillStyle = '#08041a'; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 12; i++) {
        const vx = rng() * S, vy = rng() * S
        const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, 40 + rng() * 100)
        const hue = 240 + rng() * 80
        vg.addColorStop(0, `hsla(${hue},70%,38%,0.40)`); vg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S)
      }
      // Bright anomaly streak
      const angle = rng() * Math.PI, cx2 = S/2 + Math.cos(angle)*S*0.2, cy2 = S/2 + Math.sin(angle)*S*0.2
      const vs = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, S * 0.18)
      vs.addColorStop(0, 'rgba(220,180,255,0.55)'); vs.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = vs; ctx.fillRect(0, 0, S, S)
      break
    }
    default: {
      ctx.fillStyle = '#303030'; ctx.fillRect(0, 0, S, S)
    }
  }
  return new THREE.CanvasTexture(cv)
}

// ── Atmosphere + ring helpers ──────────────────────────────────────────────────
function addAtmosphere(parent: THREE.Mesh, hexColor: string, r: number, opacity: number) {
  const c = new THREE.Color(hexColor)
  for (let i = 1; i <= 2; i++) {
    const geo = new THREE.SphereGeometry(r * (1.22 + i * 0.16), 16, 16)
    const mat = new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: opacity / i,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    parent.add(new THREE.Mesh(geo, mat))
  }
}

function addRings(parent: THREE.Mesh, r: number) {
  const innerR = r * 1.35, outerR = r * 2.4
  const geo = new THREE.RingGeometry(innerR, outerR, 90, 1)
  // Remap UVs so the texture runs radially (inner→outer) rather than circumferentially
  const pos = geo.attributes.position as THREE.BufferAttribute
  const uv  = geo.attributes.uv  as THREE.BufferAttribute
  const v3  = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i)
    uv.setXY(i, (v3.length() - innerR) / (outerR - innerR), 0.5)
  }
  uv.needsUpdate = true

  const mat = new THREE.MeshBasicMaterial({
    map: saturnRingTex ?? undefined,
    color: saturnRingTex ? 0xffffff : 0xd4c080,
    transparent: true, opacity: saturnRingTex ? 0.38 : 0.22,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  const ring = new THREE.Mesh(geo, mat)
  ring.rotation.x = Math.PI / 2.15  // slight tilt
  parent.add(ring)
}

// ── Sun particle formation (mirrors GalaxyView presets, scaled down) ───────────
type SunAnimFn = (pos: Float32Array, col: Float32Array, elapsed: number, count: number, radius: number) => void

const SUN_PRESETS = ['sphere', 'helix', 'torus', 'crown', 'burst', 'atom', 'quantum', 'mobius', 'neutron', 'dna'] as const
type  SunPreset  = typeof SUN_PRESETS[number]

function sunPresetForSystem(id: string): SunPreset {
  const rng = seededRng(id + '_preset')
  return SUN_PRESETS[Math.floor(rng() * SUN_PRESETS.length)]
}

const SUN_PRESET_ROTATION: Record<SunPreset, { axis: [number, number, number]; speed: number }> = {
  sphere:  { axis: [0.15, 1, 0.08], speed: 0.15 },
  helix:   { axis: [0, 1, 0],       speed: 0.30 },
  torus:   { axis: [0.4, 1, 0.2],   speed: 0.22 },
  crown:   { axis: [0, 1, 0],       speed: 0.18 },
  burst:   { axis: [0.2, 1, 0.3],   speed: 0.25 },
  atom:    { axis: [0, 1, 0],       speed: 0 },
  quantum: { axis: [0, 1, 0],       speed: 0 },
  mobius:  { axis: [0, 1, 0],       speed: 0 },
  neutron: { axis: [0, 1, 0],       speed: 0 },
  dna:     { axis: [0, 1, 0],       speed: 0 },
}

function buildSunFormation(preset: SunPreset, count: number, radius: number): Float32Array {
  const pos = new Float32Array(count * 3)
  switch (preset) {
    case 'sphere': {
      for (let i = 0; i < count; i++) {
        const phi = Math.acos(-1 + (2 * i) / count), theta = Math.sqrt(count * Math.PI) * phi
        const r = radius * (0.80 + Math.random() * 0.28)
        pos[i*3] = r*Math.sin(phi)*Math.cos(theta); pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta); pos[i*3+2] = r*Math.cos(phi)
      }
      break
    }
    case 'helix': {
      for (let i = 0; i < count; i++) {
        const strand = i % 2, t2 = (i / count) * Math.PI * 10
        pos[i*3] = Math.cos(t2 + strand*Math.PI)*radius*0.55; pos[i*3+1] = (i/count-0.5)*radius*2.6; pos[i*3+2] = Math.sin(t2 + strand*Math.PI)*radius*0.55
      }
      break
    }
    case 'torus': {
      const R = radius*0.88, rr = radius*0.32
      for (let i = 0; i < count; i++) {
        const u = (i/count)*Math.PI*2*7, v2 = Math.random()*Math.PI*2
        pos[i*3] = (R+rr*Math.cos(v2))*Math.cos(u); pos[i*3+1] = (R+rr*Math.cos(v2))*Math.sin(u); pos[i*3+2] = rr*Math.sin(v2)
      }
      break
    }
    case 'crown': {
      const rings = 6, perRing = Math.floor(count/rings)
      for (let i = 0; i < count; i++) {
        const ring = Math.min(Math.floor(i/perRing), rings-1), j = i%perRing
        const angle = (j/perRing)*Math.PI*2, ringR = radius*(0.45+ring*0.11), y = (ring/(rings-1)-0.5)*radius*1.6
        pos[i*3] = Math.cos(angle)*ringR+(Math.random()-0.5)*radius*0.07
        pos[i*3+1] = y+(Math.random()-0.5)*radius*0.09
        pos[i*3+2] = Math.sin(angle)*ringR+(Math.random()-0.5)*radius*0.07
      }
      break
    }
    case 'burst': {
      const shells = 5, perShell = Math.floor(count/shells)
      for (let i = 0; i < count; i++) {
        const shell = Math.min(Math.floor(i/perShell), shells-1)
        const r2 = radius*(0.2+shell*0.2)*(0.9+Math.random()*0.2)
        const phi = Math.acos(-1+Math.random()*2), theta = Math.random()*Math.PI*2
        pos[i*3] = r2*Math.sin(phi)*Math.cos(theta); pos[i*3+1] = r2*Math.sin(phi)*Math.sin(theta); pos[i*3+2] = r2*Math.cos(phi)
      }
      break
    }
  }
  return pos
}

const _sunColor = new THREE.Color()

function sunAtomAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const speed=0.39, radius=nodeRadius*1.5, nucleusSize=nodeRadius*0.55, trailLen=31.6
  const nucleusCount=Math.floor(count*0.10), electronHeadCount=3*60, electronTrailCount=Math.floor(count*0.22)
  const trailPerRing=Math.floor(electronTrailCount/3), ringTotal=count-nucleusCount-electronHeadCount-electronTrailCount
  const ringSize=Math.floor(ringTotal/3), t=elapsed*speed
  const tlX0=0.44,tlX1=1.13,tlX2=1.45, tlZ0=0.17,tlZ1=0.73,tlZ2=-0.38
  for (let i=0; i<count; i++) {
    let x=0,y=0,z=0,r=0,g=0,b=0
    if (i<nucleusCount) {
      const golden=2.399963, theta2=Math.acos(1-2*(i+0.5)/nucleusCount), phi2=golden*i+t*0.3
      const rr=nucleusSize*(0.5+0.5*Math.pow(Math.abs(Math.sin(t*1.5+i*0.2)),0.5))
      x=Math.sin(theta2)*Math.cos(phi2)*rr; y=Math.sin(theta2)*Math.sin(phi2)*rr; z=Math.cos(theta2)*rr
      const pulse=0.7+0.3*Math.sin(t*2.5+i*0.1); r=0.65*pulse; g=0.35*pulse; b=1.0*pulse
    } else if (i<nucleusCount+ringSize*3) {
      const ri=i-nucleusCount, ringIdx=Math.floor(ri/ringSize), pi2=ri-ringIdx*ringSize
      const frac=pi2/ringSize, dir=ringIdx===1?-1:1, spd=1.0+ringIdx*0.3
      const angle=frac*Math.PI*2+t*spd*dir
      const bx=Math.cos(angle)*radius, by=Math.sin(angle)*radius
      const tX=ringIdx===0?tlX0:ringIdx===1?tlX1:tlX2, tZ=ringIdx===0?tlZ0:ringIdx===1?tlZ1:tlZ2
      const cxr=Math.cos(tX),sxr=Math.sin(tX), czr=Math.cos(tZ),szr=Math.sin(tZ)
      const ry2=by*cxr, rz2=by*sxr
      x=bx*czr-ry2*szr; y=bx*szr+ry2*czr; z=rz2
      const bright=0.5+0.2*Math.sin(angle*3+t)
      if (ringIdx===0){r=0.49*bright;g=0.23*bright;b=0.93*bright}
      else if (ringIdx===1){r=0.02*bright;g=0.71*bright;b=0.83*bright}
      else{r=0.42*bright;g=0.30*bright;b=0.98*bright}
    } else if (i<nucleusCount+ringSize*3+electronHeadCount) {
      const hi=i-nucleusCount-ringSize*3, ringIdx=Math.floor(hi/60), pi2=hi-ringIdx*60
      const dir=ringIdx===1?-1:1, spd=1.0+ringIdx*0.3, eAngle=t*spd*dir*2.5
      const headR=0.5, angSpread=(pi2/60)*Math.PI*2, rSpread=headR*Math.sqrt((pi2%20)/20.0)
      const offAngle=eAngle+Math.cos(angSpread)*(rSpread/radius), offR=radius+Math.sin(angSpread)*rSpread
      const bx=Math.cos(offAngle)*offR, by=Math.sin(offAngle)*offR
      const tX=ringIdx===0?tlX0:ringIdx===1?tlX1:tlX2, tZ=ringIdx===0?tlZ0:ringIdx===1?tlZ1:tlZ2
      const cxr=Math.cos(tX),sxr=Math.sin(tX), czr=Math.cos(tZ),szr=Math.sin(tZ)
      const ry2=by*cxr, rz2=by*sxr
      x=bx*czr-ry2*szr; y=bx*szr+ry2*czr; z=rz2
      const glow=1.0-(rSpread/headR)*0.4; r=glow; g=glow; b=glow
    } else if (i<nucleusCount+ringSize*3+electronHeadCount+trailPerRing*3) {
      const ei=i-nucleusCount-ringSize*3-electronHeadCount, ringIdx=Math.floor(ei/trailPerRing)
      const trailIdx=ei-ringIdx*trailPerRing, trailFrac=trailIdx/trailPerRing
      const dir=ringIdx===1?-1:1, spd=1.0+ringIdx*0.3, offset=trailFrac*trailLen*0.04
      const angle=t*spd*dir*2.5-offset*dir
      const bx=Math.cos(angle)*radius, by=Math.sin(angle)*radius
      const tX=ringIdx===0?tlX0:ringIdx===1?tlX1:tlX2, tZ=ringIdx===0?tlZ0:ringIdx===1?tlZ1:tlZ2
      const cxr=Math.cos(tX),sxr=Math.sin(tX), czr=Math.cos(tZ),szr=Math.sin(tZ)
      const ry2=by*cxr, rz2=by*sxr
      x=bx*czr-ry2*szr; y=bx*szr+ry2*czr; z=rz2
      const fc=Math.pow(1.0-trailFrac,3)
      if (ringIdx===0){r=0.7*fc;g=0.4*fc;b=1.0*fc}
      else if (ringIdx===1){r=0.1*fc;g=0.9*fc;b=1.0*fc}
      else{r=0.6*fc;g=0.45*fc;b=1.0*fc}
    }
    pos[i*3]  +=(x-pos[i*3])*0.1; pos[i*3+1]+=(y-pos[i*3+1])*0.1; pos[i*3+2]+=(z-pos[i*3+2])*0.1
    col[i*3]=r; col[i*3+1]=g; col[i*3+2]=b
  }
}

function sunQuantumAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const radius=nodeRadius*1.4, tube=nodeRadius*0.5, speed=0.8, chaos=nodeRadius*0.07, t=elapsed*speed
  for (let i=0; i<count; i++) {
    const n=i/count, u=n*Math.PI*2*13.0+t*0.3, v2=n*Math.PI*2*412.0-t*1.5
    const harmonicTwist=Math.sin(u*3.0+t), dynamicTube=tube*(0.5+0.5*harmonicTwist)
    const noise=Math.sin(i*789.123)*chaos, structureMod=Math.cos(u*5.0)*chaos*0.5
    const cx=(radius+dynamicTube*Math.cos(v2)+noise)*Math.cos(u)
    const cy=(radius+dynamicTube*Math.cos(v2)+noise)*Math.sin(u)
    const cz=dynamicTube*Math.sin(v2)+noise+Math.sin(u*4.0)*structureMod
    pos[i*3]+=(cx-pos[i*3])*0.1; pos[i*3+1]+=(cy-pos[i*3+1])*0.1; pos[i*3+2]+=(cz-pos[i*3+2])*0.1
    const hue=(0.55+0.35*Math.sin(v2*0.2+t*0.5)+0.1*Math.cos(u*2.0))%1.0
    _sunColor.setHSL(hue, 0.8+0.2*Math.cos(v2), Math.max(0.1,Math.min(1.0,0.3+0.5*Math.abs(harmonicTwist)+noise*0.05)))
    col[i*3]=_sunColor.r; col[i*3+1]=_sunColor.g; col[i*3+2]=_sunColor.b
  }
}

function sunMobiusAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const scale=nodeRadius*1.43, twist=3.52, flow=0.78, thickness=nodeRadius*0.12, bloom=0.58
  const TAU=Math.PI*2, t=elapsed*flow
  for (let i=0; i<count; i++) {
    const u=(i+0.5)/count, g2=i*0.6180339887498949, band=g2-Math.floor(g2)
    const a=TAU*u, s1=Math.sin(a+t*0.35), c1=Math.cos(a+t*0.35), s2=Math.sin((a+t*0.35)*2.0)
    const den=1.0+s1*s1, r=scale/den, bx=c1*r, by=s1*c1*r*0.9
    const bz=scale*0.14*Math.sin(a*3.0-t*0.8)+scale*0.08*s2*bloom
    const phi=TAU*band+t*0.75+twist*Math.sin(a*0.5+t*0.2), halfTwist=0.5*(a+t*0.35)
    const ring=thickness*(0.55+0.28*Math.sin(a*5.0-t*1.3)+0.17*Math.cos(a*9.0+t*0.7)*bloom)
    const cp=Math.cos(phi),sp=Math.sin(phi),ch=Math.cos(halfTwist),sh=Math.sin(halfTwist)
    const ox=ring*cp*ch, oy=ring*sp, oz=ring*cp*sh
    const drift=1.0+0.08*Math.sin(a*13.0+t)+0.05*Math.cos(a*21.0-t*1.7)
    const cx=(bx+ox+scale*0.05*Math.sin(phi*2.0+a*4.0+t))*drift
    const cy=(by+oy+scale*0.04*Math.cos(phi*2.0-a*3.0-t*0.6))*drift
    const cz2=(bz+oz+scale*0.06*Math.sin(a*7.0+phi-t*0.5)*bloom)*drift
    pos[i*3]+=(cx-pos[i*3])*0.1; pos[i*3+1]+=(cy-pos[i*3+1])*0.1; pos[i*3+2]+=(cz2-pos[i*3+2])*0.1
    const h=(band*0.22+0.08*Math.sin(a*2.0-t*0.4)+0.55+0.05*s2)%1.0
    _sunColor.setHSL(h,0.75+0.2*Math.abs(Math.sin(phi+a)),Math.max(0.1,Math.min(1.0,0.42+0.18*Math.sin(phi-t*0.3)+0.08*Math.cos(a*6.0+t))))
    col[i*3]=_sunColor.r; col[i*3+1]=_sunColor.g; col[i*3+2]=_sunColor.b
  }
}

function sunNeutronAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const speed=0.149, scale=nodeRadius*1.1, turbulence=1.02, jetPower=1.02, T=elapsed*speed
  const DISC_END=0.70, JET_END=0.90
  for (let i=0; i<count; i++) {
    const n=i/count
    const s1=Math.sin(i*73.13+1.7),s2=Math.sin(i*157.9+3.3),s3=Math.sin(i*311.2+7.1)
    const r1=s1*s1,r2=s2*s2,r3=s3*s3
    let px=0,py=0,pz=0,hue=0,sat=0,lit=0
    if (n<DISC_END) {
      const dn=n/DISC_END, radius=0.08+0.77*dn, omega=1.0/Math.sqrt(radius*radius*radius+1e-4)
      const angle=r1*Math.PI*2.0+omega*T, thickness=(0.012+radius*0.06)*turbulence, yOff=(r2-0.5)*2.0*thickness
      const wavePhase=angle*2.0+Math.log(radius+0.01)*3.5+T*0.25, waveDensity=1.0+0.18*Math.sin(wavePhase)
      px=radius*waveDensity*Math.cos(angle)+(r3-0.5)*turbulence*0.025; py=yOff; pz=radius*waveDensity*Math.sin(angle)
      hue=(1.0-dn)*0.10; sat=1.0; lit=0.22+dn*0.55+Math.sin(wavePhase)*0.07
    } else if (n<JET_END) {
      const jn=(n-DISC_END)/0.20, jetDir=jn<0.5?1.0:-1.0, jt=jn<0.5?jn*2.0:(jn-0.5)*2.0
      const height=jt*1.25*jetPower, baseR=0.025+height*0.07*(1.0+turbulence*0.4)
      const helix=r1*Math.PI*2.0+height*9.0+T*2.5, helixR=baseR*(0.65+0.35*Math.sin(helix*3.0))
      const recoll=1.0-0.35*Math.exp(-((jt-0.35)*(jt-0.35))/0.01)
      px=helixR*recoll*Math.cos(helix); py=height*jetDir; pz=helixR*recoll*Math.sin(helix)
      hue=0.54+jt*0.08; sat=0.75-jt*0.35; lit=0.62+(1.0-jt)*0.33
    } else {
      const cn=(n-JET_END)/0.10, phi=cn*Math.PI*2.0*7.618, cosT=2.0*r1-1.0, sinT=Math.sqrt(Math.max(0,1-cosT*cosT))
      const qpo=1.0+0.22*Math.sin(T*3.1+r3*Math.PI*2)+0.08*Math.sin(T*7.4+r2*Math.PI*4)
      const cR=(0.045+r2*0.09)*qpo
      px=cR*sinT*Math.cos(phi); py=cR*cosT*0.45; pz=cR*sinT*Math.sin(phi)
      hue=0.58+r3*0.06; sat=0.35+r2*0.30; lit=0.65+r3*0.30+(qpo-1.0)*0.15
    }
    const tx=px*scale,ty=py*scale,tz=pz*scale
    pos[i*3]+=(tx-pos[i*3])*0.1; pos[i*3+1]+=(ty-pos[i*3+1])*0.1; pos[i*3+2]+=(tz-pos[i*3+2])*0.1
    _sunColor.setHSL(hue,sat,Math.min(0.97,Math.max(0.04,lit)))
    col[i*3]=_sunColor.r; col[i*3+1]=_sunColor.g; col[i*3+2]=_sunColor.b
  }
}

function sunDnaAnimFn(pos: Float32Array, col: Float32Array, elapsed: number, count: number, nodeRadius: number): void {
  const radius=nodeRadius*0.65, height=nodeRadius*2.2, turns=10, speed=1.0, separation=nodeRadius*0.12, t=elapsed*speed
  for (let i=0; i<count; i++) {
    const fi=i/count, y=(fi-0.5)*height
    const angle=turns*Math.PI*2*fi+t, strandShift=Math.sign(Math.sin(i*3.1415926)), strandOffset=strandShift*separation
    const x=Math.cos(angle)*radius+strandOffset*Math.cos(angle+Math.PI*0.5)
    const z=Math.sin(angle)*radius+strandOffset*Math.sin(angle+Math.PI*0.5)
    pos[i*3]+=(x-pos[i*3])*0.1; pos[i*3+1]+=(y-pos[i*3+1])*0.1; pos[i*3+2]+=(z-pos[i*3+2])*0.1
    const baseHue=(strandShift+1.0)*0.25, hue=(baseHue+0.1*Math.sin(angle))%1.0
    _sunColor.setHSL(hue, 0.8, 0.5+0.2*Math.sin(fi*20+t))
    col[i*3]=_sunColor.r; col[i*3+1]=_sunColor.g; col[i*3+2]=_sunColor.b
  }
}

const SUN_PRESET_ANIM: Partial<Record<SunPreset, SunAnimFn>> = {
  atom: sunAtomAnimFn, quantum: sunQuantumAnimFn,
  mobius: sunMobiusAnimFn, neutron: sunNeutronAnimFn, dna: sunDnaAnimFn,
}

// ── Soul sprite material ───────────────────────────────────────────────────────
function makeSoulSpriteMat(hexColor: string): THREE.SpriteMaterial {
  const S = 128, pad = 18
  const cv  = document.createElement('canvas')
  cv.width  = S; cv.height = S
  const ctx = cv.getContext('2d')!

  // Scale from 24×28 viewBox into canvas with padding
  ctx.save()
  ctx.translate(pad, pad)
  ctx.scale((S - pad * 2) / 24, (S - pad * 2) / 28)

  const ghostPath = new Path2D(
    'M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63' +
    'l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87' +
    'c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63' +
    '.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z'
  )

  // Soft glow halo (very faint, coloured)
  ctx.shadowColor = hexColor
  ctx.shadowBlur  = 14
  ctx.fillStyle   = hexColor
  ctx.globalAlpha = 0.12
  ctx.fill(ghostPath)

  // Semi-transparent body — low enough alpha to see through
  ctx.shadowBlur  = 0
  ctx.globalAlpha = 0.28
  ctx.fill(ghostPath)

  // Eyes — slightly brighter than the body so they read
  ctx.globalAlpha = 0.55
  ctx.fillStyle   = 'rgba(0,0,0,0.9)'
  ctx.beginPath(); ctx.arc(9.5,  11, 1.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(14.5, 11, 1.3, 0, Math.PI * 2); ctx.fill()

  ctx.restore()

  return new THREE.SpriteMaterial({
    map:         new THREE.CanvasTexture(cv),
    transparent: true,
    depthWrite:  false,
    blending:    THREE.NormalBlending,
  })
}

// ── Build solar system scene ───────────────────────────────────────────────────
function buildScene() {
  if (!sceneCtx || !meshData.value || !solarSystem.value) return
  const { scene } = sceneCtx
  const sys = solarSystem.value
  const data = meshData.value

  planetMeshes.clear()
  soulMeshes.clear()
  soulBasePos.clear()
  soulPhases.clear()
  clickableMeshes  = []
  occlusionMeshes  = []
  soulClickables   = []
  labelWorldData.splice(0)

  // ── Central sun (particle formation — same preset as galaxy view) ────────────
  const rng     = seededRng(sys.id)
  const sunHex  = PLANET_COLORS[Math.floor(rng() * PLANET_COLORS.length)]
  const sunColor = new THREE.Color(sunHex)

  const sunPreset    = sunPresetForSystem(sys.id)
  // Mirror GalaxyView exactly (r = 5 + planetCount*0.35, count = 320 + planetCount*18)
  // then scale down to 60% so it reads as "same formation, zoomed in"
  const GALAXY_SCALE = 0.60
  const planetCount  = sys.planets.length
  const SUN_R        = (5 + planetCount * 0.35) * GALAXY_SCALE
  const SUN_COUNT    = 320 + planetCount * 18
  const sunAnimFn    = SUN_PRESET_ANIM[sunPreset]
  const sunPtGeo     = new THREE.BufferGeometry()

  if (sunAnimFn) {
    sunParticlePosArray = new Float32Array(SUN_COUNT * 3)
    sunParticleColArray = new Float32Array(SUN_COUNT * 3)
    sunPtGeo.setAttribute('position', new THREE.BufferAttribute(sunParticlePosArray, 3))
    sunPtGeo.setAttribute('color',    new THREE.BufferAttribute(sunParticleColArray, 3))
    const sunMat = new THREE.PointsMaterial({
      size: 0.38, transparent: true, opacity: 0.88,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, vertexColors: true,
    })
    sunParticle       = new THREE.Points(sunPtGeo, sunMat)
    sunParticleAnimFn  = sunAnimFn
    sunParticleCount   = SUN_COUNT
    sunParticleRadius  = SUN_R
  } else {
    const positions = buildSunFormation(sunPreset, SUN_COUNT, SUN_R)
    sunPtGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const sunMat = new THREE.PointsMaterial({
      color: sunColor, size: 0.36, transparent: true, opacity: 0.82,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    sunParticle = new THREE.Points(sunPtGeo, sunMat)
    const cfg  = SUN_PRESET_ROTATION[sunPreset]
    sunParticle.userData.rotationAxis  = new THREE.Vector3(...cfg.axis).normalize()
    sunParticle.userData.rotationSpeed = cfg.speed
  }
  sunParticle.userData.clearable = true
  scene.add(sunParticle)

  // Directional key light from the sun direction — doesn't suffer physical falloff
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.4)
  sunLight.position.set(0, 0, 0)
  sunLight.target.position.set(1, 0.4, 1)
  sunLight.userData = { clearable: true }
  scene.add(sunLight)
  scene.add(sunLight.target)

  // ── Planets ───────────────────────────────────────────────────────────────
  const planets = sys.planets
    .map((id) => data.planets[id])
    .filter(Boolean)

  const baseR = 28, radStep = 10
  const dirs = fibSphere(planets.length)

  planets.forEach((planet, i) => {
    const ptype  = pickPlanetType(planet.id)
    const hex    = planetHex(planet.id)         // still used for labels + drawer tint
    const r      = ptype.radius
    const rngP   = seededRng(planet.id + 'dist')
    const jitter = (rngP() - 0.5) * 8
    const dist   = baseR + (i % 4) * radStep + jitter
    const pos    = dirs[i].clone().multiplyScalar(dist)

    // Resolve texture:
    //   1. Real image texture (Solar System Scope) if loaded
    //   2. Exotic procedural for exotic types
    //   3. Original makePlanetTexture fallback for real types whose image didn't load
    const imgTex = ptype.texKey ? planetTextures.get(ptype.texKey) ?? null : null
    const tex = imgTex
      ?? (ptype.texKey === null
          ? makeExoticTexture(ptype.id, planet.id)
          : makePlanetTexture(planet.id, planetHex(planet.id)))

    const tintColor = new THREE.Color(hex)
    const geo = new THREE.SphereGeometry(r, 36, 36)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      // Self-light the surface using the texture itself so planets read clearly
      // even when the sun PointLight falls off (Three.js r155+ physical lights)
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: imgTex ? 0.65 : 0.55,
      roughness: 0.75, metalness: 0,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.userData = { clearable: true, planetId: planet.id, title: planet.title, baseRadius: r }

    // Rings (saturn type only)
    if (ptype.hasRings) addRings(mesh, r)

    // Thin radial line to sun
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), pos])
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const line = new THREE.Line(lineGeo, lineMat)
    line.userData = { clearable: true }
    scene.add(line)

    scene.add(mesh)
    planetMeshes.set(planet.id, mesh)
    clickableMeshes.push(mesh)
    occlusionMeshes.push(mesh)
    labelWorldData.push({ id: planet.id, pos: pos.clone(), title: planet.title, color: hex, baseRadius: r })
  })

  // ── Concepts (3D soul sprites) ────────────────────────────────────────────
  const concepts = sys.concepts
    .map((id) => data.concepts[id])
    .filter(Boolean)

  const conceptDirs = fibSphere(Math.max(concepts.length, 2))
  concepts.forEach((concept, i) => {
    const hex  = conceptHex(concept.id)
    const rngC = seededRng(concept.id + 'dist')
    const dist = 22 + rngC() * 18  // inner-to-mid belt (22–40)
    const pos  = conceptDirs[i % conceptDirs.length].clone().multiplyScalar(dist)

    // Push soul away from any planet it's too close to
    for (let iter = 0; iter < 10; iter++) {
      let moved = false
      for (const pmesh of planetMeshes.values()) {
        const minSep = (pmesh.userData.baseRadius as number) + 6
        const sep = pos.distanceTo(pmesh.position)
        if (sep < minSep) {
          const pushDir = pos.clone().sub(pmesh.position).normalize()
          pos.copy(pmesh.position).addScaledVector(pushDir, minSep)
          moved = true
        }
      }
      if (!moved) break
    }

    const mat    = makeSoulSpriteMat(hex)
    const sprite = new THREE.Sprite(mat)
    sprite.position.copy(pos)
    sprite.scale.set(4, 4.67, 1)   // 24:28 aspect × 4
    sprite.userData = { clearable: true, conceptId: concept.id, color: hex }

    scene.add(sprite)
    soulMeshes.set(concept.id, sprite)
    soulBasePos.set(concept.id, pos.clone())
    soulPhases.set(concept.id, seededRng(concept.id + 'phase')() * Math.PI * 2)
    soulClickables.push(sprite)
  })
}

// ── Per-frame ─────────────────────────────────────────────────────────────────
function onFrame(elapsed: number) {
  // Sun particle formation animation
  if (sunParticle) {
    if (sunParticleAnimFn && sunParticlePosArray && sunParticleColArray) {
      sunParticleAnimFn(sunParticlePosArray, sunParticleColArray, elapsed, sunParticleCount, sunParticleRadius)
      sunParticle.geometry.attributes.position.needsUpdate = true
      sunParticle.geometry.attributes.color.needsUpdate    = true
    } else if (sunParticle.userData.rotationAxis) {
      sunParticle.rotateOnAxis(sunParticle.userData.rotationAxis as THREE.Vector3, sunParticle.userData.rotationSpeed * 0.01)
      const pulse = 1 + Math.sin(elapsed * 0.5) * 0.03
      sunParticle.scale.setScalar(pulse)
    }
  }

  // Planet self-rotation
  planetMeshes.forEach((mesh) => {
    mesh.rotation.y += 0.003
    mesh.rotation.x += 0.0006
  })

  if (!sceneCtx || !containerRef.value) return
  const cam = sceneCtx.camera

  // Soul sprite animation
  const _dir = new THREE.Vector3()
  soulMeshes.forEach((sprite, conceptId) => {
    if (collectedConceptIds.value.has(conceptId)) {
      sprite.visible = false
      return
    }
    sprite.visible = true

    const base  = soulBasePos.get(conceptId)!
    const phase = soulPhases.get(conceptId) ?? 0

    // Bob up/down
    sprite.position.y = base.y + Math.sin(elapsed * 1.8 + phase) * 0.8

    // Distance-based opacity — cap at 1.0 so the texture alpha drives transparency
    const dist    = cam.position.distanceTo(sprite.position)
    let opacity   = Math.max(0, Math.min(1.0, (180 - dist) / 50))

    // Occlusion: dim soul when a planet/sun is between camera and soul
    if (opacity > 0 && occlusionMeshes.length > 0) {
      _dir.subVectors(sprite.position, cam.position).normalize()
      occlusionRay.set(cam.position, _dir)
      occlusionRay.far = dist - 0.5
      if (occlusionRay.intersectObjects(occlusionMeshes, false).length > 0) {
        opacity *= 0.15
      }
    }

    sprite.material.opacity = opacity

    // Highlighted state: pulse scale
    const highlighted = highlightedConceptIds.value.includes(conceptId)
    const pulse = highlighted ? 1.3 + Math.sin(elapsed * 4 + phase) * 0.08 : 1.0
    sprite.scale.set(4 * pulse, 4.67 * pulse, 1)
  })

  // Planet labels
  const tmp = new THREE.Vector3()
  const w   = containerRef.value.clientWidth
  const h   = containerRef.value.clientHeight
  const updatedLabels: LabelPos[] = []
  for (const lbl of labelWorldData) {
    const mesh = planetMeshes.get(lbl.id)
    if (!mesh) continue
    tmp.copy(mesh.position)
    tmp.project(cam)
    const sx = (tmp.x * 0.5 + 0.5) * w
    const sy = (-tmp.y * 0.5 + 0.5) * h
    const dist = cam.position.distanceTo(mesh.position)
    const opacity = tmp.z < 1 ? Math.max(0, Math.min(1, (120 - dist) / 40)) : 0
    const r = lbl.baseRadius * mesh.scale.x
    updatedLabels.push({
      id: lbl.id, x: sx, y: sy - r * (h / (dist + 0.01)) - 14,
      opacity, title: lbl.title, color: lbl.color,
      visited: visitedPlanetIds.value.has(lbl.id),
    })
  }
  labelPositions.value = updatedLabels
}

// ── Raycasting ─────────────────────────────────────────────────────────────────
function onMouseMove(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || selectedPlanet.value || navigating.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)

  // Soul sprites take cursor priority
  const soulHits = raycaster.intersectObjects(soulClickables, false)
  const soulHit  = soulHits.find(h => h.object.userData.conceptId && !collectedConceptIds.value.has(h.object.userData.conceptId))
  if (soulHit) { containerRef.value.style.cursor = 'pointer'; return }

  const hits = raycaster.intersectObjects(clickableMeshes, true)
  const hit  = hits.find((h) => h.object.userData.planetId || h.object.parent?.userData.planetId)
  containerRef.value.style.cursor = hit ? 'pointer' : 'grab'
}

function onClick(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || selectedPlanet.value || navigating.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)

  // Soul sprites checked first
  const soulHits = raycaster.intersectObjects(soulClickables, false)
  const soulHit  = soulHits.find(h => h.object.userData.conceptId && !collectedConceptIds.value.has(h.object.userData.conceptId))
  if (soulHit) { collectSoul(soulHit.object.userData.conceptId); return }

  const hits = raycaster.intersectObjects(clickableMeshes, true)
  const hit  = hits.find((h) => h.object.userData.planetId || h.object.parent?.userData.planetId)
  if (!hit) return

  const ud = hit.object.userData.planetId ? hit.object.userData : hit.object.parent!.userData
  flyToPlanet(ud.planetId as string, true)
}

// ── Planet navigation ──────────────────────────────────────────────────────────
function flyToPlanet(planetId: string, openDrawer: boolean) {
  if (!sceneCtx) return
  const mesh = planetMeshes.get(planetId)
  if (!mesh) return

  const target = mesh.position.clone()
  const camDir = sceneCtx.camera.position.clone().sub(target).normalize()
  const dest   = target.clone().addScaledVector(camDir, 16)

  // Scale duration by distance so far planets don't require a fast camera spin
  const travelDist = sceneCtx.camera.position.distanceTo(dest)
  const duration   = Math.max(0.55, Math.min(0.95, travelDist / 22))

  sceneCtx.controls.enabled = false
  const tl = gsap.timeline({
    onUpdate:  () => { sceneCtx!.controls.update() },
    onComplete: () => {
      sceneCtx!.controls.enabled = true
      if (openDrawer) openPlanetById(planetId)
    },
  })
  tl.to(sceneCtx.camera.position, { x: dest.x,    y: dest.y,    z: dest.z,    duration, ease: 'power2.inOut' }, 0)
  tl.to(sceneCtx.controls.target,  { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, 0)
}

function openPlanetById(planetId: string) {
  const planet = meshData.value?.planets[planetId]
  if (!planet) return
  selectedPlanet.value  = planet
  selectedPlanetColor.value = planetHex(planetId)
  const next = new Set([...visitedPlanetIds.value, planetId])
  visitedPlanetIds.value = next
  persistSet('scholarSystem.visitedPlanets', next)
}

function closeDrawer() {
  selectedPlanet.value = null
  if (sceneCtx) {
    sceneCtx.controls.enabled = true
    const tl = gsap.timeline({
      onUpdate: () => { sceneCtx!.controls.update() },
    })
    tl.to(sceneCtx.camera.position, { x: 0, y: 0, z: 85, duration: 0.6, ease: 'power2.inOut' }, 0)
    tl.to(sceneCtx.controls.target,  { x: 0, y: 0, z: 0,  duration: 0.6, ease: 'power2.inOut' }, 0)
  }
}

// ── Concept soul collection ────────────────────────────────────────────────────
function collectSoul(conceptId: string) {
  if (collectedConceptIds.value.has(conceptId)) return
  if (!conceptHudRef.value || !flyingSoulRef.value || !containerRef.value || !sceneCtx) return
  const concept = meshData.value?.concepts[conceptId]
  if (!concept) return

  const color     = conceptHex(conceptId)
  const hudTarget = conceptHudRef.value.getTargetRect()
  if (!hudTarget) return

  // Project sprite world position → screen coords for the fly-out start point
  const sprite = soulMeshes.get(conceptId)
  if (!sprite) return
  const tmp = sprite.position.clone().project(sceneCtx.camera)
  const screenX = (tmp.x * 0.5 + 0.5) * containerRef.value.clientWidth
  const screenY = (-tmp.y * 0.5 + 0.5) * containerRef.value.clientHeight

  const fly    = flyingSoulRef.value
  const pathEl = fly.querySelector('#fly-soul-path') as SVGPathElement
  if (pathEl) pathEl.style.fill = color

  fly.style.display     = 'block'
  fly.style.position    = 'fixed'
  fly.style.width       = '22px'
  fly.style.height      = '26px'
  fly.style.left        = screenX + 'px'
  fly.style.top         = screenY + 'px'
  fly.style.zIndex      = '9999'
  fly.style.pointerEvents = 'none'

  const nextCollected = new Set([...collectedConceptIds.value, conceptId])
  collectedConceptIds.value = nextCollected
  persistSet('scholarSystem.collectedConcepts', nextCollected)

  const destX = hudTarget.left + hudTarget.width  / 2 - 11
  const destY = hudTarget.top  + hudTarget.height / 2 - 13

  gsap.timeline()
    .to(fly, { y: -18, duration: 0.28, ease: 'power2.out' })
    .to(fly, { x: destX - screenX, y: destY - screenY, scale: 0.5, opacity: 0.8, duration: 0.5, ease: 'power2.inOut' })
    .to(fly, {
      opacity: 0, scale: 0.2, duration: 0.15, ease: 'power2.in',
      onComplete: () => {
        fly.style.display = 'none'
        gsap.set(fly, { x: 0, y: 0, scale: 1, opacity: 1 })
        conceptHudRef.value?.collect({ id: conceptId, title: concept.title, color } satisfies CollectedConcept)
      },
    })
}

// ── Story/concept handlers ─────────────────────────────────────────────────────
function onStoryVisitPlanet(planetId: string) { flyToPlanet(planetId, false) }
function onHighlightConcepts(ids: string[])   { highlightedConceptIds.value = ids }
function onNavigateToPlanet(planetId: string) {
  if (!sceneCtx) return
  // Close drawer immediately, zoom out to overview, then fly to new planet
  selectedPlanet.value = null
  sceneCtx.controls.enabled = false
  const tl = gsap.timeline({
    onUpdate:  () => { sceneCtx!.controls.update() },
    onComplete: () => { flyToPlanet(planetId, true) },
  })
  tl.to(sceneCtx.camera.position, { x: 0, y: 0, z: 85, duration: 0.6, ease: 'power2.inOut' }, 0)
  tl.to(sceneCtx.controls.target,  { x: 0, y: 0, z: 0,  duration: 0.6, ease: 'power2.inOut' }, 0)
}
function onOpenConcept(_id: string)           { /* future */ }
function onOpenStory(storyId: string)         { storyReaderRef.value?.openById(storyId) }

// ── Back navigation ────────────────────────────────────────────────────────────
function navigateBack() {
  if (!sceneCtx || navigating.value) return
  navigating.value = true
  sceneCtx.controls.enabled = false
  // Step 1: fade to black (0.35s)
  if (veilRef.value) gsap.to(veilRef.value, {
    opacity: 1, duration: 0.35, ease: 'power1.in',
    onComplete: () => {
      // Step 2: warp 'in' plays on the pure-black screen (stars shoot inward)
      triggerWarp(700, 'in')
      // Step 3: navigate partway through warp so new scene loads while stars are flying
      setTimeout(() => {
        router.push({ name: 'galaxy', params: { id: route.params.id } })
      }, 380)
    },
  })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
const { triggerWarp } = useWarpEffect()

onMounted(() => {
  if (!meshData.value) loadFromFixture(galaxyFixture)
  if (!containerRef.value) return

  const isMobile = window.innerWidth < 768
  sceneCtx = useThreeScene(containerRef.value, {
    bloomStrength:  0.04,
    bloomRadius:    0.2,
    bloomThreshold: 0.35,
    starCount: 1000,
    cameraZ: isMobile ? 130 : 85,
    enableDamping: true,
  })

  // Extra ambient for texture visibility
  // useThreeScene already provides ambient + fill — don't duplicate them

  raycaster    = new THREE.Raycaster()
  occlusionRay = new THREE.Raycaster()
  mouse        = new THREE.Vector2()

  // Hook per-frame into render loop
  const originalRender = sceneCtx.composer.render.bind(sceneCtx.composer)
  sceneCtx.composer.render = function () {
    onFrame(sceneCtx!.clock.getElapsedTime())
    originalRender()
  }

  // Preload planet textures, then build scene (veil stays black during load as a natural cover)
  preloadPlanetTextures(() => {
    buildScene()

    // Restore collected souls into the HUD from persisted store
    nextTick(() => {
      for (const conceptId of collectedConceptIds.value) {
        const concept = meshData.value?.concepts[conceptId]
        if (!concept) continue
        conceptHudRef.value?.collect({
          id: conceptId,
          title: concept.title,
          color: conceptHex(conceptId),
        })
      }
    })

    // Arrival: fade the veil out — warp already played during departure from GalaxyView
    if (veilRef.value) gsap.fromTo(veilRef.value, { opacity: 1 }, { opacity: 0, duration: 0.5, delay: 0.15, ease: 'power1.out' })
  })

  if (!isMobile) containerRef.value.addEventListener('mousemove', onMouseMove)
  containerRef.value.addEventListener('click', onClick)
})

onUnmounted(() => {
  containerRef.value?.removeEventListener('mousemove', onMouseMove)
  containerRef.value?.removeEventListener('click', onClick)
  sceneCtx?.dispose()
})
</script>

<style scoped>
.solar-view {
  position: fixed; inset: 0;
  background: #02040a; overflow: hidden; cursor: grab;
}
.solar-view:active { cursor: grabbing; }

.nav-veil {
  position: absolute; inset: 0; z-index: 50;
  background: #02040a; opacity: 0; pointer-events: none;
}

.back-btn {
  position: absolute; top: 24px; left: 72px; z-index: 20;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px 8px 12px;
  background: rgba(5,8,20,0.6); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 100px;
  font-size: 12px; font-weight: 500; color: #8a9ab8; cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  backdrop-filter: blur(12px);
}
.back-btn:hover {
  color: rgba(255,255,255,0.85); border-color: rgba(255,255,255,0.15);
  background: rgba(10,14,30,0.8);
}

.system-hud {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  text-align: center; pointer-events: none; z-index: 10;
}
.system-name { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.88); letter-spacing: 0.03em; }
.system-meta { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 3px; }

/* Planet labels */
.planet-label {
  position: absolute;
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 500;
  color: rgba(255,255,255,0.7);
  pointer-events: none; transform: translateX(-50%);
  white-space: nowrap; letter-spacing: 0.03em;
  text-shadow: 0 0 8px rgba(0,0,0,0.85);
  z-index: 15;
}
.planet-dot {
  width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
  border: 1px solid rgba(160,160,180,0.45);
  background: transparent;
  transition: background 0.3s, border-color 0.3s;
}
.planet-dot.visited {
  background: #5ba8ff;
  border-color: #5ba8ff;
}

/* Flying soul */
.flying-soul {
  position: fixed; pointer-events: none; z-index: 9999;
}
.flying-soul svg { width: 100%; height: 100%; filter: drop-shadow(0 0 8px white); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.35s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
