<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGalaxyStore } from '@/lib/galaxyStore'
import type { Concept, Palette, Subtopic } from '@/types/galaxy'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import SkillTreeHUD from '@/components/skill-tree/SkillTreeHUD.vue'
import ConstellationSection, { type ConstellationNode } from '@/components/skill-tree/ConstellationSection.vue'
import type { NodeState } from '@/components/skill-tree/ConstellationSection.vue'

// ─── Store & routing ──────────────────────────────────────────────────
const route = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy } = useGalaxyStore()

const loading = ref(false)
const loadError = ref<string | null>(null)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) return
  try {
    loading.value = true
    await loadGalaxy(id)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})

// ─── Palette lookup via spatial bodies ───────────────────────────────
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

// ─── Progress lookup via spatial body ID ─────────────────────────────
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

// ─── Tree builder ─────────────────────────────────────────────────────
interface TreeTopic {
  id: string
  chapter: string
  title: string
  topicIdx: number
  nodes: ConstellationNode[]
}

const tree = computed<TreeTopic[]>(() => {
  const g = galaxy.value
  if (!g?.knowledge) return []

  const conceptMap = new Map(g.knowledge.concepts.map((c) => [c.id, c]))
  const subtopicMap = new Map(g.knowledge.subtopics.map((s) => [s.id, s]))

  return g.knowledge.topics.map((topic, topicIdx) => {
    const subtopics = topic.subtopicIds
      .map((id) => subtopicMap.get(id))
      .filter(Boolean) as Subtopic[]

    const nodes: ConstellationNode[] = subtopics.map((subtopic, subIdx) => {
      const concepts = subtopic.conceptIds
        .map((id) => conceptMap.get(id))
        .filter(Boolean) as Concept[]

      const prog = progressFor(subtopic.id)
      const completedCount = concepts.filter((c) => progressFor(c.id)?.visited).length
      const mastery = prog?.masteryEstimate ?? 0
      const visited = prog?.visited ?? false

      let state: NodeState
      if (mastery >= 0.9) {
        state = 'mastered'
      } else if (visited || (prog?.attemptCount ?? 0) > 0) {
        state = 'in-progress'
      } else if (subIdx === 0) {
        // First subtopic in every topic is available
        state = 'available'
      } else {
        const prevProg = progressFor(subtopics[subIdx - 1].id)
        state = prevProg?.visited ? 'available' : 'locked'
      }

      return {
        subtopic,
        concepts,
        palette: subtopicPalette.value.get(subtopic.id) ?? null,
        state,
        completedCount,
        paletteIndex: topicIdx,
      }
    })

    return { id: topic.id, chapter: topic.chapter, title: topic.title, topicIdx, nodes }
  })
})

// ─── Overall stats ────────────────────────────────────────────────────
const stats = computed(() => {
  const g = galaxy.value
  if (!g) return { visited: 0, total: 0, mastery: 0 }
  return { visited: g.progress.visitedCount, total: g.progress.totalBodies, mastery: g.progress.overallMastery }
})

function goBack() {
  router.push('/')
}

function onNavigate(subtopicId: string) {
  router.push(`/galaxy/${route.params.id}/planet/${subtopicId}`)
}

function goStats() {
  router.push(`/galaxy/${route.params.id}/stats`)
}
</script>

<template>
  <div class="skill-tree-page">
    <!-- Cosmic background -->
    <GalaxyRenderer class="bg-renderer" />

    <SkillTreeHUD
      :title="galaxy?.meta.title ?? 'Loading…'"
      :visited-count="stats.visited"
      :total-nodes="stats.total"
      :overall-mastery="stats.mastery"
      @back="goBack"
      @stats="goStats"
    />

    <!-- Loading -->
    <div v-if="loading" class="state-screen">
      <div class="loading-orb" />
      <p class="state-label">Charting the galaxy…</p>
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="state-screen">
      <p class="error-msg">{{ loadError }}</p>
      <button class="back-btn-inline" @click="goBack">Go back</button>
    </div>

    <!-- Skill tree -->
    <main v-else-if="galaxy?.knowledge" class="tree-scroll">
      <div class="tree-container">
        <template v-for="section in tree" :key="section.id">
          <!-- Topic header -->
          <div class="topic-header">
            <div class="topic-rule" />
            <div class="topic-pill">
              <span class="topic-chapter">{{ section.chapter }}</span>
              <span class="topic-title">{{ section.title }}</span>
            </div>
            <div class="topic-rule" />
          </div>

          <!-- Constellation of subtopic nodes -->
          <ConstellationSection :nodes="section.nodes" :section-id="section.id" @navigate="onNavigate" />
        </template>

        <div class="bottom-spacer" />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ─── Page ───────────────────────────────────────────────────────── */
.skill-tree-page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  background: var(--color-void-base);
}

.bg-renderer {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.45;
}

/* ─── Loading / error screens ────────────────────────────────────── */
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
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 32%, #92ccff, #1a3a7a 55%, #060d1a);
  box-shadow: 0 0 36px rgba(58, 143, 232, 0.55);
  animation: orb-breathe 2.2s ease-in-out infinite alternate;
}
@keyframes orb-breathe {
  from { transform: scale(0.9); box-shadow: 0 0 20px rgba(58, 143, 232, 0.3); }
  to   { transform: scale(1.06); box-shadow: 0 0 54px rgba(58, 143, 232, 0.7); }
}

.state-label {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0;
}

.error-msg {
  color: #f87171;
  max-width: 340px;
  text-align: center;
  font-family: var(--font-body);
}

.back-btn-inline {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  padding: 8px 22px;
  border: 1px solid var(--color-hairline-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-primary);
  transition: background 200ms ease;
}
.back-btn-inline:hover {
  background: rgba(232, 236, 242, 0.06);
}

/* ─── Scroll layout ──────────────────────────────────────────────── */
.tree-scroll {
  position: relative;
  z-index: 5;
  height: 100dvh;
  overflow-y: auto;
  padding-top: 76px;
  scroll-behavior: smooth;
}

.tree-container {
  max-width: 580px;
  margin: 0 auto;
  padding: 24px 0 0;
  display: flex;
  flex-direction: column;
}

/* ─── Topic header ───────────────────────────────────────────────── */
.topic-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 36px 20px 20px;
}

.topic-rule {
  flex: 1;
  height: 1px;
  background: var(--color-hairline-strong);
}

.topic-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 20px;
  border: 1px solid var(--color-hairline-strong);
  border-radius: 999px;
  background: rgba(2, 4, 10, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  white-space: nowrap;
  flex-shrink: 0;
}

.topic-chapter {
  font-family: var(--font-ui);
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--color-accent);
  opacity: 0.8;
}

.topic-title {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
}

/* ─── Bottom spacer ──────────────────────────────────────────────── */
.bottom-spacer {
  height: 100px;
}
</style>
