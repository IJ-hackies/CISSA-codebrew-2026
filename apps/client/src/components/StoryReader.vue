<template>
  <!-- Book button trigger -->
  <button v-if="!open" class="story-trigger" @click="open = true" title="Stories">
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 3.5C3 2.67 3.67 2 4.5 2H14v14H4.5A1.5 1.5 0 0 1 3 14.5V3.5z" stroke="currentColor" stroke-width="1.4"/>
      <path d="M14 2l.5.5M3 13h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M6 6h6M6 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  </button>

  <Transition name="story-panel">
    <div v-if="open" class="story-panel" :class="{ mobile: isMobile, 'has-story': !!activeStory }">

      <!-- Story list -->
      <template v-if="!activeStory">
        <div class="panel-header">
          <span class="panel-title">Stories</span>
          <button class="panel-close" @click="open = false">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="story-list">
          <button
            v-for="story in stories"
            :key="story.id"
            class="story-item"
            @click="openStory(story.id)"
          >
            <div class="story-item-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2.5C2 1.67 2.67 1 3.5 1H11v12H3.5A1.5 1.5 0 0 1 2 11.5V2.5z" stroke="currentColor" stroke-width="1.2"/>
                <path d="M4.5 4.5h5M4.5 7h3.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="story-item-text">
              <span class="story-item-title">{{ story.title }}</span>
              <span class="story-item-meta">{{ story.scenes.length }} scenes</span>
            </div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="story-item-arrow">
              <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </template>

      <!-- Active story reader -->
      <template v-else>
        <div class="panel-header">
          <button class="back-btn" @click="closeStory">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="panel-title story-title">{{ activeStory.title }}</span>
          <button class="panel-close" @click="open = false">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Scene progress bar -->
        <div class="scene-progress">
          <div class="progress-track">
            <div
              class="progress-fill"
              :style="{ width: `${(currentSceneIndex + 1) / totalSections * 100}%` }"
            />
          </div>
          <span class="progress-label">{{ currentSceneIndex + 1 }} / {{ totalSections }}</span>
        </div>

        <!-- Scrollable content -->
        <div class="story-content" ref="storyContentRef">

          <!-- Introduction -->
          <section
            class="story-section"
            :class="{ active: currentSceneIndex === 0 }"
            @click="setScene(0)"
          >
            <div class="section-tag intro-tag">Introduction</div>
            <div class="section-body prose-sm" v-html="renderedIntro" @click="onProseClick" />
          </section>

          <!-- Scenes -->
          <section
            v-for="(scene, i) in activeStory.scenes"
            :key="scene.planetId"
            class="story-section"
            :class="{ active: currentSceneIndex === i + 1 }"
            @click="setScene(i + 1)"
          >
            <div class="section-tag scene-tag">
              <div class="scene-dot" />
              {{ planetTitle(scene.planetId) }}
            </div>
            <div class="section-body prose-sm" v-html="renderScene(scene.markdown)" @click="onProseClick" />
            <button class="visit-planet-btn" @click.stop="$emit('visit-planet', scene.planetId)">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.2"/>
                <circle cx="5" cy="5" r="1.2" fill="currentColor"/>
              </svg>
              Visit planet
            </button>
          </section>

          <!-- Conclusion -->
          <section
            class="story-section"
            :class="{ active: currentSceneIndex === totalSections - 1 }"
            @click="setScene(totalSections - 1)"
          >
            <div class="section-tag outro-tag">Conclusion</div>
            <div class="section-body prose-sm" v-html="renderedConclusion" @click="onProseClick" />
          </section>
        </div>

        <!-- Scene navigation -->
        <div class="scene-nav">
          <button class="nav-btn" :disabled="currentSceneIndex === 0" @click="prevScene">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="scene-label">{{ sceneLabel }}</span>
          <button class="nav-btn" :disabled="currentSceneIndex === totalSections - 1" @click="nextScene">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { MeshStory, GalaxyData } from '@/lib/meshApi'
import { useIsMobile } from '@/composables/useIsMobile'

const props = defineProps<{
  stories: MeshStory[]
  galaxyData: GalaxyData | null
}>()

const emit = defineEmits<{
  'visit-planet': [planetId: string]
  'highlight-concepts': [conceptIds: string[]]
  'navigate-to-planet': [planetId: string]
  'open-concept': [conceptId: string]
}>()

const isMobile = useIsMobile()
const open = ref(false)
const activeStory = ref<MeshStory | null>(null)
const currentSceneIndex = ref(0) // 0 = intro, 1..n = scenes, n+1 = conclusion
const storyContentRef = ref<HTMLDivElement>()

const totalSections = computed(() =>
  activeStory.value ? activeStory.value.scenes.length + 2 : 0
)

const sceneLabel = computed(() => {
  if (!activeStory.value) return ''
  if (currentSceneIndex.value === 0) return 'Introduction'
  if (currentSceneIndex.value === totalSections.value - 1) return 'Conclusion'
  const scene = activeStory.value.scenes[currentSceneIndex.value - 1]
  return planetTitle(scene.planetId)
})

function planetTitle(id: string): string {
  return props.galaxyData?.planets[id]?.title ?? 'Unknown Planet'
}

function openStory(id: string) {
  const story = props.stories.find((s) => s.id === id)
  if (!story) return
  activeStory.value = story
  currentSceneIndex.value = 0
  emitHighlights()
}

function closeStory() {
  activeStory.value = null
  currentSceneIndex.value = 0
}

function setScene(index: number) {
  currentSceneIndex.value = index
  scrollToSection(index)
  emitHighlights()
  // Emit planet visit for camera tracking
  if (activeStory.value && index > 0 && index < totalSections.value - 1) {
    const scene = activeStory.value.scenes[index - 1]
    emit('visit-planet', scene.planetId)
  }
}

function nextScene() {
  if (currentSceneIndex.value < totalSections.value - 1) {
    setScene(currentSceneIndex.value + 1)
  }
}
function prevScene() {
  if (currentSceneIndex.value > 0) {
    setScene(currentSceneIndex.value - 1)
  }
}

function emitHighlights() {
  if (!activeStory.value) return
  let ids: string[] = []
  if (currentSceneIndex.value === 0) {
    ids = activeStory.value.introduction.conceptIds
  } else if (currentSceneIndex.value === totalSections.value - 1) {
    ids = activeStory.value.conclusion.conceptIds
  }
  emit('highlight-concepts', ids)
}

function scrollToSection(index: number) {
  nextTick(() => {
    const el = storyContentRef.value
    if (!el) return
    const sections = el.querySelectorAll('.story-section')
    sections[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function renderWikilinks(md: string): string {
  if (!props.galaxyData) return md
  const idx = props.galaxyData.wikiLinkIndex
  return md.replace(/\[\[([^\]]+)\]\]/g, (_match, name: string) => {
    const key = name.includes('/') ? name.split('/').pop()! : name
    const uuid = idx[key]
    if (!uuid) return `<span class="wikilink-broken">${key.replace(/^\([^)]+\)\s*/, '')}</span>`
    const typeMatch = key.match(/^\((\w[\w ]*)\)/)
    const type = typeMatch?.[1]?.toLowerCase() ?? 'unknown'
    const label = key.replace(/^\([^)]+\)\s*/, '')
    return `<a data-id="${uuid}" data-type="${type}" class="wikilink">${label}</a>`
  })
}

function mdToHtml(md: string): string {
  let html = renderWikilinks(md)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return html
}

const renderedIntro = computed(() =>
  activeStory.value ? mdToHtml(activeStory.value.introduction.markdown) : ''
)
const renderedConclusion = computed(() =>
  activeStory.value ? mdToHtml(activeStory.value.conclusion.markdown) : ''
)
function renderScene(md: string): string {
  return mdToHtml(md)
}

function onProseClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('[data-id]') as HTMLElement | null
  if (!link) return
  const id = link.dataset.id!
  const type = link.dataset.type!
  e.stopPropagation()
  if (type === 'planet') emit('navigate-to-planet', id)
  else if (type === 'concept') emit('open-concept', id)
}

/** Called externally to open a specific story (e.g. from a wikilink click) */
function openById(id: string) {
  open.value = true
  openStory(id)
}

defineExpose({ openById })
</script>

<style scoped>
.story-trigger {
  position: fixed;
  top: 24px;
  left: 24px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(8, 10, 20, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 55;
  backdrop-filter: blur(12px);
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.story-trigger:hover,
.story-trigger.active {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
  background: rgba(20, 25, 45, 0.92);
}

.story-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 340px;
  height: 100%;
  background: rgba(6, 8, 18, 0.94);
  border-right: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(20px);
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.story-panel.mobile {
  width: 100vw;
  top: auto;
  bottom: 0;
  left: 0;
  right: 0;
  height: 55vh;
  border-right: none;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 18px 18px 0 0;
}

.story-panel.mobile.has-story {
  height: 72vh;
}

/* Panel header */
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  flex: 1;
  letter-spacing: 0.01em;
}
.story-title {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-close,
.back-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;
}
.panel-close:hover,
.back-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

/* Story list */
.story-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
}
.story-list::-webkit-scrollbar { width: 3px; }
.story-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.story-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px;
  border-radius: 10px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
  margin-bottom: 4px;
}
.story-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}
.story-item-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(140, 160, 255, 0.1);
  border: 1px solid rgba(140, 160, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(140, 180, 255, 0.8);
  flex-shrink: 0;
}
.story-item-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.story-item-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.story-item-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}
.story-item-arrow {
  color: rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}

/* Scene progress */
.scene-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
.progress-track {
  flex: 1;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 1px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: rgba(140, 180, 255, 0.7);
  border-radius: 1px;
  transition: width 0.3s ease;
}
.progress-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  white-space: nowrap;
}

/* Story content */
.story-content {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}
.story-content::-webkit-scrollbar { width: 3px; }
.story-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.story-section {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.story-section:hover {
  background: rgba(255, 255, 255, 0.02);
}
.story-section.active {
  background: rgba(140, 180, 255, 0.04);
}
.story-section.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(140, 180, 255, 0.5);
  border-radius: 0 1px 1px 0;
}

.section-tag {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.intro-tag { color: rgba(200, 180, 255, 0.6); }
.outro-tag { color: rgba(255, 200, 160, 0.6); }
.scene-tag { color: rgba(140, 200, 180, 0.7); }

.scene-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(140, 200, 180, 0.6);
  flex-shrink: 0;
}

.section-body {
  font-size: 12px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.story-section.active .section-body {
  display: block;
  color: rgba(255, 255, 255, 0.7);
  -webkit-line-clamp: unset;
}

.prose-sm :deep(p) { margin-bottom: 8px; }
.prose-sm :deep(.wikilink) {
  color: rgba(140, 180, 255, 0.8);
  text-decoration: underline;
  text-decoration-color: rgba(140, 180, 255, 0.3);
  cursor: pointer;
}
.prose-sm :deep(.wikilink:hover) { color: rgb(160, 200, 255); }

.visit-planet-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: rgba(140, 200, 180, 0.7);
  background: rgba(140, 200, 180, 0.08);
  border: 1px solid rgba(140, 200, 180, 0.18);
  border-radius: 20px;
  padding: 4px 10px;
  cursor: pointer;
  margin-top: 10px;
  transition: background 0.15s, color 0.15s;
}
.visit-planet-btn:hover {
  background: rgba(140, 200, 180, 0.15);
  color: rgb(160, 220, 200);
}

/* Scene nav footer */
.scene-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.nav-btn:disabled {
  opacity: 0.25;
  cursor: default;
}
.scene-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

/* Transitions */
.story-panel-enter-active,
.story-panel-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}
.story-panel-enter-from,
.story-panel-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.story-panel.mobile.story-panel-enter-from,
.story-panel.mobile.story-panel-leave-to {
  transform: translateY(100%);
}
</style>
