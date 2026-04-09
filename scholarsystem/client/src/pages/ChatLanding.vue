<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import ChatInput from '@/components/ChatInput.vue'
import SuggestionChips from '@/components/SuggestionChips.vue'
import DropOverlay from '@/components/DropOverlay.vue'
import HistoryButton from '@/components/HistoryButton.vue'
import HistoryOverlay from '@/components/HistoryOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useVisualViewport } from '@/composables/useVisualViewport'
import {
  addRecentGalaxy,
  generateUuid,
  hasAnyRecentGalaxies,
  listRecentGalaxies,
  type GalaxyEntry,
} from '@/lib/recentGalaxies'

const router = useRouter()
const isMobile = useIsMobile()
useVisualViewport()

const text = ref('')
const files = ref<File[]>([])
const launching = ref(false)
const dropVisible = ref(false)
const showSuggestions = ref(!hasAnyRecentGalaxies())
const recents = ref<GalaxyEntry[]>(listRecentGalaxies())
const historyOpen = ref(false)

const galaxyRendererRef = ref<InstanceType<typeof GalaxyRenderer> | null>(null)
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)
const inputRect = ref<DOMRect | null>(null)

// ─── Drag-and-drop, page-wide ─────────────────────────────────────────────
let dragCounter = 0
function isFileDrag(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}
function onDragEnter(e: DragEvent) {
  if (!isFileDrag(e)) return
  dragCounter++
  dropVisible.value = true
}
function onDragOver(e: DragEvent) {
  if (!isFileDrag(e)) return
  e.preventDefault()
}
function onDragLeave(e: DragEvent) {
  if (!isFileDrag(e)) return
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    dropVisible.value = false
  }
}
function onDrop(e: DragEvent) {
  if (!isFileDrag(e)) return
  e.preventDefault()
  dragCounter = 0
  dropVisible.value = false
  const dropped = Array.from(e.dataTransfer?.files ?? [])
  if (dropped.length) chatInputRef.value?.addFiles(dropped)
}

// ─── Focus reaction wiring + input rect tracking ──────────────────────────
// inputRect is a high-water mark: it only ever grows. This way orbiting
// glyphs reserve space for the input's largest historical size, so they
// don't need to scatter when the user expands the textarea.
function updateFocusAnchor() {
  const rect = chatInputRef.value?.inputBoxRect() ?? null
  if (rect) {
    const prev = inputRect.value
    if (!prev) {
      inputRect.value = rect
    } else {
      const left = Math.min(prev.left, rect.left)
      const top = Math.min(prev.top, rect.top)
      const right = Math.max(prev.right, rect.right)
      const bottom = Math.max(prev.bottom, rect.bottom)
      inputRect.value = new DOMRect(left, top, right - left, bottom - top)
    }
  }
  const renderer = galaxyRendererRef.value?.getRenderer()
  if (!renderer) return
  if (!rect) {
    renderer.setFocusAnchor(null)
    return
  }
  // Focus anchor follows the *current* center, not the high-water mark.
  renderer.setFocusAnchor({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
}

let focusInterval: number | null = null
let inputResizeObserver: ResizeObserver | null = null
onMounted(async () => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  // Focus the input on mount so the void feels alive immediately.
  await nextTick()
  // Defer focus a beat so layout has settled.
  setTimeout(() => {
    chatInputRef.value?.focus()
    updateFocusAnchor()
    // Observe the input box so the high-water rect tracks growth in real time.
    const el = chatInputRef.value?.inputBoxEl()
    if (el) {
      inputResizeObserver = new ResizeObserver(() => updateFocusAnchor())
      inputResizeObserver.observe(el)
    }
  }, 100)
  // Re-anchor on resize / scroll.
  window.addEventListener('resize', updateFocusAnchor)
  // Cheap poll fallback — covers the case where the renderer wasn't ready yet.
  focusInterval = window.setInterval(updateFocusAnchor, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  window.removeEventListener('resize', updateFocusAnchor)
  if (focusInterval !== null) clearInterval(focusInterval)
  inputResizeObserver?.disconnect()
  inputResizeObserver = null
})

function onPickSuggestion(t: string) {
  text.value = t
  chatInputRef.value?.focus()
}

function openHistory() {
  if (!recents.value.length) return
  historyOpen.value = true
  const renderer = galaxyRendererRef.value?.getRenderer()
  if (!renderer) return
  if (isMobile.value) {
    // Mobile: brief warp + input fades (the fade is driven by .dimmed class).
    renderer.warp()
  } else {
    // Desktop: sustained camera pull-back. Input shrinks + fades via CSS.
    renderer.zoomOut()
  }
}
function closeHistory() {
  historyOpen.value = false
  const renderer = galaxyRendererRef.value?.getRenderer()
  if (!renderer) return
  if (isMobile.value) {
    renderer.warp()
  } else {
    renderer.zoomIn()
  }
}

const placeholderTitle = computed(() => {
  const trimmed = text.value.trim()
  if (trimmed) return trimmed.slice(0, 48)
  if (files.value.length) return files.value[0].name.replace(/\.[^.]+$/, '')
  return 'Untitled galaxy'
})

async function handleSubmit(origin: { x: number; y: number }) {
  if (launching.value) return
  launching.value = true

  const renderer = galaxyRendererRef.value?.getRenderer()
  if (!renderer) {
    // Renderer not ready — just create the entry and bail.
    finalizeFakeGalaxy()
    return
  }

  // Tell the renderer where the DOM rocket lives so it can take over from
  // the same screen position. (DOM button fades via .launching CSS class.)
  await renderer.launchRocket(origin)

  // Cruise begins. In mockup mode we simulate Stage 1 with a fixed 3s
  // timer. TODO: replace with a real "Stage 1 complete" signal from the
  // SSE stream of POST /api/galaxy/create.
  await new Promise((r) => setTimeout(r, 3000))

  await renderer.landRocket()
  finalizeFakeGalaxy()
}

function finalizeFakeGalaxy() {
  // TODO: this entire function is the mockup stand-in. Replace with the
  // real galaxy UUID returned by POST /api/galaxy/create. The localStorage
  // write stays — it's how the recent-galaxies strip stays in sync with
  // what the user has explored.
  const entry: GalaxyEntry = {
    uuid: generateUuid(),
    title: placeholderTitle.value,
    createdAt: Date.now(),
  }
  addRecentGalaxy(entry)
  recents.value = listRecentGalaxies()
  router.push(`/galaxy/${entry.uuid}`)
}
</script>

<template>
  <main class="page" :class="{ mobile: isMobile }">
    <GalaxyRenderer ref="galaxyRendererRef" />

    <!-- Logo + wordmark (top-left desktop, top-right mobile) -->
    <a href="/" class="logo-link" aria-label="Scholar System">
      <img src="/logo.png" alt="Scholar System" class="logo" />
      <span class="wordmark">SCHOLAR&nbsp;SYSTEM</span>
    </a>

    <!-- Unified history button (top-right desktop, top-left mobile) -->
    <HistoryButton
      :visible="recents.length > 0 && !launching"
      @open="openHistory"
    />

    <!-- ─── Desktop layout: centered stage ──────────────────────────── -->
    <div
      v-if="!isMobile"
      class="stage"
      :class="{ launching, 'history-open': historyOpen }"
    >
      <div class="hero">
        <h1 class="tagline">
          Turn anything you study<br />into a <strong>galaxy</strong> you can explore.
        </h1>
      </div>

      <ChatInput
        ref="chatInputRef"
        v-model="text"
        v-model:files="files"
        :launching="launching"
        @submit="handleSubmit"
      />

      <div class="hints">
        <span><kbd>↵</kbd> launch</span>
        <span class="dot-sep">·</span>
        <span><kbd>⇧↵</kbd> newline</span>
        <span class="dot-sep">·</span>
        <span>drop files anywhere</span>
      </div>

      <SuggestionChips
        v-if="showSuggestions && !recents.length && !launching"
        @pick="onPickSuggestion"
      />
    </div>

    <!-- Subtle desktop footer — file format vocabulary -->
    <div v-if="!isMobile" class="formats-footer" :class="{ hidden: launching || historyOpen }">
      <span class="formats-label">SUPPORTED</span>
      <span class="formats-list">PDF · DOCX · PPTX · MD · TXT · RTF · HTML · CSV · JSON · EPUB · TEX · IPYNB</span>
    </div>

    <!-- ─── Mobile layout: chips floating above, input pinned bottom ── -->
    <template v-if="isMobile">
      <div
        v-if="showSuggestions && !recents.length && !launching && !historyOpen"
        class="mobile-chips-floating"
      >
        <SuggestionChips @pick="onPickSuggestion" />
      </div>

      <div class="mobile-input-dock" :class="{ launching, dimmed: historyOpen }">
        <ChatInput
          ref="chatInputRef"
          v-model="text"
          v-model:files="files"
          :launching="launching"
          mobile
          @submit="handleSubmit"
        />
      </div>
    </template>

    <!-- Unified history overlay -->
    <HistoryOverlay
      :visible="historyOpen"
      :entries="recents"
      @close="closeHistory"
    />

    <DropOverlay :visible="dropVisible" />
  </main>
</template>

<style scoped>
.page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
}

.logo-link {
  position: fixed;
  top: 28px;
  left: 32px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  opacity: 0.92;
  transition:
    opacity 240ms ease,
    transform 320ms ease;
  animation: logoIn 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.wordmark {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.28em;
  color: var(--color-text-primary);
  white-space: nowrap;
  user-select: none;
  opacity: 0.85;
}
.logo-link:hover {
  opacity: 1;
  transform: translateY(-1px);
}
.logo {
  width: 160px;
  height: auto;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}
@keyframes logoIn {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 0.92;
    transform: translateY(0);
  }
}

.stage {
  position: relative;
  z-index: 5;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 120px 24px 100px;
  transition: transform 600ms ease;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
  margin-bottom: 8px;
  animation: heroIn 1100ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes heroIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-ui);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.32em;
  color: var(--color-accent);
  padding: 6px 14px;
  border: 1px solid rgba(255, 181, 71, 0.2);
  border-radius: 999px;
  background: rgba(255, 181, 71, 0.04);
}
.eyebrow .dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px rgba(255, 181, 71, 0.7);
  animation: dotPulse 2.4s ease-in-out infinite;
}
@keyframes dotPulse {
  0%, 100% {
    opacity: 0.55;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}
.tagline {
  font-family: var(--font-body);
  font-size: 2.1rem;
  font-weight: 300;
  line-height: 1.2;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.018em;
  max-width: 680px;
}
.tagline strong {
  font-weight: 600;
  color: #fff;
}
@media (min-width: 1280px) {
  .tagline {
    font-size: 2.6rem;
  }
}
@media (min-width: 1536px) {
  .tagline {
    font-size: 3rem;
  }
}

.hints {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  font-family: var(--font-ui);
  font-size: 0.74rem;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
  animation: heroIn 1300ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: 200ms;
}
.hints kbd {
  display: inline-block;
  padding: 2px 7px;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-primary);
  background: rgba(245, 240, 234, 0.04);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 5px;
  margin-right: 5px;
}
.dot-sep {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.formats-footer {
  position: fixed;
  bottom: 28px;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  font-family: var(--font-ui);
  transition: opacity 360ms ease;
  animation: heroIn 1500ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: 400ms;
}
.formats-footer.hidden {
  opacity: 0;
}
.formats-label {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.32em;
  color: var(--color-accent);
  opacity: 0.7;
}
.formats-list {
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  color: var(--color-text-muted);
  opacity: 0.55;
}
.stage.launching {
  /* Pulled into the black hole — scale toward screen center, fade out. */
  transform: scale(0.4);
  opacity: 0;
  pointer-events: none;
  filter: blur(2px);
  transition:
    transform 1100ms cubic-bezier(0.5, 0, 0.75, 0),
    opacity 900ms ease-in,
    filter 900ms ease-in;
}
.stage.history-open {
  /* Camera-pulled-back: input shrinks and fades behind the overlay. */
  transform: scale(0.86);
  opacity: 0;
  pointer-events: none;
  transition:
    transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 520ms ease;
}

/* ── Mobile layout (≤768px) ─────────────────────────────────────────── */
.page.mobile .logo-link {
  /* Logo top-RIGHT on mobile, tucked tight into the corner */
  top: 10px;
  left: auto;
  right: 10px;
  flex-direction: row-reverse;
  gap: 8px;
}
.page.mobile .logo {
  width: 64px;
}
.page.mobile .wordmark {
  display: none;
}

.mobile-input-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--vv-bottom-offset, 0px);
  z-index: 30;
  padding: 10px 14px calc(14px + env(safe-area-inset-bottom)) 14px;
  background: linear-gradient(
    to top,
    rgba(2, 4, 8, 0.85) 0%,
    rgba(5, 8, 16, 0.55) 60%,
    rgba(5, 8, 16, 0) 100%
  );
  pointer-events: none;
  transition: opacity 320ms ease;
}
.mobile-input-dock > * {
  pointer-events: auto;
}
.mobile-input-dock.launching {
  opacity: 0;
  transform: scale(0.5) translateY(40px);
  filter: blur(2px);
  pointer-events: none;
  transition:
    opacity 900ms ease-in,
    transform 1100ms cubic-bezier(0.5, 0, 0.75, 0),
    filter 900ms ease-in;
}
.mobile-input-dock.dimmed {
  opacity: 0;
  pointer-events: none;
}

.mobile-chips-floating {
  position: fixed;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  z-index: 6;
  display: flex;
  justify-content: center;
  padding: 0 20px;
  pointer-events: none;
}
.mobile-chips-floating > * {
  pointer-events: auto;
}

@media (max-width: 768px) {
  .stage {
    display: none;
  }
}
</style>
