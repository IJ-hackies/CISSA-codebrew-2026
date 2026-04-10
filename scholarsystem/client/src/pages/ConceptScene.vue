<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGalaxyStore } from '@/lib/galaxyStore'
import { getScene, generateScene as apiGenerateScene } from '@/lib/api'
import SceneBackground from '@/components/scene/SceneBackground.vue'
import CharacterSprite from '@/components/scene/CharacterSprite.vue'
import DialogueBox from '@/components/scene/DialogueBox.vue'
import ChallengePanel from '@/components/scene/ChallengePanel.vue'
import type { Biome } from '@/components/scene/SceneBackground.vue'
import type { CharacterId, AnimationId } from '@/components/scene/CharacterSprite.vue'
import type { Challenge } from '@/components/scene/minigames/index'
import type { DialogueLine } from '@/components/scene/DialogueBox.vue'
import type { Concept } from '@/types/galaxy'
import {
  pickArchetype,
  pickChallengeType,
  generateChallenge,
  generateDialogue as mockGenerateDialogue,
  getOpeningNarrative,
  type Archetype,
  type ConceptLike,
} from '@/lib/mockScene'

const route  = useRoute()
const router = useRouter()
const { galaxy, loadGalaxy } = useGalaxyStore()

// ─── Scene phase ───────────────────────────────────────────────────────
// narrative = non-dialogue archetypes show opening flavour text before challenge
type Phase = 'loading' | 'dialogue' | 'narrative' | 'challenge' | 'result'
const phase = ref<Phase>('loading')

// ─── Data loading ──────────────────────────────────────────────────────
const loading = ref(false)
const generatingScene = ref(false)

// Backend scene data (null = use mock fallback).
const backendScene = ref<any>(null)

onMounted(async () => {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  await loadGalaxy(id)
  loading.value = false

  const arc = archetype.value
  // guardian-dialogue and memory-echo open with full NPC dialogue
  if (arc === 'guardian-dialogue' || arc === 'memory-echo') {
    phase.value = 'dialogue'
  } else {
    phase.value = 'narrative'
  }

  // Fire-and-forget: try to fetch/generate a real scene in the background.
  // The scene starts with mock data immediately. If a backend scene arrives
  // before the user reaches the challenge, the computeds swap it in
  // reactively. If not, mock works fine and the scene gets cached for
  // revisits.
  tryLoadScene(id)
})

/**
 * Try to load a scene from the backend. Falls back to mock if unavailable.
 * Non-blocking — the component renders with mock data while this runs.
 */
async function tryLoadScene(galaxyId: string) {
  const bId = bodyId.value
  if (!bId) return

  try {
    // 1. Check if a cached scene already exists.
    const cached = await getScene(galaxyId, bId)
    if (cached) {
      backendScene.value = cached
      return
    }

    // 2. Generate on-demand.
    generatingScene.value = true
    const scene = await apiGenerateScene(galaxyId, bId)
    backendScene.value = scene
  } catch (err) {
    // Silently fall back to mock scene — the user still gets to play.
    console.warn('[ConceptScene] backend scene unavailable, using mock:', err)
  } finally {
    generatingScene.value = false
  }
}

// ─── Concept data ──────────────────────────────────────────────────────
const conceptId = computed(() => route.params.conceptId as string)

const concept = computed<Concept | null>(
  () => galaxy.value?.knowledge?.concepts.find((c) => c.id === conceptId.value) ?? null,
)

const parentSubtopic = computed(() => {
  const g = galaxy.value
  if (!g?.knowledge || !conceptId.value) return null
  return g.knowledge.subtopics.find((s) => s.conceptIds.includes(conceptId.value)) ?? null
})

// ─── Body ID lookup ────────────────────────────────────────────────────
const bodyId = computed<string | null>(() => {
  const g = galaxy.value
  const c = concept.value
  if (!g?.spatial || !c) return null
  const body = g.spatial.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === c.id,
  )
  return body?.id ?? null
})

// ─── Neighbours for challenge generation ──────────────────────────────
function toConceptLike(c: Concept): ConceptLike {
  return {
    id:        c.id,
    title:     c.title,
    kind:      c.kind,
    brief:     c.brief,
    modelTier: (c as any).modelTier ?? 'standard',
  }
}

const neighbours = computed<ConceptLike[]>(() => {
  const g = galaxy.value
  const c = concept.value
  if (!g?.knowledge || !c) return []
  const sub       = parentSubtopic.value
  const siblingIds = sub?.conceptIds ?? []
  const siblings   = g.knowledge.concepts.filter(
    (x) => x.id !== c.id && siblingIds.includes(x.id),
  )
  const others = g.knowledge.concepts.filter(
    (x) => x.id !== c.id && !siblingIds.includes(x.id),
  )
  return [...siblings, ...others].slice(0, 8).map(toConceptLike)
})

// ─── Kind config ───────────────────────────────────────────────────────
const KIND_COLORS: Record<string, string> = {
  definition: '#4a9eff',
  formula:    '#c084fc',
  example:    '#34d399',
  fact:       '#fb923c',
  principle:  '#f472b6',
  process:    '#22d3ee',
}

const accentColor = computed(() =>
  concept.value ? (KIND_COLORS[concept.value.kind] ?? '#7a9abb') : '#7a9abb',
)

// ─── Biome resolution ──────────────────────────────────────────────────
const KIND_BIOMES: Record<string, Biome> = {
  definition: 'alien-ruins',
  formula:    'space-station',
  example:    'jungle-canopy',
  fact:       'crystal-cave',
  principle:  'floating-islands',
  process:    'volcanic-surface',
}

const biome = computed<Biome>(() => {
  const g = galaxy.value
  const c = concept.value
  if (!g || !c) return 'crystal-cave'
  const body = g.spatial?.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === c.id,
  )
  const visual = body ? (g.visuals?.[body.id] as any) : null
  if (visual?.biome) return visual.biome as Biome
  return KIND_BIOMES[c.kind] ?? 'crystal-cave'
})

// ─── Character resolution ──────────────────────────────────────────────
const KIND_CHARACTERS: Record<string, CharacterId> = {
  definition: 'sage',
  formula:    'engineer',
  example:    'archivist',
  fact:       'trickster',
  principle:  'sage',
  process:    'engineer',
}

const CHARACTER_NAMES: Record<CharacterId, string> = {
  scholar:   'Scholar',
  sage:      'The Sage',
  engineer:  'The Engineer',
  warrior:   'The Warrior',
  archivist: 'The Archivist',
  trickster: 'The Trickster',
  echo:      'The Echo',
}

const character = computed<CharacterId>(() => {
  const g = galaxy.value
  const c = concept.value
  if (!g || !c) return 'sage'
  // memory-echo always uses the ghost character
  if (archetype.value === 'memory-echo') return 'echo'
  const body = g.spatial?.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === c.id,
  )
  const visual = body ? (g.visuals?.[body.id] as any) : null
  if (visual?.character) return visual.character as CharacterId
  return KIND_CHARACTERS[c.kind] ?? 'sage'
})

const speakerName = computed(() => CHARACTER_NAMES[character.value])

// ─── Archetype & challenge ─────────────────────────────────────────────
const archetype = computed<Archetype>(() =>
  concept.value ? pickArchetype(toConceptLike(concept.value)) : 'guardian-dialogue',
)

const challenge = computed<Challenge | null>(() => {
  // Use backend scene challenge if available.
  if (backendScene.value?.challenge) {
    return backendScene.value.challenge as Challenge
  }
  // Fall back to mock.
  const c = concept.value
  if (!c) return null
  const cl   = toConceptLike(c)
  const type = pickChallengeType(cl, archetype.value)
  return generateChallenge(cl, neighbours.value, type)
})

const openingNarrative = computed(() => {
  // Use backend scene narrative if available.
  if (backendScene.value?.openingNarrative) {
    return backendScene.value.openingNarrative as string
  }
  return concept.value ? getOpeningNarrative(toConceptLike(concept.value), archetype.value) : ''
})

// ─── Archetype label ──────────────────────────────────────────────────
const ARCHETYPE_LABELS: Record<Archetype, string> = {
  'guardian-dialogue':     'Guardian Dialogue',
  'exploration-discovery': 'Exploration',
  'environmental-puzzle':  'Environmental Puzzle',
  'memory-echo':           'Memory Echo',
  'cooperative-challenge': 'Cooperative Challenge',
}

// ─── Character animation ────────────────────────────────────────────────
const characterAnimation = ref<AnimationId>('warp-in')

function onAnimationComplete(anim: AnimationId) {
  if (anim === 'celebrate' || anim === 'hit-reaction') {
    characterAnimation.value = 'idle'
  }
}

function onEmotionChange(anim: AnimationId) {
  if (phase.value === 'dialogue' || phase.value === 'challenge') {
    characterAnimation.value = anim
  }
}

// ─── Dialogue lines ─────────────────────────────────────────────────────
const dialogueLines = computed<DialogueLine[]>(() => {
  // Use backend scene dialogue if available.
  if (backendScene.value?.dialogue?.length) {
    return (backendScene.value.dialogue as any[]).map((line) => ({
      speaker: line.speakerId ? 'npc' : 'npc',
      text: line.text,
      emotion: 'neutral' as const,
    }))
  }
  // Fall back to mock.
  const c = concept.value
  if (!c) return []
  return mockGenerateDialogue(toConceptLike(c))
})

// ─── Challenge result ───────────────────────────────────────────────────
const challengeResult = ref(false)

// ─── Progress ──────────────────────────────────────────────────────────
function markVisited(correct: boolean) {
  const g = galaxy.value
  const c = concept.value
  if (!g?.spatial || !c) return
  const body = g.spatial.bodies.find(
    (b) => 'knowledgeRef' in b && b.knowledgeRef === c.id,
  )
  if (!body) return
  const existing = g.progress.bodies[body.id]
  const score    = correct ? 1 : 0
  g.progress.bodies[body.id] = {
    visited:         true,
    attemptCount:    (existing?.attemptCount ?? 0) + 1,
    bestScore:       Math.max(existing?.bestScore ?? 0, score),
    lastScore:       score,
    hintsUsed:       existing?.hintsUsed ?? 0,
    timeSpentMs:     existing?.timeSpentMs ?? 0,
    masteryEstimate: score,
    attempts: [
      ...(existing?.attempts ?? []),
      { at: Date.now(), score, chosenOptionId: '' },
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
function onDialogueComplete() {
  characterAnimation.value = 'idle'
  phase.value = 'challenge'
}

function onNarrativeAdvance() {
  characterAnimation.value = 'idle'
  phase.value = 'challenge'
}

function onChallengeComplete(correct: boolean) {
  challengeResult.value = correct
  markVisited(correct)
  characterAnimation.value = correct ? 'celebrate' : 'hit-reaction'
  phase.value = 'result'
}

function goBack() {
  const sub = parentSubtopic.value
  // replace() so ConceptScene doesn't push an extra history entry —
  // the browser back button then correctly returns to the planet/galaxy view.
  router.replace(sub
    ? `/galaxy/${route.params.id}/planet/${sub.id}`
    : `/galaxy/${route.params.id}`,
  )
}
</script>

<template>
  <div class="scene-page">

    <!-- ─── Background ─────────────────────────────────────────────────── -->
    <SceneBackground :biome="biome" />

    <!-- ─── Loading ───────────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="loading" class="state-overlay">
        <span class="state-text">Entering the scene…</span>
      </div>
    </Transition>

    <!-- ─── Scene generating indicator ────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="generatingScene && !loading" class="generating-badge">
        <span class="generating-dot" />
        <span class="generating-text">Generating scene…</span>
      </div>
    </Transition>

    <!-- ─── Main scene ─────────────────────────────────────────────────── -->
    <template v-if="concept && !loading">

      <!-- HUD back button -->
      <header class="hud">
        <button class="back-btn" @click="goBack" aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <span class="hud-chapter">{{ concept.chapter }}</span>
        <span
          class="hud-kind"
          :style="{ color: accentColor, borderColor: `${accentColor}44`, background: `${accentColor}11` }"
        >{{ concept.kind }}</span>
      </header>

      <!-- Character stage — always visible once scene starts -->
      <Transition name="character-enter">
        <div v-if="phase !== 'loading'" class="character-stage">
          <CharacterSprite
            :character="character"
            :animation="characterAnimation"
            :size="220"
            :alpha="character === 'echo' ? 0.6 : 1"
            @animation-complete="onAnimationComplete"
          />
        </div>
      </Transition>

      <!-- ── Phase: dialogue (guardian-dialogue, memory-echo) ─────── -->
      <Transition name="slide-up">
        <DialogueBox
          v-if="phase === 'dialogue'"
          :lines="dialogueLines"
          :speaker-name="speakerName"
          @emotion="onEmotionChange"
          @complete="onDialogueComplete"
        />
      </Transition>

      <!-- ── Phase: narrative (exploration, puzzle, cooperative) ─── -->
      <Transition name="slide-up">
        <div
          v-if="phase === 'narrative'"
          class="narrative-card"
          role="button"
          tabindex="0"
          @click="onNarrativeAdvance"
          @keydown.enter="onNarrativeAdvance"
          @keydown.space.prevent="onNarrativeAdvance"
        >
          <div class="narrative-inner">
            <span
              class="narrative-archetype-tag"
              :style="{ color: accentColor, borderColor: `${accentColor}33`, background: `${accentColor}0d` }"
            >{{ ARCHETYPE_LABELS[archetype] }}</span>
            <p class="narrative-title">{{ concept.title }}</p>
            <p class="narrative-text">{{ openingNarrative }}</p>
            <span class="narrative-hint">Tap to begin ▶</span>
          </div>
        </div>
      </Transition>

      <!-- ── Phase: challenge ──────────────────────────────────────── -->
      <Transition name="slide-up">
        <ChallengePanel
          v-if="phase === 'challenge' && challenge"
          :challenge="challenge"
          :accent-color="accentColor"
          @complete="onChallengeComplete"
          @emotion="onEmotionChange"
        />
      </Transition>

      <!-- ── Phase: result ─────────────────────────────────────────── -->
      <Transition name="slide-up">
        <div v-if="phase === 'result'" class="result-panel">
          <div class="result-inner">

            <div class="result-banner" :class="challengeResult ? 'result-correct' : 'result-wrong'">
              <div class="result-icon">{{ challengeResult ? '✦' : '◇' }}</div>
              <div class="result-body">
                <p class="result-heading">{{ challengeResult ? 'Correct!' : 'Not quite.' }}</p>
                <p class="result-sub">
                  {{ challengeResult
                    ? 'Excellent. This concept is now marked as visited.'
                    : 'The correct answer was shown. Review it before moving on.' }}
                </p>
              </div>
            </div>

            <button class="continue-btn" @click="goBack">
              Continue exploring
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor"
                  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

          </div>
        </div>
      </Transition>

    </template>
  </div>
</template>

<style scoped>
.scene-page {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-void-base);
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
  background: linear-gradient(to bottom,
    rgba(2,4,10,0.88) 0%,
    rgba(2,4,10,0.5) 70%,
    transparent 100%
  );
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
}

/* ─── Generating badge ───────────────────────────────────────────── */
.generating-badge {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(4, 6, 14, 0.85);
  border: 1px solid rgba(232, 236, 242, 0.12);
  backdrop-filter: blur(12px);
}
.generating-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #4a9eff;
  animation: pulse-dot 1.2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}
.generating-text {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: var(--color-text-muted);
}

/* ─── Character stage ─────────────────────────────────────────────── */
.character-stage {
  position: fixed;
  bottom: 168px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  pointer-events: none;
}
@media (max-width: 640px) {
  .character-stage { bottom: 148px; }
}

/* ─── Narrative card ──────────────────────────────────────────────── */
.narrative-card {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 40;
  background: rgba(4, 6, 14, 0.94);
  border-top: 1px solid rgba(232, 236, 242, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  clip-path: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
  cursor: pointer;
}
.narrative-card:hover { background: rgba(6, 8, 18, 0.96); }

.narrative-inner {
  max-width: 620px;
  margin: 0 auto;
  padding: 26px 28px 36px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.narrative-archetype-tag {
  align-self: flex-start;
  font-family: var(--font-ui);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid;
}

.narrative-title {
  font-family: var(--font-ui);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: 0.03em;
}

.narrative-text {
  font-family: var(--font-body);
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin: 0;
  font-style: italic;
}

.narrative-hint {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: rgba(232,236,242,0.3);
  margin-top: 4px;
}

/* ─── Result panel ────────────────────────────────────────────────── */
.result-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 40;
  max-height: 72dvh;
  overflow-y: auto;
  background: rgba(4, 6, 14, 0.94);
  border-top: 1px solid rgba(232, 236, 242, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  clip-path: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

.result-inner {
  max-width: 620px;
  margin: 0 auto;
  padding: 28px 28px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 14px;
  border: 1px solid;
}
.result-correct { border-color: rgba(52,211,153,0.4);   background: rgba(52,211,153,0.07); }
.result-wrong   { border-color: rgba(248,113,113,0.35); background: rgba(248,113,113,0.07); }

.result-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 1px; }
.result-correct .result-icon { color: #34d399; }
.result-wrong   .result-icon { color: #f87171; }

.result-heading {
  font-family: var(--font-ui);
  font-size: 0.9rem;
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

/* ─── Continue button ─────────────────────────────────────────────── */
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
  transition: background 200ms ease, border-color 200ms ease, transform 150ms ease;
}
.continue-btn:hover {
  background: rgba(232,236,242,0.1);
  border-color: rgba(232,236,242,0.25);
  transform: translateY(-1px);
}

/* ─── State overlay ───────────────────────────────────────────────── */
.state-overlay {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-void-base);
}
.state-text {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* ─── Transitions ─────────────────────────────────────────────────── */
.slide-up-enter-active { transition: transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease; }
.slide-up-leave-active { transition: transform 240ms ease, opacity 200ms ease; }
.slide-up-enter-from   { transform: translateY(100%); opacity: 0; }
.slide-up-leave-to     { transform: translateY(100%); opacity: 0; }

.character-enter-enter-active { transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease; }
.character-enter-enter-from   { transform: translateX(-50%) translateY(40px); opacity: 0; }

.fade-up-enter-active { transition: opacity 280ms ease, transform 280ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(8px); }

.fade-enter-active { transition: opacity 200ms ease; }
.fade-leave-active { transition: opacity 300ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .narrative-inner, .result-inner { padding-left: 18px; padding-right: 18px; }
}
</style>
