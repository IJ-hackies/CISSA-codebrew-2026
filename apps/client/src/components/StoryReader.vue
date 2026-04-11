<template>
  <!-- Trigger button when closed. Shows a "resume" affordance when there's
       an active story preserved (e.g. after collapsing for a planet drawer
       or arriving via cross-system traversal). The colored left border is
       the indicator — keeps width identical to the default state so the
       Galaxy back button doesn't get pushed around. -->
  <button
    v-if="!open"
    class="story-trigger"
    :class="{ 'has-resume': !!activeStory }"
    :style="activeStory ? { '--resume-accent': storyColorFor(activeStory.id) } : undefined"
    :aria-label="activeStory ? `Resume ${activeStory.title}` : 'Stories'"
    @click="handleTriggerClick"
  >
    <svg width="16" height="16" viewBox="0 0 17 17" fill="none">
      <path d="M3 3.5C3 2.67 3.67 2 4.5 2H13v13H4.5A1.5 1.5 0 0 1 3 13.5V3.5z" stroke="currentColor" stroke-width="1.4"/>
      <path d="M13 2l.5.5M3 12h10M6 6h5M6 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <span class="trigger-label">Stories</span>
  </button>

  <DrawerShell
    :open="open"
    side="left"
    :can-go-back="canGoBack || !!activeStory"
    @close="handleClose"
    @back="handleBack"
  >
    <!-- LIST MODE ---------------------------------------------------------- -->
    <template v-if="!activeStory" #body>
      <div class="list-wrap">
        <div class="list-tag">Stories</div>
        <div class="list-title">Narrative arcs</div>
        <div class="list-meta">{{ stories.length }} character-driven journeys</div>

        <div class="story-cards">
          <button
            v-for="story in stories"
            :key="story.id"
            class="story-list-card"
            :style="cardStyle(story.id)"
            @click="openStoryById(story.id)"
          >
            <div class="list-card-top">
              <div class="list-card-accent" />
              <div class="list-card-title">{{ story.title }}</div>
            </div>
            <div class="list-card-stats">
              <div class="list-stat">
                <div class="list-stat-label">visits</div>
                <div class="list-stat-value">{{ storyStats(story).valueA }}</div>
              </div>
              <div class="list-stat">
                <div class="list-stat-label">driven by</div>
                <div class="list-stat-value">{{ storyStats(story).valueB }}</div>
              </div>
              <div class="list-stat">
                <div class="list-stat-label">scenes</div>
                <div class="list-stat-value">{{ story.scenes.length }}</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </template>

    <!-- ACTIVE STORY MODE -------------------------------------------------- -->
    <template v-else #hero>
      <EntityHero
        v-if="activeStory"
        type="story"
        :title="activeStory.title"
        :color="storyColorFor(activeStory.id)"
        :stats="storyStats(activeStory)"
        :has-back="true"
      />
    </template>

    <template v-if="activeStory" #body>
      <!-- Scene progress bar -->
      <div class="scene-progress">
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: `${((currentSceneIndex + 1) / totalSections) * 100}%`, background: storyColorFor(activeStory.id) }"
          />
        </div>
        <span class="progress-label">{{ currentSceneIndex + 1 }} / {{ totalSections }}</span>
      </div>

      <div class="story-content" ref="storyContentRef">
        <!-- Introduction -->
        <section
          class="story-section"
          :class="{ active: currentSceneIndex === 0 }"
          :style="activeSectionStyle(activeStory.id)"
          @click="setScene(0)"
        >
          <div class="section-tag intro-tag">Introduction</div>
          <div class="section-body prose-sm" v-html="renderedIntro" @click="onProseClick" />
        </section>

        <!-- Scenes -->
        <section
          v-for="(scene, i) in activeStory.scenes"
          :key="i + '-' + scene.planetId"
          class="story-section"
          :class="{ active: currentSceneIndex === i + 1 }"
          :style="activeSectionStyle(activeStory.id)"
          @click="setScene(i + 1)"
        >
          <div class="section-tag scene-tag">
            <div class="scene-dot" :style="{ background: storyColorFor(activeStory.id) }" />
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
          :style="activeSectionStyle(activeStory.id)"
          @click="setScene(totalSections - 1)"
        >
          <div class="section-tag outro-tag">Conclusion</div>
          <div class="section-body prose-sm" v-html="renderedConclusion" @click="onProseClick" />
        </section>
      </div>
    </template>

    <!-- Scene nav footer -->
    <template v-if="activeStory" #footer>
      <div class="scene-nav">
        <button class="nav-btn" :disabled="currentSceneIndex === 0" @click="prevScene">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M8 2L4 6.5L8 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="scene-label">{{ sceneLabel }}</span>
        <button class="nav-btn" :disabled="currentSceneIndex === totalSections - 1" @click="nextScene">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M5 2l4 4.5L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </template>
  </DrawerShell>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, defineExpose } from 'vue'
import DrawerShell from './DrawerShell.vue'
import EntityHero from './EntityHero.vue'
import type { MeshStory, GalaxyData, UUID } from '@/lib/meshApi'
import { storyStats as computeStoryStats } from '@/lib/entityStats'

const props = defineProps<{
  stories: MeshStory[]
  galaxyData: GalaxyData | null
  canGoBack?: boolean
}>()

const emit = defineEmits<{
  'visit-planet': [planetId: UUID]
  'highlight-concepts': [conceptIds: UUID[]]
  'navigate-to-planet': [planetId: UUID]
  'open-concept': [conceptId: UUID]
  'open-story': [storyId: UUID]
  back: []
  close: []
  /** Fired when the drawer transitions from closed → open. Lets the parent
   * collapse other drawers (e.g. the planet panel) so only one rail is
   * visible at a time. */
  opened: []
}>()

const open = ref(false)
const activeStory = ref<MeshStory | null>(null)
const currentSceneIndex = ref(0)
const storyContentRef = ref<HTMLDivElement>()

const totalSections = computed(() =>
  activeStory.value ? activeStory.value.scenes.length + 2 : 0,
)

const sceneLabel = computed(() => {
  if (!activeStory.value) return ''
  if (currentSceneIndex.value === 0) return 'Introduction'
  if (currentSceneIndex.value === totalSections.value - 1) return 'Conclusion'
  return planetTitle(activeStory.value.scenes[currentSceneIndex.value - 1].planetId)
})

// ── Public helpers (for external callers like SolarSystemView) ────────────

function openList() {
  open.value = true
  activeStory.value = null
  currentSceneIndex.value = 0
}

function openStoryById(id: UUID) {
  const story = props.stories.find((s) => s.id === id)
  if (!story) return
  open.value = true
  activeStory.value = story
  currentSceneIndex.value = 0
  emitHighlights()
}

/** Open a story at a specific scene index — used to restore state after cross-system travel. */
function openStoryAtScene(id: UUID, sceneIndex: number) {
  const story = props.stories.find((s) => s.id === id)
  if (!story) return
  open.value = true
  activeStory.value = story
  // Bound the index to valid sections (intro = 0, scenes = 1..N, conclusion = N+1)
  const maxIndex = story.scenes.length + 1
  currentSceneIndex.value = Math.max(0, Math.min(sceneIndex, maxIndex))
  emitHighlights()
  scrollToSection(currentSceneIndex.value)
}

/**
 * Restore story state without opening the drawer. Used on cross-system arrival
 * — the planet drawer takes focus and the story stays collapsed-with-resume,
 * so the user can click the trigger to pick up where they left off.
 */
function restoreState(id: UUID, sceneIndex: number) {
  const story = props.stories.find((s) => s.id === id)
  if (!story) return
  activeStory.value = story
  const maxIndex = story.scenes.length + 1
  currentSceneIndex.value = Math.max(0, Math.min(sceneIndex, maxIndex))
}

/** Snapshot of the current reader state — used to capture state before cross-system travel. */
function getCurrentState() {
  return {
    storyId: activeStory.value?.id ?? null,
    sceneIndex: currentSceneIndex.value,
    isOpen: open.value,
  }
}

/**
 * Close the drawer but preserve `activeStory` + `currentSceneIndex` so the
 * trigger button shows a "resume" affordance and the user can pick up where
 * they left off. Used when a planet drawer takes focus.
 */
function collapse() {
  open.value = false
}

/** Trigger button click: resume active story if there is one, else open the list. */
function handleTriggerClick() {
  if (activeStory.value) {
    open.value = true
    emitHighlights()
    scrollToSection(currentSceneIndex.value)
  } else {
    openList()
  }
}

function closeAll() {
  open.value = false
  activeStory.value = null
  currentSceneIndex.value = 0
}

function setActiveStory(id: UUID) {
  openStoryById(id)
}

function backToList() {
  activeStory.value = null
  currentSceneIndex.value = 0
}

// Notify the parent whenever the drawer transitions to open, so it can
// collapse the opposite drawer (one-rail-at-a-time).
watch(open, (val, prev) => {
  if (val && !prev) emit('opened')
})

defineExpose({
  openById: openStoryById,
  openByIdAtScene: openStoryAtScene,
  restoreState,
  collapse,
  getCurrentState,
  openList,
  closeAll,
  setActiveStory,
  backToList,
})

// ── Shell back / close handlers ───────────────────────────────────────────

function handleBack() {
  // If an external stack is active and wants back (story stacked), forward it
  if (props.canGoBack) {
    emit('back')
    return
  }
  // Otherwise: if reading a story, return to list
  if (activeStory.value) backToList()
  else open.value = false
}

function handleClose() {
  closeAll()
  emit('close')
}

// ── Scene navigation ──────────────────────────────────────────────────────

function setScene(index: number) {
  currentSceneIndex.value = index
  scrollToSection(index)
  emitHighlights()
  if (activeStory.value && index > 0 && index < totalSections.value - 1) {
    emit('visit-planet', activeStory.value.scenes[index - 1].planetId)
  }
}
function nextScene() { if (currentSceneIndex.value < totalSections.value - 1) setScene(currentSceneIndex.value + 1) }
function prevScene() { if (currentSceneIndex.value > 0) setScene(currentSceneIndex.value - 1) }

function emitHighlights() {
  if (!activeStory.value) return
  let ids: UUID[] = []
  if (currentSceneIndex.value === 0) ids = activeStory.value.introduction.conceptIds
  else if (currentSceneIndex.value === totalSections.value - 1) ids = activeStory.value.conclusion.conceptIds
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

function planetTitle(id: UUID): string {
  return props.galaxyData?.planets[id]?.title ?? 'Unknown'
}

function storyStats(story: MeshStory) { return computeStoryStats(story) }

// ── Deterministic story color ─────────────────────────────────────────────

const STORY_PALETTE = [
  '#b5a0ff', '#ffc8e8', '#a0f0d0', '#ffeaa7',
  '#dfe0ff', '#c8f0ff', '#ffd8b8', '#e8f4a0',
  '#f7a8c4', '#8fd5ff',
]
function storyColorFor(id: UUID): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  const idx = Math.abs(h) % STORY_PALETTE.length
  return STORY_PALETTE[idx]
}

function cardStyle(id: UUID) {
  const color = storyColorFor(id)
  return { '--accent': color } as Record<string, string>
}
function activeSectionStyle(id: UUID) {
  return { '--accent': storyColorFor(id) } as Record<string, string>
}

// ── Inline markdown rendering (scene narrative) ───────────────────────────

function renderWikilinks(md: string): string {
  if (!props.galaxyData) return md
  const idx = props.galaxyData.wikiLinkIndex
  return md.replace(/\[\[([^\]]+)\]\]/g, (_m, name: string) => {
    const key = name.includes('/') ? name.split('/').pop()! : name
    const uuid = idx[key]
    const label = key.replace(/^\([^)]+\)\s*/, '')
    if (!uuid) return `<span class="wikilink-broken">${label}</span>`
    const typeMatch = key.match(/^\((\w[\w ]*)\)/)
    const type = typeMatch?.[1]?.toLowerCase().replace(/\s+/g, '-') ?? 'unknown'
    return `<a data-id="${uuid}" data-type="${type}" class="wikilink">${label}</a>`
  })
}

function mdToHtml(md: string): string {
  let html = renderWikilinks(md)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  html = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return html
}

const renderedIntro = computed(() =>
  activeStory.value ? mdToHtml(activeStory.value.introduction.markdown) : '',
)
const renderedConclusion = computed(() =>
  activeStory.value ? mdToHtml(activeStory.value.conclusion.markdown) : '',
)
function renderScene(md: string): string { return mdToHtml(md) }

function onProseClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('a[data-id]') as HTMLElement | null
  if (!link) return
  const id = link.dataset.id!
  const type = link.dataset.type!
  e.stopPropagation()
  if (type === 'planet') emit('navigate-to-planet', id)
  else if (type === 'concept') emit('open-concept', id)
  else if (type === 'story') emit('open-story', id)
}
</script>

<style scoped>
/* ── Trigger button (closed state) ──────────────────────────────────────── */
.story-trigger {
  position: fixed;
  top: 22px;
  left: 22px;
  height: 40px;
  padding: 0 14px 0 11px;
  border-radius: 12px;
  background: rgba(8, 10, 20, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.65);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  z-index: 55;
  backdrop-filter: blur(14px);
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.story-trigger:hover {
  background: rgba(20, 25, 45, 0.92);
  border-color: rgba(255, 255, 255, 0.26);
  color: #fff;
}
.trigger-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgba(255, 255, 255, 0.8);
}

/* Resume affordance: colored left edge in the active story's hue. Keeps the
   trigger width identical to the default state — only the border changes. */
.story-trigger.has-resume {
  border-left: 2px solid var(--resume-accent, #b5a0ff);
  padding-left: 9px;          /* compensate for the 2px border (default 11px) */
  background: rgba(12, 14, 28, 0.88);
  color: rgba(255, 255, 255, 0.85);
  box-shadow: -1px 0 12px -2px var(--resume-accent, #b5a0ff);
}
.story-trigger.has-resume .trigger-label {
  color: rgba(255, 255, 255, 0.95);
}

/* Mobile: icon-only trigger so the top bar stays uncluttered. */
@media (max-width: 768px) {
  .story-trigger {
    padding: 0 11px;
    gap: 0;
  }
  .story-trigger.has-resume {
    padding-left: 9px;
  }
  .trigger-label { display: none; }
}

/* ── LIST MODE ─────────────────────────────────────────────────────────── */
.list-wrap {
  padding: 16px 24px 18px;
}

.list-title {
  padding-right: 44px;
}

.list-tag {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}
.list-title {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.15;
  color: #fff;
  letter-spacing: -0.01em;
}
.list-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  margin-bottom: 22px;
}

.story-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.story-list-card {
  position: relative;
  text-align: left;
  padding: 14px 16px 14px 18px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: inherit;
  cursor: pointer;
  overflow: hidden;
  transition: background 0.2s, border-color 0.2s, transform 0.2s;
}
.story-list-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent, rgba(170, 200, 255, 0.6));
}
.story-list-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 0% 0%,
    color-mix(in srgb, var(--accent, #aac8ff) 18%, transparent) 0%,
    transparent 60%
  );
  pointer-events: none;
}
.story-list-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.list-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  position: relative;
}
.list-card-accent {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent, rgba(170, 200, 255, 0.8));
  box-shadow: 0 0 8px 1px color-mix(in srgb, var(--accent, #aac8ff) 60%, transparent);
  flex-shrink: 0;
}
.list-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: -0.005em;
  line-height: 1.25;
}
.list-card-stats {
  display: flex;
  gap: 14px;
  position: relative;
}
.list-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.list-stat-label {
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.42);
  font-weight: 600;
}
.list-stat-value {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1;
  font-feature-settings: 'tnum' 1;
}

/* ── ACTIVE STORY ──────────────────────────────────────────────────────── */
.scene-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px 6px;
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
  border-radius: 1px;
  transition: width 0.3s ease;
}
.progress-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.38);
  white-space: nowrap;
  font-feature-settings: 'tnum' 1;
}

.story-content {
  padding: 4px 0 12px;
}

.story-section {
  padding: 14px 22px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.story-section:last-child { border-bottom: none; }
.story-section:hover { background: rgba(255, 255, 255, 0.02); }
.story-section.active { background: rgba(255, 255, 255, 0.03); }
.story-section.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 2px;
  background: var(--accent, rgba(170, 200, 255, 0.7));
  border-radius: 0 1px 1px 0;
}

.section-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: rgba(255, 255, 255, 0.55);
}
.intro-tag { color: rgba(200, 180, 255, 0.7); }
.outro-tag { color: rgba(255, 200, 160, 0.7); }
.scene-tag { color: rgba(255, 255, 255, 0.6); }

.scene-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.section-body {
  font-size: 12.5px;
  line-height: 1.72;
  color: rgba(255, 255, 255, 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.story-section.active .section-body {
  display: block;
  -webkit-line-clamp: unset;
  color: rgba(255, 255, 255, 0.75);
}

.prose-sm :deep(p) { margin: 0 0 10px; }
.prose-sm :deep(p:last-child) { margin-bottom: 0; }
.prose-sm :deep(.wikilink) {
  color: rgba(170, 200, 255, 0.9);
  background: rgba(170, 200, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}
.prose-sm :deep(.wikilink:hover) { color: #fff; background: rgba(170, 200, 255, 0.18); }
.prose-sm :deep(.wikilink-broken) { color: rgba(255, 255, 255, 0.3); text-decoration: line-through; }

.visit-planet-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  padding: 5px 12px;
  cursor: pointer;
  margin-top: 10px;
  transition: background 0.15s, color 0.15s;
}
.visit-planet-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

/* Scene nav footer */
.scene-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 18px;
}
.nav-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.nav-btn:disabled {
  opacity: 0.22;
  cursor: default;
}
.scene-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  max-width: 190px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  flex: 1;
}
</style>
