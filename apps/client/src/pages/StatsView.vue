<template>
  <div class="stats-page">
    <div class="bg-grad" />

    <header class="hud">
      <button class="back-btn" @click="goBack" aria-label="Back to galaxy">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="hud-center">
        <span class="hud-super">Galaxy Overview</span>
        <span class="hud-title">{{ data ? 'Your Stella Taco' : '…' }}</span>
      </div>
    </header>

    <div v-if="!data" class="state-screen">
      <div class="loading-orb" />
      <p class="state-label">Loading…</p>
    </div>

    <main v-else class="scroll">
      <div class="content">

        <!-- Inventory hero -->
        <section class="inventory">
          <div class="tag">Inventory</div>
          <h1 class="big-title">
            <span class="hero-num">{{ displayPlanets }}</span>
            <span class="hero-word">planets</span>
            <span class="hero-sep">·</span>
            <span class="hero-num">{{ displayConcepts }}</span>
            <span class="hero-word">concepts</span>
          </h1>
          <p class="hero-sub">
            across <span class="accent">{{ inv.solarSystems }}</span> solar systems,
            threaded through <span class="accent">{{ inv.stories }}</span> character journeys.
          </p>

          <div class="inv-grid">
            <div class="inv-cell">
              <div class="inv-val">{{ displayWords }}</div>
              <div class="inv-lbl">total words</div>
            </div>
            <div class="inv-div" />
            <div class="inv-cell">
              <div class="inv-val">{{ displayConnections }}</div>
              <div class="inv-lbl">connections</div>
            </div>
            <div class="inv-div" />
            <div class="inv-cell">
              <div class="inv-val">{{ displaySouls }}<span class="inv-tot"> / {{ inv.concepts }}</span></div>
              <div class="inv-lbl">souls collected</div>
            </div>
          </div>
        </section>

        <!-- Insights / superlatives -->
        <section class="insights">
          <div class="tag">Insights</div>
          <h2 class="section-heading">The standouts of this galaxy</h2>

          <div class="insight-cards">
            <button
              v-if="mostConnected"
              class="insight-card"
              :style="{ '--accent': planetColor(mostConnected.entity.id) }"
              @click="openPlanet(mostConnected.entity.id)"
            >
              <div class="card-tag">Most connected</div>
              <div class="card-title">{{ mostConnected.entity.title }}</div>
              <div class="card-meta">Planet · {{ mostConnected.value }} ties</div>
              <div class="card-arrow">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M3 2l4 3.5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>

            <button
              v-if="mostReferenced"
              class="insight-card"
              :style="{ '--accent': conceptColor(mostReferenced.entity.id) }"
              @click="openConcept(mostReferenced.entity.id)"
            >
              <div class="card-tag">Most referenced</div>
              <div class="card-title">{{ mostReferenced.entity.title }}</div>
              <div class="card-meta">Concept · drives {{ mostReferenced.value }} stories</div>
              <div class="card-arrow">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M3 2l4 3.5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>

            <button
              v-if="longest"
              class="insight-card"
              :style="{ '--accent': '#ffd8b8' }"
              @click="openStory(longest.entity.id)"
            >
              <div class="card-tag">Longest story</div>
              <div class="card-title">{{ longest.entity.title }}</div>
              <div class="card-meta">Story · {{ longest.value.toLocaleString() }} words</div>
              <div class="card-arrow">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M3 2l4 3.5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>

            <button
              v-if="mostVisited"
              class="insight-card"
              :style="{ '--accent': '#a0f0d0' }"
              @click="goToSystem(mostVisited.entity.id)"
            >
              <div class="card-tag">Most visited system</div>
              <div class="card-title">{{ mostVisited.entity.title }}</div>
              <div class="card-meta">Solar System · {{ mostVisited.value }} scene visits</div>
              <div class="card-arrow">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M3 2l4 3.5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </button>
          </div>
        </section>

        <div class="bottom-spacer" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gsap from 'gsap'
import { useMeshStore } from '@/lib/meshStore'
import {
  galaxyInventory,
  mostConnectedPlanet,
  mostReferencedConcept,
  longestStory,
  mostVisitedSolarSystem,
} from '@/lib/entityStats'
import type { UUID } from '@/lib/meshApi'

const route = useRoute()
const router = useRouter()
const { data, collectedConceptIds, loadFromApi } = useMeshStore()

const galaxyId = computed(() => (route.params.id as string) ?? 'fixture')

onMounted(async () => {
  if (!data.value) {
    await loadFromApi(galaxyId.value)
  }
})

// ── Inventory computations ─────────────────────────────────────────────────

const inv = computed(() =>
  data.value
    ? galaxyInventory(data.value)
    : { solarSystems: 0, planets: 0, concepts: 0, stories: 0, totalConnections: 0, totalWordCount: 0 },
)

const mostConnected = computed(() => (data.value ? mostConnectedPlanet(data.value) : null))
const mostReferenced = computed(() => (data.value ? mostReferencedConcept(data.value) : null))
const longest = computed(() => (data.value ? longestStory(data.value) : null))
const mostVisited = computed(() => (data.value ? mostVisitedSolarSystem(data.value) : null))

// ── Count-up display state ─────────────────────────────────────────────────

const displayPlanets = ref(0)
const displayConcepts = ref(0)
const displayWords = ref('0')
const displayConnections = ref(0)
const displaySouls = ref(0)

function runCountUps() {
  if (!data.value) return
  const target = {
    p: inv.value.planets,
    c: inv.value.concepts,
    w: inv.value.totalWordCount,
    n: inv.value.totalConnections,
    s: collectedConceptIds.value.size,
  }
  const counter = { p: 0, c: 0, w: 0, n: 0, s: 0 }
  gsap.to(counter, {
    p: target.p,
    c: target.c,
    w: target.w,
    n: target.n,
    s: target.s,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: () => {
      displayPlanets.value = Math.round(counter.p)
      displayConcepts.value = Math.round(counter.c)
      displayWords.value = Math.round(counter.w).toLocaleString()
      displayConnections.value = Math.round(counter.n)
      displaySouls.value = Math.round(counter.s)
    },
  })
}

onMounted(() => {
  if (data.value) runCountUps()
  else {
    // Wait a tick for loadFromApi to settle
    setTimeout(runCountUps, 60)
  }
})

// ── Color seeding (matches SolarSystemView + ConceptHUD) ──────────────────

const PLANET_COLORS = [
  '#6a8cff', '#ff7c6e', '#7de8c0', '#ffd166',
  '#c77dff', '#4cc9f0', '#f77f00', '#a8dadc',
  '#84a98c', '#e63946', '#457b9d', '#e9c46a',
]
const CONCEPT_COLORS = [
  '#b5a0ff', '#ffc8e8', '#a0f0d0', '#ffeaa7',
  '#dfe0ff', '#c8f0ff', '#ffd8b8', '#e8f4a0',
]
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}
function planetColor(id: UUID): string { return PLANET_COLORS[hash(id) % PLANET_COLORS.length] }
function conceptColor(id: UUID): string { return CONCEPT_COLORS[hash(id) % CONCEPT_COLORS.length] }

// ── Navigation from insight cards ──────────────────────────────────────────

/** Find the solar system id containing a given planet. */
function findSystemForPlanet(planetId: UUID): UUID | null {
  if (!data.value) return null
  for (const sysId in data.value.solarSystems) {
    if (data.value.solarSystems[sysId].planets.includes(planetId)) return sysId
  }
  return null
}

/** Find the solar system id containing a given concept. */
function findSystemForConcept(conceptId: UUID): UUID | null {
  if (!data.value) return null
  for (const sysId in data.value.solarSystems) {
    if (data.value.solarSystems[sysId].concepts.includes(conceptId)) return sysId
  }
  return null
}

/** Pick any solar system as the "home" for a story (stories span systems). */
function firstSystemForStory(storyId: UUID): UUID | null {
  if (!data.value) return null
  const story = data.value.stories.find((s) => s.id === storyId)
  if (!story || !story.scenes.length) {
    const keys = Object.keys(data.value.solarSystems)
    return keys[0] ?? null
  }
  return findSystemForPlanet(story.scenes[0].planetId)
}

function navigateWithOpen(sysId: UUID, query: Record<string, string>) {
  router.push({
    name: 'solar-system',
    params: { id: galaxyId.value, clusterId: sysId },
    query,
  })
}

function openPlanet(planetId: UUID) {
  const sysId = findSystemForPlanet(planetId)
  if (!sysId) return
  navigateWithOpen(sysId, { openPlanet: planetId })
}

function openConcept(conceptId: UUID) {
  const sysId = findSystemForConcept(conceptId)
  if (!sysId) return
  navigateWithOpen(sysId, { openConcept: conceptId })
}

function openStory(storyId: UUID) {
  const sysId = firstSystemForStory(storyId)
  if (!sysId) return
  navigateWithOpen(sysId, { openStory: storyId })
}

function goToSystem(sysId: UUID) {
  router.push({ name: 'solar-system', params: { id: galaxyId.value, clusterId: sysId } })
}

function goBack() {
  router.push({ name: 'galaxy', params: { id: galaxyId.value } })
}
</script>

<style scoped>
.stats-page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  background: #02040a;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.85);
}
.bg-grad {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 10%, rgba(124, 158, 248, 0.09), transparent 60%),
    radial-gradient(ellipse at 80% 90%, rgba(181, 160, 255, 0.08), transparent 60%),
    #02040a;
  z-index: 0;
}

/* ── Header ────────────────────────────────────────────────── */
.hud {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 22px;
  background: linear-gradient(to bottom, rgba(2, 4, 10, 0.82) 0%, transparent 100%);
  backdrop-filter: blur(14px);
}
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(8, 10, 20, 0.7);
  color: rgba(255, 255, 255, 0.65);
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.back-btn:hover {
  background: rgba(20, 25, 45, 0.92);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.26);
}
.hud-center { display: flex; flex-direction: column; gap: 2px; }
.hud-super {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
}
.hud-title {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

/* ── States ────────────────────────────────────────────────── */
.state-screen {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}
.loading-orb {
  width: 56px; height: 56px; border-radius: 50%;
  background: radial-gradient(circle at 36% 32%, #7c9ef8, #1a3a7a 55%, #060d1a);
  animation: orb-breathe 2s ease-in-out infinite alternate;
}
@keyframes orb-breathe {
  from { transform: scale(0.9); opacity: 0.7; }
  to   { transform: scale(1.06); opacity: 1; }
}
.state-label {
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
}

/* ── Scroll + content ──────────────────────────────────────── */
.scroll {
  position: relative;
  z-index: 5;
  min-height: 100dvh;
  overflow-y: auto;
  padding-top: 84px;
}
.content {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 28px 60px;
  display: flex;
  flex-direction: column;
  gap: 64px;
}

/* ── Inventory hero ────────────────────────────────────────── */
.inventory { display: flex; flex-direction: column; gap: 18px; }
.tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}
.big-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
  font-size: clamp(38px, 7vw, 58px);
  font-weight: 800;
  color: #fff;
  margin: 0;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.hero-num {
  color: #fff;
  font-feature-settings: 'tnum' 1;
}
.hero-word {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.7em;
  letter-spacing: -0.01em;
}
.hero-sep {
  color: rgba(255, 255, 255, 0.2);
  font-weight: 300;
}
.hero-sub {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
  margin: 0;
  max-width: 48ch;
}
.hero-sub .accent { color: #fff; font-weight: 600; }

.inv-grid {
  display: flex;
  align-items: stretch;
  gap: 14px;
  margin-top: 16px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.inv-cell {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.inv-val {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.01em;
}
.inv-tot {
  color: rgba(255, 255, 255, 0.35);
  font-weight: 500;
  font-size: 14px;
}
.inv-lbl {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}
.inv-div {
  width: 1px;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Insights section ──────────────────────────────────────── */
.insights { display: flex; flex-direction: column; gap: 14px; }
.section-heading {
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.insight-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
@media (max-width: 640px) {
  .insight-cards { grid-template-columns: 1fr; }
}

.insight-card {
  position: relative;
  text-align: left;
  padding: 18px 42px 16px 20px;
  border-radius: 16px;
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--accent, #aac8ff) 14%, transparent) 0%,
      rgba(255, 255, 255, 0.03) 60%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s, background 0.2s;
}
.insight-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--accent, rgba(170, 200, 255, 0.7));
}
.insight-card:hover {
  border-color: rgba(255, 255, 255, 0.22);
  transform: translateY(-2px);
}
.card-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin-bottom: 6px;
}
.card-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin-bottom: 6px;
}
.card-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  font-feature-settings: 'tnum' 1;
}
.card-arrow {
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  transition: color 0.2s, transform 0.2s;
}
.insight-card:hover .card-arrow {
  color: #fff;
  transform: translateY(-50%) translateX(2px);
}

.bottom-spacer { height: 40px; }
</style>
