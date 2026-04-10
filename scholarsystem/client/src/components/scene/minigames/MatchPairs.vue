<script setup lang="ts">
/**
 * MatchPairs — click a left term then a right match to connect them.
 * All pairs must be matched correctly to complete.
 */
import { ref, computed } from 'vue'

export interface MatchPairsChallenge {
  type: 'match-pairs'
  instruction: string
  pairs: { left: string; right: string }[]
}

const props = defineProps<{ challenge: MatchPairsChallenge }>()
const emit  = defineEmits<{ complete: [correct: boolean] }>()

// ─── Build shuffled right column ──────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const rightItems = ref(shuffle(props.challenge.pairs.map((p) => p.right)))

// ─── Selection state ──────────────────────────────────────────────────────────
const selectedLeft  = ref<number | null>(null) // index into pairs
const selectedRight = ref<number | null>(null) // index into rightItems

// matched[leftIdx] = rightItem string (once a pair is confirmed)
const matched = ref<Record<number, string>>({})
// wrongFlash: indices currently flashing wrong
const wrongLeft  = ref<number | null>(null)
const wrongRight = ref<number | null>(null)

const submitted = ref(false)
const allCorrect = computed(() =>
  props.challenge.pairs.every((p, i) => matched.value[i] === p.right),
)

// ─── Click handlers ───────────────────────────────────────────────────────────

function clickLeft(idx: number) {
  if (submitted.value || idx in matched.value) return
  selectedLeft.value = selectedLeft.value === idx ? null : idx
  tryMatch()
}

function clickRight(rightVal: string) {
  if (submitted.value) return
  // Don't allow clicking already-matched right items
  if (Object.values(matched.value).includes(rightVal)) return
  const idx = rightItems.value.indexOf(rightVal)
  selectedRight.value = selectedRight.value === idx ? null : idx
  tryMatch()
}

function tryMatch() {
  if (selectedLeft.value === null || selectedRight.value === null) return
  const leftIdx   = selectedLeft.value
  const rightVal  = rightItems.value[selectedRight.value]
  const correct   = props.challenge.pairs[leftIdx].right === rightVal

  if (correct) {
    matched.value = { ...matched.value, [leftIdx]: rightVal }
    selectedLeft.value  = null
    selectedRight.value = null
    // Auto-complete when all matched
    if (Object.keys(matched.value).length === props.challenge.pairs.length) {
      submitted.value = true
      setTimeout(() => emit('complete', true), 600)
    }
  } else {
    wrongLeft.value  = leftIdx
    wrongRight.value = selectedRight.value
    setTimeout(() => {
      wrongLeft.value  = null
      wrongRight.value = null
      selectedLeft.value  = null
      selectedRight.value = null
    }, 700)
  }
}

function isMatchedLeft(idx: number)       { return idx in matched.value }
function isMatchedRight(rightVal: string) { return Object.values(matched.value).includes(rightVal) }
function rightIndex(rightVal: string)     { return rightItems.value.indexOf(rightVal) }
</script>

<template>
  <div class="match-pairs">
    <p class="instruction">{{ challenge.instruction }}</p>

    <div class="pairs-grid">
      <!-- Left column -->
      <div class="column left-col">
        <button
          v-for="(pair, i) in challenge.pairs"
          :key="`left-${i}`"
          class="pair-item"
          :class="{
            selected:  selectedLeft === i && !isMatchedLeft(i),
            matched:   isMatchedLeft(i),
            wrong:     wrongLeft === i,
          }"
          @click="clickLeft(i)"
        >
          {{ pair.left }}
        </button>
      </div>

      <!-- Connector dots -->
      <div class="connector-col">
        <div v-for="(_, i) in challenge.pairs" :key="`dot-${i}`" class="connector-dot"
          :class="{ matched: isMatchedLeft(i) }" />
      </div>

      <!-- Right column (shuffled) -->
      <div class="column right-col">
        <button
          v-for="rightVal in rightItems"
          :key="rightVal"
          class="pair-item right"
          :class="{
            selected:  selectedRight === rightIndex(rightVal) && !isMatchedRight(rightVal),
            matched:   isMatchedRight(rightVal),
            wrong:     wrongRight === rightIndex(rightVal),
          }"
          @click="clickRight(rightVal)"
        >
          {{ rightVal }}
        </button>
      </div>
    </div>

    <Transition name="fade-up">
      <div v-if="submitted" class="all-matched">
        ✦ All pairs matched!
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.match-pairs { display: flex; flex-direction: column; gap: 16px; }

.instruction {
  font-family: var(--font-body);
  font-size: 0.92rem;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

.pairs-grid {
  display: grid;
  grid-template-columns: 1fr 20px 1fr;
  gap: 8px;
  align-items: start;
}

.column { display: flex; flex-direction: column; gap: 8px; }

.pair-item {
  padding: 11px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.04);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.82rem;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms, background 160ms, color 160ms, transform 120ms;
  min-height: 44px;
}
.pair-item.right { text-align: right; }
.pair-item:hover:not(.matched) {
  border-color: rgba(232,236,242,0.25);
  background: rgba(232,236,242,0.07);
  color: var(--color-text-primary);
}
.pair-item.selected {
  border-color: rgba(140,190,255,0.55);
  background: rgba(140,190,255,0.08);
  color: #aacfff;
  transform: scale(1.02);
}
.pair-item.matched {
  border-color: rgba(52,211,153,0.45);
  background: rgba(52,211,153,0.07);
  color: #6ee7b7;
  cursor: default;
}
.pair-item.wrong {
  border-color: rgba(248,113,113,0.55);
  background: rgba(248,113,113,0.08);
  color: #fca5a5;
  animation: shake 0.35s ease;
}

@keyframes shake {
  0%,100% { transform: translateX(0); }
  25%      { transform: translateX(-6px); }
  75%      { transform: translateX(6px); }
}

.connector-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding-top: 11px;
}
.connector-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--color-hairline-strong);
  background: transparent;
  flex-shrink: 0;
  /* Align with pair-item center: pair-item min-height 44px, so center at 22px */
  margin-top: 9px;
  transition: background 200ms, border-color 200ms;
}
.connector-dot.matched {
  background: rgba(52,211,153,0.6);
  border-color: #34d399;
}

.all-matched {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #34d399;
}

.fade-up-enter-active { transition: opacity 300ms ease, transform 300ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
