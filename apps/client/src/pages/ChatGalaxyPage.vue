<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConstellationGlyph from '@/components/ConstellationGlyph.vue'
import ChatInput from '@/components/ChatInput.vue'
import DropOverlay from '@/components/DropOverlay.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  fetchGalaxyEnvelope,
  fetchSubmissions,
  type GalaxyEnvelope,
  type Submission,
} from '@/lib/meshApi'
import { useMeshStore } from '@/lib/meshStore'
import { setPendingAppend } from '@/lib/pendingAppend'

const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const { clear: clearMeshStore } = useMeshStore()

const galaxyId = computed(() => route.params.id as string)

const envelope = ref<GalaxyEnvelope | null>(null)
const submissions = ref<Submission[]>([])
const text = ref('')
const files = ref<File[]>([])
const submitting = ref(false)
const submitError = ref<string | null>(null)
const dropVisible = ref(false)
const loading = ref(true)


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
  try {
    const [env, subs] = await Promise.all([
      fetchGalaxyEnvelope(galaxyId.value),
      fetchSubmissions(galaxyId.value),
    ])
    envelope.value = env
    submissions.value = subs
  } catch (err) {
    console.error('[chat-galaxy] load failed:', err)
  } finally {
    loading.value = false
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
const galaxyTitle = computed(() => envelope.value?.title ?? '')
const galaxyStatus = computed(() => envelope.value?.status ?? 'complete')
// Don't show processing state while we're still loading initial data
const isProcessing = computed(() => !loading.value && galaxyStatus.value !== 'complete' && galaxyStatus.value !== 'error')

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
    <!-- Background -->
    <div class="nebula nebula-1" />
    <div class="nebula nebula-2" />
    <div class="dot-grid" />
    <div class="noise" />
    <div class="vignette" />

    <!-- Back to Taco -->
    <button class="back-btn" @click="router.push('/')" aria-label="Back to dashboard">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="back-label">Dashboard</span>
    </button>

    <!-- Loading skeleton -->
    <div v-if="loading" class="content">
      <div class="portal-section">
        <div class="skel skel-circle" />
        <div class="skel-meta">
          <div class="skel skel-bar skel-title" />
          <div class="skel skel-bar skel-hint" />
        </div>
      </div>
      <div class="section-divider">
        <span class="divider-label">Add more content</span>
      </div>
      <div class="skel skel-input" />
      <div class="skel-log">
        <div class="skel skel-bar skel-log-header" />
        <div class="skel skel-entry" />
        <div class="skel skel-entry" />
      </div>
    </div>

    <!-- Content -->
    <div v-else class="content">

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
      <div v-if="submissions.length > 0" class="submission-log">
        <div class="log-header">
          <span class="log-label">CONTENT ADDED</span>
          <span class="log-count">{{ submissions.length }} submission{{ submissions.length === 1 ? '' : 's' }}</span>
        </div>
        <div class="log-entries">
          <div v-for="sub in submissions" :key="sub.id" class="log-entry">
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
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.18);
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
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 12px;
  overflow: hidden;
}
.log-entry {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 16px 20px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.08);
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

/* ── Loading skeleton ────────────────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.skel {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 25%,
    rgba(255,255,255,0.09) 50%,
    rgba(255,255,255,0.04) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.6s ease-in-out infinite;
  border-radius: 8px;
}
.skel-circle {
  width: 200px; height: 200px;
  border-radius: 50%;
  flex-shrink: 0;
}
.skel-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.skel-bar {
  height: 14px;
  border-radius: 6px;
}
.skel-title { width: 180px; height: 22px; }
.skel-hint  { width: 130px; height: 12px; opacity: 0.6; }
.skel-input { height: 80px; width: 100%; border-radius: 12px; }
.skel-log {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.skel-log-header { width: 120px; height: 11px; margin-bottom: 10px; opacity: 0.5; }
.skel-entry {
  height: 52px;
  border-radius: 0;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.03) 25%,
    rgba(255,255,255,0.07) 50%,
    rgba(255,255,255,0.03) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
.skel-entry:first-of-type { border-radius: 10px 10px 0 0; }
.skel-entry:last-of-type  { border-radius: 0 0 10px 10px; }

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
