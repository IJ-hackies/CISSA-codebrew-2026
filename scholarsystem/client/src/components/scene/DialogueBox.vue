<script setup lang="ts">
/**
 * DialogueBox — classic RPG-style bottom dialogue panel.
 *
 * Renders lines one at a time with a typewriter effect.
 * Click anywhere to skip the typewriter, then click again to advance.
 * Emits `emotion` on each new line so the parent can sync the CharacterSprite.
 * Emits `complete` when all lines have been shown.
 */

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AnimationId } from './CharacterSprite.vue'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Emotion = 'neutral' | 'excited' | 'thoughtful' | 'stern' | 'encouraging' | 'surprised'
export type Speaker = 'npc' | 'player'

export interface DialogueLine {
  speaker: Speaker
  text: string
  emotion: Emotion
}

// Emotion → CharacterSprite animation
const EMOTION_ANIM: Record<Emotion, AnimationId> = {
  neutral:     'talking',
  excited:     'talking',
  thoughtful:  'thinking',
  stern:       'talking',
  encouraging: 'talking',
  surprised:   'surprised',
}

// ─── Props / Emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  lines: DialogueLine[]
  /** Display name shown above the dialogue text. */
  speakerName: string
  /** Typewriter speed in ms per character. Default 28. */
  typingSpeed?: number
}>()

const emit = defineEmits<{
  /** Fires on each new line with the animation the character should play. */
  emotion: [anim: AnimationId]
  /** Fires when all lines have been shown and the user advances past the last. */
  complete: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const lineIndex   = ref(0)
const displayed   = ref('')   // characters revealed so far
const isTyping    = ref(false)
const showCursor  = ref(true)

let typingTimer: ReturnType<typeof setInterval> | null = null
let cursorTimer:  ReturnType<typeof setInterval> | null = null

// ─── Computed ─────────────────────────────────────────────────────────────────

const currentLine = computed<DialogueLine | null>(
  () => props.lines[lineIndex.value] ?? null,
)

const isComplete = computed(
  () => displayed.value.length === (currentLine.value?.text.length ?? 0),
)

const isNpc = computed(
  () => (currentLine.value?.speaker ?? 'npc') === 'npc',
)

// ─── Typewriter ───────────────────────────────────────────────────────────────

function clearTyping() {
  if (typingTimer !== null) {
    clearInterval(typingTimer)
    typingTimer = null
  }
}

function startTyping(text: string) {
  clearTyping()
  displayed.value = ''
  isTyping.value = true
  let i = 0
  const speed = props.typingSpeed ?? 28
  typingTimer = setInterval(() => {
    if (i < text.length) {
      displayed.value += text[i]
      i++
    } else {
      clearTyping()
      isTyping.value = false
    }
  }, speed)
}

function skipTyping() {
  if (!currentLine.value) return
  clearTyping()
  displayed.value = currentLine.value.text
  isTyping.value = false
}

// ─── Advance ──────────────────────────────────────────────────────────────────

function advance() {
  // First click: complete the typewriter.
  if (isTyping.value) {
    skipTyping()
    return
  }

  // Last line: emit complete.
  if (lineIndex.value >= props.lines.length - 1) {
    emit('complete')
    return
  }

  // Advance to next line.
  lineIndex.value++
}

// ─── Watch for line changes ───────────────────────────────────────────────────

watch(lineIndex, (idx) => {
  const line = props.lines[idx]
  if (!line) return
  emit('emotion', EMOTION_ANIM[line.emotion])
  nextTick(() => startTyping(line.text))
}, { immediate: false })

// Start on mount.
watch(() => props.lines, (lines) => {
  if (lines.length === 0) return
  lineIndex.value = 0
  emit('emotion', EMOTION_ANIM[lines[0].emotion])
  startTyping(lines[0].text)
}, { immediate: true })

// ─── Cursor blink ─────────────────────────────────────────────────────────────

cursorTimer = setInterval(() => {
  showCursor.value = !showCursor.value
}, 530)

onBeforeUnmount(() => {
  clearTyping()
  if (cursorTimer !== null) clearInterval(cursorTimer)
})

// ─── Keyboard support ─────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') {
    e.preventDefault()
    advance()
  }
}

// Expose for parent to programmatically advance (e.g. challenge reveal).
defineExpose({ advance, skipTyping })
</script>

<template>
  <div
    class="dialogue-box"
    :class="{ 'is-player': !isNpc }"
    role="dialog"
    aria-live="polite"
    tabindex="0"
    @click="advance"
    @keydown="onKeyDown"
  >
    <!-- Scanline texture overlay -->
    <div class="scanlines" />

    <!-- Speaker name tag -->
    <div class="speaker-tag" :class="{ 'speaker-player': !isNpc }">
      {{ isNpc ? speakerName : 'Scholar' }}
    </div>

    <!-- Text area -->
    <div class="text-area">
      <p class="dialogue-text">
        {{ displayed
        }}<span
          v-if="isTyping"
          class="typing-cursor"
          :class="{ visible: showCursor }"
        >▌</span>
      </p>
    </div>

    <!-- Advance indicator -->
    <Transition name="fade-prompt">
      <div v-if="!isTyping && currentLine" class="advance-prompt">
        <span class="prompt-icon">▼</span>
      </div>
    </Transition>

    <!-- Line progress dots -->
    <div v-if="lines.length > 1" class="line-dots">
      <span
        v-for="(_, i) in lines"
        :key="i"
        class="dot"
        :class="{ active: i === lineIndex, done: i < lineIndex }"
      />
    </div>
  </div>
</template>

<style scoped>
.dialogue-box {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  min-height: 160px;
  padding: 0 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(4, 6, 14, 0.92);
  border-top: 1px solid rgba(232, 236, 242, 0.12);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  cursor: pointer;
  user-select: none;
  outline: none;

  /* Subtle corner bevel feel */
  clip-path: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

/* NPC: cool blue-tinted border. Player: warm accent. */
.dialogue-box::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(100, 160, 255, 0.6) 20%,
    rgba(100, 160, 255, 0.8) 50%,
    rgba(100, 160, 255, 0.6) 80%,
    transparent 100%
  );
}
.dialogue-box.is-player::before {
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 181, 71, 0.5) 20%,
    rgba(255, 181, 71, 0.7) 50%,
    rgba(255, 181, 71, 0.5) 80%,
    transparent 100%
  );
}

/* CRT scanlines */
.scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.08) 3px,
    rgba(0, 0, 0, 0.08) 4px
  );
  pointer-events: none;
  border-radius: inherit;
}

/* ─── Speaker tag ─────────────────────────────────────────────────── */
.speaker-tag {
  align-self: flex-start;
  margin-top: 18px;
  padding: 3px 14px;
  background: rgba(100, 160, 255, 0.12);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 4px;
  font-family: var(--font-ui);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(140, 190, 255, 0.9);
}
.speaker-player {
  background: rgba(255, 181, 71, 0.1);
  border-color: rgba(255, 181, 71, 0.3);
  color: rgba(255, 210, 130, 0.9);
}

/* ─── Text ────────────────────────────────────────────────────────── */
.text-area {
  flex: 1;
  display: flex;
  align-items: flex-start;
}

.dialogue-text {
  font-family: var(--font-body);
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--color-text-primary);
  margin: 0;
  min-height: 2.5em;
  letter-spacing: 0.01em;
}

.typing-cursor {
  opacity: 0;
  color: rgba(140, 190, 255, 0.8);
  font-size: 0.9em;
  transition: opacity 80ms;
}
.typing-cursor.visible { opacity: 1; }

/* ─── Advance prompt ──────────────────────────────────────────────── */
.advance-prompt {
  position: absolute;
  bottom: 20px;
  right: 32px;
}
.prompt-icon {
  font-size: 0.7rem;
  color: rgba(140, 190, 255, 0.7);
  animation: bounce-down 0.9s ease-in-out infinite;
}
@keyframes bounce-down {
  0%, 100% { transform: translateY(0); opacity: 0.7; }
  50%       { transform: translateY(4px); opacity: 1; }
}

/* ─── Line dots ───────────────────────────────────────────────────── */
.line-dots {
  position: absolute;
  top: 14px;
  right: 32px;
  display: flex;
  gap: 5px;
  align-items: center;
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(232, 236, 242, 0.15);
  transition: background 200ms ease, transform 200ms ease;
}
.dot.done    { background: rgba(100, 160, 255, 0.4); }
.dot.active  { background: rgba(140, 190, 255, 0.9); transform: scale(1.3); }

/* ─── Transitions ─────────────────────────────────────────────────── */
.fade-prompt-enter-active,
.fade-prompt-leave-active {
  transition: opacity 300ms ease;
}
.fade-prompt-enter-from,
.fade-prompt-leave-to {
  opacity: 0;
}

/* ─── Mobile ──────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .dialogue-box {
    padding: 0 20px 24px;
    min-height: 140px;
  }
  .dialogue-text {
    font-size: 0.92rem;
  }
}
</style>
