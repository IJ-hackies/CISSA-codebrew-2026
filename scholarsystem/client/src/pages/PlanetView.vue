<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGalaxyStore } from '@/lib/galaxyStore'
import { useIsMobile } from '@/composables/useIsMobile'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import type { Concept, Palette } from '@/types/galaxy'

const route = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy } = useGalaxyStore()
const isMobile = useIsMobile()

const loading = ref(false)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  await loadGalaxy(id)
  loading.value = false
})

// ─── Data ─────────────────────────────────────────────────────────────
const subtopicId = computed(() => route.params.subtopicId as string)

const subtopic = computed(() =>
  galaxy.value?.knowledge?.subtopics.find((s) => s.id === subtopicId.value) ?? null,
)

const concepts = computed<Concept[]>(() => {
  if (!galaxy.value?.knowledge || !subtopic.value) return []
  const map = new Map(galaxy.value.knowledge.concepts.map((c) => [c.id, c]))
  return subtopic.value.conceptIds.map((id) => map.get(id)).filter(Boolean) as Concept[]
})

// ─── Palette (from spatial visuals) ───────────────────────────────────
const planetPalette = computed<Palette>(() => {
  const g = galaxy.value
  if (!g?.spatial) return DEFAULT_PALETTE
  const body = g.spatial.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === subtopicId.value,
  )
  const vis = body ? (g.visuals[body.id] as any) : null
  return vis?.palette ?? DEFAULT_PALETTE
})

const DEFAULT_PALETTE: Palette = {
  primary: '#3a8fe8',
  secondary: '#0d2a5e',
  accent: '#92ccff',
  atmosphere: 'rgba(58,143,232,0.24)',
}

// ─── Concept kind colours for moon tints ──────────────────────────────
const KIND_COLORS: Record<string, string> = {
  definition: '#4a9eff',
  formula: '#c084fc',
  example: '#34d399',
  fact: '#fb923c',
  principle: '#f472b6',
  process: '#22d3ee',
}

function moonColor(concept: Concept): string {
  return KIND_COLORS[concept.kind] ?? '#7a9abb'
}

// ─── Orbit layout ─────────────────────────────────────────────────────
// Planet sphere radius in px (matches SVG: desktop=90, mobile=62)
const PLANET_R_DESKTOP = 90
const PLANET_R_MOBILE  = 62
// Moon SVG half-size + clearance gap
const MOON_HALF = 22
const ORBIT_GAP = 55

const ORBIT_RADII_DESKTOP = [
  PLANET_R_DESKTOP + MOON_HALF + ORBIT_GAP,            // ~167
  PLANET_R_DESKTOP + MOON_HALF + ORBIT_GAP + 65,       // ~232
  PLANET_R_DESKTOP + MOON_HALF + ORBIT_GAP + 32,       // ~199
  PLANET_R_DESKTOP + MOON_HALF + ORBIT_GAP + 100,      // ~267
]
const ORBIT_RADII_MOBILE = [
  PLANET_R_MOBILE + MOON_HALF + ORBIT_GAP,             // ~139
  PLANET_R_MOBILE + MOON_HALF + ORBIT_GAP + 48,        // ~187
  PLANET_R_MOBILE + MOON_HALF + ORBIT_GAP + 24,        // ~163
  PLANET_R_MOBILE + MOON_HALF + ORBIT_GAP + 72,        // ~211
]
const ORBIT_DURATIONS = [70, 105, 85, 125]  // seconds per orbit — slow & majestic
const PHASES          = [0, 0.25, 0.5, 0.75]

function orbitRadius(i: number): number {
  const radii = isMobile.value ? ORBIT_RADII_MOBILE : ORBIT_RADII_DESKTOP
  return radii[Math.min(i, radii.length - 1)]
}

const maxOrbitRadius = computed(() =>
  concepts.value.length > 0
    ? orbitRadius(concepts.value.length - 1)
    : 150,
)

// ─── Planet SVG helpers ────────────────────────────────────────────────
function hash(str: string): number {
  let h = 0x811c9dc5
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  return h >>> 0
}
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff }
}

interface Mark { dx: number; dy: number; rx: number; ry: number; rot: number; opacity: number }
function terrainMarks(id: string, r: number): Mark[] {
  const rng = makeRng(hash(id))
  const count = 3 + Math.floor(rng() * 3)
  return Array.from({ length: count }, () => {
    const a = rng() * Math.PI * 2
    const dist = r * (0.08 + rng() * 0.44)
    return {
      dx: Math.cos(a) * dist,
      dy: Math.sin(a) * dist * 0.72,
      rx: r * (0.14 + rng() * 0.18),
      ry: r * (0.07 + rng() * 0.09),
      rot: rng() * 70 - 35,
      opacity: 0.18 + rng() * 0.22,
    }
  })
}

interface Wisp { dx: number; dy: number; rx: number; ry: number; rot: number }
function cloudWisps(id: string, r: number): Wisp[] {
  const rng = makeRng(hash(id) ^ 0xdeadbeef)
  const count = 2 + Math.floor(rng() * 2)
  return Array.from({ length: count }, () => {
    const a = rng() * Math.PI * 2
    const dist = r * (0.12 + rng() * 0.38)
    return {
      dx: Math.cos(a) * dist,
      dy: Math.sin(a) * dist * 0.45,
      rx: r * (0.32 + rng() * 0.28),
      ry: r * (0.07 + rng() * 0.07),
      rot: rng() * 40 - 20,
    }
  })
}

// ─── Progress lookup ───────────────────────────────────────────────────
function isConceptVisited(conceptId: string): boolean {
  const g = galaxy.value
  if (!g?.spatial) return false
  const body = g.spatial.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === conceptId,
  )
  if (!body) return false
  return g.progress.bodies[body.id]?.visited ?? false
}

// ─── Navigation ───────────────────────────────────────────────────────
function goBack() {
  router.push(`/galaxy/${route.params.id}`)
}

function enterConcept(conceptId: string) {
  router.push(`/galaxy/${route.params.id}/concept/${conceptId}`)
}
</script>

<template>
  <div class="planet-view">
    <GalaxyRenderer class="bg" />

    <!-- ─── HUD ──────────────────────────────────────────────────────── -->
    <header class="hud">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="hud-center">
        <span class="hud-chapter">{{ subtopic?.chapter }}</span>
        <span class="hud-title">{{ subtopic?.title }}</span>
      </div>
      <div class="hud-count">
        <span :style="{ color: planetPalette.accent }">{{ concepts.filter(c => isConceptVisited(c.id)).length }}</span>
        <span class="hud-sep">/</span>
        <span>{{ concepts.length }}</span>
      </div>
    </header>

    <!-- ─── Loading ──────────────────────────────────────────────────── -->
    <div v-if="loading" class="center-screen">
      <div class="loading-orb" :style="{ background: `radial-gradient(circle at 36% 32%, ${planetPalette.accent}, ${planetPalette.primary} 55%, ${planetPalette.secondary})` }" />
      <p class="loading-label">Entering orbit…</p>
    </div>

    <!-- ─── Orbit stage ───────────────────────────────────────────────── -->
    <main v-else-if="subtopic" class="orbit-stage">
      <!-- Orbit ring paths -->
      <svg
        class="orbit-rings"
        :width="(maxOrbitRadius + 40) * 2"
        :height="(maxOrbitRadius + 40) * 2"
        :viewBox="`${-(maxOrbitRadius + 40)} ${-(maxOrbitRadius + 40)} ${(maxOrbitRadius + 40) * 2} ${(maxOrbitRadius + 40) * 2}`"
      >
        <circle
          v-for="(concept, i) in concepts"
          :key="concept.id"
          cx="0"
          cy="0"
          :r="orbitRadius(i)"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          stroke-width="1"
          stroke-dasharray="5 9"
        />
      </svg>

      <!-- ─── Central planet ── -->
      <div class="planet-center">
        <svg
          :width="isMobile ? 140 : 200"
          :height="isMobile ? 140 : 200"
          :viewBox="`0 0 ${isMobile ? 140 : 200} ${isMobile ? 140 : 200}`"
          class="planet-svg"
        >
          <defs>
            <radialGradient id="pv-main" :cx="isMobile ? 47 : 67" :cy="isMobile ? 42 : 60" :r="isMobile ? 77 : 110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" :stop-color="planetPalette.accent" stop-opacity="1" />
              <stop offset="32%" :stop-color="planetPalette.primary" stop-opacity="0.97" />
              <stop offset="72%" :stop-color="planetPalette.primary" stop-opacity="0.88" />
              <stop offset="100%" :stop-color="planetPalette.secondary" stop-opacity="0.9" />
            </radialGradient>
            <radialGradient id="pv-shadow" :cx="isMobile ? 90 : 130" :cy="isMobile ? 85 : 120" :r="isMobile ? 60 : 85" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#000" stop-opacity="0" />
              <stop offset="55%" stop-color="#000" stop-opacity="0" />
              <stop offset="100%" stop-color="#000" stop-opacity="0.72" />
            </radialGradient>
            <filter id="pv-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="pv-clip">
              <circle :cx="isMobile ? 70 : 100" :cy="isMobile ? 70 : 100" :r="isMobile ? 62 : 90" />
            </clipPath>
          </defs>

          <!-- Atmosphere glow -->
          <circle
            :cx="isMobile ? 70 : 100" :cy="isMobile ? 70 : 100" :r="isMobile ? 72 : 104"
            :fill="planetPalette.atmosphere"
            opacity="0.7"
          />

          <!-- Planet body -->
          <circle
            :cx="isMobile ? 70 : 100" :cy="isMobile ? 70 : 100" :r="isMobile ? 62 : 90"
            fill="url(#pv-main)"
            filter="url(#pv-glow)"
          />

          <!-- Terrain -->
          <g clip-path="url(#pv-clip)">
            <ellipse
              v-for="(m, mi) in terrainMarks(subtopicId, isMobile ? 62 : 90)"
              :key="mi"
              :cx="(isMobile ? 70 : 100) + m.dx"
              :cy="(isMobile ? 70 : 100) + m.dy"
              :rx="m.rx" :ry="m.ry"
              :fill="planetPalette.secondary"
              :opacity="m.opacity"
              :transform="`rotate(${m.rot} ${(isMobile ? 70 : 100) + m.dx} ${(isMobile ? 70 : 100) + m.dy})`"
            />
          </g>

          <!-- Shadow -->
          <circle
            :cx="isMobile ? 70 : 100" :cy="isMobile ? 70 : 100" :r="isMobile ? 62 : 90"
            fill="url(#pv-shadow)"
            clip-path="url(#pv-clip)"
          />

          <!-- Clouds -->
          <g clip-path="url(#pv-clip)">
            <ellipse
              v-for="(w, wi) in cloudWisps(subtopicId, isMobile ? 62 : 90)"
              :key="wi"
              :cx="(isMobile ? 70 : 100) + w.dx"
              :cy="(isMobile ? 70 : 100) + w.dy"
              :rx="w.rx" :ry="w.ry"
              fill="white" opacity="0.13"
              :transform="`rotate(${w.rot} ${(isMobile ? 70 : 100) + w.dx} ${(isMobile ? 70 : 100) + w.dy})`"
            />
          </g>

          <!-- Rim + specular -->
          <circle
            :cx="isMobile ? 70 : 100" :cy="isMobile ? 70 : 100" :r="isMobile ? 61 : 89"
            fill="none" :stroke="planetPalette.accent" stroke-width="1.2" stroke-opacity="0.35"
          />
          <ellipse
            :cx="isMobile ? 52 : 73" :cy="isMobile ? 45 : 65"
            :rx="isMobile ? 18 : 26" :ry="isMobile ? 10 : 15"
            fill="white" opacity="0.24"
            :transform="`rotate(-28 ${isMobile ? 52 : 73} ${isMobile ? 45 : 65})`"
          />
        </svg>
      </div>

      <!-- Planet label below sphere -->
      <div class="planet-label">
        <div class="planet-name">{{ subtopic.title }}</div>
        <div class="planet-summary">{{ subtopic.summary }}</div>
      </div>

      <!-- ─── Orbiting concept moons ──────────────────────────────────── -->
      <!--
        Two-spinner orbit trick:
        .moon-rotator  — position:absolute at viewport center, spins CW
        .moon-offset   — position:absolute 0×0, translateX to orbit radius
        .moon-counter  — position:absolute 0×0, spins CCW at same rate → content upright
        .moon-btn      — position:absolute, translate(-50%,-50%) to centre on orbit point
        All layers are 0×0 so transform-origin is always exactly the orbit centre.
      -->
      <div
        v-for="(concept, i) in concepts"
        :key="concept.id"
        class="moon-rotator"
        :style="{
          animationDuration: `${ORBIT_DURATIONS[Math.min(i, ORBIT_DURATIONS.length - 1)]}s`,
          animationDelay: `-${ORBIT_DURATIONS[Math.min(i, ORBIT_DURATIONS.length - 1)] * PHASES[Math.min(i, PHASES.length - 1)]}s`,
        }"
      >
        <div class="moon-offset" :style="{ transform: `translateX(${orbitRadius(i)}px)` }">
          <div
            class="moon-counter"
            :style="{
              animationDuration: `${ORBIT_DURATIONS[Math.min(i, ORBIT_DURATIONS.length - 1)]}s`,
              animationDelay: `-${ORBIT_DURATIONS[Math.min(i, ORBIT_DURATIONS.length - 1)] * PHASES[Math.min(i, PHASES.length - 1)]}s`,
            }"
          >
            <button
              class="moon-btn"
              :aria-label="`Study ${concept.title}`"
              @click="enterConcept(concept.id)"
            >
              <!-- Moon orb -->
              <svg width="44" height="44" viewBox="0 0 44 44" class="moon-svg">
                <defs>
                  <radialGradient :id="`moon-grad-${concept.id}`" cx="35%" cy="32%" r="70%">
                    <stop offset="0%" :stop-color="moonColor(concept)" stop-opacity="0.95" />
                    <stop offset="60%" :stop-color="moonColor(concept)" stop-opacity="0.6" />
                    <stop offset="100%" stop-color="#060d1a" stop-opacity="0.8" />
                  </radialGradient>
                  <filter :id="`moon-glow-${concept.id}`" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <!-- Halo -->
                <circle cx="22" cy="22" r="20" :fill="moonColor(concept)" fill-opacity="0.12" />
                <!-- Body -->
                <circle cx="22" cy="22" r="16"
                  :fill="`url(#moon-grad-${concept.id})`"
                  :filter="`url(#moon-glow-${concept.id})`"
                />
                <!-- Specular -->
                <ellipse cx="15" cy="14" rx="5" ry="3" fill="white" opacity="0.28"
                  transform="rotate(-25 15 14)"
                />
                <!-- Visited checkmark -->
                <g v-if="isConceptVisited(concept.id)">
                  <circle cx="33" cy="11" r="7" fill="#02040a" />
                  <circle cx="33" cy="11" r="5.5" fill="#34d399" />
                  <path d="M30 11l2 2 4-4" stroke="#02040a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                </g>
              </svg>

              <!-- Label -->
              <span class="moon-label">{{ concept.title }}</span>
              <span class="moon-kind" :style="{ color: moonColor(concept) }">{{ concept.kind }}</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.planet-view {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-void-base);
}

.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

/* ─── HUD ─────────────────────────────────────────────────────────── */
.hud {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  background: linear-gradient(to bottom, rgba(2,4,10,0.88) 0%, rgba(2,4,10,0.6) 70%, transparent 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-hairline);
}

.back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.04);
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: background 200ms ease, color 200ms ease;
}
.back-btn:hover { background: rgba(232,236,242,0.09); color: var(--color-text-primary); }

.hud-center {
  flex: 1;
  display: flex; flex-direction: column; gap: 2px;
  min-width: 0;
}
.hud-chapter {
  font-family: var(--font-ui);
  font-size: 0.55rem; font-weight: 700;
  letter-spacing: 0.28em; text-transform: uppercase;
  color: var(--color-accent); opacity: 0.75;
}
.hud-title {
  font-family: var(--font-ui);
  font-size: 0.8rem; font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.hud-count {
  font-family: var(--font-ui);
  font-size: 0.72rem; color: var(--color-text-muted);
  display: flex; align-items: center; gap: 2px;
  flex-shrink: 0; font-weight: 600;
}
.hud-sep { opacity: 0.4; font-weight: 400; }

/* ─── Loading ─────────────────────────────────────────────────────── */
.center-screen {
  position: fixed; inset: 0; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
}
.loading-orb {
  width: 60px; height: 60px; border-radius: 50%;
  animation: orb-breathe 2s ease-in-out infinite alternate;
}
@keyframes orb-breathe {
  from { transform: scale(0.9); opacity: 0.7; }
  to   { transform: scale(1.06); opacity: 1; }
}
.loading-label {
  font-family: var(--font-ui);
  font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-text-muted); margin: 0;
}

/* ─── Orbit stage ─────────────────────────────────────────────────── */
.orbit-stage {
  position: relative;
  z-index: 5;
  width: 100%;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse 55% 55% at 50% 50%, rgba(58,143,232,0.10) 0%, transparent 70%),
    radial-gradient(ellipse 80% 60% at 30% 60%, rgba(100,60,200,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 60% 80% at 70% 40%, rgba(20,120,180,0.07) 0%, transparent 60%);
}

/* Orbit ring SVG, centred on the planet */
.orbit-rings {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* Central planet SVG — only the orb, so flex centre == sphere centre */
.planet-center {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
}
.planet-svg {
  display: block;
  animation: planet-breathe 6s ease-in-out infinite alternate;
}
@keyframes planet-breathe {
  from { filter: drop-shadow(0 0 14px rgba(58,143,232,0.28)); }
  to   { filter: drop-shadow(0 0 38px rgba(58,143,232,0.62)); }
}

/* Label below sphere (doesn't affect orbit anchor) */
.planet-label {
  position: absolute;
  top: calc(50% + 100px);
  left: 50%;
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  z-index: 3;
  pointer-events: none;
}
.planet-name {
  font-family: var(--font-ui);
  font-size: 0.96rem; font-weight: 700; letter-spacing: 0.05em;
  color: var(--color-text-primary);
  text-align: center; text-shadow: 0 1px 10px rgba(0,0,0,0.95);
  white-space: nowrap;
}
.planet-summary {
  font-family: var(--font-body);
  font-size: 0.72rem; color: var(--color-text-muted);
  text-align: center; max-width: 240px; line-height: 1.5;
  text-shadow: 0 1px 6px rgba(0,0,0,0.9); opacity: 0.75;
}

/* ─── Orbiting moons ──────────────────────────────────────────────── */

/* Outer spinner — 0×0 at viewport centre, rotates CW */
.moon-rotator {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  animation: spin-cw linear infinite;
}
@keyframes spin-cw {
  to { transform: rotate(360deg); }
}

/*
 * Middle layer — 0×0 absolute, translateX moves pivot to orbit radius.
 * Zero size keeps transform-origin at (0,0) = the orbit centre point.
 */
.moon-offset {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}

/*
 * Inner counter-spinner — 0×0 absolute, rotates CCW at same rate.
 * transform-origin (0,0) = orbit point, so cancels parent spin without drift.
 */
.moon-counter {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  animation: spin-ccw linear infinite;
}
@keyframes spin-ccw {
  to { transform: rotate(-360deg); }
}

/* Button centred on the (0,0) orbit point */
.moon-btn {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 12px;
  transition: filter 200ms ease;
}
.moon-btn:hover { filter: brightness(1.25); }
.moon-btn:hover .moon-svg { transform: scale(1.1); }

.moon-svg {
  display: block;
  transition: transform 200ms ease;
}

.moon-label {
  font-family: var(--font-ui);
  font-size: 0.62rem; font-weight: 600; letter-spacing: 0.04em;
  color: var(--color-text-primary);
  white-space: nowrap; text-shadow: 0 1px 6px rgba(0,0,0,0.95);
  max-width: 100px; overflow: hidden; text-overflow: ellipsis;
}
.moon-kind {
  font-family: var(--font-ui);
  font-size: 0.55rem; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; text-shadow: 0 1px 4px rgba(0,0,0,0.9); opacity: 0.8;
}

@media (max-width: 768px) {
  .planet-label { top: calc(50% + 72px); }
}
</style>
