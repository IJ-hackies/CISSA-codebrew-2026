<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGalaxyStore } from '@/lib/galaxyStore'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import type { Concept } from '@/types/galaxy'

const route = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy } = useGalaxyStore()

const loading = ref(false)
const selectedOptionId = ref<string | null>(null)
const submitted = ref(false)
const revealed = ref(false)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  await loadGalaxy(id)
  loading.value = false
})

// ─── Concept data ──────────────────────────────────────────────────────
const conceptId = computed(() => route.params.conceptId as string)

const concept = computed<Concept | null>(
  () => galaxy.value?.knowledge?.concepts.find((c) => c.id === conceptId.value) ?? null,
)

// Find the parent subtopic so we can go back to the right planet
const parentSubtopic = computed(() => {
  const g = galaxy.value
  if (!g?.knowledge || !conceptId.value) return null
  return g.knowledge.subtopics.find((s) => s.conceptIds.includes(conceptId.value)) ?? null
})

// ─── Kind styling ──────────────────────────────────────────────────────
const KIND_COLORS: Record<string, string> = {
  definition: '#4a9eff',
  formula:    '#c084fc',
  example:    '#34d399',
  fact:       '#fb923c',
  principle:  '#f472b6',
  process:    '#22d3ee',
}

const KIND_OPENERS: Record<string, string> = {
  definition: 'You are about to learn a key definition.',
  formula:    'A fundamental formula awaits.',
  example:    'Let\'s explore this through an example.',
  fact:       'There is a fact of the universe to uncover.',
  principle:  'A guiding principle governs this domain.',
  process:    'A process unfolds before you.',
}

const accentColor = computed(() =>
  concept.value ? (KIND_COLORS[concept.value.kind] ?? '#7a9abb') : '#7a9abb',
)

// ─── Seeded shuffle for deterministic options ──────────────────────────
function hash(str: string): number {
  let h = 0x811c9dc5
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  return h >>> 0
}
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff }
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = makeRng(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Challenge options ─────────────────────────────────────────────────
interface Option { id: string; text: string; isCorrect: boolean }

const challengeOptions = computed<Option[]>(() => {
  const g = galaxy.value
  const c = concept.value
  if (!g?.knowledge || !c) return []

  // Pick 3 distractors from other concepts in the same subtopic's topic,
  // falling back to any concept if needed. Seeded for consistency.
  const others = g.knowledge.concepts.filter((x) => x.id !== c.id)
  const seed = hash(c.id)
  const distractors = seededShuffle(others, seed).slice(0, 3)

  const raw: Option[] = [
    { id: '__correct__', text: c.brief, isCorrect: true },
    ...distractors.map((d) => ({ id: d.id, text: d.brief, isCorrect: false })),
  ]

  return seededShuffle(raw, seed ^ 0xabcdef)
})

const isCorrect = computed(() =>
  challengeOptions.value.find((o) => o.id === selectedOptionId.value)?.isCorrect ?? false,
)

// ─── Progress update (in-memory) ───────────────────────────────────────
function markVisited() {
  const g = galaxy.value
  const c = concept.value
  if (!g?.spatial || !c) return

  const body = g.spatial.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === c.id,
  )
  if (!body) return

  const existing = g.progress.bodies[body.id]
  const score = isCorrect.value ? 1 : 0
  g.progress.bodies[body.id] = {
    visited: true,
    attemptCount: (existing?.attemptCount ?? 0) + 1,
    bestScore: Math.max(existing?.bestScore ?? 0, score),
    lastScore: score,
    hintsUsed: existing?.hintsUsed ?? 0,
    timeSpentMs: existing?.timeSpentMs ?? 0,
    masteryEstimate: score,
    attempts: [
      ...(existing?.attempts ?? []),
      { at: Date.now(), score, chosenOptionId: selectedOptionId.value ?? '' },
    ],
  }

  if (!existing?.visited) g.progress.visitedCount++
  if (score === 1) g.progress.completedCount++
  g.progress.overallMastery =
    g.progress.totalBodies > 0
      ? g.progress.completedCount / g.progress.totalBodies
      : 0
}

// ─── Interactions ──────────────────────────────────────────────────────
function selectOption(id: string) {
  if (submitted.value) return
  selectedOptionId.value = id
}

function submit() {
  if (!selectedOptionId.value || submitted.value) return
  submitted.value = true
  markVisited()
}

function goBack() {
  const sub = parentSubtopic.value
  if (sub) {
    router.push(`/galaxy/${route.params.id}/planet/${sub.id}`)
  } else {
    router.push(`/galaxy/${route.params.id}`)
  }
}
</script>

<template>
  <div class="scene-page">
    <GalaxyRenderer class="bg" />

    <!-- ─── HUD ────────────────────────────────────────────────────────── -->
    <header class="hud">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <span class="hud-chapter">{{ concept?.chapter }}</span>
      <span
        class="hud-kind"
        :style="{ color: accentColor, borderColor: `${accentColor}44`, background: `${accentColor}11` }"
      >{{ concept?.kind }}</span>
    </header>

    <!-- ─── Loading ──────────────────────────────────────────────────── -->
    <div v-if="loading" class="center-screen">
      <p class="loading-label">Loading…</p>
    </div>

    <!-- ─── Scene content ────────────────────────────────────────────── -->
    <main v-else-if="concept" class="scene-scroll">
      <div class="scene-container">

        <!-- Opening narrative -->
        <div class="opening">
          <div class="opening-line" :style="{ background: `${accentColor}22`, borderColor: `${accentColor}44` }">
            <span class="opening-icon" :style="{ color: accentColor }">◈</span>
            <span class="opening-text">{{ KIND_OPENERS[concept.kind] ?? 'Something awaits.' }}</span>
          </div>
        </div>

        <!-- ─── Concept card ─────────────────────────────────────────── -->
        <div class="concept-card" :style="{ '--accent': accentColor }">
          <div class="card-glow" :style="{ background: `radial-gradient(ellipse at 30% 20%, ${accentColor}18, transparent 65%)` }" />

          <div class="card-header">
            <span
              class="kind-badge"
              :style="{ color: accentColor, borderColor: `${accentColor}44`, background: `${accentColor}12` }"
            >{{ concept.kind }}</span>
            <span class="chapter-tag">{{ concept.chapter }}</span>
          </div>

          <h1 class="concept-title">{{ concept.title }}</h1>
          <p class="concept-brief">{{ concept.brief }}</p>
        </div>

        <!-- ─── Challenge ────────────────────────────────────────────── -->
        <div class="challenge-section">
          <div class="challenge-header">
            <div class="challenge-rule" />
            <span class="challenge-label">Test your understanding</span>
            <div class="challenge-rule" />
          </div>

          <p class="challenge-question">
            Which of the following best describes
            <strong>{{ concept.title }}</strong>?
          </p>

          <div class="options-list">
            <button
              v-for="option in challengeOptions"
              :key="option.id"
              class="option-btn"
              :class="{
                selected: selectedOptionId === option.id && !submitted,
                correct: submitted && option.isCorrect,
                wrong: submitted && selectedOptionId === option.id && !option.isCorrect,
                dimmed: submitted && !option.isCorrect && selectedOptionId !== option.id,
              }"
              :disabled="submitted"
              @click="selectOption(option.id)"
            >
              <span class="option-indicator">
                <span v-if="!submitted" class="option-dot" :class="{ filled: selectedOptionId === option.id }" />
                <span v-else-if="option.isCorrect" class="option-check">✓</span>
                <span v-else-if="selectedOptionId === option.id" class="option-x">✗</span>
                <span v-else class="option-dot" />
              </span>
              <span class="option-text">{{ option.text }}</span>
            </button>
          </div>

          <!-- Submit -->
          <Transition name="fade-up">
            <button
              v-if="selectedOptionId && !submitted"
              class="submit-btn"
              :style="{ background: accentColor }"
              @click="submit"
            >
              Submit answer
            </button>
          </Transition>

          <!-- Result -->
          <Transition name="fade-up">
            <div v-if="submitted" class="result-banner" :class="isCorrect ? 'result-correct' : 'result-wrong'">
              <div class="result-icon">{{ isCorrect ? '✦' : '◇' }}</div>
              <div class="result-body">
                <p class="result-heading">{{ isCorrect ? 'Correct!' : 'Not quite.' }}</p>
                <p class="result-sub">
                  {{ isCorrect
                    ? 'Great work. This concept is now marked as visited.'
                    : 'The correct answer was highlighted above. Review it and try again next time.' }}
                </p>
              </div>
            </div>
          </Transition>

          <!-- Continue -->
          <Transition name="fade-up">
            <button v-if="submitted" class="continue-btn" @click="goBack">
              Continue exploring
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </Transition>
        </div>

        <div class="bottom-spacer" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.scene-page {
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
  opacity: 0.4;
}

/* ─── HUD ─────────────────────────────────────────────────────────── */
.hud {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: linear-gradient(to bottom, rgba(2,4,10,0.9) 0%, rgba(2,4,10,0.65) 70%, transparent 100%);
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

.hud-chapter {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: var(--color-text-muted);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hud-kind {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
  flex-shrink: 0;
}

/* ─── Loading ─────────────────────────────────────────────────────── */
.center-screen {
  position: fixed; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
}
.loading-label {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* ─── Scene scroll ───────────────────────────────────────────────── */
.scene-scroll {
  position: relative;
  z-index: 5;
  height: 100dvh;
  overflow-y: auto;
  padding-top: 72px;
}
.scene-container {
  max-width: 620px;
  margin: 0 auto;
  padding: 32px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ─── Opening ─────────────────────────────────────────────────────── */
.opening {
  display: flex;
  justify-content: center;
}
.opening-line {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid;
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-style: italic;
  color: var(--color-text-muted);
}
.opening-icon {
  font-style: normal;
  font-size: 1rem;
}
.opening-text { line-height: 1.4; }

/* ─── Concept card ───────────────────────────────────────────────── */
.concept-card {
  position: relative;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 22px;
  padding: 28px 28px 24px;
  background: rgba(8,14,26,0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  overflow: hidden;
}
.card-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.kind-badge {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
}
.chapter-tag {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  opacity: 0.6;
}
.concept-title {
  font-family: var(--font-ui);
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--color-text-primary);
  margin: 0 0 14px;
}
.concept-brief {
  font-family: var(--font-body);
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--color-text-muted);
  margin: 0;
}

/* ─── Challenge ──────────────────────────────────────────────────── */
.challenge-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.challenge-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.challenge-rule {
  flex: 1;
  height: 1px;
  background: var(--color-hairline-strong);
}
.challenge-label {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.challenge-question {
  font-family: var(--font-body);
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin: 0;
}
.challenge-question strong { font-weight: 600; color: #fff; }

/* ─── Options ────────────────────────────────────────────────────── */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.option-btn {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.03);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.84rem;
  line-height: 1.5;
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease, color 180ms ease;
}
.option-btn:hover:not(:disabled) {
  border-color: rgba(232,236,242,0.22);
  background: rgba(232,236,242,0.06);
  color: var(--color-text-primary);
}
.option-btn.selected {
  border-color: rgba(232,236,242,0.35);
  background: rgba(232,236,242,0.08);
  color: var(--color-text-primary);
}
.option-btn.correct {
  border-color: rgba(52,211,153,0.5);
  background: rgba(52,211,153,0.08);
  color: #6ee7b7;
}
.option-btn.wrong {
  border-color: rgba(248,113,113,0.5);
  background: rgba(248,113,113,0.08);
  color: #fca5a5;
}
.option-btn.dimmed { opacity: 0.4; }
.option-btn:disabled { cursor: default; }

.option-indicator {
  flex-shrink: 0;
  margin-top: 2px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.option-dot {
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  opacity: 0.5;
  display: block;
}
.option-dot.filled {
  border-color: var(--color-text-primary);
  background: var(--color-text-primary);
  opacity: 1;
}
.option-check { color: #34d399; font-size: 1rem; line-height: 1; }
.option-x     { color: #f87171; font-size: 1rem; line-height: 1; }
.option-text  { flex: 1; }

/* ─── Submit ─────────────────────────────────────────────────────── */
.submit-btn {
  align-self: center;
  padding: 12px 36px;
  border-radius: 999px;
  border: none;
  color: #02040a;
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: filter 200ms ease, transform 160ms ease;
}
.submit-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }

/* ─── Result banner ──────────────────────────────────────────────── */
.result-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
  border-radius: 16px;
  border: 1px solid;
}
.result-correct {
  border-color: rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.07);
}
.result-wrong {
  border-color: rgba(248,113,113,0.35);
  background: rgba(248,113,113,0.07);
}
.result-icon {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
}
.result-correct .result-icon { color: #34d399; }
.result-wrong  .result-icon { color: #f87171; }
.result-heading {
  font-family: var(--font-ui);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 5px;
}
.result-sub {
  font-family: var(--font-body);
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin: 0;
}

/* ─── Continue ───────────────────────────────────────────────────── */
.continue-btn {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 999px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.05);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 200ms ease, border-color 200ms ease, transform 160ms ease;
}
.continue-btn:hover {
  background: rgba(232,236,242,0.1);
  border-color: rgba(232,236,242,0.25);
  transform: translateY(-1px);
}

/* ─── Transitions ────────────────────────────────────────────────── */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 320ms ease, transform 320ms ease;
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.bottom-spacer { height: 80px; }
</style>
