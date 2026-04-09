<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import ChatInput from '@/components/ChatInput.vue'
import SuggestionChips from '@/components/SuggestionChips.vue'
import RecentGalaxiesStrip from '@/components/RecentGalaxiesStrip.vue'
import DropOverlay from '@/components/DropOverlay.vue'
import {
  addRecentGalaxy,
  hasAnyRecentGalaxies,
  listRecentGalaxies,
  type GalaxyEntry,
} from '@/lib/recentGalaxies'
import { createGalaxy } from '@/lib/api'

const router = useRouter()

const text = ref('')
const files = ref<File[]>([])
const launching = ref(false)
const launchError = ref<string | null>(null)
const dropVisible = ref(false)
const showSuggestions = ref(!hasAnyRecentGalaxies())
const recents = ref<GalaxyEntry[]>(listRecentGalaxies())

const galaxyRendererRef = ref<InstanceType<typeof GalaxyRenderer> | null>(null)
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null)

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

// ─── Focus reaction wiring ────────────────────────────────────────────────
function updateFocusAnchor() {
  const renderer = galaxyRendererRef.value?.getRenderer()
  if (!renderer) return
  const rect = chatInputRef.value?.inputBoxRect()
  if (!rect) {
    renderer.setFocusAnchor(null)
    return
  }
  renderer.setFocusAnchor({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
}

let focusInterval: number | null = null
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
  }, 100)
  // Re-anchor on resize / scroll.
  window.addEventListener('resize', updateFocusAnchor)
  // Cheap poll — focus anchor only changes on resize, but the renderer
  // may not be ready when we first try.
  focusInterval = window.setInterval(updateFocusAnchor, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  window.removeEventListener('resize', updateFocusAnchor)
  if (focusInterval !== null) clearInterval(focusInterval)
})

function onPickSuggestion(t: string) {
  text.value = t
  chatInputRef.value?.focus()
}

const placeholderTitle = computed(() => {
  const trimmed = text.value.trim()
  if (trimmed) return trimmed.slice(0, 48)
  if (files.value.length) return files.value[0].name.replace(/\.[^.]+$/, '')
  return 'Untitled galaxy'
})

// Minimum cruise duration so the rocket cinematic still reads even if the
// pipeline returns faster than the animation. Real pipeline latency is
// unbounded in v1 (sync POST /api/galaxy/create); if it exceeds this, the
// cruise just waits on the network promise.
const MIN_CRUISE_MS = 2500

async function handleSubmit(origin: { x: number; y: number }) {
  if (launching.value) return

  // v1 backend only accepts text. Files are collected in the UI but ignored
  // until PDF ingest lands.
  const trimmed = text.value.trim()
  if (!trimmed) {
    launchError.value = 'Type some text to launch (file uploads not wired yet).'
    return
  }

  launching.value = true
  launchError.value = null

  const renderer = galaxyRendererRef.value?.getRenderer()

  try {
    // Kick off the real pipeline call in parallel with the rocket launch
    // animation so cruise time overlaps network time.
    const pipelinePromise = createGalaxy({
      text: trimmed,
      title: placeholderTitle.value,
      filename: files.value[0]?.name ?? null,
    })

    if (renderer) {
      // Tell the renderer where the DOM rocket lives so it can take over
      // from the same screen position. (DOM button fades via .launching class.)
      await renderer.launchRocket(origin)
    }

    // Wait for BOTH: the pipeline result and a minimum cruise feel.
    const [galaxy] = await Promise.all([
      pipelinePromise,
      new Promise((r) => setTimeout(r, MIN_CRUISE_MS)),
    ])

    if (renderer) {
      await renderer.landRocket()
    }

    const entry: GalaxyEntry = {
      uuid: galaxy.meta.id,
      title: galaxy.meta.title,
      createdAt: Date.now(),
    }
    addRecentGalaxy(entry)
    recents.value = listRecentGalaxies()
    router.push(`/galaxy/${entry.uuid}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[chat-landing] launch failed:', message)
    launchError.value = `Launch failed: ${message}`
    launching.value = false
  }
}
</script>

<template>
  <main class="page">
    <GalaxyRenderer ref="galaxyRendererRef" />

    <!-- Logo top-left -->
    <a href="/" class="logo-link" aria-label="Scholar System">
      <img src="/logo.png" alt="Scholar System" class="logo" />
    </a>

    <!-- Centered composition -->
    <div class="stage" :class="{ launching }">
      <ChatInput
        ref="chatInputRef"
        v-model="text"
        v-model:files="files"
        :launching="launching"
        @submit="handleSubmit"
      />

      <SuggestionChips
        v-if="showSuggestions && !recents.length && !launching"
        @pick="onPickSuggestion"
      />

      <RecentGalaxiesStrip v-if="recents.length && !launching" :entries="recents" />

      <p v-if="launchError" class="launch-error" role="alert">{{ launchError }}</p>
    </div>

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
  display: inline-block;
  text-decoration: none;
  opacity: 0.92;
  transition:
    opacity 240ms ease,
    transform 320ms ease;
  animation: logoIn 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
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
  gap: 36px;
  padding: 120px 24px 80px;
  transition: transform 600ms ease;
}
.stage.launching {
  transform: scale(0.98);
}

.launch-error {
  margin: 0;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(255, 90, 90, 0.08);
  border: 1px solid rgba(255, 138, 101, 0.3);
  color: #ff8a65;
  font-family: var(--font-ui);
  font-size: 0.78rem;
  max-width: 520px;
  text-align: center;
}

@media (max-width: 640px) {
  .logo-link {
    top: 20px;
    left: 22px;
  }
  .logo {
    width: 132px;
  }
  .stage {
    gap: 28px;
    padding: 100px 18px 60px;
  }
}
</style>
