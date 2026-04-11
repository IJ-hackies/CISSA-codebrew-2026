<template>
  <div class="entity-prose" @click="onClick">
    <div
      v-for="(section, i) in prose.sections"
      :key="i"
      class="prose-section"
    >
      <h3 v-if="section.heading" class="section-heading">{{ section.heading }}</h3>
      <div class="section-body" v-html="section.html" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RenderedProse } from '@/lib/renderMarkdownSectioned'
import type { UUID } from '@/lib/meshApi'

defineProps<{
  prose: RenderedProse
}>()

const emit = defineEmits<{
  'wikilink-click': [{ id: UUID; type: string }]
}>()

function onClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const link = target.closest('a[data-id]') as HTMLElement | null
  if (!link) return
  e.preventDefault()
  const id = link.dataset.id
  const type = link.dataset.type
  if (id && type) emit('wikilink-click', { id, type })
}
</script>

<style scoped>
.entity-prose {
  padding: 14px 24px 30px;
}

/* Sections */
.prose-section {
  margin-top: 22px;
}
.prose-section:first-child {
  margin-top: 0;
}

.section-heading {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-body {
  font-size: 13.5px;
  line-height: 1.72;
  color: rgba(255, 255, 255, 0.68);
}

.section-body :deep(p) {
  margin: 0 0 12px;
}
.section-body :deep(p:last-child) {
  margin-bottom: 0;
}
.section-body :deep(strong) {
  color: rgba(255, 255, 255, 0.92);
  font-weight: 600;
}
.section-body :deep(em) { font-style: italic; }
.section-body :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(200, 220, 255, 0.95);
}
.section-body :deep(ul) {
  padding-left: 18px;
  margin: 0 0 12px;
}
.section-body :deep(li) {
  margin: 4px 0;
}
.section-body :deep(.prose-img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 10px 0;
}

.section-body :deep(.wikilink) {
  color: rgba(170, 200, 255, 0.95);
  text-decoration: none;
  background: rgba(170, 200, 255, 0.08);
  padding: 1px 5px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.section-body :deep(.wikilink:hover) {
  color: #fff;
  background: rgba(170, 200, 255, 0.18);
}
.section-body :deep(.wikilink-broken) {
  color: rgba(255, 255, 255, 0.35);
  text-decoration: line-through;
}
</style>
