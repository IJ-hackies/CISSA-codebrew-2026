<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGalaxyStore } from '@/lib/galaxyStore'
import { MOCK_GALAXY } from '@/lib/mockGalaxy'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'

const route = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy, setGalaxy } = useGalaxyStore()
const loading = ref(false)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) return
  if (!galaxy.value || galaxy.value.meta.id !== id) {
    loading.value = true
    try {
      await loadGalaxy(id)
    } catch {
      setGalaxy(MOCK_GALAXY)
    } finally {
      loading.value = false
    }
  }
})

const clusterCount = computed(() => galaxy.value?.knowledge?.clusters.length ?? 0)
const entryCount = computed(() => galaxy.value?.knowledge?.entries.length ?? 0)
const edgeCount = computed(() => galaxy.value?.relationships.edges.length ?? 0)
const visitedCount = computed(() => Object.keys(galaxy.value?.exploration.visited ?? {}).length)
const bookmarkCount = computed(() => galaxy.value?.exploration.bookmarked.length ?? 0)

const RING_R = 72
const RING_C = 2 * Math.PI * RING_R

const explorationFraction = computed(() => {
  const total = entryCount.value
  if (!total) return 0
  return Math.min(visitedCount.value / total, 1)
})

// Per-cluster breakdown
const clusterStats = computed(() => {
  const g = galaxy.value
  if (!g?.knowledge) return []
  return g.knowledge.clusters.map((c) => {
    const groupIds = new Set(c.groupIds)
    const clusterEntries = g.knowledge!.entries.filter((e) => {
      if (!e.groupId) return false
      const grp = g.knowledge!.groups.find((gr) => gr.id === e.groupId)
      return grp && groupIds.has(grp.id)
    })
    const wrap = g.wraps[c.id]
    const visited = clusterEntries.filter((e) => g.exploration.visited[e.id]).length
    return {
      id: c.id,
      title: c.title,
      color: wrap?.color ?? '#7c9ef8',
      mood: wrap?.mood ?? 'curious',
      total: clusterEntries.length,
      visited,
      fraction: clusterEntries.length > 0 ? visited / clusterEntries.length : 0,
    }
  })
})

function goBack() {
  router.push({ name: 'galaxy', params: { id: route.params.id } })
}
</script>

<template>
  <div class="stats-page">
    <GalaxyRenderer class="bg" />

    <header class="hud">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div class="hud-center">
        <span class="hud-super">{{ galaxy?.meta.title ?? '…' }}</span>
        <span class="hud-title">Exploration</span>
      </div>
    </header>

    <div v-if="loading" class="state-screen">
      <div class="loading-orb" />
      <p class="state-label">Loading…</p>
    </div>

    <main v-else-if="galaxy" class="scroll">
      <div class="content">

        <!-- Overview ring -->
        <section class="summary-section">
          <div class="ring-wrap">
            <svg width="190" height="190" viewBox="0 0 190 190">
              <circle cx="95" cy="95" :r="RING_R" fill="none" stroke="rgba(232,236,242,0.07)" stroke-width="10" />
              <circle
                cx="95" cy="95" :r="RING_R"
                fill="none"
                stroke="var(--color-accent)"
                stroke-width="10"
                stroke-linecap="round"
                :stroke-dasharray="RING_C"
                :stroke-dashoffset="RING_C * (1 - explorationFraction)"
                transform="rotate(-90 95 95)"
                class="arc"
              />
              <text x="95" y="88" text-anchor="middle" font-family="var(--font-ui)" font-size="28" font-weight="700" fill="var(--color-text-primary)">
                {{ Math.round(explorationFraction * 100) }}%
              </text>
              <text x="95" y="108" text-anchor="middle" font-family="var(--font-ui)" font-size="9" font-weight="600" letter-spacing="0.18em" fill="var(--color-text-muted)">
                EXPLORED
              </text>
            </svg>
          </div>

          <div class="pills">
            <div class="pill">
              <span class="pill-val" style="color: var(--color-accent)">{{ visitedCount }}</span>
              <span class="pill-label">visited</span>
            </div>
            <div class="pill-div" />
            <div class="pill">
              <span class="pill-val">{{ bookmarkCount }}</span>
              <span class="pill-label">bookmarked</span>
            </div>
            <div class="pill-div" />
            <div class="pill">
              <span class="pill-val" style="opacity: 0.45">{{ entryCount }}</span>
              <span class="pill-label">total</span>
            </div>
          </div>
        </section>

        <!-- Galaxy snapshot -->
        <section class="snap-section">
          <h2 class="section-heading">Galaxy snapshot</h2>
          <div class="snap-grid">
            <div class="snap-card">
              <span class="snap-val">{{ clusterCount }}</span>
              <span class="snap-label">Solar systems</span>
            </div>
            <div class="snap-card">
              <span class="snap-val">{{ entryCount }}</span>
              <span class="snap-label">Memory nodes</span>
            </div>
            <div class="snap-card">
              <span class="snap-val">{{ edgeCount }}</span>
              <span class="snap-label">Connections</span>
            </div>
          </div>
        </section>

        <!-- Per-cluster breakdown -->
        <section class="clusters-section">
          <h2 class="section-heading">By solar system</h2>
          <div class="cluster-cards">
            <div v-for="c in clusterStats" :key="c.id" class="cluster-card">
              <div class="card-header">
                <div class="card-dot" :style="{ background: c.color }" />
                <div class="card-meta">
                  <span class="card-title">{{ c.title }}</span>
                  <span class="card-mood">{{ c.mood }}</span>
                </div>
                <span class="card-pct" :style="{ color: c.color }">{{ Math.round(c.fraction * 100) }}%</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${c.fraction * 100}%`, background: c.color }" />
              </div>
              <div class="card-footer">
                <span class="count-label">{{ c.visited }} / {{ c.total }} entries visited</span>
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
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none; opacity: 0.35;
}

.hud {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  display: flex; align-items: center; gap: 14px;
  padding: 12px 20px;
  background: linear-gradient(to bottom, rgba(2,4,10,0.92) 0%, transparent 100%);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: #6f7989;
  transition: background 200ms, color 200ms;
}
.back-btn:hover { background: rgba(255,255,255,0.08); color: #e8ecf2; }
.hud-center { display: flex; flex-direction: column; gap: 2px; }
.hud-super { font-family: var(--font-ui); font-size: 0.52rem; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--color-accent); opacity: 0.7; }
.hud-title { font-family: var(--font-ui); font-size: 0.8rem; font-weight: 600; color: var(--color-text-primary); }

.state-screen {
  position: fixed; inset: 0; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
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
.state-label { font-family: var(--font-ui); font-size: 0.72rem; letter-spacing: 0.22em; text-transform: uppercase; color: #6f7989; margin: 0; }

.scroll { position: relative; z-index: 5; min-height: 100dvh; overflow-y: auto; padding-top: 72px; }
.content { max-width: 540px; margin: 0 auto; padding: 32px 20px 0; display: flex; flex-direction: column; gap: 48px; }

.summary-section { display: flex; flex-direction: column; align-items: center; gap: 28px; }
.ring-wrap { filter: drop-shadow(0 0 28px rgba(124,158,248,0.2)); }
.arc { transition: stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1); }

.pills { display: flex; align-items: center; gap: 20px; }
.pill { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pill-val { font-family: var(--font-ui); font-size: 1.6rem; font-weight: 700; color: var(--color-text-primary); line-height: 1; }
.pill-label { font-family: var(--font-ui); font-size: 0.55rem; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #6f7989; }
.pill-div { width: 1px; height: 36px; background: rgba(255,255,255,0.06); }

.section-heading { font-family: var(--font-ui); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #3a4558; margin: 0; }

.snap-section { display: flex; flex-direction: column; gap: 14px; }
.snap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.snap-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 18px 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
}
.snap-val { font-family: var(--font-ui); font-size: 1.5rem; font-weight: 700; color: #e8ecf2; line-height: 1; }
.snap-label { font-family: var(--font-ui); font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: #3a4558; text-align: center; }

.clusters-section { display: flex; flex-direction: column; gap: 12px; }
.cluster-cards { display: flex; flex-direction: column; gap: 8px; }
.cluster-card {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.05);
  background: rgba(2,4,10,0.55);
  backdrop-filter: blur(10px);
}
.card-header { display: flex; align-items: center; gap: 12px; }
.card-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.card-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.card-title { font-family: var(--font-ui); font-size: 0.82rem; font-weight: 600; color: #e8ecf2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-mood { font-family: var(--font-ui); font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: #3a4558; }
.card-pct { font-family: var(--font-ui); font-size: 0.78rem; font-weight: 700; flex-shrink: 0; }
.bar-track { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.06); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 2px; opacity: 0.75; transition: width 1s cubic-bezier(0.4,0,0.2,1); min-width: 0; }
.card-footer { }
.count-label { font-family: var(--font-ui); font-size: 0.62rem; color: #3a4558; }

.bottom-spacer { height: 80px; }
</style>
