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

    <!-- HTML concept soul overlays -->
    <div
      v-for="soul in soulPositions"
      :key="soul.id"
      class="soul-overlay"
      :style="{
        left: soul.x + 'px',
        top: soul.y + 'px',
        opacity: soul.opacity,
        '--soul-color': soul.color,
        pointerEvents: soul.occluded ? 'none' : 'auto',
      }"
      :class="{ highlighted: soul.highlighted }"
      @click.stop="collectSoul(soul.id, $event)"
    >
      <svg class="soul-svg" viewBox="0 0 24 28" fill="none">
        <path
          d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
          fill="var(--soul-color)"
          fill-opacity="0.85"
        />
        <circle cx="9.5" cy="11" r="1.3" fill="rgba(0,0,0,0.4)"/>
        <circle cx="14.5" cy="11" r="1.3" fill="rgba(0,0,0,0.4)"/>
      </svg>
    </div>

    <!-- HTML planet label overlays -->
    <template v-if="!selectedPlanet">
      <div
        v-for="lbl in labelPositions"
        :key="lbl.id"
        class="planet-label"
        :style="{ left: lbl.x + 'px', top: lbl.y + 'px', opacity: lbl.opacity, '--lc': lbl.color }"
      >
        {{ lbl.title }}
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const { data: meshData, loadFromFixture } = useMeshStore()

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
const collectedConceptIds   = ref<Set<string>>(new Set())

// ── Overlay types ─────────────────────────────────────────────────────────────
interface SoulPos  { id: string; x: number; y: number; opacity: number; color: string; highlighted: boolean; occluded: boolean }
interface LabelPos { id: string; x: number; y: number; opacity: number; title: string; color: string }
const soulPositions  = ref<SoulPos[]>([])
const labelPositions = ref<LabelPos[]>([])

// Per-frame world anchors
const soulWorldData:  Array<{ id: string; pos: THREE.Vector3; color: string }> = []
const labelWorldData: Array<{ id: string; pos: THREE.Vector3; title: string; color: string; baseRadius: number }> = []

// ── Three.js state ─────────────────────────────────────────────────────────────
let sceneCtx: ReturnType<typeof useThreeScene> | null = null
let raycaster: THREE.Raycaster
let occlusionRay: THREE.Raycaster
let mouse: THREE.Vector2
const planetMeshes = new Map<string, THREE.Mesh>()
let clickableMeshes: THREE.Mesh[] = []
let occlusionMeshes: THREE.Mesh[] = []  // planets + sun for occlusion testing

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

// ── Build solar system scene ───────────────────────────────────────────────────
function buildScene() {
  if (!sceneCtx || !meshData.value || !solarSystem.value) return
  const { scene } = sceneCtx
  const sys = solarSystem.value
  const data = meshData.value

  planetMeshes.clear()
  clickableMeshes  = []
  occlusionMeshes  = []
  soulWorldData.splice(0)
  labelWorldData.splice(0)

  // ── Central sun ───────────────────────────────────────────────────────────
  const rng = seededRng(sys.id)
  const sunHex = PLANET_COLORS[Math.floor(rng() * PLANET_COLORS.length)]
  const sunColor = new THREE.Color(sunHex)

  const sunGeo = new THREE.SphereGeometry(6.5, 40, 40)
  const sunMat = new THREE.MeshStandardMaterial({
    color: sunColor, emissive: sunColor, emissiveIntensity: 0.6,
    roughness: 0.05, metalness: 0,
  })
  const sun = new THREE.Mesh(sunGeo, sunMat)
  sun.userData = { clearable: true }
  scene.add(sun)
  occlusionMeshes.push(sun)

  // Sun glow layers
  for (let i = 1; i <= 3; i++) {
    const glowGeo = new THREE.SphereGeometry(6.5 + i * 3.5, 28, 28)
    const glowMat = new THREE.MeshBasicMaterial({
      color: sunColor, transparent: true, opacity: 0.035 / i,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const g = new THREE.Mesh(glowGeo, glowMat)
    g.userData = { clearable: true }
    scene.add(g)
  }

  // Sun point light
  const sunLight = new THREE.PointLight(sunColor, 2.2, 220)
  sunLight.userData = { clearable: true }
  scene.add(sunLight)

  // ── Planets ───────────────────────────────────────────────────────────────
  const planets = sys.planets
    .map((id) => data.planets[id])
    .filter(Boolean)

  const baseR = 28, radStep = 10
  const dirs = fibSphere(planets.length)

  planets.forEach((planet, i) => {
    const hex    = planetHex(planet.id)
    const color  = new THREE.Color(hex)
    const r      = planetRadius(planet.id)
    const rngP   = seededRng(planet.id + 'dist')
    const jitter = (rngP() - 0.5) * 8
    const dist   = baseR + (i % 4) * radStep + jitter
    const pos    = dirs[i].clone().multiplyScalar(dist)

    const tex = makePlanetTexture(planet.id, hex)
    const geo = new THREE.SphereGeometry(r, 32, 32)
    const mat = new THREE.MeshStandardMaterial({
      map: tex, color, emissive: color, emissiveIntensity: 0.12,
      roughness: 0.65, metalness: 0,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.userData = { clearable: true, planetId: planet.id, title: planet.title, baseRadius: r }

    // Glow
    const glowGeo = new THREE.SphereGeometry(r * 1.6, 18, 18)
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.045,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    mesh.add(new THREE.Mesh(glowGeo, glowMat))

    // Faint radial line to sun
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), pos])
    const lineMat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.04,
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

  // ── Concepts (soul anchor positions) ─────────────────────────────────────
  const concepts = sys.concepts
    .map((id) => data.concepts[id])
    .filter(Boolean)

  const conceptDirs = fibSphere(Math.max(concepts.length, 2))
  concepts.forEach((concept, i) => {
    const hex  = conceptHex(concept.id)
    const rngC = seededRng(concept.id + 'dist')
    const dist = 18 + rngC() * 20 // float between inner and outer belt
    const pos  = conceptDirs[i % conceptDirs.length].clone().multiplyScalar(dist)
    soulWorldData.push({ id: concept.id, pos, color: hex })
  })
}

// ── Per-frame ─────────────────────────────────────────────────────────────────
function onFrame(_elapsed: number) {
  // Planet self-rotation
  planetMeshes.forEach((mesh) => {
    mesh.rotation.y += 0.003
    mesh.rotation.x += 0.0006
  })

  // Overlay projection
  if (!sceneCtx || !containerRef.value) return
  const cam = sceneCtx.camera
  const w   = containerRef.value.clientWidth
  const h   = containerRef.value.clientHeight
  const tmp = new THREE.Vector3()

  // Souls
  const updatedSouls: SoulPos[] = []
  const _dir = new THREE.Vector3()
  for (const s of soulWorldData) {
    if (collectedConceptIds.value.has(s.id)) continue
    tmp.copy(s.pos)
    tmp.project(cam)
    const sx = (tmp.x * 0.5 + 0.5) * w
    const sy = (-tmp.y * 0.5 + 0.5) * h
    const dist = cam.position.distanceTo(s.pos)
    const baseOpacity = tmp.z < 1 ? Math.max(0, Math.min(0.9, (180 - dist) / 50)) : 0

    // Occlusion: cast a ray from camera toward the soul — dim it if a planet/sun is in the way
    let occluded = false
    if (baseOpacity > 0 && occlusionMeshes.length > 0) {
      _dir.subVectors(s.pos, cam.position).normalize()
      occlusionRay.set(cam.position, _dir)
      occlusionRay.far = dist - 0.5
      occluded = occlusionRay.intersectObjects(occlusionMeshes, false).length > 0
    }

    updatedSouls.push({
      id: s.id, x: sx - 10, y: sy - 14,
      opacity: occluded ? baseOpacity * 0.15 : baseOpacity,
      color: s.color,
      highlighted: highlightedConceptIds.value.includes(s.id),
      occluded,
    })
  }
  soulPositions.value = updatedSouls

  // Planet labels
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
  const hits = raycaster.intersectObjects(clickableMeshes, true)
  const hit  = hits.find((h) => h.object.userData.planetId || h.object.parent?.userData.planetId)
  if (!hit) return

  const ud = hit.object.userData.planetId ? hit.object.userData : hit.object.parent!.userData
  const planetId = ud.planetId as string

  flyToPlanet(planetId, true)
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
function collectSoul(conceptId: string, event: MouseEvent) {
  if (collectedConceptIds.value.has(conceptId)) return
  if (!conceptHudRef.value || !flyingSoulRef.value || !containerRef.value) return
  const concept = meshData.value?.concepts[conceptId]
  if (!concept) return

  const color = conceptHex(conceptId)
  const hudTarget = conceptHudRef.value.getTargetRect()
  if (!hudTarget) return

  const soulEl   = event.currentTarget as HTMLElement
  const soulRect = soulEl.getBoundingClientRect()

  const fly = flyingSoulRef.value
  const pathEl = fly.querySelector('#fly-soul-path') as SVGPathElement
  if (pathEl) pathEl.style.fill = color

  fly.style.display = 'block'
  fly.style.position = 'fixed'
  fly.style.width  = '22px'
  fly.style.height = '26px'
  fly.style.left   = soulRect.left + 'px'
  fly.style.top    = soulRect.top  + 'px'
  fly.style.zIndex = '9999'
  fly.style.pointerEvents = 'none'

  collectedConceptIds.value = new Set([...collectedConceptIds.value, conceptId])

  const destX = hudTarget.left + hudTarget.width  / 2 - 11
  const destY = hudTarget.top  + hudTarget.height / 2 - 13

  gsap.timeline()
    .to(fly, { y: -18, duration: 0.28, ease: 'power2.out' })
    .to(fly, { x: destX - soulRect.left, y: destY - soulRect.top, scale: 0.5, opacity: 0.8, duration: 0.5, ease: 'power2.inOut' })
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
    bloomStrength:  0.35,
    bloomRadius:    0.4,
    bloomThreshold: 0.07,
    starCount: 1000,
    cameraZ: isMobile ? 130 : 85,
    enableDamping: true,
  })

  // Extra ambient for texture visibility
  sceneCtx.scene.add(new THREE.AmbientLight(0x2a3a5a, 3.5))

  raycaster    = new THREE.Raycaster()
  occlusionRay = new THREE.Raycaster()
  mouse        = new THREE.Vector2()

  // Hook per-frame into render loop
  const originalRender = sceneCtx.composer.render.bind(sceneCtx.composer)
  sceneCtx.composer.render = function () {
    onFrame(sceneCtx!.clock.getElapsedTime())
    originalRender()
  }

  buildScene()

  // Arrival: just fade the veil out — warp already played during departure from GalaxyView
  if (veilRef.value) gsap.fromTo(veilRef.value, { opacity: 1 }, { opacity: 0, duration: 0.5, delay: 0.15, ease: 'power1.out' })

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

/* Soul overlays */
.soul-overlay {
  position: absolute; width: 20px; height: 24px;
  cursor: pointer; pointer-events: auto; transform-origin: bottom center;
  animation: soul-bob 3.2s ease-in-out infinite;
  filter: drop-shadow(0 0 5px var(--soul-color));
  z-index: 20; transition: filter 0.3s;
}
.soul-overlay:nth-child(2n) { animation-delay: -1.3s; }
.soul-overlay:nth-child(3n) { animation-delay: -2.5s; }
.soul-overlay.highlighted {
  filter: drop-shadow(0 0 10px var(--soul-color)) drop-shadow(0 0 18px var(--soul-color));
  animation-duration: 1.5s;
}
.soul-svg { width: 100%; height: 100%; }
@keyframes soul-bob {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-5px) rotate(2deg); }
}

/* Planet labels */
.planet-label {
  position: absolute;
  font-size: 10px; font-weight: 500;
  color: rgba(255,255,255,0.7);
  pointer-events: none; transform: translateX(-50%);
  white-space: nowrap; letter-spacing: 0.03em;
  text-shadow: 0 0 8px rgba(0,0,0,0.85);
  z-index: 15;
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
