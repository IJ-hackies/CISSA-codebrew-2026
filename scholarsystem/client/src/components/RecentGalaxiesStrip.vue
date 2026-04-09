<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { GalaxyEntry } from '@/lib/recentGalaxies'
import ConstellationGlyph from './ConstellationGlyph.vue'

const props = defineProps<{
  entries: GalaxyEntry[]
}>()

const router = useRouter()

const visible = computed(() => props.entries.slice(0, 24))

function open(entry: GalaxyEntry) {
  router.push(`/galaxy/${entry.uuid}`)
}

function truncate(s: string, max = 24) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
</script>

<template>
  <div v-if="visible.length" class="recent-strip">
    <div class="label">Recent</div>
    <div class="strip no-scrollbar">
      <button
        v-for="entry in visible"
        :key="entry.uuid"
        class="constellation-card"
        @click="open(entry)"
        :title="entry.title"
      >
        <ConstellationGlyph :uuid="entry.uuid" :size="64" />
        <span class="title">{{ truncate(entry.title) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.recent-strip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 720px;
  margin-inline: auto;
}
.label {
  font-family: var(--font-ui);
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.strip {
  display: flex;
  gap: 28px;
  overflow-x: auto;
  padding: 4px 12px 12px;
  width: 100%;
  scroll-snap-type: x mandatory;
  justify-content: flex-start;
}
@media (min-width: 720px) {
  .strip {
    justify-content: center;
  }
}
.constellation-card {
  background: transparent;
  border: none;
  padding: 4px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  scroll-snap-align: center;
  cursor: pointer;
  transition: transform 280ms ease;
}
.constellation-card:hover {
  transform: translateY(-2px);
}
.title {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
  max-width: 80px;
  text-align: center;
  transition: color 240ms ease;
}
.constellation-card:hover .title {
  color: var(--color-text-primary);
}
</style>
