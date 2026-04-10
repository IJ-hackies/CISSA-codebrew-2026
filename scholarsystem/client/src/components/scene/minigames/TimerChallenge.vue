<script setup lang="ts">
/**
 * TimerChallenge — beat the clock MCQ.
 * Urgency narrative sets the scene. Timer bar depletes.
 * Auto-submits as wrong if time runs out.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface TimerChallengeData {
  type: 'timer'
  urgencyNarrative: string
  timeSeconds: number
  question: string
  options: { text: string; correct: boolean }[]
}

const props = defineProps<{ challenge: TimerChallengeData }>()
const emit  = defineEmits<{ complete: [correct: boolean] }>()

const selected  = ref<number | null>(null)
const submitted = ref(false)
const timeLeft  = ref(props.challenge.timeSeconds)
const isCorrect = ref(false)

const pct = computed(() => (timeLeft.value / props.challenge.timeSeconds) * 100)

const urgency = computed(() => {
  if (pct.value > 60) return 'calm'
  if (pct.value > 30) return 'warn'
  return 'danger'
})

let ticker: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  ticker = setInterval(() => {
    if (submitted.value) return
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      submit(true) // auto-submit as timeout
    }
  }, 100)
})

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
})

function select(idx: number) {
  if (submitted.value) return
  selected.value = idx
}

function submit(timeout = false) {
  if (submitted.value) return
  submitted.value = true
  if (ticker) clearInterval(ticker)
  if (timeout) {
    isCorrect.value = false
    setTimeout(() => emit('complete', false), 1000)
    return
  }
  if (selected.value === null) return
  isCorrect.value = props.challenge.options[selected.value].correct
  setTimeout(() => emit('complete', isCorrect.value), 900)
}

const timeDisplay = computed(() => Math.ceil(timeLeft.value).toString())
</script>

<template>
  <div class="timer-challenge" :class="`urgency-${urgency}`">

    <!-- Urgency narrative -->
    <div class="urgency-banner">
      <span class="urgency-icon">⚠</span>
      <p class="urgency-text">{{ challenge.urgencyNarrative }}</p>
    </div>

    <!-- Timer bar -->
    <div class="timer-track">
      <div class="timer-bar" :style="{ width: `${pct}%` }" />
      <span class="timer-num">{{ timeDisplay }}s</span>
    </div>

    <!-- Question -->
    <p class="question">{{ challenge.question }}</p>

    <!-- Options -->
    <div class="options">
      <button
        v-for="(opt, i) in challenge.options"
        :key="i"
        class="opt-btn"
        :class="{
          selected: selected === i && !submitted,
          correct:  submitted && opt.correct,
          wrong:    submitted && selected === i && !opt.correct,
          dimmed:   submitted && !opt.correct && selected !== i,
        }"
        :disabled="submitted"
        @click="select(i)"
      >
        {{ opt.text }}
      </button>
    </div>

    <Transition name="fade-up">
      <button v-if="selected !== null && !submitted" class="submit-btn" @click="submit(false)">
        Lock in answer
      </button>
    </Transition>

    <Transition name="fade-up">
      <div v-if="submitted" class="result" :class="isCorrect ? 'correct' : 'wrong'">
        {{ isCorrect ? '✦ Correct! Fast thinking.' : timeLeft <= 0 ? '◇ Time\'s up!' : '◇ Wrong answer.' }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.timer-challenge { display: flex; flex-direction: column; gap: 14px; }

/* ─── Urgency banner ──────────────────────────────────────────── */
.urgency-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(248,113,113,0.25);
  background: rgba(248,113,113,0.06);
  transition: border-color 400ms, background 400ms;
}
.urgency-danger .urgency-banner {
  border-color: rgba(248,113,113,0.55);
  background: rgba(248,113,113,0.12);
  animation: urgency-pulse 0.6s ease-in-out infinite alternate;
}
@keyframes urgency-pulse {
  from { box-shadow: 0 0 0 0 rgba(248,113,113,0); }
  to   { box-shadow: 0 0 12px 2px rgba(248,113,113,0.15); }
}

.urgency-icon {
  font-size: 1rem;
  flex-shrink: 0;
  color: #f87171;
  margin-top: 1px;
}
.urgency-text {
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-style: italic;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.45;
}

/* ─── Timer bar ───────────────────────────────────────────────── */
.timer-track {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background: rgba(232,236,242,0.08);
  overflow: visible;
}
.timer-bar {
  height: 100%;
  border-radius: 999px;
  background: #34d399;
  transition: width 0.1s linear, background 400ms ease;
}
.urgency-warn  .timer-bar { background: #ffb547; }
.urgency-danger .timer-bar { background: #f87171; }

.timer-num {
  position: absolute;
  right: 0;
  top: -18px;
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  transition: color 400ms;
}
.urgency-danger .timer-num { color: #f87171; }

/* ─── Question ────────────────────────────────────────────────── */
.question {
  font-family: var(--font-body);
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin: 0;
}

/* ─── Options ─────────────────────────────────────────────────── */
.options { display: flex; flex-direction: column; gap: 7px; }

.opt-btn {
  text-align: left;
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.03);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.84rem;
  line-height: 1.4;
  cursor: pointer;
  transition: border-color 140ms, background 140ms, color 140ms;
}
.opt-btn:hover:not(:disabled) {
  border-color: rgba(232,236,242,0.22);
  background: rgba(232,236,242,0.07);
  color: var(--color-text-primary);
}
.opt-btn.selected { border-color: rgba(140,190,255,0.4); background: rgba(140,190,255,0.07); color: #aacfff; }
.opt-btn.correct  { border-color: rgba(52,211,153,0.5);  background: rgba(52,211,153,0.08);  color: #6ee7b7; }
.opt-btn.wrong    { border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); color: #fca5a5; }
.opt-btn.dimmed   { opacity: 0.35; }
.opt-btn:disabled { cursor: default; }

/* ─── Submit / result ─────────────────────────────────────────── */
.submit-btn {
  align-self: center;
  padding: 10px 32px;
  border-radius: 999px;
  border: 1px solid rgba(248,113,113,0.4);
  background: rgba(248,113,113,0.1);
  color: #fca5a5;
  font-family: var(--font-ui);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 160ms, transform 130ms;
}
.submit-btn:hover { background: rgba(248,113,113,0.16); transform: translateY(-1px); }

.result {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.result.correct { color: #34d399; }
.result.wrong   { color: #f87171; }

.fade-up-enter-active { transition: opacity 280ms ease, transform 280ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
