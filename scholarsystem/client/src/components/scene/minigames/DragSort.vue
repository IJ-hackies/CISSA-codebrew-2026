<script setup lang="ts">
/**
 * DragSort — drag items into the correct order.
 * Uses pointer events so it works on both desktop and mobile.
 */
import { ref, computed } from 'vue'

export interface DragSortItem {
  id: string
  label: string
  correctIndex: number
}

export interface DragSortChallenge {
  type: 'drag-sort'
  instruction: string
  items: DragSortItem[]
}

const props = defineProps<{ challenge: DragSortChallenge }>()
const emit  = defineEmits<{ complete: [correct: boolean] }>()

// ─── State ────────────────────────────────────────────────────────────────────

// Working order — indices into props.challenge.items
const order = ref<string[]>(props.challenge.items.map((i) => i.id))

const submitted = ref(false)
const isCorrect = ref(false)

// ─── Drag state ───────────────────────────────────────────────────────────────

const draggingId  = ref<string | null>(null)
const dragOverId  = ref<string | null>(null)

function onDragStart(id: string) {
  draggingId.value = id
}

function onDragEnter(id: string) {
  if (draggingId.value === null || draggingId.value === id) return
  dragOverId.value = id
  // Reorder: move dragging item to position of hovered item
  const from = order.value.indexOf(draggingId.value)
  const to   = order.value.indexOf(id)
  if (from === -1 || to === -1) return
  const next = [...order.value]
  next.splice(from, 1)
  next.splice(to, 0, draggingId.value)
  order.value = next
}

function onDragEnd() {
  draggingId.value = null
  dragOverId.value = null
}

// ─── Pointer-based drag (mobile) ─────────────────────────────────────────────

let pointerDragId: string | null = null
let lastEnteredId: string | null = null

function onPointerDown(e: PointerEvent, id: string) {
  pointerDragId = id
  draggingId.value = id
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!pointerDragId) return
  // Find which item the pointer is over
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const itemEl = el?.closest('[data-item-id]') as HTMLElement | null
  const overId = itemEl?.dataset.itemId ?? null
  if (overId && overId !== lastEnteredId) {
    lastEnteredId = overId
    onDragEnter(overId)
  }
}

function onPointerUp() {
  pointerDragId = null
  lastEnteredId = null
  onDragEnd()
}

// ─── Computed ─────────────────────────────────────────────────────────────────

const orderedItems = computed(() =>
  order.value.map((id) => props.challenge.items.find((i) => i.id === id)!),
)

function itemState(item: DragSortItem, idx: number) {
  if (!submitted.value) return 'default'
  return item.correctIndex === idx ? 'correct' : 'wrong'
}

// ─── Submit ───────────────────────────────────────────────────────────────────

function submit() {
  if (submitted.value) return
  submitted.value = true
  const correct = order.value.every(
    (id, idx) => props.challenge.items.find((i) => i.id === id)!.correctIndex === idx,
  )
  isCorrect.value = correct
  setTimeout(() => emit('complete', correct), 1200)
}
</script>

<template>
  <div class="drag-sort">
    <p class="instruction">{{ challenge.instruction }}</p>

    <div class="items-list">
      <div
        v-for="(item, idx) in orderedItems"
        :key="item.id"
        class="drag-item"
        :class="[
          { dragging: draggingId === item.id, 'drag-over': dragOverId === item.id },
          submitted ? itemState(item, idx) : '',
        ]"
        :data-item-id="item.id"
        draggable="true"
        @dragstart="onDragStart(item.id)"
        @dragenter.prevent="onDragEnter(item.id)"
        @dragover.prevent
        @dragend="onDragEnd"
        @pointerdown="onPointerDown($event, item.id)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @lostpointercapture="onPointerUp"
      >
        <span class="item-index">{{ idx + 1 }}</span>
        <span class="item-label">{{ item.label }}</span>
        <span class="drag-handle">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="4.5" cy="3" r="1" fill="currentColor"/>
            <circle cx="9.5" cy="3" r="1" fill="currentColor"/>
            <circle cx="4.5" cy="7" r="1" fill="currentColor"/>
            <circle cx="9.5" cy="7" r="1" fill="currentColor"/>
            <circle cx="4.5" cy="11" r="1" fill="currentColor"/>
            <circle cx="9.5" cy="11" r="1" fill="currentColor"/>
          </svg>
        </span>
      </div>
    </div>

    <button v-if="!submitted" class="submit-btn" @click="submit">
      Confirm order
    </button>

    <Transition name="fade-result">
      <div v-if="submitted" class="result-line" :class="isCorrect ? 'correct' : 'wrong'">
        {{ isCorrect ? '✦ Correct order!' : '◇ Not quite — see the correct order above.' }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drag-sort {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.instruction {
  font-family: var(--font-body);
  font-size: 0.92rem;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drag-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 12px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232,236,242,0.04);
  cursor: grab;
  touch-action: none;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease, opacity 160ms ease;
  user-select: none;
}
.drag-item:hover { border-color: rgba(232,236,242,0.22); background: rgba(232,236,242,0.07); }
.drag-item.dragging { opacity: 0.4; transform: scale(0.98); cursor: grabbing; }
.drag-item.drag-over { border-color: rgba(140,190,255,0.5); background: rgba(140,190,255,0.06); }
.drag-item.correct { border-color: rgba(52,211,153,0.5); background: rgba(52,211,153,0.08); color: #6ee7b7; cursor: default; }
.drag-item.wrong   { border-color: rgba(248,113,113,0.5); background: rgba(248,113,113,0.08); color: #fca5a5; cursor: default; }

.item-index {
  flex-shrink: 0;
  width: 24px; height: 24px;
  border-radius: 50%;
  background: rgba(232,236,242,0.08);
  border: 1px solid var(--color-hairline-strong);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-ui);
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-text-muted);
}
.item-label {
  flex: 1;
  font-family: var(--font-body);
  font-size: 0.86rem;
  color: var(--color-text-primary);
  line-height: 1.4;
}
.drag-handle {
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0.5;
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
  transition: background 180ms, border-color 180ms, transform 140ms;
}
.submit-btn:hover { background: rgba(232,236,242,0.12); transform: translateY(-1px); }

.result-line {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.result-line.correct { color: #34d399; }
.result-line.wrong   { color: #f87171; }

.fade-result-enter-active { transition: opacity 300ms ease, transform 300ms ease; }
.fade-result-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
