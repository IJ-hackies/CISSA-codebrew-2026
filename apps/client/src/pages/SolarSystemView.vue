<template>
  <div class="solar-view" ref="containerRef">
    <!-- Back button -->
    <button class="back-btn" @click="navigateBack">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Galaxy
    </button>

    <!-- Cluster title -->
    <Transition name="fade">
      <div v-if="cluster && !selectedEntry" class="system-hud">
        <div class="system-name">{{ cluster.title }}</div>
        <div class="system-brief">{{ cluster.brief }}</div>
      </div>
    </Transition>

    <!-- Entry count -->
    <Transition name="fade">
      <div v-if="cluster && !selectedEntry" class="entry-count">
        {{ systemEntries.length }} bodies
      </div>
    </Transition>

    <!-- HTML overlay labels for entry nodes -->
    <template v-if="!selectedEntry">
      <div
        v-for="lbl in labelPositions"
        :key="lbl.id"
        class="node-label"
        :style="{
          left: lbl.x + 'px',
          top:  lbl.y + 'px',
          opacity: lbl.opacity,
          color: lbl.color,
          '--lc': lbl.color,
        }"
      >
        <div class="lbl-top-row">
          <span class="lbl-kind">{{ lbl.kind }}</span>
          <span class="visited-dot" :class="{ 'is-visited': lbl.visited }" :style="{ '--lc': lbl.color }" />
        </div>
        <span class="lbl-title">{{ lbl.title }}</span>
      </div>
    </template>

    <!-- Hover tooltip -->
    <div
      v-if="hovered && !selectedEntry"
      class="node-tooltip"
      :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
    >
      <span class="tooltip-brief">{{ hovered.brief }}</span>
    </div>

    <!-- Wrap Card overlay -->
    <WrapCard
      v-if="selectedEntry"
      :wrap="selectedWrap"
      :entry="selectedEntry"
      :allWraps="galaxy?.wraps ?? {}"
      :allEntries="galaxy?.knowledge?.entries ?? []"
      @close="closeWrap"
    />

    <!-- Nav veil -->
    <div class="nav-veil" ref="veilRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as THREE from 'three'
import gsap from 'gsap'
import { useThreeScene } from '@/composables/useThreeScene'
import { useWarpEffect } from '@/composables/useWarpEffect'
import { useGalaxyStore } from '@/lib/galaxyStore'
import { MOCK_GALAXY } from '@/lib/mockGalaxy'
import type { Entry, EntryWrap, ClusterWrap } from '@/lib/galaxyTypes'
import WrapCard from '@/components/WrapCard.vue'

const route  = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy, setGalaxy } = useGalaxyStore()

const containerRef = ref<HTMLDivElement>()
const veilRef      = ref<HTMLDivElement>()
const { triggerWarp }  = useWarpEffect()
const navigating       = ref(false)
const hovered      = ref<{ brief: string } | null>(null)
const tooltipPos   = ref({ x: 0, y: 0 })
const selectedEntry = ref<Entry | null>(null)
const selectedWrap  = ref<EntryWrap | null>(null)

interface LabelPos { id: string; x: number; y: number; opacity: number; title: string; color: string; kind: string; visited: boolean }
const labelPositions = ref<LabelPos[]>([])
const labelWorldData: Array<{ id: string; mesh: THREE.Mesh; title: string; color: string; kind: string; baseRadius: number }> = []

const clusterId = computed(() => route.params.clusterId as string)

const cluster = computed(() =>
  galaxy.value?.knowledge?.clusters.find((c) => c.id === clusterId.value),
)

const systemEntries = computed(() => {
  if (!galaxy.value?.knowledge || !clusterId.value) return []
  const { groups, entries } = galaxy.value.knowledge
  const clusterGroupIds = new Set(
    groups.filter((g) => g.clusterId === clusterId.value).map((g) => g.id),
  )
  return entries.filter((e) => e.groupId !== null && clusterGroupIds.has(e.groupId!))
})

// ── Three.js ──────────────────────────────────────────────────────────────────
let sceneCtx: ReturnType<typeof useThreeScene> | null = null
let raycaster:      THREE.Raycaster
let mouse:          THREE.Vector2
let clickableMeshes: THREE.Mesh[] = []
const entryMeshMap = new Map<string, THREE.Mesh>()

// ── Procedural texture generator ──────────────────────────────────────────────
function makeProceduralTexture(kind: string, hexColor: string): THREE.CanvasTexture {
  const S   = 256
  const cv  = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const c   = new THREE.Color(hexColor)
  const ri = Math.round(c.r * 255)
  const gi = Math.round(c.g * 255)
  const bi = Math.round(c.b * 255)
  const base  = `rgb(${ri},${gi},${bi})`
  const dark  = `rgb(${Math.round(ri*0.35)},${Math.round(gi*0.35)},${Math.round(bi*0.35)})`
  const light = `rgb(${Math.min(255,Math.round(ri*1.7))},${Math.min(255,Math.round(gi*1.7))},${Math.min(255,Math.round(bi*1.7))})`
  // Seeded-ish random using kind + color as seed
  let seed = kind.charCodeAt(0) * 37 + ri + gi * 3 + bi * 7
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff }

  switch (kind) {
    case 'moment': {
      // Moon — mottled grey with craters
      const bg = ctx.createRadialGradient(S*0.4, S*0.35, S*0.05, S/2, S/2, S/2)
      bg.addColorStop(0, light); bg.addColorStop(0.6, base); bg.addColorStop(1, dark)
      ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 14; i++) {
        const cx = rng()*S, cy = rng()*S, cr = 4 + rng()*18
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.round(ri*0.25)},${Math.round(gi*0.25)},${Math.round(bi*0.25)},0.55)`; ctx.fill()
        ctx.beginPath(); ctx.arc(cx-cr*0.18, cy-cr*0.18, cr*0.7, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.min(255,ri+60)},${Math.min(255,gi+60)},${Math.min(255,bi+60)},0.2)`; ctx.fill()
      }
      break
    }
    case 'person': {
      // Planet — horizontal atmospheric bands
      const grad = ctx.createLinearGradient(0, 0, 0, S)
      grad.addColorStop(0, light); grad.addColorStop(0.18, base)
      grad.addColorStop(0.5, dark); grad.addColorStop(0.82, base); grad.addColorStop(1, light)
      ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 7; i++) {
        const y = rng()*S, bh = 6 + rng()*22
        ctx.fillStyle = i%2===0 ? `rgba(${Math.round(ri*0.3)},${Math.round(gi*0.3)},${Math.round(bi*0.3)},0.45)` : `rgba(${Math.min(255,ri+50)},${Math.min(255,gi+50)},${Math.min(255,bi+50)},0.25)`
        ctx.fillRect(0, y, S, bh)
      }
      // Polar shimmer
      ctx.fillStyle = `rgba(255,255,255,0.12)`; ctx.fillRect(0, 0, S, 18)
      ctx.fillRect(0, S-18, S, 18)
      break
    }
    case 'place': {
      // Planet — ocean + continent patches
      ctx.fillStyle = dark; ctx.fillRect(0, 0, S, S)
      // Slight ocean depth gradient
      const og = ctx.createRadialGradient(S/2, S/2, S*0.1, S/2, S/2, S*0.6)
      og.addColorStop(0, `rgba(${Math.min(255,ri+30)},${Math.min(255,gi+30)},${Math.min(255,bi+60)},0.3)`)
      og.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = og; ctx.fillRect(0, 0, S, S)
      // Continents
      for (let i = 0; i < 4; i++) {
        const cx = 20 + rng()*(S-40), cy = 20 + rng()*(S-40)
        const w = 30 + rng()*70, h = 20 + rng()*55
        ctx.beginPath()
        ctx.ellipse(cx, cy, w/2, h/2, rng()*Math.PI, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.min(255,ri+25)},${Math.min(255,gi+35)},${Math.round(bi*0.7)},0.75)`; ctx.fill()
      }
      break
    }
    case 'theme': {
      // Star — bright radiant corona
      const rg = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2)
      rg.addColorStop(0, 'white')
      rg.addColorStop(0.15, light)
      rg.addColorStop(0.45, base)
      rg.addColorStop(0.8, `rgba(${ri},${gi},${bi},0.35)`)
      rg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rg; ctx.fillRect(0, 0, S, S)
      // Corona spikes
      ctx.save(); ctx.translate(S/2, S/2)
      for (let i = 0; i < 10; i++) {
        ctx.rotate(Math.PI/5)
        ctx.beginPath(); ctx.moveTo(0, 0)
        ctx.lineTo(S*0.45, S*0.04); ctx.lineTo(S*0.52, 0); ctx.lineTo(S*0.45, -S*0.04)
        ctx.closePath(); ctx.fillStyle = `rgba(255,255,255,0.18)`; ctx.fill()
      }
      ctx.restore()
      break
    }
    case 'artifact': {
      // Comet — dark rocky surface
      ctx.fillStyle = dark; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 22; i++) {
        const cx = rng()*S, cy = rng()*S, cr = 3 + rng()*14
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2)
        ctx.fillStyle = i%4===0 ? `rgba(${Math.min(255,ri+80)},${Math.min(255,gi+80)},${Math.min(255,bi+80)},0.35)` : `rgba(${Math.round(ri*0.6)},${Math.round(gi*0.6)},${Math.round(bi*0.6)},0.4)`
        ctx.fill()
      }
      // Highlight edge
      const hg = ctx.createRadialGradient(S*0.3, S*0.3, 0, S/2, S/2, S/2)
      hg.addColorStop(0, `rgba(${Math.min(255,ri+60)},${Math.min(255,gi+60)},${Math.min(255,bi+60)},0.3)`)
      hg.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = hg; ctx.fillRect(0, 0, S, S)
      break
    }
    case 'milestone': {
      // Large moon — bright cratered silver
      const mg = ctx.createRadialGradient(S*0.38, S*0.35, S*0.05, S/2, S/2, S*0.52)
      mg.addColorStop(0, 'white'); mg.addColorStop(0.4, light); mg.addColorStop(0.85, base); mg.addColorStop(1, dark)
      ctx.fillStyle = mg; ctx.fillRect(0, 0, S, S)
      // Prominent impact rings
      for (let i = 0; i < 5; i++) {
        const cx = 35 + rng()*(S-70), cy = 35 + rng()*(S-70), cr = 14 + rng()*28
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${Math.round(ri*0.25)},${Math.round(gi*0.25)},${Math.round(bi*0.25)},0.7)`;
        ctx.lineWidth = 1.5; ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, cr*0.42, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${Math.round(ri*0.3)},${Math.round(gi*0.3)},${Math.round(bi*0.3)},0.55)`; ctx.fill()
      }
      break
    }
    case 'period': {
      // Ringed planet — atmospheric cloud bands
      const pg = ctx.createLinearGradient(0, 0, 0, S)
      pg.addColorStop(0, light); pg.addColorStop(0.28, `rgba(${Math.min(255,ri+40)},${Math.min(255,gi+40)},${Math.min(255,bi+40)},1)`)
      pg.addColorStop(0.6, base); pg.addColorStop(1, dark)
      ctx.fillStyle = pg; ctx.fillRect(0, 0, S, S)
      for (let i = 0; i < 9; i++) {
        const y = (i/9)*S + rng()*8
        ctx.fillStyle = i%2===0 ? `rgba(255,255,255,0.07)` : `rgba(0,0,0,0.12)`
        ctx.fillRect(0, y, S, S/10)
      }
      break
    }
    default: {
      ctx.fillStyle = base; ctx.fillRect(0, 0, S, S)
    }
  }
  return new THREE.CanvasTexture(cv)
}

// ── Entry kind → mesh ─────────────────────────────────────────────────────────
function getMeshForKind(kind: string, color: THREE.Color, hexColor: string): { mesh: THREE.Mesh; baseRadius: number } {
  const tex = makeProceduralTexture(kind, hexColor)
  // Low emissive — let the sun light do the work
  switch (kind) {
    case 'person': case 'place': {
      // Gas giant — moderate warm glow
      const r = 3.8, geo = new THREE.SphereGeometry(r, 36, 36)
      const mat = new THREE.MeshStandardMaterial({ map: tex, color, emissive: color, emissiveIntensity: 0.10, roughness: 0.75, metalness: 0 })
      return { mesh: new THREE.Mesh(geo, mat), baseRadius: r }
    }
    case 'theme': {
      // Sub-star — brightest entry kind
      const r = 3.2, geo = new THREE.IcosahedronGeometry(r, 2)
      const mat = new THREE.MeshStandardMaterial({ map: tex, color, emissive: color, emissiveIntensity: 0.24, roughness: 0.05, metalness: 0 })
      return { mesh: new THREE.Mesh(geo, mat), baseRadius: r }
    }
    case 'artifact': {
      // Rocky asteroid — very dim, no bloom
      const r = 2.2, geo = new THREE.SphereGeometry(r, 18, 12)
      const mat = new THREE.MeshStandardMaterial({ map: tex, color, emissive: color, emissiveIntensity: 0.05, roughness: 0.9, metalness: 0.15 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.scale.set(1.6, 0.7, 0.75)
      return { mesh, baseRadius: r }
    }
    case 'milestone': {
      // Glowing milestone — second brightest
      const r = 3.4, geo = new THREE.SphereGeometry(r, 32, 32)
      const mat = new THREE.MeshStandardMaterial({ map: tex, color, emissive: color, emissiveIntensity: 0.19, roughness: 0.3, metalness: 0.08 })
      return { mesh: new THREE.Mesh(geo, mat), baseRadius: r }
    }
    case 'period': {
      // Ringed planet — medium glow
      const r = 3.2, geo = new THREE.SphereGeometry(r, 32, 32)
      const mat = new THREE.MeshStandardMaterial({ map: tex, color, emissive: color, emissiveIntensity: 0.13, roughness: 0.72, metalness: 0 })
      const mesh = new THREE.Mesh(geo, mat)
      const ringGeo = new THREE.TorusGeometry(5.4, 0.32, 8, 48)
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2.2
      mesh.add(ring)
      return { mesh, baseRadius: r }
    }
    default: {
      // moment — small dim moon
      const r = 2.3, geo = new THREE.SphereGeometry(r, 28, 28)
      const mat = new THREE.MeshStandardMaterial({ map: tex, color, emissive: color, emissiveIntensity: 0.08, roughness: 0.65, metalness: 0 })
      return { mesh: new THREE.Mesh(geo, mat), baseRadius: r }
    }
  }
}

// Fibonacci sphere — even distribution
function fibonacciSphere(count: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const phi = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = phi * i
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
  }
  return pts
}

function buildSolarSystem() {
  if (!sceneCtx || !galaxy.value?.knowledge) return
  const { scene } = sceneCtx
  const entries     = systemEntries.value
  const wraps       = galaxy.value.wraps
  const clusterWrap = wraps[clusterId.value] as ClusterWrap | undefined

  clickableMeshes = []
  entryMeshMap.clear()
  labelWorldData.splice(0)
  scene.children.filter((c) => c.userData.clearable).forEach((c) => scene.remove(c))

  // ── Central sun ───────────────────────────────────────────────────────────
  const sunColor = new THREE.Color(clusterWrap?.color ?? '#f8c97c')
  const sunTex   = makeProceduralTexture('theme', clusterWrap?.color ?? '#f8c97c')
  const sunGeo   = new THREE.SphereGeometry(7.5, 40, 40)
  const sunMat   = new THREE.MeshStandardMaterial({
    map: sunTex, color: sunColor,
    emissive: sunColor, emissiveIntensity: 0.48,
    roughness: 0.05, metalness: 0,
  })
  const sun = new THREE.Mesh(sunGeo, sunMat)
  sun.userData = { clearable: true }
  scene.add(sun)

  // Sun glow shells (reduced, more atmospheric)
  for (let i = 1; i <= 2; i++) {
    const glowGeo = new THREE.SphereGeometry(7.5 + i * 3, 28, 28)
    const glowMat = new THREE.MeshBasicMaterial({
      color: sunColor, transparent: true, opacity: 0.04 / i,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    scene.add(Object.assign(new THREE.Mesh(glowGeo, glowMat), { userData: { clearable: true } }))
  }

  // Sun light — primary illumination for entries
  const sunLight = new THREE.PointLight(sunColor, 2.0, 200)
  sunLight.userData = { clearable: true }
  scene.add(sunLight)

  if (entries.length === 0) return

  const groupOrder  = galaxy.value.knowledge.groups
    .filter((g) => g.clusterId === clusterId.value)
    .map((g, i) => ({ id: g.id, rank: i }))
  const groupRankMap = new Map(groupOrder.map((g) => [g.id, g.rank]))

  const baseR = 30, radStep = 13
  const sorted = [...entries].sort((a, b) =>
    (groupRankMap.get(a.groupId ?? '') ?? 0) - (groupRankMap.get(b.groupId ?? '') ?? 0),
  )
  const dirs = fibonacciSphere(sorted.length)

  sorted.forEach((entry, i) => {
    const wrap     = wraps[entry.id]
    const hexColor = wrap?.color ?? '#7c9ef8'
    const color    = new THREE.Color(hexColor)
    const groupRank = groupRankMap.get(entry.groupId ?? '') ?? 0
    // Vary distance: inner groups closer, outer groups farther, plus jitter
    const seededJitter = ((entry.id.charCodeAt(0) * 17 + entry.id.charCodeAt(2) * 31) % 100) / 100 - 0.5
    const dist = baseR + groupRank * radStep + seededJitter * 7
    const pos  = dirs[i].clone().multiplyScalar(dist)

    const { mesh, baseRadius } = getMeshForKind(entry.kind, color, hexColor)
    mesh.position.copy(pos)
    mesh.userData = { clearable: true, entryId: entry.id, title: entry.title, brief: entry.brief, kind: entry.kind, baseRadius }

    // Subtle atmospheric glow (size varies by kind)
    const glowR = baseRadius * 1.5
    const glowGeo = new THREE.SphereGeometry(glowR, 18, 18)
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.045,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    mesh.add(new THREE.Mesh(glowGeo, glowMat))

    scene.add(mesh)
    clickableMeshes.push(mesh)
    entryMeshMap.set(entry.id, mesh)
    labelWorldData.push({ id: entry.id, mesh, title: entry.title, color: hexColor, kind: entry.kind, baseRadius })

    // Faint radial connection line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), pos])
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(hexColor), transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    scene.add(Object.assign(new THREE.Line(lineGeo, lineMat), { userData: { clearable: true } }))
  })
}

// ── Per-frame animation ───────────────────────────────────────────────────────
function onFrame(_elapsed: number) {
  // Self-rotation per entry (kind-based speeds)
  entryMeshMap.forEach((mesh) => {
    mesh.rotation.y += 0.004
    mesh.rotation.x += 0.0008
  })

  // HTML label projection
  if (!sceneCtx || !containerRef.value || labelWorldData.length === 0) return
  const cam = sceneCtx.camera
  const w   = containerRef.value.clientWidth
  const h   = containerRef.value.clientHeight
  const tmp = new THREE.Vector3()

  const updated: LabelPos[] = []
  for (const lbl of labelWorldData) {
    tmp.copy(lbl.mesh.position)
    tmp.project(cam)
    if (tmp.z >= 1) continue  // behind camera
    const sx = (tmp.x * 0.5 + 0.5) * w
    const sy = (-tmp.y * 0.5 + 0.5) * h
    const dist = cam.position.distanceTo(lbl.mesh.position)
    const opacity = Math.max(0, Math.min(1, (180 - dist) / 60))
    // Offset label above the body — approximate screen-space radius
    const screenOffset = Math.max(14, (lbl.baseRadius * h) / (dist + 0.1) * 0.35)
    const visited = !!(galaxy.value?.exploration.visited[lbl.id])
    updated.push({ id: lbl.id, x: sx, y: sy - screenOffset - 8, opacity, title: lbl.title, color: lbl.color, kind: lbl.kind, visited })
  }
  labelPositions.value = updated

}

// ── Raycasting ────────────────────────────────────────────────────────────────
function onMouseMove(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || selectedEntry.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)
  const hits = raycaster.intersectObjects(clickableMeshes, true)
  const hit  = hits.find((h) => h.object.userData.entryId || h.object.parent?.userData.entryId)
  if (hit) {
    const ud = hit.object.userData.entryId ? hit.object.userData : hit.object.parent!.userData
    hovered.value = { brief: ud.brief }
    tooltipPos.value = { x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 8 }
    containerRef.value.style.cursor = 'pointer'
  } else {
    hovered.value = null
    containerRef.value.style.cursor = 'grab'
  }
}

function onClick(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || selectedEntry.value || navigating.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)
  const hits = raycaster.intersectObjects(clickableMeshes, true)
  const hit  = hits.find((h) => h.object.userData.entryId || h.object.parent?.userData.entryId)
  if (!hit) return

  const ud    = hit.object.userData.entryId ? hit.object.userData : hit.object.parent!.userData
  const entry = galaxy.value?.knowledge?.entries.find((e) => e.id === ud.entryId)
  const wrap  = galaxy.value?.wraps[ud.entryId]
  if (!entry || !wrap || wrap.level !== 'entry') return

  const target = (hit.object.userData.entryId ? hit.object : hit.object.parent!).position.clone()
  const camDir = sceneCtx.camera.position.clone().sub(target).normalize()
  const dest   = target.clone().addScaledVector(camDir, 16)

  sceneCtx.controls.enabled = false
  const tl = gsap.timeline({ onComplete: () => {
    // Mark as visited
    if (galaxy.value?.exploration) galaxy.value.exploration.visited[entry.id] = true
    selectedEntry.value = entry
    selectedWrap.value  = wrap as EntryWrap
  }})
  tl.to(sceneCtx.camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.6, ease: 'power2.inOut',
    onUpdate: () => { sceneCtx!.controls.update() } }, 0)
  tl.to(sceneCtx.controls.target, { x: target.x, y: target.y, z: target.z, duration: 0.6, ease: 'power2.inOut' }, 0)
}

function closeWrap() {
  selectedEntry.value = null
  selectedWrap.value  = null
  if (sceneCtx) {
    sceneCtx.controls.enabled = true
    const tl = gsap.timeline()
    tl.to(sceneCtx.camera.position, { x: 0, y: 0, z: 85, duration: 0.65, ease: 'power2.inOut',
      onUpdate: () => { sceneCtx!.controls.update() } }, 0)
    tl.to(sceneCtx.controls.target, { x: 0, y: 0, z: 0, duration: 0.65, ease: 'power2.inOut' }, 0)
  }
}

function navigateBack() {
  if (!sceneCtx || navigating.value) return
  navigating.value = true
  sceneCtx.controls.enabled = false
  triggerWarp(700, 'in')   // stars converge inward — pulling back to galaxy
  // Fade veil to black while zooming out — no blank flash
  if (veilRef.value) gsap.to(veilRef.value, { opacity: 1, duration: 0.35, ease: 'power1.in' })
  gsap.to(sceneCtx.camera.position, {
    x: 0, y: 0, z: 260, duration: 0.7, ease: 'power2.in',
    onUpdate: () => { sceneCtx!.controls.update() },
    onComplete: () => { router.push({ name: 'galaxy', params: { id: route.params.id } }) },
  })
}

// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!containerRef.value) return

  const id = route.params.id as string
  if (!galaxy.value || galaxy.value.meta.id !== id) {
    try { await loadGalaxy(id) } catch { setGalaxy(MOCK_GALAXY) }
  }

  const isMobile = window.innerWidth < 768
  sceneCtx = useThreeScene(containerRef.value, {
    bloomStrength:  0.28,   // much softer — sun still glows, entries get subtle halo
    bloomRadius:    0.4,
    bloomThreshold: 0.07,   // low enough for varied entry emissive to catch bloom
    starCount: 1000,
    cameraZ: isMobile ? 130 : 85,
    enableDamping: true,
  })

  // Stronger fill light so textures read properly
  sceneCtx.scene.add(new THREE.AmbientLight(0x2a3a5a, 3.2))

  raycaster = new THREE.Raycaster()
  mouse     = new THREE.Vector2()

  const originalRender = sceneCtx.composer.render.bind(sceneCtx.composer)
  sceneCtx.composer.render = function () {
    onFrame(sceneCtx!.clock.getElapsedTime())
    originalRender()
  }

  buildSolarSystem()

  // Fade in from veil
  if (veilRef.value) gsap.fromTo(veilRef.value, { opacity: 1 }, { opacity: 0, duration: 0.4, ease: 'power1.out' })

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

/* Back button */
.back-btn {
  position: absolute; top: 24px; left: 24px; z-index: 20;
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px 8px 12px;
  background: rgba(5,8,20,0.6); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 100px; font-family: 'Space Grotesk', sans-serif;
  font-size: 12px; font-weight: 500; color: #8a9ab8; cursor: pointer;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  backdrop-filter: blur(12px);
}
.back-btn:hover { color: #e8ecf2; border-color: rgba(255,255,255,0.15); background: rgba(5,8,20,0.8); }

@media (max-width: 767px) {
  .back-btn { top: auto; bottom: 32px; left: 24px; }
}

/* System HUD */
.system-hud {
  position: absolute; top: 24px; left: 50%; transform: translateX(-50%);
  text-align: center; pointer-events: none; z-index: 10;
}
.system-name { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 600; color: #e8ecf2; letter-spacing: 0.02em; margin-bottom: 4px; }
.system-brief { font-family: 'Nunito', sans-serif; font-size: 12px; color: #8a9ab8; max-width: 280px; }

/* Entry count */
.entry-count {
  position: absolute; top: 24px; right: 24px; z-index: 10;
  font-family: 'Space Grotesk', sans-serif; font-size: 11px;
  color: #3a4558; text-transform: uppercase; letter-spacing: 0.06em; pointer-events: none;
}

/* HTML node labels */
.node-label {
  position: absolute; transform: translateX(-50%);
  pointer-events: none; z-index: 10;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: opacity 0.12s ease;
}
.lbl-top-row {
  display: flex; align-items: center; gap: 5px;
}
.visited-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.08);
  background: transparent;
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
.visited-dot.is-visited {
  background: var(--lc);
  border-color: var(--lc);
  box-shadow: 0 0 4px color-mix(in srgb, var(--lc) 40%, transparent);
}
.lbl-kind {
  font-family: 'Space Grotesk', sans-serif; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;
  color: #e0e6f0;
  text-shadow:
    0 1px 0 rgba(0,0,0,1), 0 -1px 0 rgba(0,0,0,1),
    1px 0 0 rgba(0,0,0,1), -1px 0 0 rgba(0,0,0,1),
    0 0 10px rgba(0,0,0,0.9),
    0 0 8px color-mix(in srgb, var(--lc) 60%, transparent);
  line-height: 1;
}
.lbl-title {
  font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 700;
  letter-spacing: 0.02em; white-space: nowrap; line-height: 1.2;
  color: #e8ecf2;
  text-shadow:
    0 1px 0 rgba(0,0,0,1), 0 -1px 0 rgba(0,0,0,1),
    1px 0 0 rgba(0,0,0,1), -1px 0 0 rgba(0,0,0,1),
    0 0 14px color-mix(in srgb, var(--lc) 50%, transparent),
    0 2px 8px rgba(0,0,0,1);
}

/* Tooltip */
.node-tooltip {
  position: absolute; pointer-events: none; z-index: 30; max-width: 190px;
  background: rgba(5,8,18,0.88); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 8px 13px; backdrop-filter: blur(16px);
}
.tooltip-brief { font-family: 'Nunito', sans-serif; font-size: 11px; color: #6f7989; line-height: 1.4; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
