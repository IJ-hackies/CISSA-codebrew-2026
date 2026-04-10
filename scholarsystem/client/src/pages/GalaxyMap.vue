<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import BodyNode from '@/components/galaxy/BodyNode.vue'
import WarpLane from '@/components/galaxy/WarpLane.vue'
import GalaxyHUD from '@/components/galaxy/GalaxyHUD.vue'
import { useGalaxyStore } from '@/lib/galaxyStore'
import { useMapControls, type ZoomLevel } from '@/composables/useMapControls'
import { useIsMobile } from '@/composables/useIsMobile'
import type {
  Body,
  Position,
  Relationship,
  RelationshipKind,
  Spatial,
} from '@/types/galaxy'

const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const { galaxy, loadGalaxy, saveCameraState, restoreCameraState } = useGalaxyStore()
const rendererRef = ref<InstanceType<typeof GalaxyRenderer> | null>(null)

// ─── Data loading ────────────────────────────────────────────────────

const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const id = route.params.id as string
  if (!galaxy.value || galaxy.value.meta.id !== id) {
    try {
      await loadGalaxy(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      loading.value = false
      return
    }
  }
  loading.value = false

  // Restore camera state if returning from a concept scene.
  const saved = restoreCameraState()
  if (saved) {
    // Wait a tick so spatial watch has initialized the viewBox first.
    await new Promise((r) => setTimeout(r, 0))
    restoreState(saved)
  }
})

// ─── Derived data ────────────────────────────────────────────────────

const spatial = computed<Spatial | null>(() => galaxy.value?.spatial ?? null)
const knowledge = computed(() => galaxy.value?.knowledge ?? null)
const visuals = computed(() => galaxy.value?.visuals ?? {})
const relationships = computed(() => galaxy.value?.relationships ?? [])
const progress = computed(
  () =>
    galaxy.value?.progress ?? {
      bodies: {},
      totalBodies: 0,
      visitedCount: 0,
      completedCount: 0,
      overallMastery: 0,
    },
)

// Lookup maps for fast access.
const bodyMap = computed(() => {
  const map = new Map<string, Body>()
  for (const b of spatial.value?.bodies ?? []) map.set(b.id, b)
  return map
})

const topicMap = computed(() => {
  const map = new Map<string, { id: string; title: string }>()
  for (const t of knowledge.value?.topics ?? []) map.set(t.id, t)
  return map
})

const subtopicMap = computed(() => {
  const map = new Map<string, { id: string; title: string; summary: string }>()
  for (const s of knowledge.value?.subtopics ?? []) map.set(s.id, s)
  return map
})

const conceptMap = computed(() => {
  const map = new Map<
    string,
    { id: string; title: string; kind: string; brief: string; modelTier: string }
  >()
  for (const c of knowledge.value?.concepts ?? []) map.set(c.id, c)
  return map
})

// ─── Map controls ────────────────────────────────────────────────────

const {
  zoomLevel,
  focusedSystemId,
  focusedPlanetId,
  viewBox,
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
} = useMapControls({ spatial, isMobile })

// ─── Body visibility filtering ───────────────────────────────────────

const visibleBodies = computed<Body[]>(() => {
  const bodies = spatial.value?.bodies ?? []
  const level = zoomLevel.value
  const sysId = focusedSystemId.value
  const planetId = focusedPlanetId.value

  if (level === 'galaxy') {
    // Show systems, stars, decoratives, asteroids. Hide planets, moons.
    return bodies.filter(
      (b) =>
        b.kind === 'system' ||
        b.kind === 'star' ||
        b.kind === 'asteroid' ||
        b.kind === 'nebula' ||
        b.kind === 'dust-cloud' ||
        b.kind === 'comet' ||
        b.kind === 'black-hole' ||
        b.kind === 'asteroid-belt',
    )
  }

  if (level === 'system' && sysId) {
    // Show the focused system's star + planets. Decoratives in the area.
    return bodies.filter(
      (b) =>
        b.id === sysId ||
        b.parentId === sysId ||
        // Decoratives that are children of the root galaxy.
        (['nebula', 'dust-cloud', 'comet', 'black-hole', 'asteroid-belt'].includes(b.kind) &&
          isInViewArea(b)),
    )
  }

  if (level === 'planet' && planetId) {
    // Show the focused planet + its moons.
    return bodies.filter(
      (b) =>
        b.id === planetId ||
        b.parentId === planetId,
    )
  }

  return bodies
})

function isInViewArea(body: Body): boolean {
  // Simple check: is this body within a reasonable distance of the focused system?
  if (!focusedSystemId.value) return false
  const system = bodyMap.value.get(focusedSystemId.value)
  if (!system) return false
  const dx = body.position.x - system.position.x
  const dy = body.position.y - system.position.y
  return Math.sqrt(dx * dx + dy * dy) < 400
}

// ─── Trail path (ordered system-to-system at galaxy level) ───────────

const trailPath = computed(() => {
  if (zoomLevel.value !== 'galaxy') return ''
  const systems = (spatial.value?.bodies ?? [])
    .filter((b) => b.kind === 'system')
    .sort((a, b) => a.position.x - b.position.x)
  if (systems.length < 2) return ''
  // Smooth cubic bezier — control points halfway between adjacent systems on x,
  // staying at each system's own y so the curve flows naturally through each star.
  let d = `M${systems[0].position.x},${systems[0].position.y}`
  for (let i = 1; i < systems.length; i++) {
    const prev = systems[i - 1].position
    const curr = systems[i].position
    const cpX = (prev.x + curr.x) / 2
    d += ` C${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`
  }
  return d
})

// ─── Warp lanes (only at planet zoom level) ──────────────────────────

interface LaneData {
  from: Position
  to: Position
  kind: RelationshipKind
  weight: number
}

const visibleLanes = computed<LaneData[]>(() => {
  // Only show relationship lanes at planet zoom — at galaxy level the trail path handles navigation
  if (zoomLevel.value === 'planet' && focusedPlanetId.value) {
    return conceptLanes(relationships.value, focusedPlanetId.value)
  }
  return []
})

function conceptLanes(rels: Relationship[], planetId: string): LaneData[] {
  // Get moon knowledgeRefs belonging to this planet.
  const moonKnowledgeIds = new Set<string>()
  for (const body of spatial.value?.bodies ?? []) {
    if (body.kind === 'moon' && body.parentId === planetId && 'knowledgeRef' in body) {
      moonKnowledgeIds.add(body.knowledgeRef)
    }
  }

  // Find bodies by knowledgeRef for position lookup.
  const knowledgeToBody = new Map<string, Body>()
  for (const body of spatial.value?.bodies ?? []) {
    if ('knowledgeRef' in body && body.knowledgeRef) {
      knowledgeToBody.set(body.knowledgeRef, body)
    }
  }

  const lanes: LaneData[] = []
  for (const rel of rels) {
    if (!moonKnowledgeIds.has(rel.from) || !moonKnowledgeIds.has(rel.to)) continue
    const fromBody = knowledgeToBody.get(rel.from)
    const toBody = knowledgeToBody.get(rel.to)
    if (!fromBody || !toBody) continue
    lanes.push({ from: fromBody.position, to: toBody.position, kind: rel.kind, weight: 1 })
  }
  return lanes
}

// ─── Label scale (based on viewBox extent) ───────────────────────────

const laneStrokeScale = computed(() => {
  if (zoomLevel.value === 'planet') return 0.5
  return 2.5
})

const labelScale = computed(() => {
  if (zoomLevel.value === 'galaxy') return 3
  if (zoomLevel.value === 'system') return 1.5
  return 0.6
})

// ─── Hover state ─────────────────────────────────────────────────────

const hoveredBodyId = ref<string | null>(null)

function onBodyHover(body: Body) {
  hoveredBodyId.value = body.id
}
function onBodyLeave() {
  hoveredBodyId.value = null
}

// ─── Body label lookup ───────────────────────────────────────────────

function bodyLabel(body: Body): string | undefined {
  if (!('knowledgeRef' in body) || !body.knowledgeRef) return undefined
  const ref = body.knowledgeRef as string
  return (
    topicMap.value.get(ref)?.title ??
    subtopicMap.value.get(ref)?.title ??
    conceptMap.value.get(ref)?.title
  )
}

function isVisited(body: Body): boolean {
  return progress.value.bodies[body.id]?.visited ?? false
}

// ─── Body click handling ─────────────────────────────────────────────

function getRenderer() {
  return rendererRef.value?.getRenderer() ?? null
}

function onBodyClick(body: Body) {
  switch (body.kind) {
    case 'system':
      getRenderer()?.warp()
      drillIntoSystem(body.id)
      break
    case 'planet':
      getRenderer()?.warp()
      drillIntoPlanet(body.id)
      break
    case 'moon':
    case 'asteroid': {
      saveCameraState(getState())
      const galaxyId = route.params.id as string
      const conceptId = 'knowledgeRef' in body && body.knowledgeRef ? body.knowledgeRef : body.id
      router.push({ name: 'concept', params: { id: galaxyId, conceptId } })
      break
    }
  }
}

// ─── Tooltip data ────────────────────────────────────────────────────

const tooltipData = computed(() => {
  if (!hoveredBodyId.value) return null
  const body = bodyMap.value.get(hoveredBodyId.value)
  if (!body) return null
  if (!('knowledgeRef' in body) || !body.knowledgeRef) return null

  const concept = conceptMap.value.get(body.knowledgeRef as string)
  if (!concept) {
    // Could be a topic or subtopic
    const topic = topicMap.value.get(body.knowledgeRef as string)
    if (topic) return { title: topic.title, subtitle: null, brief: null }
    const subtopic = subtopicMap.value.get(body.knowledgeRef as string)
    if (subtopic) return { title: subtopic.title, subtitle: null, brief: subtopic.summary }
    return null
  }

  return {
    title: concept.title,
    subtitle: concept.kind,
    brief: concept.brief,
  }
})

// ─── HUD navigation handler ─────────────────────────────────────────

function onHudNavigate(level: ZoomLevel, id?: string) {
  navigateTo(level, id)
}
</script>

<template>
  <main class="galaxy-map-page">
    <!-- Background starfield -->
    <GalaxyRenderer ref="rendererRef" />

    <!-- Loading / error states -->
    <div v-if="loading" class="state-overlay">
      <span class="state-text">Loading galaxy...</span>
    </div>
    <div v-else-if="error" class="state-overlay">
      <span class="state-text error">{{ error }}</span>
    </div>

    <!-- SVG map layer -->
    <svg
      v-else-if="spatial"
      class="map-svg"
      :class="{ 'is-dragging': false }"
      :viewBox="viewBox"
      preserveAspectRatio="xMidYMid meet"
      style="touch-action: none; user-select: none;"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @wheel.prevent="onWheel"
      @click="onBackgroundClick"
    >
      <!--
        Portrait: rotate the entire content 90° so the galaxy arm runs
        top-to-bottom. Labels are counter-rotated inside BodyNode.
        Landscape: no transform needed.
      -->
      <g :transform="isPortrait && zoomLevel === 'galaxy' ? 'rotate(90)' : ''">

        <!-- Galaxy arm trail — smooth bezier through all systems -->
        <path
          v-if="trailPath"
          :d="trailPath"
          fill="none"
          stroke="rgba(180,210,255,0.07)"
          stroke-width="28"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="trail-glow"
        />
        <path
          v-if="trailPath"
          :d="trailPath"
          fill="none"
          stroke="rgba(180,210,255,0.18)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray="18 14"
          class="trail-path"
        />

        <!-- Warp lanes (planet zoom only) -->
        <WarpLane
          v-for="(lane, i) in visibleLanes"
          :key="`lane-${i}`"
          :from="lane.from"
          :to="lane.to"
          :kind="lane.kind"
          :weight="lane.weight"
          :stroke-scale="laneStrokeScale"
        />

        <!-- Orbit rings at system zoom level -->
        <template v-if="zoomLevel === 'system' || zoomLevel === 'planet'">
          <circle
            v-for="body in visibleBodies.filter((b) => b.kind === 'planet')"
            :key="`orbit-${body.id}`"
            :cx="bodyMap.get(body.parentId ?? '')?.position.x ?? 0"
            :cy="bodyMap.get(body.parentId ?? '')?.position.y ?? 0"
            :r="'orbitRadius' in body ? (body as any).orbitRadius : 0"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            stroke-width="0.5"
            class="orbit-ring"
          />
        </template>

        <!-- Moon orbit rings at planet zoom -->
        <template v-if="zoomLevel === 'planet'">
          <circle
            v-for="body in visibleBodies.filter((b) => b.kind === 'moon')"
            :key="`moon-orbit-${body.id}`"
            :cx="bodyMap.get(body.parentId ?? '')?.position.x ?? 0"
            :cy="bodyMap.get(body.parentId ?? '')?.position.y ?? 0"
            :r="'orbitRadius' in body ? (body as any).orbitRadius : 0"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            stroke-width="0.3"
            class="orbit-ring"
          />
        </template>

        <!-- Bodies -->
        <BodyNode
          v-for="body in visibleBodies"
          :key="body.id"
          :body="body"
          :visual="visuals[body.id]"
          :label="bodyLabel(body)"
          :visited="isVisited(body)"
          :hovered="hoveredBodyId === body.id"
          :label-scale="labelScale"
          :rotated="isPortrait && zoomLevel === 'galaxy'"
          @click="onBodyClick"
          @pointerenter="onBodyHover"
          @pointerleave="onBodyLeave"
        />

      </g>
    </svg>

    <!-- Tooltip (HTML overlay, always sharp) -->
    <Transition name="tooltip">
      <div
        v-if="tooltipData && hoveredBodyId && zoomLevel === 'planet'"
        class="concept-tooltip"
      >
        <span class="tooltip-title">{{ tooltipData.title }}</span>
        <span v-if="tooltipData.subtitle" class="tooltip-kind">{{ tooltipData.subtitle }}</span>
        <span v-if="tooltipData.brief" class="tooltip-brief">{{ tooltipData.brief }}</span>
      </div>
    </Transition>

    <!-- HUD -->
    <GalaxyHUD
      v-if="!loading && !error"
      :zoom-level="zoomLevel"
      :focused-system-id="focusedSystemId"
      :focused-planet-id="focusedPlanetId"
      :knowledge="knowledge"
      :progress="progress"
      @navigate="onHudNavigate"
    />

    <!-- Mobile: back button when drilled in -->
    <button
      v-if="isMobile && zoomLevel !== 'galaxy'"
      class="mobile-back"
      @click="zoomUp"
      aria-label="Go back"
    >
      &larr;
    </button>
  </main>
</template>

<style scoped>
.galaxy-map-page {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-void-base);
}

.map-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  cursor: grab;
  touch-action: none;
}
.map-svg:active {
  cursor: grabbing;
}

.orbit-ring {
  pointer-events: none;
}

.trail-path {
  pointer-events: none;
}

/* ─── States ─────────────────────────────────────────────── */

.state-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.state-text {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  letter-spacing: 0.1em;
}
.state-text.error {
  color: #ff5a5a;
}

/* ─── Tooltip ─────────────────────────────────────────────── */

.concept-tooltip {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: rgba(5, 8, 16, 0.9);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  max-width: 360px;
  text-align: center;
  pointer-events: none;
}

.tooltip-title {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tooltip-kind {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-accent);
}

.tooltip-brief {
  font-family: var(--font-body);
  font-size: 0.72rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}
.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* ─── Mobile back button ──────────────────────────────────── */

.mobile-back {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 25;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: var(--color-text-primary);
  background: rgba(5, 8, 16, 0.7);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  cursor: pointer;
}
.mobile-back:active {
  background: rgba(5, 8, 16, 0.9);
}

@media (max-width: 768px) {
  .map-svg {
    cursor: default;
  }
}
</style>
