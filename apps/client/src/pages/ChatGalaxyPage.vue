<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import ConstellationGlyph from '@/components/ConstellationGlyph.vue'
import ChatInput from '@/components/ChatInput.vue'
import DropOverlay from '@/components/DropOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  publishToTaco,
  unpublishFromTaco,
  updateTacoTagline,
  isOwner,
  type GalaxyEnvelope,
  type Submission,
} from '@/lib/meshApi'
import {
  getCachedEnvelope,
  fetchEnvelopeCached,
  getCachedSubmissions,
  fetchSubmissionsCached,
} from '@/lib/dataCache'
import { useMeshStore } from '@/lib/meshStore'
import { setPendingAppend } from '@/lib/pendingAppend'

const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const { clear: clearMeshStore, loadFromApi: preloadGalaxy } = useMeshStore()

const galaxyId = computed(() => route.params.id as string)

const envelope = ref<GalaxyEnvelope | null>(null)
const submissions = ref<Submission[]>([])
const text = ref('')
const files = ref<File[]>([])
const submitting = ref(false)
const submitError = ref<string | null>(null)
const dropVisible = ref(false)
const envelopeLoading = ref(true)
const subsLoading = ref(true)

// Title is seeded from router navigation state (passed by TacoDashboard)
// so it's available instantly before the envelope resolves.
const titleFromNav = (window.history.state?.title as string | undefined) ?? ''


const POLL_INTERVAL_MS = 2500

// ── Drag-and-drop ─────────────────────────────────────────────────
let dragCounter = 0
function isFileDrag(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}
function onDragEnter(e: DragEvent) { if (!isFileDrag(e)) return; dragCounter++; dropVisible.value = true }
function onDragOver(e: DragEvent) { if (!isFileDrag(e)) return; e.preventDefault() }
function onDragLeave(e: DragEvent) {
  if (!isFileDrag(e)) return
  dragCounter--
  if (dragCounter <= 0) { dragCounter = 0; dropVisible.value = false }
}
function onDrop(e: DragEvent) {
  if (!isFileDrag(e)) return
  e.preventDefault(); dragCounter = 0; dropVisible.value = false
  const dropped = Array.from(e.dataTransfer?.files ?? [])
  if (dropped.length) chatInputRef.value?.addFiles(dropped)
}

const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

// ── Load galaxy + submissions ──────────────────────────────────────
async function loadData() {
  const id = galaxyId.value

  // Seed from cache for instant render — no waiting for the network.
  const cachedEnv = getCachedEnvelope(id)
  if (cachedEnv) {
    envelope.value = cachedEnv
    envelopeLoading.value = false
  }
  const cachedSubs = getCachedSubmissions(id)
  if (cachedSubs) {
    submissions.value = cachedSubs
    subsLoading.value = false
  }

  // Fetch fresh envelope (updates silently if cache was warm).
  try {
    envelope.value = await fetchEnvelopeCached(id)
  } catch (err) {
    console.error('[chat-galaxy] envelope load failed:', err)
  } finally {
    envelopeLoading.value = false
  }

  // Fetch fresh submissions.
  try {
    submissions.value = await fetchSubmissionsCached(id)
  } catch (err) {
    console.error('[chat-galaxy] submissions load failed:', err)
  } finally {
    subsLoading.value = false
  }
}

// Poll while pipeline is running
let pollTimer: number | null = null
function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(async () => {
    try {
      const env = await fetchGalaxyEnvelope(galaxyId.value)
      envelope.value = env
      if (env.status === 'complete' || env.status === 'error') stopPolling()
    } catch { /* ignore */ }
  }, POLL_INTERVAL_MS)
}
function stopPolling() {
  if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  // Pre-fetch the galaxy mesh in the background so clicking the glyph
  // navigates into an already-loaded GalaxyView.
  preloadGalaxy(galaxyId.value).catch(() => { /* silent — GalaxyView will retry */ })
  await loadData()
  if (envelope.value && envelope.value.status !== 'complete' && envelope.value.status !== 'error') {
    startPolling()
  }
})

import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  stopPolling()
})

// ── Submit (append) ────────────────────────────────────────────────
const galaxyTitle = computed(() => envelope.value?.title ?? titleFromNav)
const galaxyStatus = computed(() => envelope.value?.status ?? 'complete')
// Don't show processing state while we're still loading initial data
const isProcessing = computed(() => !envelopeLoading.value && galaxyStatus.value !== 'complete' && galaxyStatus.value !== 'error')

const stageLabels: Record<string, string> = {
  queued: 'Queued…',
  ingest: 'Reading your content…',
  cluster: 'Discovering themes…',
  outline: 'Outlining solar systems…',
  expand: 'Growing planets…',
  stories: 'Writing stories…',
  complete: 'Ready',
  error: 'Error',
}
const statusLabel = computed(() => stageLabels[galaxyStatus.value] ?? galaxyStatus.value)

function handleSubmit() {
  if (submitting.value || isProcessing.value) return
  const trimmed = text.value.trim()
  const allFiles = files.value.slice()
  if (!trimmed && allFiles.length === 0) {
    submitError.value = 'Type some text or attach a file.'
    return
  }

  // Stash the payload for the loading page — no await, navigate instantly
  setPendingAppend({
    galaxyId: galaxyId.value,
    input: {
      text: trimmed || undefined,
      files: allFiles.length > 0 ? allFiles : undefined,
      filename: allFiles[0]?.name ?? null,
    },
  })
  clearMeshStore()
  router.push(`/galaxy/${galaxyId.value}/loading`)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function enterGalaxy() {
  router.push(`/galaxy/${galaxyId.value}`)
}

// ── Taco publish ───────────────────────────────────────────────────
const isPublic = computed(() => envelope.value?.isPublic ?? false)
const tacoModalOpen = ref(false)
const tacoTagline = ref('')
const tacoError = ref('')
const tacoSaving = ref(false)
const isEditingTagline = computed(() => isPublic.value)

function openTacoModal() {
  tacoTagline.value = envelope.value?.tagline ?? ''
  tacoError.value = ''
  tacoModalOpen.value = true
}
function closeTacoModal() {
  tacoModalOpen.value = false
  tacoTagline.value = ''
  tacoError.value = ''
}

async function submitTaco() {
  if (tacoSaving.value) return
  if (!isOwner(galaxyId.value)) {
    tacoError.value = 'This galaxy was created before sharing was enabled. Create a new galaxy to share it.'
    return
  }
  tacoSaving.value = true
  tacoError.value = ''
  try {
    if (isEditingTagline.value) {
      await updateTacoTagline(galaxyId.value, tacoTagline.value)
    } else {
      await publishToTaco(galaxyId.value, tacoTagline.value)
    }
    if (envelope.value) {
      envelope.value = { ...envelope.value, isPublic: true, tagline: tacoTagline.value.trim() }
    }
    closeTacoModal()
  } catch (err) {
    tacoError.value = err instanceof Error ? err.message : 'Failed to publish'
  } finally {
    tacoSaving.value = false
  }
}

function navigateBack() {
  router.push('/')
}

const removeConfirmOpen = ref(false)
const removePhase = ref<'idle' | 'removing' | 'removed'>('idle')

async function removefromTaco() {
  if (removePhase.value !== 'idle') return
  removePhase.value = 'removing'
  try {
    await unpublishFromTaco(galaxyId.value)
    if (envelope.value) envelope.value = { ...envelope.value, isPublic: false }
    removePhase.value = 'removed'
    setTimeout(() => {
      removeConfirmOpen.value = false
      removePhase.value = 'idle'
    }, 1200)
  } catch (err) {
    console.error('[chat-galaxy] unpublish failed:', err)
    removePhase.value = 'idle'
  }
}
</script>

<template>
  <main
    class="chat-galaxy-page"
    :class="{ mobile: isMobile }"
    @dragenter.prevent
    @dragover.prevent
    @dragleave.prevent
    @drop.prevent
  >
    <!-- Starfield canvas -->
    <GalaxyRenderer />
    <!-- Background -->
    <div class="nebula nebula-1" />
    <div class="nebula nebula-2" />
    <div class="dot-grid" />
    <div class="noise" />
    <div class="vignette" />

    <!-- Back to Taco -->
    <button class="back-btn" @click="navigateBack" aria-label="Back to dashboard">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="back-label">Dashboard</span>
    </button>

    <!-- Content (rendered immediately — glyph only needs the UUID from route) -->
    <div class="content">

      <!-- Galaxy portal -->
      <div class="portal-section">
        <button
          class="glyph-btn"
          :class="{ processing: isProcessing || submitting }"
          @click="enterGalaxy"
          :aria-label="`Enter ${galaxyTitle} galaxy`"
          :disabled="isProcessing || submitting"
          :title="isProcessing ? 'Galaxy is being generated' : submitting ? 'Uploading…' : 'Enter 3D galaxy'"
        >
          <ConstellationGlyph :uuid="galaxyId" :size="isMobile ? 120 : 160" />
          <div v-if="isProcessing" class="processing-ring" />
        </button>

        <div class="galaxy-meta">
          <span class="galaxy-title">{{ galaxyTitle || '—' }}</span>
          <span class="galaxy-hint" v-if="!isProcessing">Click to explore 3D galaxy</span>
          <span class="galaxy-hint processing" v-else>{{ statusLabel }}</span>
        </div>
      </div>

      <!-- Taco share row -->
      <div v-if="!envelopeLoading && !isProcessing" class="taco-row">
        <template v-if="!isPublic">
          <button class="taco-share-btn" @click="openTacoModal">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M6.5 3.5v6M3.5 6.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            Share to The Taco
          </button>
        </template>
        <template v-else>
          <div class="taco-published-row">
            <span class="taco-published-label">In The Taco</span>
            <button class="taco-edit-btn" @click="openTacoModal">Edit tagline</button>
            <button class="taco-remove-btn" @click="removeConfirmOpen = true">Remove</button>
          </div>
        </template>
      </div>

      <!-- Divider -->
      <div class="section-divider">
        <span class="divider-label">Add more content</span>
      </div>

      <!-- Chat input -->
      <div class="input-section">
        <ChatInput
          ref="chatInputRef"
          v-model="text"
          v-model:files="files"
          :launching="submitting || isProcessing"
          :placeholder="isProcessing ? 'Generating…' : 'Add more content to your galaxy…'"
          @submit="handleSubmit"
        />
        <p v-if="submitError" class="submit-error">{{ submitError }}</p>
        <p v-if="!isMobile" class="input-hint">
          <kbd>↵</kbd> append to galaxy &nbsp;·&nbsp; <kbd>⇧↵</kbd> newline &nbsp;·&nbsp; drop files anywhere
        </p>
      </div>

      <!-- Submission log -->
      <div v-if="subsLoading" class="subs-loading-row">
        <div class="subs-dot" /><div class="subs-dot" /><div class="subs-dot" />
      </div>
      <div v-else-if="submissions.length > 0" class="submission-log">
        <div class="log-header">
          <span class="log-label">CONTENT ADDED</span>
          <span class="log-count">{{ submissions.length }} submission{{ submissions.length === 1 ? '' : 's' }}</span>
        </div>
        <div class="log-entries">
          <div v-for="sub in [...submissions].reverse()" :key="sub.id" class="log-entry">
            <div class="log-entry-time">{{ formatDate(sub.createdAt) }}</div>
            <div class="log-entry-content">
              <span v-if="sub.text" class="log-text">{{ sub.text.slice(0, 120) }}{{ sub.text.length > 120 ? '…' : '' }}</span>
              <span
                v-for="fname in sub.filenames"
                :key="fname"
                class="log-file"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M2 1h5l2 2v7H2V1z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
                  <path d="M7 1v2h2" stroke="currentColor" stroke-width="1"/>
                </svg>
                {{ fname }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <DropOverlay :visible="dropVisible" />

    <!-- Taco remove confirm -->
    <Transition name="dialog-fade">
      <div v-if="removeConfirmOpen" class="dialog-backdrop" @click.self="removePhase === 'idle' && (removeConfirmOpen = false)">
        <div class="dialog">
          <p class="dialog-title">
            {{ removePhase === 'removed' ? 'Removed from The Taco' : 'Remove from The Taco?' }}
          </p>
          <p class="dialog-body">
            {{ removePhase === 'removed'
              ? 'Your galaxy has been removed from the public gallery.'
              : 'This galaxy will no longer appear in the public gallery. You can re-publish it any time.' }}
          </p>
          <div v-if="removePhase === 'idle'" class="dialog-actions">
            <button class="dialog-btn cancel" @click="removeConfirmOpen = false">Cancel</button>
            <button class="dialog-btn confirm" @click="removefromTaco">Remove</button>
          </div>
          <div v-else class="dialog-actions">
            <button class="dialog-btn cancel" disabled>
              {{ removePhase === 'removing' ? 'Removing…' : 'Removed' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Taco publish modal -->
    <Transition name="dialog-fade">
      <div v-if="tacoModalOpen" class="dialog-backdrop" @click.self="closeTacoModal">
        <div class="dialog">
          <p class="dialog-title">{{ isEditingTagline ? 'Edit tagline' : 'Share to The Taco' }}</p>
          <p v-if="!isEditingTagline" class="dialog-body">Write a short tagline so others know what to expect.</p>
          <textarea
            v-model="tacoTagline"
            class="tagline-input"
            placeholder="A journey through…"
            maxlength="280"
            rows="3"
            @keydown.enter.ctrl="submitTaco"
          />
          <p class="tagline-count">{{ tacoTagline.length }}/280</p>
          <p v-if="tacoError" class="dialog-error">{{ tacoError }}</p>
          <div class="dialog-actions">
            <button class="dialog-btn cancel" @click="closeTacoModal">Cancel</button>
            <button
              class="dialog-btn publish"
              :disabled="tacoSaving || !tacoTagline.trim()"
              @click="submitTaco"
            >
              {{ tacoSaving ? 'Saving…' : isEditingTagline ? 'Save' : 'Publish' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.chat-galaxy-page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  background: #050810;
  color: var(--color-text-primary, #f5f0ea);
  overflow-x: hidden;
}

/* ── Background ─────────────────────────────────────────────────── */
.nebula {
  position: fixed; border-radius: 50%;
  filter: blur(110px); pointer-events: none; z-index: 0;
}
.nebula-1 {
  width: 500px; height: 500px; top: -100px; left: -100px;
  background: radial-gradient(circle, rgba(80,120,255,0.18) 0%, transparent 65%);
  animation: driftA 30s ease-in-out infinite alternate;
}
.nebula-2 {
  width: 420px; height: 420px; bottom: 5%; right: -80px;
  background: radial-gradient(circle, rgba(130,80,255,0.14) 0%, transparent 65%);
  animation: driftB 26s ease-in-out infinite alternate;
}
@keyframes driftA { 0% { transform: translate(0,0); } 100% { transform: translate(40px,50px); } }
@keyframes driftB { 0% { transform: translate(0,0); } 100% { transform: translate(-30px,-40px); } }

.dot-grid {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.4) 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.4) 0%, transparent 70%);
}
.noise {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.022;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
.vignette {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(2,4,10,0.6) 100%);
}

/* ── Back button ─────────────────────────────────────────────────── */
.back-btn {
  position: fixed;
  top: 22px; left: 22px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px 0 10px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 500;
  color: rgba(245,240,234,0.75);
  background: rgba(10,14,28,0.8);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 100px;
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: color 200ms, border-color 200ms;
}
.back-btn:hover { color: #f5f0ea; border-color: rgba(255,255,255,0.28); }
.back-label { @media (max-width: 480px) { display: none; } }

/* ── Content ────────────────────────────────────────────────────── */
.content {
  position: relative;
  z-index: 5;
  max-width: 760px;
  margin: 0 auto;
  padding: 120px 40px 100px;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

/* ── Portal / Glyph ──────────────────────────────────────────────── */
.portal-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.glyph-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px; height: 200px;
  background: rgba(255,255,255,0.09);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 50%;
  cursor: pointer;
  transition: background 250ms ease, border-color 250ms ease, transform 250ms ease;
}
.glyph-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.32);
  transform: scale(1.04);
}
.glyph-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.processing-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1.5px solid transparent;
  border-top-color: rgba(255,181,71,0.5);
  border-right-color: rgba(255,181,71,0.15);
  animation: spin 1.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.galaxy-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.galaxy-title {
  font-family: var(--font-body, serif);
  font-size: 1.45rem;
  font-weight: 500;
  color: #f5f0ea;
}
.galaxy-hint {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.82rem;
  color: rgba(245,240,234,0.75);
  letter-spacing: 0.03em;
}
.galaxy-hint.processing {
  color: rgba(255,181,71,0.85);
}

/* ── Divider ─────────────────────────────────────────────────────── */
.section-divider {
  display: flex;
  align-items: center;
  gap: 16px;
}
.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.12);
}
.divider-label {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: rgba(245,240,234,0.65);
  white-space: nowrap;
}

/* ── Input section ───────────────────────────────────────────────── */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.submit-error {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.8rem;
  color: #ff6b6b;
  margin: 0;
}
.input-hint {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  color: rgba(245,240,234,0.65);
  margin: 0;
  letter-spacing: 0.03em;
}
.input-hint kbd {
  display: inline-block;
  padding: 2px 6px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-primary, #f5f0ea);
  background: rgba(245,240,234,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  margin-right: 3px;
}

/* ── Submissions loading dots ────────────────────────────────────── */
.subs-loading-row { display: flex; justify-content: center; gap: 8px; padding: 28px 0; }
.subs-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,181,71,0.9); animation: subsDotPulse 1.4s ease-in-out infinite; }
.subs-dot:nth-child(2) { animation-delay: 0.2s; }
.subs-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes subsDotPulse { 0%,80%,100% { opacity:0.25; transform:scale(0.7); } 40% { opacity:1; transform:scale(1.2); } }

/* ── Submission log ──────────────────────────────────────────────── */
.submission-log {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.log-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.log-label {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: rgba(245,240,234,0.72);
}
.log-count {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  color: rgba(245,240,234,0.62);
}
.log-entries {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 12px;
  overflow: hidden;
}
.log-entry {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 16px 20px;
  background: rgba(255,255,255,0.10);
  border-bottom: 1px solid rgba(255,255,255,0.10);
}
.log-entry:last-child { border-bottom: none; }
.log-entry-time {
  flex-shrink: 0;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.7rem;
  color: rgba(245,240,234,0.65);
  letter-spacing: 0.02em;
  padding-top: 2px;
  min-width: 100px;
}
.log-entry-content {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.log-text {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.82rem;
  color: rgba(245,240,234,0.92);
  line-height: 1.5;
  word-break: break-word;
}
.log-file {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  color: rgba(245,240,234,0.82);
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 6px;
  padding: 3px 10px;
}



/* ── Taco share row ──────────────────────────────────────────────── */
.taco-row {
  display: flex;
  justify-content: center;
  margin-top: -20px;
}

.taco-share-btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 36px; padding: 0 18px;
  font-family: var(--font-ui, sans-serif); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em;
  color: rgba(245,240,234,0.75);
  background: rgba(255,181,71,0.08);
  border: 1px solid rgba(255,181,71,0.22);
  border-radius: 100px;
  cursor: pointer;
  transition: background 180ms, border-color 180ms, color 180ms;
}
.taco-share-btn:hover { background: rgba(255,181,71,0.16); border-color: rgba(255,181,71,0.4); color: #f5f0ea; }

.taco-published-row {
  display: inline-flex; align-items: center; gap: 10px;
  height: 36px; padding: 0 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 100px;
}
.taco-published-label {
  font-family: var(--font-ui, sans-serif); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.06em;
  color: rgba(255,181,71,0.8);
}
.taco-published-row::before {
  content: '';
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,181,71,0.6);
  flex-shrink: 0;
}
.taco-edit-btn, .taco-remove-btn {
  font-family: var(--font-ui, sans-serif); font-size: 0.68rem; font-weight: 500;
  background: none; border: none; cursor: pointer;
  padding: 0; transition: color 160ms;
}
.taco-edit-btn { color: rgba(245,240,234,0.5); }
.taco-edit-btn:hover { color: rgba(245,240,234,0.85); }
.taco-remove-btn { color: rgba(255,100,100,0.5); }
.taco-remove-btn:hover { color: rgba(255,100,100,0.85); }

/* ── Taco modal ───────────────────────────────────────────────────── */
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(2,4,10,0.75); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.dialog {
  background: #0d1120; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
  padding: 28px 28px 24px; max-width: 380px; width: 100%;
  display: flex; flex-direction: column; gap: 10px;
}
.dialog-title { font-family: var(--font-body, serif); font-size: 1rem; font-weight: 500; color: #f5f0ea; margin: 0; }
.dialog-body { font-family: var(--font-ui, sans-serif); font-size: 0.78rem; color: rgba(245,240,234,0.45); line-height: 1.5; margin: 0; }
.dialog-error { font-family: var(--font-ui, sans-serif); font-size: 0.72rem; color: #ff8a8a; margin: 0; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.dialog-btn {
  height: 36px; padding: 0 18px;
  font-family: var(--font-ui, sans-serif); font-size: 0.72rem; font-weight: 600;
  border-radius: 100px; cursor: pointer; transition: background 180ms, border-color 180ms, color 180ms;
}
.dialog-btn.cancel { color: rgba(245,240,234,0.55); background: transparent; border: 1px solid rgba(255,255,255,0.1); }
.dialog-btn.cancel:hover { color: rgba(245,240,234,0.85); border-color: rgba(255,255,255,0.2); }
.dialog-btn.publish { color: #fff; background: rgba(255,181,71,0.2); border: 1px solid rgba(255,181,71,0.4); }
.dialog-btn.publish:hover:not(:disabled) { background: rgba(255,181,71,0.35); }
.dialog-btn.publish:disabled { opacity: 0.4; cursor: default; }
.dialog-btn.confirm { color: #fff; background: rgba(200,50,50,0.75); border: 1px solid rgba(220,60,60,0.4); }
.dialog-btn.confirm:hover { background: rgba(220,60,60,0.9); }

.tagline-input {
  width: 100%; padding: 10px 12px;
  font-family: var(--font-ui, sans-serif); font-size: 0.8rem; line-height: 1.5;
  color: #f5f0ea; background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
  resize: none; outline: none; transition: border-color 180ms; box-sizing: border-box;
}
.tagline-input:focus { border-color: rgba(255,255,255,0.25); }
.tagline-input::placeholder { color: rgba(245,240,234,0.3); }
.tagline-count { font-family: var(--font-ui, sans-serif); font-size: 0.65rem; color: rgba(245,240,234,0.25); text-align: right; margin: -4px 0 0; }

.dialog-fade-enter-active, .dialog-fade-leave-active { transition: opacity 180ms ease; }
.dialog-fade-enter-from, .dialog-fade-leave-to { opacity: 0; }

/* ── Mobile ─────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .content { padding: 90px 20px 70px; gap: 36px; }
  .glyph-btn { width: 160px; height: 160px; }
  .galaxy-title { font-size: 1.2rem; }
  .log-entry { flex-direction: column; gap: 6px; padding: 14px 16px; }
  .log-entry-time { min-width: unset; }
  .back-label { display: none; }
}

</style>
