<template>
  <div class="galaxy-view" ref="containerRef">
    <!-- Loading state -->
    <Transition name="fade">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-content">
          <div class="loading-orb" />
          <p class="loading-label">Mapping your galaxy…</p>
        </div>
      </div>
    </Transition>

    <!-- HUD -->
    <Transition name="slide-up">
      <div v-if="!loading && galaxy" class="hud">
        <div class="hud-title">{{ galaxy.meta.title }}</div>
        <div class="hud-meta">{{ clusterCount }} solar systems · {{ entryCount }} memories</div>
      </div>
    </Transition>

    <!-- Pipeline running banner -->
    <Transition name="slide-down">
      <div v-if="pipelineRunning" class="pipeline-banner">
        <span class="pipeline-dot" />
        Building your galaxy…
      </div>
    </Transition>

    <!-- HTML overlay labels — projected from 3D world positions each frame -->
    <div
      v-for="lbl in labelPositions"
      :key="lbl.id"
      class="node-label"
      :style="{
        left: lbl.x + 'px',
        top:  lbl.y + 'px',
        opacity: lbl.opacity,
        '--lc': lbl.color,
      }"
    >
      <span class="lbl-text">{{ lbl.title }}</span>
      <!-- Exploration arc ring — inline, next to title -->
      <svg v-if="lbl.totalCount > 0" class="explore-arc" width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="6" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.8"/>
        <circle
          cx="9" cy="9" r="6"
          fill="none"
          :stroke="lbl.color"
          stroke-width="1.8"
          stroke-linecap="round"
          :stroke-dasharray="2 * Math.PI * 6"
          :stroke-dashoffset="2 * Math.PI * 6 * (1 - lbl.visitedCount / lbl.totalCount)"
          transform="rotate(-90 9 9)"
          style="transition: stroke-dashoffset 0.6s ease"
        />
      </svg>
    </div>

    <!-- Hover tooltip — brief description on hover -->
    <div
      v-if="hovered"
      class="node-tooltip"
      :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
    >
      <span class="tooltip-brief">{{ hovered.brief }}</span>
    </div>

    <!-- Nav fade overlay — prevents blank flash on route transition -->
    <div class="nav-veil" ref="veilRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as THREE from 'three'
import gsap from 'gsap'
// @ts-ignore — d3-force-3d lacks full TS declarations
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force-3d'
import { useThreeScene } from '@/composables/useThreeScene'
import { useWarpEffect } from '@/composables/useWarpEffect'
import { useGalaxyStore } from '@/lib/galaxyStore'
import { MOCK_GALAXY } from '@/lib/mockGalaxy'
import type { Cluster, RelationshipEdge } from '@/lib/galaxyTypes'

const route = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy, setGalaxy } = useGalaxyStore()

const containerRef = ref<HTMLDivElement>()
const veilRef      = ref<HTMLDivElement>()
const loading      = ref(true)
const navigating   = ref(false)
const { triggerWarp }   = useWarpEffect()
const hovered      = ref<{ brief: string } | null>(null)
const tooltipPos   = ref({ x: 0, y: 0 })

// ── HTML label overlay ────────────────────────────────────────────────────────
interface LabelPos { id: string; x: number; y: number; opacity: number; title: string; color: string; visitedCount: number; totalCount: number }
const labelPositions = ref<LabelPos[]>([])
// Store world positions for each labeled mesh so we can project them each frame
const labelWorldData: Array<{ id: string; mesh: THREE.Mesh; title: string; color: string }> = []

const clusterCount   = computed(() => galaxy.value?.knowledge?.clusters.length ?? 0)
const entryCount     = computed(() => galaxy.value?.knowledge?.entries.length ?? 0)
const pipelineRunning = computed(() => {
  const p = galaxy.value?.pipeline
  if (!p) return false
  return ['ingest', 'structure', 'wraps', 'coverage'].some(
    (k) => (p as any)[k]?.status === 'running',
  )
})

// ── Three.js refs ─────────────────────────────────────────────────────────────
let sceneCtx: ReturnType<typeof useThreeScene> | null = null
const nodeObjects  = new Map<string, THREE.Mesh>()
const edgeObjects: THREE.Points[] = []
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let clickable: THREE.Mesh[] = []

// ── Build force graph ─────────────────────────────────────────────────────────
function buildGraph() {
  if (!sceneCtx || !galaxy.value?.knowledge) return
  const { scene } = sceneCtx
  const { clusters, entries } = galaxy.value.knowledge
  const edges  = galaxy.value.relationships.edges
  const wraps  = galaxy.value.wraps

  nodeObjects.forEach((m) => { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose() })
  nodeObjects.clear()
  edgeObjects.forEach((p) => { scene.remove(p); p.geometry.dispose(); (p.material as THREE.Material).dispose() })
  edgeObjects.splice(0)
  labelWorldData.splice(0)
  clickable = []

  interface SimNode {
    id: string; x: number; y: number; z: number
    vx?: number; vy?: number; vz?: number
    cluster: Cluster; entryCount: number
  }

  const simNodes: SimNode[] = clusters.map((c) => {
    const count = entries.filter((e) => {
      const g = galaxy.value?.knowledge?.groups.find((gr) => gr.id === e.groupId)
      return g?.clusterId === c.id
    }).length
    return {
      id: c.id,
      x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80, z: (Math.random() - 0.5) * 80,
      cluster: c, entryCount: count,
    }
  })

  interface SimLink { source: string; target: string; edge: RelationshipEdge }
  const clusterIds = new Set(clusters.map((c) => c.id))
  const simLinks: SimLink[] = edges
    .filter((e) => clusterIds.has(e.source) && clusterIds.has(e.target))
    .map((e) => ({ source: e.source, target: e.target, edge: e }))

  const sim = forceSimulation(simNodes, 3)
    .force('link',    forceLink(simLinks).id((d: SimNode) => d.id).distance(50).strength(0.4))
    .force('charge',  forceManyBody().strength(-140))
    .force('center',  forceCenter(0, 0, 0))
    .force('collide', forceCollide(16))
    .stop()
  for (let i = 0; i < 220; i++) sim.tick()

  const nodeIndexMap = new Map<string, SimNode>()
  simNodes.forEach((n) => nodeIndexMap.set(n.id, n))

  simNodes.forEach((n) => {
    const wrap     = wraps[n.id]
    const hexColor = wrap?.color ?? '#7c9ef8'
    const color    = new THREE.Color(hexColor)
    const radius   = 3.5 + n.entryCount * 0.6

    const geo = new THREE.SphereGeometry(radius, 28, 28)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,   // warm glow, not blinding
      roughness: 0.3,
      metalness: 0.05,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(n.x, n.y, n.z)
    mesh.userData = { clusterId: n.cluster.id, title: n.cluster.title, brief: n.cluster.brief }
    scene.add(mesh)
    nodeObjects.set(n.id, mesh)
    clickable.push(mesh)

    // Outer glow shell
    const glowGeo = new THREE.SphereGeometry(radius * 1.6, 20, 20)
    const glowMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.09,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    mesh.add(new THREE.Mesh(glowGeo, glowMat))

    // Register for HTML label projection
    labelWorldData.push({ id: n.id, mesh, title: n.cluster.title, color: hexColor })
  })

  // ── Particle stream edges ─────────────────────────────────────────────────
  simLinks.forEach((link) => {
    const srcNode = nodeIndexMap.get(typeof link.source === 'string' ? link.source : (link.source as any).id)
    const tgtNode = nodeIndexMap.get(typeof link.target === 'string' ? link.target : (link.target as any).id)
    if (!srcNode || !tgtNode) return

    const srcPos = new THREE.Vector3(srcNode.x, srcNode.y, srcNode.z)
    const tgtPos = new THREE.Vector3(tgtNode.x, tgtNode.y, tgtNode.z)

    const particleCount = 20
    const positions = new Float32Array(particleCount * 3)
    const phases    = new Float32Array(particleCount)
    for (let i = 0; i < particleCount; i++) phases[i] = i / particleCount

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const weight = link.edge.weight ?? 0.5
    const streamColor = new THREE.Color()
    streamColor.lerpColors(
      new THREE.Color(wraps[link.edge.source]?.color ?? '#7c9ef8'),
      new THREE.Color(wraps[link.edge.target]?.color ?? '#7c9ef8'),
      0.5,
    )

    const mat = new THREE.PointsMaterial({
      color: streamColor, size: 0.5, transparent: true,
      opacity: 0.12 + weight * 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
    const pts = new THREE.Points(geo, mat)
    pts.userData = { srcPos, tgtPos, positions, phases, particleCount }
    scene.add(pts)
    edgeObjects.push(pts)
  })
}

// ── Per-frame: particles + pulse + label projection ───────────────────────────
function onFrame(elapsed: number) {
  // Particle streams
  edgeObjects.forEach((pts) => {
    const { srcPos, tgtPos, positions, phases, particleCount } = pts.userData
    for (let i = 0; i < particleCount; i++) {
      const t = (phases[i] + elapsed * 0.07) % 1
      positions[i * 3]     = srcPos.x + (tgtPos.x - srcPos.x) * t
      positions[i * 3 + 1] = srcPos.y + (tgtPos.y - srcPos.y) * t
      positions[i * 3 + 2] = srcPos.z + (tgtPos.z - srcPos.z) * t
    }
    pts.geometry.attributes.position.needsUpdate = true
  })

  // Node pulse
  nodeObjects.forEach((mesh) => {
    const pulse = 1 + Math.sin(elapsed * 0.7 + mesh.position.x * 0.1) * 0.02
    mesh.scale.setScalar(pulse)
  })

  // HTML label projection
  if (!sceneCtx || !containerRef.value || labelWorldData.length === 0) return
  const cam = sceneCtx.camera
  const w   = containerRef.value.clientWidth
  const h   = containerRef.value.clientHeight
  const tmp = new THREE.Vector3()

  const g = galaxy.value
  const updated: LabelPos[] = []
  for (const lbl of labelWorldData) {
    tmp.copy(lbl.mesh.position)
    tmp.project(cam)
    const sx = (tmp.x * 0.5 + 0.5) * w
    const sy = (-tmp.y * 0.5 + 0.5) * h
    const dist    = cam.position.distanceTo(lbl.mesh.position)
    const opacity = tmp.z < 1 ? Math.max(0, Math.min(1, (250 - dist) / 60)) : 0
    const radius  = (lbl.mesh.geometry as THREE.SphereGeometry).parameters.radius * lbl.mesh.scale.x

    // Per-cluster exploration stats
    let visitedCount = 0, totalCount = 0
    if (g?.knowledge && g?.exploration) {
      const groupIds = new Set(g.knowledge.groups.filter(gr => gr.clusterId === lbl.id).map(gr => gr.id))
      const clusterEntries = g.knowledge.entries.filter(e => e.groupId && groupIds.has(e.groupId))
      totalCount   = clusterEntries.length
      visitedCount = clusterEntries.filter(e => g.exploration.visited[e.id]).length
    }

    updated.push({ id: lbl.id, x: sx, y: sy - radius * (h / (dist + 0.01)) - 18, opacity, title: lbl.title, color: lbl.color, visitedCount, totalCount })
  }
  labelPositions.value = updated

}

// ── Raycasting ────────────────────────────────────────────────────────────────
function onMouseMove(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)
  const hits = raycaster.intersectObjects(clickable)
  if (hits.length > 0) {
    const ud = hits[0].object.userData
    hovered.value = { brief: ud.brief }
    tooltipPos.value = { x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 8 }
    containerRef.value.style.cursor = 'pointer'
  } else {
    hovered.value = null
    containerRef.value.style.cursor = 'grab'
  }
}

function onClick(e: MouseEvent) {
  if (!sceneCtx || !containerRef.value || navigating.value) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, sceneCtx.camera)
  const hits = raycaster.intersectObjects(clickable)
  if (hits.length === 0) return

  const mesh     = hits[0].object as THREE.Mesh
  const clusterId = mesh.userData.clusterId
  if (!clusterId) return

  const target = mesh.position.clone()
  // Destination: approach from current camera angle, stop at radius + 22
  const camDir = sceneCtx.camera.position.clone().sub(target).normalize()
  const dest   = target.clone().addScaledVector(camDir, 22)

  navigating.value = true
  sceneCtx.controls.enabled = false

  const tl = gsap.timeline({
    onComplete: () => {
      // Warp fires as the veil fades — stars appear during the black fade
      triggerWarp(700, 'out')
      if (veilRef.value) gsap.to(veilRef.value, {
        opacity: 1, duration: 0.7, ease: 'sine.inOut',
        onComplete: () => { router.push({ name: 'solar-system', params: { id: route.params.id, clusterId } }) },
      })
      else router.push({ name: 'solar-system', params: { id: route.params.id, clusterId } })
    },
  })
  // Simultaneously tween camera position AND controls.target
  tl.to(sceneCtx.camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.65, ease: 'sine.in',
    onUpdate: () => { sceneCtx!.controls.update() } }, 0)
  tl.to(sceneCtx.controls.target, { x: target.x, y: target.y, z: target.z, duration: 0.65, ease: 'sine.in' }, 0)
}

// ── Mount ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!containerRef.value) return

  const id = route.params.id as string
  if (!galaxy.value || galaxy.value.meta.id !== id) {
    try { await loadGalaxy(id) } catch { setGalaxy(MOCK_GALAXY) }
  }
  loading.value = false

  const isMobile = window.innerWidth < 768
  sceneCtx = useThreeScene(containerRef.value, {
    bloomStrength:  0.8,   // visible glow on orbs
    bloomRadius:    0.45,
    bloomThreshold: 0.08,
    starCount: 1400,
    cameraZ: isMobile ? 165 : 110,
    enableDamping: true,
  })

  raycaster = new THREE.Raycaster()
  mouse     = new THREE.Vector2()

  const originalRender = sceneCtx.composer.render.bind(sceneCtx.composer)
  sceneCtx.composer.render = function () {
    onFrame(sceneCtx!.clock.getElapsedTime())
    originalRender()
  }

  buildGraph()

  // Fade in — veil starts opaque, dissolves away
  if (veilRef.value) gsap.fromTo(veilRef.value, { opacity: 1 }, { opacity: 0, duration: 0.35, ease: 'power1.out' })

  if (!isMobile) containerRef.value.addEventListener('mousemove', onMouseMove)
  containerRef.value.addEventListener('click', onClick)
})

onUnmounted(() => {
  containerRef.value?.removeEventListener('mousemove', onMouseMove)
  containerRef.value?.removeEventListener('click', onClick)
  sceneCtx?.dispose()
})

watch(() => galaxy.value?.knowledge, (k) => { if (k && sceneCtx) buildGraph() })
</script>

<style scoped>
.galaxy-view {
  position: fixed;
  inset: 0;
  background: #02040a;
  overflow: hidden;
  cursor: grab;
}
.galaxy-view:active { cursor: grabbing; }

/* Nav veil — full-screen overlay used for cross-route fade */
.nav-veil {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: #02040a;
  opacity: 0;
  pointer-events: none;
}

/* Loading */
.loading-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: #02040a; z-index: 20;
}
.loading-content { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.loading-orb {
  width: 56px; height: 56px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #7c9ef8, #4a5fa8);
  box-shadow: 0 0 30px #7c9ef840, 0 0 60px #7c9ef820;
  animation: orb-pulse 2s ease-in-out infinite;
}
@keyframes orb-pulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.12); }
}
.loading-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px; letter-spacing: 0.06em;
  color: #6f7989; text-transform: uppercase;
}

/* HUD */
.hud {
  position: absolute; top: 28px; left: 50%; transform: translateX(-50%);
  text-align: center; pointer-events: none; z-index: 10;
}
.hud-title { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; color: #e8ecf2; letter-spacing: 0.03em; margin-bottom: 4px; }
.hud-meta  { font-family: 'Space Grotesk', sans-serif; font-size: 11px; color: #8a9ab8; letter-spacing: 0.05em; text-transform: uppercase; }

/* Pipeline banner */
.pipeline-banner {
  position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px; padding: 8px 18px;
  background: rgba(7,10,20,0.7); border: 1px solid rgba(124,158,248,0.15);
  border-radius: 100px; font-family: 'Space Grotesk', sans-serif; font-size: 12px; color: #6f7989;
  backdrop-filter: blur(12px); pointer-events: none; z-index: 10;
}
.pipeline-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #7c9ef8;
  animation: dot-blink 1.4s ease-in-out infinite;
}
@keyframes dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }

/* HTML node labels — always visible, projected from 3D */
.node-label {
  position: absolute;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 10;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  transition: opacity 0.15s ease;
}
.lbl-text {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e8ecf2;
  text-shadow:
    0 0 20px color-mix(in srgb, var(--lc) 70%, transparent),
    0 0 40px color-mix(in srgb, var(--lc) 35%, transparent),
    0 1px 0 rgba(0,0,0,1),
    0 -1px 0 rgba(0,0,0,1),
    1px 0 0 rgba(0,0,0,1),
    -1px 0 0 rgba(0,0,0,1),
    0 2px 8px rgba(0,0,0,1);
}
.explore-arc {
  flex-shrink: 0;
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--lc) 55%, transparent));
}

/* Hover tooltip — brief only (title is always shown via label) */
.node-tooltip {
  position: absolute; pointer-events: none; z-index: 30;
  max-width: 200px;
  background: rgba(5,8,18,0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 8px 14px;
  backdrop-filter: blur(16px);
}
.tooltip-brief { font-family: 'Nunito', sans-serif; font-size: 11px; color: #6f7989; line-height: 1.4; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.5s ease, transform 0.5s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.slide-down-enter-active, .slide-down-leave-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }
</style>
