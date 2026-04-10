<script setup lang="ts">
/**
 * DialogueChoiceChallenge — branching conversation challenge.
 * Player must pick correct responses across one or more exchanges.
 * NPC reacts to each choice before advancing.
 */
import { ref, computed } from 'vue'
import type { Emotion } from '../DialogueBox.vue'
import type { AnimationId } from '../CharacterSprite.vue'

export interface PlayerOption {
  text: string
  correct: boolean
  npcReaction: string
  emotion: Emotion
}

export interface Exchange {
  npcLine: string
  playerOptions: PlayerOption[]
}

export interface DialogueChoiceChallengeData {
  type: 'dialogue-choice'
  setup: string
  exchanges: Exchange[]
}

const props = defineProps<{ challenge: DialogueChoiceChallengeData }>()
const emit  = defineEmits<{
  complete: [correct: boolean]
  emotion: [anim: AnimationId]
}>()

const EMOTION_ANIM: Record<Emotion, AnimationId> = {
  neutral:     'talking',
  excited:     'talking',
  thoughtful:  'thinking',
  stern:       'talking',
  encouraging: 'talking',
  surprised:   'surprised',
}

// ─── State ────────────────────────────────────────────────────────────────────

const exchangeIdx  = ref(0)
const reactionText = ref<string | null>(null)   // NPC's reaction to the player's pick
const allCorrect   = ref(true)
const done         = ref(false)

const currentExchange = computed(() => props.challenge.exchanges[exchangeIdx.value])

// Typewriter for reaction line
const displayed  = ref('')
let typingTimer: ReturnType<typeof setInterval> | null = null

function typeText(text: string, onDone: () => void) {
  if (typingTimer) clearInterval(typingTimer)
  displayed.value = ''
  let i = 0
  typingTimer = setInterval(() => {
    if (i < text.length) {
      displayed.value += text[i++]
    } else {
      if (typingTimer) clearInterval(typingTimer)
      typingTimer = null
      onDone()
    }
  }, 28)
}

// ─── Interaction ──────────────────────────────────────────────────────────────

const waitingForAdvance = ref(false)

function choose(opt: PlayerOption) {
  if (reactionText.value !== null) return // already chose
  if (!opt.correct) allCorrect.value = false

  emit('emotion', EMOTION_ANIM[opt.emotion])

  // Show NPC reaction with typewriter
  reactionText.value = ''
  typeText(opt.npcReaction, () => {
    waitingForAdvance.value = true
  })
}

function advance() {
  if (!waitingForAdvance.value) return
  waitingForAdvance.value = false
  reactionText.value = null
  displayed.value = ''

  const isLast = exchangeIdx.value >= props.challenge.exchanges.length - 1
  if (isLast) {
    done.value = true
    setTimeout(() => emit('complete', allCorrect.value), 600)
  } else {
    exchangeIdx.value++
    emit('emotion', 'talking' as AnimationId)
  }
}
</script>

<template>
  <div class="dialogue-choice">
    <!-- Setup context -->
    <p class="setup">{{ challenge.setup }}</p>

    <!-- Exchange progress dots -->
    <div v-if="challenge.exchanges.length > 1" class="exchange-dots">
      <span
        v-for="(_, i) in challenge.exchanges"
        :key="i"
        class="ex-dot"
        :class="{ active: i === exchangeIdx, done: i < exchangeIdx }"
      />
    </div>

    <!-- NPC line -->
    <div class="npc-bubble">
      <span class="npc-tag">NPC</span>
      <p class="npc-text">{{ currentExchange.npcLine }}</p>
    </div>

    <!-- Player options (before choosing) -->
    <div v-if="reactionText === null && !done" class="options">
      <button
        v-for="(opt, i) in currentExchange.playerOptions"
        :key="i"
        class="choice-btn"
        @click="choose(opt)"
      >
        <span class="choice-arrow">▶</span>
        {{ opt.text }}
      </button>
    </div>

    <!-- NPC reaction (after choosing) -->
    <Transition name="slide-in">
      <div v-if="reactionText !== null" class="reaction-bubble" @click="advance">
        <span class="npc-tag">NPC</span>
        <p class="reaction-text">
          {{ displayed }}<span class="cursor" v-if="!waitingForAdvance">▌</span>
        </p>
        <Transition name="fade">
          <span v-if="waitingForAdvance" class="advance-hint">Click to continue ▼</span>
        </Transition>
      </div>
    </Transition>

    <!-- Completion -->
    <Transition name="fade-up">
      <div v-if="done" class="result" :class="allCorrect ? 'correct' : 'wrong'">
        {{ allCorrect ? '✦ All correct!' : '◇ Some choices were off — but you made it through.' }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dialogue-choice { display: flex; flex-direction: column; gap: 14px; }

.setup {
  font-family: var(--font-body);
  font-size: 0.84rem;
  font-style: italic;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

/* ─── Exchange dots ───────────────────────────────────────────── */
.exchange-dots { display: flex; gap: 6px; }
.ex-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  border: 1.5px solid var(--color-hairline-strong);
  background: transparent;
  transition: background 200ms, border-color 200ms;
}
.ex-dot.done   { background: rgba(100,160,255,0.4); border-color: rgba(100,160,255,0.4); }
.ex-dot.active { background: rgba(140,190,255,0.9); border-color: rgba(140,190,255,0.9); transform: scale(1.2); }

/* ─── NPC bubble ──────────────────────────────────────────────── */
.npc-bubble, .reaction-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(100,160,255,0.2);
  background: rgba(100,160,255,0.06);
  cursor: default;
}
.reaction-bubble { cursor: pointer; }
.reaction-bubble:hover { background: rgba(100,160,255,0.09); }

.npc-tag {
  display: inline-block;
  font-family: var(--font-ui);
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(140,190,255,0.7);
  margin-bottom: 5px;
}
.npc-text, .reaction-text {
  font-family: var(--font-body);
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--color-text-primary);
  margin: 0;
  min-height: 1.4em;
}
.cursor {
  color: rgba(140,190,255,0.7);
  animation: blink 0.9s step-end infinite;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }

.advance-hint {
  display: block;
  margin-top: 8px;
  font-family: var(--font-ui);
  font-size: 0.62rem;
  color: rgba(140,190,255,0.5);
  letter-spacing: 0.1em;
}

/* ─── Player options ──────────────────────────────────────────── */
.options { display: flex; flex-direction: column; gap: 7px; }

.choice-btn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  text-align: left;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.03);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.84rem;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 150ms, background 150ms, color 150ms, transform 120ms;
}
.choice-btn:hover {
  border-color: rgba(255,181,71,0.35);
  background: rgba(255,181,71,0.06);
  color: var(--color-text-primary);
  transform: translateX(4px);
}
.choice-arrow {
  flex-shrink: 0;
  font-size: 0.6rem;
  color: rgba(255,181,71,0.6);
  margin-top: 3px;
}

/* ─── Result ──────────────────────────────────────────────────── */
.result {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.result.correct { color: #34d399; }
.result.wrong   { color: #f87171; }

/* ─── Transitions ─────────────────────────────────────────────── */
.slide-in-enter-active { transition: transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease; }
.slide-in-enter-from   { transform: translateY(12px); opacity: 0; }

.fade-enter-active { transition: opacity 300ms ease; }
.fade-enter-from   { opacity: 0; }

.fade-up-enter-active { transition: opacity 280ms ease, transform 280ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
