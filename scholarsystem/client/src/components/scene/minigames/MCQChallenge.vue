<script setup lang="ts">
/**
 * MCQChallenge — standard 4-option multiple choice with explanations.
 */
import { ref, computed } from 'vue'

export interface MCQOption {
  text: string
  correct: boolean
  explanation: string
}

export interface MCQChallengeData {
  type: 'mcq'
  question: string
  options: MCQOption[]
}

const props = defineProps<{ challenge: MCQChallengeData }>()
const emit  = defineEmits<{ complete: [correct: boolean] }>()

const selected  = ref<number | null>(null)
const submitted = ref(false)
const isCorrect = computed(() =>
  selected.value !== null && props.challenge.options[selected.value].correct,
)

function select(i: number) {
  if (submitted.value) return
  selected.value = i
}

function submit() {
  if (selected.value === null || submitted.value) return
  submitted.value = true
  setTimeout(() => emit('complete', isCorrect.value), 900)
}
</script>

<template>
  <div class="mcq">
    <p class="question">{{ challenge.question }}</p>

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
        <span class="opt-indicator">
          <span v-if="!submitted" class="dot" :class="{ filled: selected === i }" />
          <span v-else-if="opt.correct">✓</span>
          <span v-else-if="selected === i">✗</span>
          <span v-else class="dot" />
        </span>
        <span class="opt-text">{{ opt.text }}</span>
      </button>
    </div>

    <!-- Explanation on submit -->
    <Transition name="fade-up">
      <div v-if="submitted && selected !== null" class="explanation">
        {{ challenge.options[selected].explanation }}
      </div>
    </Transition>

    <Transition name="fade-up">
      <button v-if="selected !== null && !submitted" class="submit-btn" @click="submit">
        Confirm answer
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.mcq { display: flex; flex-direction: column; gap: 16px; }

.question {
  font-family: var(--font-body);
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin: 0;
}

.options { display: flex; flex-direction: column; gap: 8px; }

.opt-btn {
  display: flex; align-items: flex-start; gap: 12px;
  text-align: left;
  padding: 13px 15px;
  border-radius: 12px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.03);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 0.84rem;
  line-height: 1.5;
  cursor: pointer;
  width: 100%;
  transition: border-color 160ms, background 160ms, color 160ms;
}
.opt-btn:hover:not(:disabled):not(.correct):not(.wrong) {
  border-color: rgba(232,236,242,0.22);
  background: rgba(232,236,242,0.06);
  color: var(--color-text-primary);
}
.opt-btn.selected { border-color: rgba(232,236,242,0.35); background: rgba(232,236,242,0.08); color: var(--color-text-primary); }
.opt-btn.correct  { border-color: rgba(52,211,153,0.5);  background: rgba(52,211,153,0.08);  color: #6ee7b7; }
.opt-btn.wrong    { border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); color: #fca5a5; }
.opt-btn.dimmed   { opacity: 0.35; }
.opt-btn:disabled { cursor: default; }

.opt-indicator { flex-shrink: 0; width: 18px; font-size: 0.9rem; line-height: 1.5; margin-top: 1px; }
.dot { display: block; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0.5; }
.dot.filled { border-color: var(--color-text-primary); background: var(--color-text-primary); opacity: 1; }
.opt-text { flex: 1; }

.explanation {
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.03);
  font-family: var(--font-body);
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  font-style: italic;
}

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

.fade-up-enter-active { transition: opacity 280ms ease, transform 280ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
