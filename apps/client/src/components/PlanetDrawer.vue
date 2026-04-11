<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="planet" class="drawer-backdrop" @click.self="$emit('close')">
        <div class="drawer" :class="{ mobile: isMobile }">
          <!-- Close -->
          <button class="drawer-close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>

          <!-- Header -->
          <div class="drawer-header">
            <div class="planet-orb" :style="{ background: planetColor, boxShadow: `0 0 20px ${planetColor}66` }" />
            <div class="drawer-title-group">
              <span class="drawer-type">Planet</span>
              <h2 class="drawer-title">{{ planet.title }}</h2>
            </div>
          </div>

          <!-- Body -->
          <div class="drawer-body">
            <div
              class="prose"
              v-html="renderedMarkdown"
              @click="onContentClick"
            />
          </div>

          <!-- Connections footer -->
          <div v-if="planet.planetConnections.length" class="drawer-footer">
            <span class="footer-label">Connected planets</span>
            <div class="connections">
              <button
                v-for="cid in planet.planetConnections"
                :key="cid"
                class="conn-chip"
                @click="$emit('navigate-to-planet', cid)"
              >
                {{ planetTitle(cid) }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MeshPlanet, GalaxyData, WikiLinkIndex } from '@/lib/meshApi'
import { useIsMobile } from '@/composables/useIsMobile'

const props = defineProps<{
  planet: MeshPlanet | null
  galaxyData: GalaxyData | null
  planetColor: string
}>()

const emit = defineEmits<{
  close: []
  'navigate-to-planet': [planetId: string]
  'open-concept': [conceptId: string]
  'open-story': [storyId: string]
}>()

const isMobile = useIsMobile()

function planetTitle(id: string): string {
  return props.galaxyData?.planets[id]?.title ?? id
}

function renderMarkdown(md: string, wikiLinkIndex: WikiLinkIndex): string {
  // Strip leading h1 (we show title in header)
  let html = md.replace(/^#\s+.+\n?/, '')

  // Wikilinks: [[(Type) Name]]
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_match, name: string) => {
    const key = name.includes('/') ? name.split('/').pop()! : name
    const uuid = wikiLinkIndex[key]
    if (!uuid) return `<span class="wikilink-broken">${key.replace(/^\([^)]+\)\s*/, '')}</span>`
    const typeMatch = key.match(/^\((\w[\w ]*)\)/)
    const type = typeMatch?.[1]?.toLowerCase() ?? 'unknown'
    const label = key.replace(/^\([^)]+\)\s*/, '')
    return `<a data-id="${uuid}" data-type="${type}" class="wikilink">${label}</a>`
  })

  // Image embeds: ![[filename]]
  html = html.replace(/!\[\[([^\]]+)\]\]/g, (_match, filename: string) => {
    return `<img src="/api/media/${encodeURIComponent(filename)}" alt="${filename}" class="prose-img" />`
  })

  // Basic markdown: bold, italic, inline code
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Paragraphs: split on double newlines
  html = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('#')) {
        const level = p.match(/^(#+)/)?.[1].length ?? 2
        const text = p.replace(/^#+\s*/, '')
        return `<h${level}>${text}</h${level}>`
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  return html
}

const renderedMarkdown = computed(() => {
  if (!props.planet || !props.galaxyData) return ''
  return renderMarkdown(props.planet.markdown, props.galaxyData.wikiLinkIndex)
})

function onContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('[data-id]') as HTMLElement | null
  if (!link) return
  const id = link.dataset.id!
  const type = link.dataset.type!
  e.preventDefault()
  if (type === 'planet') {
    emit('navigate-to-planet', id)
  } else if (type === 'concept') {
    emit('open-concept', id)
  } else if (type === 'story') {
    emit('open-story', id)
  }
}
</script>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  width: 380px;
  max-width: 100vw;
  background: rgba(6, 8, 18, 0.94);
  border-left: 1px solid rgba(255, 255, 255, 0.09);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  overflow: hidden;
}

.drawer.mobile {
  width: 100vw;
  border-left: none;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 18px 18px 0 0;
  top: auto;
  bottom: 0;
  height: 85vh;
}

.drawer-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  z-index: 1;
}
.drawer-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.drawer-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 28px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.planet-orb {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
}

.drawer-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-right: 40px;
}

.drawer-type {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 600;
}

.drawer-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.drawer-body::-webkit-scrollbar { width: 3px; }
.drawer-body::-webkit-scrollbar-track { background: transparent; }
.drawer-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

/* Prose styles */
.prose {
  font-size: 14px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.72);
}

.prose :deep(p) {
  margin-bottom: 14px;
}

.prose :deep(h2),
.prose :deep(h3) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  margin: 20px 0 8px;
}
.prose :deep(h2) { font-size: 15px; }
.prose :deep(h3) { font-size: 13px; }

.prose :deep(strong) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.prose :deep(code) {
  font-family: monospace;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  color: rgba(200, 220, 255, 0.9);
}

.prose :deep(.wikilink) {
  color: rgba(140, 180, 255, 0.9);
  text-decoration: underline;
  text-decoration-color: rgba(140, 180, 255, 0.3);
  cursor: pointer;
  transition: color 0.15s;
}
.prose :deep(.wikilink:hover) {
  color: rgb(160, 200, 255);
  text-decoration-color: rgba(160, 200, 255, 0.6);
}
.prose :deep(.wikilink-broken) {
  color: rgba(255, 255, 255, 0.3);
}
.prose :deep(.prose-img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 12px 0;
}

.drawer-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.footer-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
}

.connections {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.conn-chip {
  font-size: 11px;
  color: rgba(140, 180, 255, 0.8);
  background: rgba(140, 180, 255, 0.08);
  border: 1px solid rgba(140, 180, 255, 0.18);
  border-radius: 20px;
  padding: 3px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.conn-chip:hover {
  background: rgba(140, 180, 255, 0.15);
  color: rgb(160, 200, 255);
}

/* Transition */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active .drawer,
.drawer-slide-leave-active .drawer {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-slide-enter-from .drawer,
.drawer-slide-leave-to .drawer {
  transform: translateX(100%);
}
.drawer-slide-enter-from .drawer.mobile,
.drawer-slide-leave-to .drawer.mobile {
  transform: translateY(100%);
}
</style>
