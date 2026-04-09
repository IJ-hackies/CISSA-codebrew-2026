<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  ACCEPT_ATTR,
  TOTAL_SIZE_LIMIT_BYTES,
  formatBytes,
  partitionFiles,
} from '@/lib/fileTypes'
import FileChip from './FileChip.vue'

const props = defineProps<{
  modelValue: string
  files: File[]
  /**
   * When the parent triggers a launch, the input fades + the rocket button
   * is hidden so the renderer can take over from the same screen position.
   */
  launching?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:files': [value: File[]]
  submit: [origin: { x: number; y: number }]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const rocketBtnRef = ref<HTMLButtonElement | null>(null)
const inputBoxRef = ref<HTMLDivElement | null>(null)
const error = ref<string | null>(null)

const totalBytes = computed(() => props.files.reduce((acc, f) => acc + f.size, 0))
const overLimit = computed(() => totalBytes.value > TOTAL_SIZE_LIMIT_BYTES)
const canSubmit = computed(
  () => !props.launching && !overLimit.value && (props.modelValue.trim().length > 0 || props.files.length > 0),
)

function autoSize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 220)}px`
}

watch(
  () => props.modelValue,
  () => nextTick(autoSize),
)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function addFiles(incoming: File[]) {
  error.value = null
  const { accepted, rejected } = partitionFiles(incoming)
  if (rejected.length) {
    error.value = `Unsupported file type: ${rejected.map((f) => f.name).join(', ')}`
  }
  // Reject any addition that would push the total above the cap.
  const next: File[] = [...props.files]
  let runningTotal = totalBytes.value
  for (const f of accepted) {
    if (runningTotal + f.size > TOTAL_SIZE_LIMIT_BYTES) {
      error.value = `Cannot add "${f.name}" — would exceed ${formatBytes(TOTAL_SIZE_LIMIT_BYTES)} limit`
      continue
    }
    runningTotal += f.size
    next.push(f)
  }
  emit('update:files', next)
}

function removeAt(idx: number) {
  const next = [...props.files]
  next.splice(idx, 1)
  emit('update:files', next)
}

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  addFiles(Array.from(input.files))
  input.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  if (!canSubmit.value) return
  const r = rocketBtnRef.value?.getBoundingClientRect()
  emit('submit', r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 })
}

defineExpose({
  addFiles,
  focus() {
    textareaRef.value?.focus()
  },
  rocketViewportCenter(): { x: number; y: number } | null {
    const el = rocketBtnRef.value
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  },
  inputBoxRect(): DOMRect | null {
    return inputBoxRef.value?.getBoundingClientRect() ?? null
  },
})
</script>

<template>
  <div class="input-shell" :class="{ launching }">
    <transition-group name="filechips" tag="div" class="file-chips" v-if="files.length">
      <FileChip
        v-for="(f, i) in files"
        :key="`${f.name}-${f.size}-${f.lastModified}`"
        :file="f"
        @remove="removeAt(i)"
      />
    </transition-group>

    <div ref="inputBoxRef" class="input-box hairline-strong">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        @input="onInput"
        @keydown="onKeydown"
        rows="1"
        placeholder="Drop your notes, or describe what you want to learn"
        spellcheck="false"
      />

      <div class="actions">
        <button
          type="button"
          class="icon-btn"
          @click="fileInputRef?.click()"
          aria-label="Attach files"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
            <path
              d="M14.5 9.5 9.7 14.3a3 3 0 0 1-4.2-4.2l5.5-5.5a2 2 0 0 1 2.8 2.8l-5.5 5.5a1 1 0 0 1-1.4-1.4l4.8-4.8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <input
          ref="fileInputRef"
          type="file"
          multiple
          :accept="ACCEPT_ATTR"
          class="hidden-input"
          @change="onPickFiles"
        />

        <button
          ref="rocketBtnRef"
          type="button"
          class="rocket-btn"
          :class="{ enabled: canSubmit, hidden: launching }"
          :disabled="!canSubmit"
          @click="submit"
          aria-label="Launch"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path
              d="M5 19c1.5-4 5-7.5 9-9 1.5 4-2 7.5-6 9-1 .25-2 0-3 0Z"
              fill="currentColor"
              opacity="0.9"
            />
            <path
              d="M14 10c2-4 5-6 8-6 0 3-2 6-6 8M9 15l-4 4M11 17l-1 2M7 13l-2 1"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="16.5" cy="7.5" r="1.2" fill="#0a0510" />
          </svg>
        </button>
      </div>
    </div>

    <div class="meta-row" v-if="files.length || error">
      <span v-if="files.length" class="counter" :class="{ over: overLimit }">
        {{ formatBytes(totalBytes) }} / 100 MB
      </span>
      <span v-if="error" class="error">{{ error }}</span>
    </div>
  </div>
</template>

<style scoped>
.input-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
  transition: opacity 320ms ease;
}
.input-shell.launching {
  opacity: 0.45;
  pointer-events: none;
}
.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.input-box {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: rgba(20, 8, 28, 0.55);
  backdrop-filter: blur(14px);
  border-radius: 16px;
  padding: 14px 14px 14px 20px;
  box-shadow:
    0 0 0 1px rgba(255, 181, 71, 0.04),
    0 30px 80px -30px rgba(255, 181, 71, 0.08),
    0 0 60px -10px rgba(74, 29, 92, 0.4);
  transition:
    box-shadow 320ms ease,
    border-color 240ms ease;
}
.input-box:focus-within {
  box-shadow:
    0 0 0 1px rgba(255, 181, 71, 0.18),
    0 30px 80px -30px rgba(255, 181, 71, 0.18),
    0 0 80px -10px rgba(255, 181, 71, 0.12);
}

textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1.5;
  padding: 6px 0;
  max-height: 220px;
  overflow-y: auto;
}
textarea::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 2px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-hairline);
  transition:
    color 200ms ease,
    border-color 200ms ease,
    background 200ms ease;
}
.icon-btn:hover {
  color: var(--color-accent);
  border-color: rgba(255, 181, 71, 0.3);
  background: rgba(255, 181, 71, 0.06);
}

.hidden-input {
  display: none;
}

.rocket-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid rgba(255, 181, 71, 0.18);
  background: linear-gradient(180deg, rgba(255, 181, 71, 0.12), rgba(255, 181, 71, 0.04));
  color: var(--color-text-muted);
  transition:
    color 220ms ease,
    background 220ms ease,
    border-color 220ms ease,
    transform 220ms ease,
    box-shadow 320ms ease,
    opacity 280ms ease;
}
.rocket-btn.enabled {
  color: var(--color-accent);
  border-color: rgba(255, 181, 71, 0.55);
  background: linear-gradient(180deg, rgba(255, 211, 128, 0.18), rgba(255, 181, 71, 0.08));
  box-shadow:
    0 0 0 1px rgba(255, 181, 71, 0.18),
    0 0 24px -4px rgba(255, 181, 71, 0.4);
}
.rocket-btn.enabled:hover {
  transform: translateY(-1px);
  color: #fff4d6;
  box-shadow:
    0 0 0 1px rgba(255, 211, 128, 0.5),
    0 0 36px -2px rgba(255, 181, 71, 0.7);
}
.rocket-btn.hidden {
  opacity: 0;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 6px;
  font-family: var(--font-ui);
  font-size: 0.7rem;
}
.counter {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}
.counter.over {
  color: #ff8a65;
}
.error {
  color: #ff8a65;
  font-weight: 500;
}

.filechips-enter-active,
.filechips-leave-active {
  transition:
    opacity 240ms ease,
    transform 240ms ease;
}
.filechips-enter-from,
.filechips-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
