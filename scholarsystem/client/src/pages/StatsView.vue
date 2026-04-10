<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGalaxyStore } from '@/lib/galaxyStore'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import type { Palette } from '@/types/galaxy'

const route  = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy } = useGalaxyStore()

const loading = ref(false)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  await loadGalaxy(id)
  loading.value = false
})

// ─── Palette lookup ────────────────────────────────────────────────────
const DEFAULT_PALETTE: Palette = {
  primary: '#3a8fe8', secondary: '#0d2a5e',
  accent: '#92ccff', atmosphere: 'rgba(58,143,232,0.24)',
}

const subtopicPalette = computed<Map<string, Palette>>(() => {
  const g = galaxy.value
  if (!g?.spatial) return new Map()
  const map = new Map<string, Palette>()
  for (const body of g.spatial.bodies) {
    if ('knowledgeRef' in body && body.knowledgeRef) {
      const vis = g.visuals[body.id] as any
      if (vis?.palette) map.set(body.knowledgeRef, vis.palette)
    }
  }
  return map
})

// ─── Body-id lookup (for progress) ────────────────────────────────────
const bodyIdByRef = computed<Map<string, string>>(() => {
  const g = galaxy.value
  if (!g?.spatial) return new Map()
  const map = new Map<string, string>()
  for (const body of g.spatial.bodies) {
    if ('knowledgeRef' in body && body.knowledgeRef) {
      map.set(body.knowledgeRef, body.id)
    }
  }
  return map
})

function progressFor(knowledgeId: string) {
  const g = galaxy.value
  const bodyId = bodyIdByRef.value.get(knowledgeId)
  if (!bodyId || !g) return null
  return g.progress.bodies[bodyId] ?? null
}

// ─── Overall stats ─────────────────────────────────────────────────────
const overall = computed(() => {
  const g = galaxy.value
  if (!g) return { mastery: 0, visited: 0, total: 0, completed: 0 }
  return {
    mastery:   g.progress.overallMastery,
    visited:   g.progress.visitedCount,
    total:     g.progress.totalBodies,
    completed: g.progress.completedCount,
  }
})

// SVG donut ring
const RING_R = 72
const RING_C = 2 * Math.PI * RING_R  // ≈ 452.4

// ─── Per-topic breakdown ───────────────────────────────────────────────
interface TopicStat {
  id: string
  chapter: string
  title: string
  subtopicsVisited: number
  subtopicsTotal: number
  conceptsVisited: number
  conceptsTotal: number
  topicMastery: number
  palette: Palette
}

const topicStats = computed<TopicStat[]>(() => {
  const g = galaxy.value
  if (!g?.knowledge) return []

  const conceptMap  = new Map(g.knowledge.concepts.map(c => [c.id, c]))
  const subtopicMap = new Map(g.knowledge.subtopics.map(s => [s.id, s]))

  return g.knowledge.topics.map(topic => {
    const subtopics = topic.subtopicIds.map(id => subtopicMap.get(id)).filter(Boolean) as typeof g.knowledge.subtopics

    let subtopicsVisited = 0
    let conceptsVisited  = 0
    let conceptsTotal    = 0
    let masterySum       = 0
    let palette: Palette = DEFAULT_PALETTE

    for (const sub of subtopics) {
      const subProg = progressFor(sub.id)
      if (subProg?.visited) subtopicsVisited++

      // First palette found in this topic wins
      const pal = subtopicPalette.value.get(sub.id)
      if (pal && palette === DEFAULT_PALETTE) palette = pal

      const concepts = sub.conceptIds.map(id => conceptMap.get(id)).filter(Boolean) as typeof g.knowledge.concepts
      conceptsTotal += concepts.length

      for (const c of concepts) {
        const prog = progressFor(c.id)
        if (prog?.visited) conceptsVisited++
        masterySum += prog?.masteryEstimate ?? 0
      }
    }

    const topicMastery = conceptsTotal > 0 ? masterySum / conceptsTotal : 0

    return {
      id:               topic.id,
      chapter:          topic.chapter,
      title:            topic.title,
      subtopicsVisited,
      subtopicsTotal:   subtopics.length,
      conceptsVisited,
      conceptsTotal,
      topicMastery,
      palette,
    }
  })
})

// ─── Navigation ────────────────────────────────────────────────────────
function goBack() {
  router.push(`/galaxy/${route.params.id}`)
}
</script>

<template>
  <div class="stats-page">
    <GalaxyRenderer class="bg" />

    <!-- HUD -->
    <header class="hud">
      <button class="back-btn" aria-label="Back to skill tree" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="hud-center">
        <span class="hud-super">{{ galaxy?.meta.title ?? 'Loading…' }}</span>
        <span class="hud-title">Progress Report</span>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="state-screen">
      <div class="loading-orb" />
      <p class="state-label">Loading progress…</p>
    </div>

    <!-- Content -->
    <main v-else-if="galaxy" class="scroll">
      <div class="content">

        <!-- ── Overall mastery ring ────────────────────────────────── -->
        <section class="summary-section">
          <div class="ring-wrap">
            <svg
              class="ring-svg"
              width="190"
              height="190"
              viewBox="0 0 190 190"
            >
              <!-- Track -->
              <circle
                cx="95" cy="95" :r="RING_R"
                fill="none"
                stroke="rgba(232,236,242,0.07)"
                stroke-width="10"
              />
              <!-- Progress arc -->
              <circle
                cx="95" cy="95" :r="RING_R"
                fill="none"
                stroke="var(--color-accent)"
                stroke-width="10"
                stroke-linecap="round"
                :stroke-dasharray="RING_C"
                :stroke-dashoffset="RING_C * (1 - overall.mastery)"
                transform="rotate(-90 95 95)"
                class="arc"
              />
              <!-- Percentage -->
              <text
                x="95" y="88"
                text-anchor="middle"
                font-family="var(--font-ui)"
                font-size="28"
                font-weight="700"
                fill="var(--color-text-primary)"
              >{{ Math.round(overall.mastery * 100) }}%</text>
              <text
                x="95" y="108"
                text-anchor="middle"
                font-family="var(--font-ui)"
                font-size="9"
                font-weight="600"
                letter-spacing="0.18em"
                text-transform="uppercase"
                fill="var(--color-text-muted)"
              >MASTERY</text>
            </svg>
          </div>

          <!-- Counter pills -->
          <div class="pills">
            <div class="pill">
              <span class="pill-val" style="color: var(--color-accent)">{{ overall.visited }}</span>
              <span class="pill-label">explored</span>
            </div>
            <div class="pill-div" />
            <div class="pill">
              <span class="pill-val">{{ overall.completed }}</span>
              <span class="pill-label">mastered</span>
            </div>
            <div class="pill-div" />
            <div class="pill">
              <span class="pill-val" style="opacity: 0.45">{{ overall.total }}</span>
              <span class="pill-label">total</span>
            </div>
          </div>
        </section>

        <!-- ── Per-topic breakdown ─────────────────────────────────── -->
        <section class="topics-section">
          <h2 class="section-heading">By Topic</h2>

          <div class="topic-cards">
            <div
              v-for="t in topicStats"
              :key="t.id"
              class="topic-card"
            >
              <!-- Card header -->
              <div class="card-header">
                <div class="card-meta">
                  <span class="card-chapter" :style="{ color: t.palette.accent }">{{ t.chapter }}</span>
                  <span class="card-title">{{ t.title }}</span>
                </div>
                <span class="card-mastery" :style="{ color: t.palette.accent }">
                  {{ Math.round(t.topicMastery * 100) }}%
                </span>
              </div>

              <!-- Mastery bar -->
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{
                    width: `${t.topicMastery * 100}%`,
                    background: `linear-gradient(to right, ${t.palette.primary}, ${t.palette.accent})`,
                  }"
                />
              </div>

              <!-- Footer counts -->
              <div class="card-footer">
                <span class="card-count">
                  <span :style="{ color: t.palette.accent }">{{ t.subtopicsVisited }}</span>
                  <span class="count-sep">/{{ t.subtopicsTotal }}</span>
                  <span class="count-label">subtopics</span>
                </span>
                <span class="card-count">
                  <span :style="{ color: t.palette.accent }">{{ t.conceptsVisited }}</span>
                  <span class="count-sep">/{{ t.conceptsTotal }}</span>
                  <span class="count-label">concepts</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <div class="bottom-spacer" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.stats-page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  background: var(--color-void-base);
}

.bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.45;
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
  background: linear-gradient(to bottom, rgba(2,4,10,0.92) 0%, rgba(2,4,10,0.7) 70%, transparent 100%);
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
  display: flex; flex-direction: column; gap: 2px;
}
.hud-super {
  font-family: var(--font-ui);
  font-size: 0.52rem; font-weight: 700;
  letter-spacing: 0.26em; text-transform: uppercase;
  color: var(--color-accent); opacity: 0.7;
}
.hud-title {
  font-family: var(--font-ui);
  font-size: 0.8rem; font-weight: 600;
  color: var(--color-text-primary);
}

/* ─── Loading ─────────────────────────────────────────────────────── */
.state-screen {
  position: fixed; inset: 0; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
}
.loading-orb {
  width: 56px; height: 56px; border-radius: 50%;
  background: radial-gradient(circle at 36% 32%, #92ccff, #1a3a7a 55%, #060d1a);
  animation: orb-breathe 2s ease-in-out infinite alternate;
}
@keyframes orb-breathe {
  from { transform: scale(0.9); opacity: 0.7; }
  to   { transform: scale(1.06); opacity: 1; }
}
.state-label {
  font-family: var(--font-ui);
  font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--color-text-muted); margin: 0;
}

/* ─── Scroll / layout ────────────────────────────────────────────── */
.scroll {
  position: relative;
  z-index: 5;
  min-height: 100dvh;
  overflow-y: auto;
  padding-top: 72px;
}

.content {
  max-width: 540px;
  margin: 0 auto;
  padding: 32px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

/* ─── Summary section ────────────────────────────────────────────── */
.summary-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.ring-wrap {
  position: relative;
  filter: drop-shadow(0 0 28px rgba(58,143,232,0.22));
}

.ring-svg {
  display: block;
}

.arc {
  transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Counter pills */
.pills {
  display: flex;
  align-items: center;
  gap: 20px;
}
.pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pill-val {
  font-family: var(--font-ui);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
}
.pill-label {
  font-family: var(--font-ui);
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.pill-div {
  width: 1px;
  height: 36px;
  background: var(--color-hairline-strong);
}

/* ─── Topics section ─────────────────────────────────────────────── */
.topics-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-heading {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0;
}

.topic-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topic-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid var(--color-hairline);
  background: rgba(2, 4, 10, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.card-chapter {
  font-family: var(--font-ui);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  opacity: 0.85;
}

.card-title {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-mastery {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  font-weight: 700;
  flex-shrink: 0;
}

.bar-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(232,236,242,0.07);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
}

.card-footer {
  display: flex;
  gap: 20px;
}

.card-count {
  font-family: var(--font-ui);
  font-size: 0.68rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.count-sep {
  opacity: 0.45;
}

.count-label {
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  opacity: 0.6;
  margin-left: 2px;
}

/* ─── Spacer ──────────────────────────────────────────────────────── */
.bottom-spacer { height: 80px; }
</style>
