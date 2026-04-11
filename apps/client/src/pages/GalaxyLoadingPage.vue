<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import { fetchGalaxyEnvelope, appendGalaxy, type GalaxyJobStatus } from '@/lib/meshApi'
import { useMeshStore } from '@/lib/meshStore'
import { takePendingAppend } from '@/lib/pendingAppend'

const route  = useRoute()
const router = useRouter()
const { clear: clearMeshStore } = useMeshStore()

const galaxyId = route.params.id as string

// ── Status pill ───────────────────────────────────────────────────
const statusMessage  = ref('Expanding your galaxy')
const statusFading   = ref(false)
const transitioning  = ref(false)

const STAGE_MESSAGES: Record<GalaxyJobStatus, string[]> = {
  queued:   ['Queued for processing', 'Warming up the engines', 'Getting ready'],
  ingest:   ['Reading your content', 'Parsing sources', 'Extracting key ideas'],
  cluster:  ['Discovering themes', 'Finding connections', 'Grouping related ideas'],
  outline:  ['Building new solar systems', 'Placing the planets', 'Shaping your galaxy'],
  expand:   ['Expanding knowledge', 'Writing planet details', 'Adding depth to each world'],
  stories:  ['Writing stories', 'Crafting the narrative', 'Sending explorers into the void'],
  complete: ['Your galaxy is ready'],
  error:    ['Something went wrong'],
}

let _cycleMessages: string[] = []
let _cycleIndex   = 0
let _cycleTimer: number | null = null

function _scheduleNextMessage() {
  if (_cycleMessages.length <= 1) return
  const delay = 3000 + Math.random() * 2400
  _cycleTimer = window.setTimeout(() => {
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
    statusFading.value  = false
    _scheduleNextMessage()
  }, 220)
}

function stopStatusCycle() {
  if (_cycleTimer !== null) { clearTimeout(_cycleTimer); _cycleTimer = null }
}

// ── Poll until renderable ─────────────────────────────────────────
const POLL_INTERVAL_MS = 2500
let _lastStage: GalaxyJobStatus | null = null

async function waitForComplete() {
  for (;;) {
    const envelope = await fetchGalaxyEnvelope(galaxyId)
    if (envelope.status !== _lastStage) {
      _lastStage = envelope.status
      startStatusCycle(envelope.status)
    }
    if (envelope.status === 'error') throw new Error(envelope.error ?? 'Pipeline failed')
    if (envelope.status === 'complete' && Object.keys(envelope.galaxy.solarSystems).length > 0) {
      return
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

// ── Renderer ──────────────────────────────────────────────────────
const galaxyRendererRef = ref<InstanceType<typeof GalaxyRenderer> | null>(null)

onMounted(async () => {
  const renderer = galaxyRendererRef.value?.getRenderer()

  startStatusCycle('queued')

  // Kick off the rocket animation immediately — upload happens in parallel
  const rocketPromise = renderer ? renderer.launchRocket() : Promise.resolve()

  // If there's a pending append payload, fire the upload now (concurrently with animation)
  const pending = takePendingAppend()
  if (pending) {
    try {
      await appendGalaxy(pending.galaxyId, pending.input)
    } catch (err) {
      // Upload failed — go back to chat
      stopStatusCycle()
      clearMeshStore()
      router.replace(`/galaxy/${galaxyId}/chat`)
      return
    }
  }

  // Wait for the rocket launch animation to finish (it may already be done)
  await rocketPromise

  try {
    await waitForComplete()
  } catch {
    stopStatusCycle()
    clearMeshStore()
    router.replace(`/galaxy/${galaxyId}/chat`)
    return
  }

  if (renderer) await renderer.landRocket()

  stopStatusCycle()
  transitioning.value = true
  await new Promise((r) => setTimeout(r, 450))

  clearMeshStore()
  router.replace(`/galaxy/${galaxyId}`)
})

onBeforeUnmount(() => {
  stopStatusCycle()
})
</script>

<template>
  <main class="loading-page">
    <GalaxyRenderer ref="galaxyRendererRef" />

    <!-- Fade-to-black before route switch -->
    <div class="transition-veil" :class="{ active: transitioning }" />

    <!-- Status pill -->
    <div class="launch-status visible">
      <span class="launch-status-text" :class="{ fading: statusFading }">{{ statusMessage }}</span>
      <span class="launch-status-dots" aria-hidden="true">...</span>
    </div>

    <!-- Nebula blobs (match ChatLanding) -->
    <div class="nebula nebula-1" />
    <div class="nebula nebula-2" />
    <div class="nebula nebula-3" />
    <div class="dot-grid" />
    <div class="hero-glow" />
    <div class="noise" />
    <div class="vignette" />
  </main>
</template>

<style scoped>
.loading-page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
}

/* Transition veil */
.transition-veil {
  position: fixed; inset: 0;
  background: #02040a;
  opacity: 0;
  pointer-events: none;
  z-index: 50;
  transition: opacity 450ms ease-in;
}
.transition-veil.active { opacity: 1; }

/* Status pill */
.launch-status {
  position: fixed;
  bottom: 28%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 22;
  display: flex;
  align-items: center;
  padding: 9px 22px;
  border-radius: 999px;
  background: rgba(4,4,15,0.55);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.07);
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: rgba(210,220,255,0.75);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 600ms ease;
  pointer-events: none;
}
.launch-status.visible { opacity: 1; }

.launch-status-text { transition: opacity 200ms ease; }
.launch-status-text.fading { opacity: 0; }

.launch-status-dots {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  width: 0.35em;
  animation: launch-dots 1.5s linear infinite;
}
@keyframes launch-dots {
  0%      { width: 0.35em; animation-timing-function: step-end; }
  33.33%  { width: 0.7em;  animation-timing-function: step-end; }
  66.66%  { width: 1.05em; animation-timing-function: step-end; }
  100%    { width: 0.35em; }
}

/* Background (copied from ChatLanding) */
.nebula {
  position: fixed; border-radius: 50%;
  filter: blur(110px); pointer-events: none; z-index: 1;
}
.nebula-1 {
  width: 600px; height: 600px; top: -140px; left: -120px;
  background: radial-gradient(circle, rgba(80,120,255,0.18) 0%, transparent 65%);
  animation: nebula-1 32s ease-in-out infinite alternate;
}
.nebula-2 {
  width: 520px; height: 520px; bottom: -100px; right: -100px;
  background: radial-gradient(circle, rgba(130,80,255,0.15) 0%, transparent 65%);
  animation: nebula-2 28s ease-in-out infinite alternate;
}
.nebula-3 {
  width: 440px; height: 440px; top: 40%; left: 55%;
  background: radial-gradient(circle, rgba(30,160,180,0.12) 0%, transparent 65%);
  animation: nebula-3 38s ease-in-out infinite alternate;
}
@keyframes nebula-1 {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  40%  { transform: translate(30px,40px) scale(1.15); opacity: 0.75; }
  100% { transform: translate(60px,80px) scale(0.92); opacity: 0.9; }
}
@keyframes nebula-2 {
  0%   { transform: translate(0,0) scale(1.05); opacity: 0.8; }
  50%  { transform: translate(-25px,-30px) scale(0.88); opacity: 1; }
  100% { transform: translate(-50px,-60px) scale(1.12); opacity: 0.75; }
}
@keyframes nebula-3 {
  0%   { transform: translate(0,0) scale(0.92); opacity: 1; }
  45%  { transform: translate(-20px,25px) scale(1.2); opacity: 0.8; }
  100% { transform: translate(-40px,50px) scale(1); opacity: 0.95; }
}
.dot-grid {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
}
.hero-glow {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255,181,71,0.04) 0%, transparent 100%);
}
.noise {
  position: fixed; inset: 0; z-index: 3; pointer-events: none; opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
.vignette {
  position: fixed; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(2,4,10,0.65) 100%);
}
</style>
