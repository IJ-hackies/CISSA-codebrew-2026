<script setup lang="ts">
/**
 * FillBlank — sentence/formula with dropdown slots.
 * Segments alternate between static text and blank dropdowns.
 */
import { ref, computed } from 'vue'

export type Segment =
  | { kind: 'text';  value: string }
  | { kind: 'blank'; id: string; correctAnswer: string; alternatives: string[]; options: string[] }

export interface FillBlankChallenge {
  type: 'fill-blank'
  instruction: string
  segments: Segment[]
}

const props = defineProps<{ challenge: FillBlankChallenge }>()
const emit  = defineEmits<{ complete: [correct: boolean] }>()

const blanks = computed(() =>
  props.challenge.segments.filter((s): s is Extract<Segment, { kind: 'blank' }> => s.kind === 'blank'),
)

// answers[blankId] = selected value
const answers   = ref<Record<string, string>>({})
const submitted = ref(false)
const results   = ref<Record<string, boolean>>({})

const allFilled = computed(() =>
  blanks.value.every((b) => answers.value[b.id] !== undefined),
)

const isCorrect = computed(() =>
  blanks.value.every((b) => results.value[b.id] === true),
)

function select(blankId: string, val: string) {
  if (submitted.value) return
  answers.value = { ...answers.value, [blankId]: val }
}

function submit() {
  if (!allFilled.value || submitted.value) return
  submitted.value = true
  const res: Record<string, boolean> = {}
  for (const b of blanks.value) {
    const given = answers.value[b.id]?.trim().toLowerCase()
    const correct = b.correctAnswer.trim().toLowerCase()
    const alts = b.alternatives.map((a) => a.trim().toLowerCase())
    res[b.id] = given === correct || alts.includes(given)
  }
  results.value = res
  setTimeout(() => emit('complete', isCorrect.value), 900)
}
</script>

<template>
  <div class="fill-blank">
    <p class="instruction">{{ challenge.instruction }}</p>

    <!-- Sentence with inline blanks -->
    <div class="sentence">
      <template v-for="(seg, i) in challenge.segments" :key="i">
        <span v-if="seg.kind === 'text'" class="text-seg">{{ seg.value }}</span>
        <span v-else class="blank-wrap">
          <select
            class="blank-select"
            :class="{
              filled: answers[seg.id] !== undefined,
              correct: submitted && results[seg.id] === true,
              wrong:   submitted && results[seg.id] === false,
            }"
            :disabled="submitted"
            :value="answers[seg.id] ?? ''"
            @change="(e) => select(seg.id, (e.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>—</option>
            <option v-for="opt in seg.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <span v-if="submitted && results[seg.id] === false" class="correct-hint">
            ✓ {{ seg.correctAnswer }}
          </span>
        </span>
      </template>
    </div>

    <Transition name="fade-up">
      <button v-if="allFilled && !submitted" class="submit-btn" @click="submit">
        Confirm
      </button>
    </Transition>

    <Transition name="fade-up">
      <p v-if="submitted" class="result-line" :class="isCorrect ? 'correct' : 'wrong'">
        {{ isCorrect ? '✦ Perfect!' : '◇ Not quite — correct answers shown above.' }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.fill-blank { display: flex; flex-direction: column; gap: 18px; }

.instruction {
  font-family: var(--font-body);
  font-size: 0.92rem;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

/* ─── Sentence ─────────────────────────────────────────────────── */
.sentence {
  font-family: var(--font-body);
  font-size: 0.95rem;
  line-height: 2;
  color: var(--color-text-primary);
  flex-wrap: wrap;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.text-seg { white-space: pre-wrap; }

.blank-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.blank-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 3px 28px 3px 10px;
  border-radius: 6px;
  border: 1.5px solid rgba(140,190,255,0.35);
  background: rgba(140,190,255,0.08) url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236f7989' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 8px center;
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 160ms, background 160ms;
  min-width: 100px;
}
.blank-select:focus { outline: none; border-color: rgba(140,190,255,0.65); }
.blank-select:not(.filled) { color: var(--color-text-muted); }
.blank-select.correct { border-color: rgba(52,211,153,0.6);  background-color: rgba(52,211,153,0.1);  color: #6ee7b7; }
.blank-select.wrong   { border-color: rgba(248,113,113,0.6); background-color: rgba(248,113,113,0.1); color: #fca5a5; }
.blank-select:disabled { cursor: default; }

.correct-hint {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  color: #34d399;
  letter-spacing: 0.04em;
}

/* ─── Submit / result ─────────────────────────────────────────── */
.submit-btn {
  align-self: center;
  padding: 11px 36px;
  border-radius: 999px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.07);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 180ms, transform 140ms;
}
.submit-btn:hover { background: rgba(232,236,242,0.12); transform: translateY(-1px); }

.result-line {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 0;
}
.result-line.correct { color: #34d399; }
.result-line.wrong   { color: #f87171; }

.fade-up-enter-active { transition: opacity 280ms ease, transform 280ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
