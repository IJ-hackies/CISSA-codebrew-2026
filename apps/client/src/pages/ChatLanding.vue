<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import ChatInput from '@/components/ChatInput.vue'
import DropOverlay from '@/components/DropOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import { useVisualViewport } from '@/composables/useVisualViewport'
import {
  addRecentGalaxy,
  type GalaxyEntry,
} from '@/lib/recentGalaxies'
import { createGalaxy, fetchGalaxyEnvelope, type GalaxyJobStatus } from '@/lib/meshApi'

const router = useRouter()
const isMobile = useIsMobile()
useVisualViewport()

const text = ref('')
const files = ref<File[]>([])
const launching = ref(false)
const transitioning = ref(false)  // true during the fade-to-black before route switch
const launchError = ref<string | null>(null)
const dropVisible = ref(false)

const galaxyRendererRef = ref<InstanceType<typeof GalaxyRenderer> | null>(null)
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)
const inputRect = ref<DOMRect | null>(null)

// ─── Launch status text ───────────────────────────────────────────────────────
const statusMessage = ref('Preparing your galaxy')
const statusFading = ref(false)

const STAGE_MESSAGES: Record<GalaxyJobStatus, string[]> = {
  queued: [
    'Preparing your galaxy',
    'Warming up the engines',
    'Getting ready for launch',
  ],
  ingest: [
    'Parsing sources',
    'Reading your content',
    'Extracting key ideas',
    'Processing your files',
  ],
  cluster: [
    'Discovering themes',
    'Finding connections',
    'Grouping related ideas',
    'Mapping the knowledge',
  ],
  outline: [
    'Building solar systems',
    'Organising the structure',
    'Placing the planets',
    'Shaping your galaxy',
  ],
  expand: [
    'Expanding knowledge',
    'Writing planet details',
    'Adding depth to each world',
    'Filling in the universe',
  ],
  stories: [
    'Writing stories',
    'Crafting your characters',
    'Plotting the journeys',
    'Weaving the narrative',
    'Sending explorers into the void',
  ],
  complete: ['Your galaxy is ready'],
  error:    ['Something went wrong'],
}

let _cycleMessages: string[] = []
let _cycleIndex   = 0
let _cycleTimer: number | null = null

function _scheduleNextMessage() {
  if (_cycleMessages.length <= 1) return
  // Each message lingers for a different amount — feels organic, not mechanical
  const delay = 3000 + Math.random() * 2400
  _cycleTimer = window.setTimeout(() => {
    // Fade out → swap text → fade back in
    statusFading.value = true
    window.setTimeout(() => {
      _cycleIndex = (_cycleIndex + 1) % _cycleMessages.length
      statusMessage.value = _cycleMessages[_cycleIndex]
      statusFading.value = false
      _scheduleNextMessage()
    }, 220)
  }, delay)
}

function startStatusCycle(stage: GalaxyJobStatus) {
  if (_cycleTimer !== null) { clearTimeout(_cycleTimer); _cycleTimer = null }
  _cycleMessages = STAGE_MESSAGES[stage] ?? [stage]
  _cycleIndex    = 0
  statusFading.value = true
  window.setTimeout(() => {
    statusMessage.value = _cycleMessages[0]
    statusFading.value = false
    _scheduleNextMessage()
  }, 220)
}

function stopStatusCycle() {
  if (_cycleTimer !== null) { clearTimeout(_cycleTimer); _cycleTimer = null }
}

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
  stopStatusCycle()
})


const placeholderTitle = computed(() => {
  const trimmed = text.value.trim()
  if (trimmed) return trimmed.slice(0, 48)
  // Never derive the title from the filename — it leaks into the solar system
  // name. Send "Untitled" so the pipeline generates a proper thematic title.
  return 'Untitled'
})

// Minimum cruise duration so the rocket cinematic still reads even if the
// pipeline returns faster than the animation. Real pipeline latency is
// unbounded in v1 (sync POST /api/galaxy/create); if it exceeds this, the
// cruise just waits on the network promise.
const MIN_CRUISE_MS = 2500
const POLL_INTERVAL_MS = 2500

let _lastPolledStage: GalaxyJobStatus | null = null
let _cancelled = false

class CancelError extends Error { constructor() { super('cancelled') } }

function cancelLaunch() {
  _cancelled = true
  stopStatusCycle()
  const renderer = galaxyRendererRef.value?.getRenderer()
  renderer?.abortLaunch()
  launching.value = false
  transitioning.value = false
  router.push('/')
}

async function waitForRenderableGalaxy(id: string) {
  for (;;) {
    if (_cancelled) throw new CancelError()
    const envelope = await fetchGalaxyEnvelope(id)
    if (_cancelled) throw new CancelError()
    // Only restart the cycle when the stage actually changes
    if (envelope.status !== _lastPolledStage) {
      _lastPolledStage = envelope.status
      startStatusCycle(envelope.status)
    }
    if (envelope.status === 'error') {
      throw new Error(envelope.error ?? 'Galaxy generation failed')
    }
    // Wait for the full pipeline (ingest + structure + stories) to complete
    // before navigating — ensures planets, concepts, and stories are all ready.
    if (envelope.status === 'complete' && Object.keys(envelope.galaxy.solarSystems).length > 0) {
      return envelope
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function handleSubmit() {
  if (launching.value) return

  // Accept any combination of: one or more attached files + pasted text.
  // The backend concatenates everything into a single blob with per-file
  // boundary headers, so Stage 1 can treat each file as a distinct topic
  // cluster. At least one of (files, text) must be present.
  const trimmed = text.value.trim()
  const allFiles = files.value.slice()
  if (!trimmed && allFiles.length === 0) {
    launchError.value = 'Type some text or attach a file to launch.'
    return
  }

  launching.value = true
  launchError.value = null
  _lastPolledStage = null
  startStatusCycle('queued')

  const renderer = galaxyRendererRef.value?.getRenderer()

  try {
    // Kick off the real pipeline call in parallel with the rocket launch
    // animation so cruise time overlaps network time.
    const pipelinePromise = createGalaxy({
      text: trimmed || undefined,
      title: placeholderTitle.value,
      files: allFiles.length > 0 ? allFiles : undefined,
      filename: allFiles[0]?.name ?? null,
    })

    if (renderer) {
      // Launch the canvas rocket while the DOM button fades via .launching.
      await renderer.launchRocket()
    }

    // Wait for BOTH: the pipeline result and a minimum cruise feel.
    const [created] = await Promise.all([
      pipelinePromise,
      new Promise((r) => setTimeout(r, MIN_CRUISE_MS)),
    ])

    const galaxy = await waitForRenderableGalaxy(created.id)

    console.log('[chat-landing] pipeline returned galaxy:', galaxy)

    if (renderer) {
      await renderer.landRocket()
    }

    stopStatusCycle()
    // Fade to black before the route switch so there's no hard cut.
    transitioning.value = true
    await new Promise((r) => setTimeout(r, 450))
    if (_cancelled) return

    const entry: GalaxyEntry = {
      uuid: galaxy.id,
      title: galaxy.title,
      createdAt: Date.now(),
    }
    if (!entry.uuid) {
      throw new Error('Backend returned galaxy without id')
    }
    addRecentGalaxy(entry)
    const navResult = router.push(`/galaxy/${entry.uuid}`)
    navResult
      .then((failure) => {
        if (failure) console.warn('[chat-landing] router.push reported:', failure)
      })
      .catch((e) => console.error('[chat-landing] router.push threw:', e))
  } catch (err) {
    if (err instanceof CancelError) return
    const message = err instanceof Error ? err.message : String(err)
    console.error('[chat-landing] launch failed:', message)
    stopStatusCycle()
    launchError.value = `Launch failed: ${message}`
    // Reset the renderer so the void doesn't stay stuck in tunnel mode.
    renderer?.abortLaunch()
    launching.value = false
  }
}
</script>

<template>
  <main class="page" :class="{ mobile: isMobile }">
    <GalaxyRenderer ref="galaxyRendererRef" />
    <!-- Fade-to-black veil that fires after rocket lands, before route switch -->
    <div class="transition-veil" :class="{ active: transitioning }" />

    <!-- Launch status pill — visible during rocket cruise -->
    <div class="launch-status" :class="{ visible: launching && !transitioning }">
      <span class="launch-status-text" :class="{ fading: statusFading }">{{ statusMessage }}</span><span class="launch-status-dots" aria-hidden="true">...</span>
    </div>

    <!-- Cancel button — appears after a short delay so it doesn't flash on fast connections -->
    <button
      class="cancel-launch-btn"
      :class="{ visible: launching && !transitioning }"
      @click="cancelLaunch"
    >Cancel</button>

    <!-- Nebula blobs -->
    <div class="nebula nebula-1" />
    <div class="nebula nebula-2" />
    <div class="nebula nebula-3" />

    <!-- Dot grid -->
    <div class="dot-grid" />

    <!-- Hero glow — warm bloom centred behind the content -->
    <div class="hero-glow" />

    <!-- Noise texture -->
    <div class="noise" />

    <!-- Edge vignette -->
    <div class="vignette" />

    <!-- Logo + wordmark (top-left desktop, top-right mobile) -->
    <a href="/" class="logo-link" aria-label="Stella Taco">
      <img src="/logo.png" alt="Stella Taco" class="logo" />
      <span class="wordmark">STELLA&nbsp;TACO</span>
    </a>

    <!-- ─── Desktop layout: centered stage ──────────────────────────── -->
    <div
      v-if="!isMobile"
      class="stage"
      :class="{ launching }"
    >
      <div class="hero">
        <h1 class="tagline">
          Upload your memories.<br />Explore it as a <strong>galaxy</strong>.
        </h1>
        <p class="sub-tagline">Journals, notes, PDFs, photos — drop anything.</p>
      </div>

      <ChatInput
        ref="chatInputRef"
        v-model="text"
        v-model:files="files"
        :launching="launching"
        @submit="handleSubmit"
      />

      <div class="hints">
        <span><kbd>↵</kbd> create galaxy</span>
        <span class="dot-sep">·</span>
        <span><kbd>⇧↵</kbd> newline</span>
        <span class="dot-sep">·</span>
        <span>drop files anywhere</span>
      </div>
    </div>

    <!-- Format indicator -->
    <div v-if="!isMobile" class="formats-footer" :class="{ hidden: launching }">
      <div class="format-icons">
        <span class="fmt-chip">PDF</span>
        <span class="fmt-chip">DOCX</span>
        <span class="fmt-chip">TXT</span>
        <span class="fmt-chip">MD</span>
        <span class="fmt-chip">Images</span>
        <span class="fmt-chip">PPTX</span>
        <span class="fmt-chip">+ more</span>
      </div>
    </div>

    <!-- ─── Mobile layout: chips floating above, input pinned bottom ── -->
    <template v-if="isMobile">
      <div class="mobile-input-dock" :class="{ launching }">
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

/* Nebula blobs */
.nebula {
  position: fixed;
  border-radius: 50%;
  filter: blur(110px);
  pointer-events: none;
  z-index: 1;
}
.nebula-1 {
  width: 600px; height: 600px;
  top: -140px; left: -120px;
  background: radial-gradient(circle, rgba(80, 120, 255, 0.18) 0%, transparent 65%);
  animation: nebula-1 32s ease-in-out infinite alternate;
}
.nebula-2 {
  width: 520px; height: 520px;
  bottom: -100px; right: -100px;
  background: radial-gradient(circle, rgba(130, 80, 255, 0.15) 0%, transparent 65%);
  animation: nebula-2 28s ease-in-out infinite alternate;
}
.nebula-3 {
  width: 440px; height: 440px;
  top: 40%; left: 55%;
  background: radial-gradient(circle, rgba(30, 160, 180, 0.12) 0%, transparent 65%);
  animation: nebula-3 38s ease-in-out infinite alternate;
}
@keyframes nebula-1 {
  0%   { transform: translate(0, 0)     scale(1);    opacity: 1; }
  40%  { transform: translate(30px, 40px) scale(1.15); opacity: 0.75; }
  100% { transform: translate(60px, 80px) scale(0.92); opacity: 0.9; }
}
@keyframes nebula-2 {
  0%   { transform: translate(0, 0)       scale(1.05); opacity: 0.8; }
  50%  { transform: translate(-25px, -30px) scale(0.88); opacity: 1; }
  100% { transform: translate(-50px, -60px) scale(1.12); opacity: 0.75; }
}
@keyframes nebula-3 {
  0%   { transform: translate(0, 0)      scale(0.92); opacity: 1; }
  45%  { transform: translate(-20px, 25px) scale(1.2);  opacity: 0.8; }
  100% { transform: translate(-40px, 50px) scale(1);    opacity: 0.95; }
}

/* Dot grid */
.dot-grid {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
}

/* Hero glow */
.hero-glow {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255, 181, 71, 0.04) 0%, transparent 100%);
}

/* Noise texture */
.noise {
  position: fixed; inset: 0; z-index: 3;
  pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 180px 180px;
}

/* Fade-to-black before route transition */
.transition-veil {
  position: fixed;
  inset: 0;
  background: #02040a;
  opacity: 0;
  pointer-events: none;
  z-index: 50;
  transition: opacity 450ms ease-in;
}
.transition-veil.active {
  opacity: 1;
}

/* Edge vignette */
.vignette {
  position: fixed; inset: 0; z-index: 2;
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(2, 4, 10, 0.65) 100%);
  pointer-events: none;
}

.logo-link {
  position: fixed;
  top: 28px;
  left: 32px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  opacity: 0.92;
  transition:
    opacity 240ms ease,
    transform 320ms ease;
  animation: logoIn 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.wordmark {
  font-family: var(--font-ui);
  font-size: 0.6rem;
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
  width: 100px;
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
  gap: 18px;
  padding: 100px 24px 80px;
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
  font-size: 1.55rem;
  font-weight: 300;
  line-height: 1.25;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.018em;
  max-width: 520px;
}
.tagline strong {
  font-weight: 600;
  color: #fff;
}
@media (min-width: 1280px) {
  .tagline {
    font-size: 1.75rem;
  }
}
@media (min-width: 1536px) {
  .tagline {
    font-size: 1.95rem;
    max-width: 560px;
  }
}

.hints {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-ui);
  font-size: 0.65rem;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
  animation: heroIn 1300ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: 200ms;
}
.hints kbd {
  display: inline-block;
  padding: 1px 5px;
  font-family: var(--font-ui);
  font-size: 0.6rem;
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

.sub-tagline {
  font-family: var(--font-ui);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
  margin: 0;
  opacity: 0.7;
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
.format-icons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.fmt-chip {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  padding: 3px 9px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 100px;
  opacity: 0.5;
  background: rgba(255, 255, 255, 0.02);
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

/* ── Launch status pill ─────────────────────────────────────────────────── */
.launch-status {
  position: fixed;
  /* Sits below the orbit ring (~30% above screen bottom feels natural) */
  bottom: 28%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 22;
  display: flex;
  align-items: center;
  gap: 0;
  pointer-events: none;

  padding: 9px 22px 9px 22px;
  border-radius: 999px;
  background: rgba(4, 4, 15, 0.55);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(255, 255, 255, 0.07);

  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: rgba(210, 220, 255, 0.75);
  white-space: nowrap;

  opacity: 0;
  transition: opacity 600ms ease;
}
.launch-status.visible {
  opacity: 1;
}

/* Cancel button — sits just below the status pill */
.cancel-launch-btn {
  position: fixed;
  bottom: calc(28% - 52px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 22;
  height: 34px;
  padding: 0 20px;
  font-family: var(--font-ui);
  font-size: 0.70rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: rgba(245,240,234,0.45);
  background: transparent;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 999px;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: color 180ms, border-color 180ms, background 180ms, opacity 600ms ease;
  transition-delay: 0s, 0s, 0s, 1.5s;
}
.cancel-launch-btn.visible {
  opacity: 1;
  pointer-events: auto;
}
.cancel-launch-btn:hover {
  color: rgba(245,240,234,0.85);
  border-color: rgba(255,255,255,0.22);
  background: rgba(255,255,255,0.05);
}

/* Text fades on message swap */
.launch-status-text {
  transition: opacity 200ms ease;
}
.launch-status-text.fading {
  opacity: 0;
}

/* Animated ellipsis — cycles "." → ".." → "..." → "." with no backward sweep */
.launch-status-dots {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  width: 0.35em; /* always at least one dot visible */
  animation: launch-dots 1.5s linear infinite;
}
@keyframes launch-dots {
  0%      { width: 0.35em;  animation-timing-function: step-end; }
  33.33%  { width: 0.7em;   animation-timing-function: step-end; }
  66.66%  { width: 1.05em;  animation-timing-function: step-end; }
  100%    { width: 0.35em; }
}
</style>
