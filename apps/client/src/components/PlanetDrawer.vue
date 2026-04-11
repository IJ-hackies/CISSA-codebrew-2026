<template>
  <DrawerShell
    :open="!!planet"
    side="right"
    :can-go-back="canGoBack"
    @close="$emit('close')"
    @back="$emit('back')"
  >
    <template #hero>
      <EntityHero
        v-if="planet"
        type="planet"
        :title="planet.title"
        :color="planetColor"
        :stats="stats"
        :has-back="canGoBack"
      />
    </template>

    <template #body>
      <EntityProse
        v-if="prose"
        :prose="prose"
        @wikilink-click="onWikilink"
      />
    </template>

    <template v-if="planet && planet.planetConnections.length" #footer>
      <div class="connections-footer">
        <div class="footer-head">
          <div class="footer-label">Connected planets</div>
          <div class="footer-count">{{ planet.planetConnections.length }}</div>
        </div>
        <div class="connections-scroller">
          <div class="connections" @wheel.prevent="(e) => (e.currentTarget as HTMLElement).scrollLeft += e.deltaY">
            <button
              v-for="cid in planet.planetConnections"
              :key="cid"
              class="conn-chip"
              :style="{ '--accent': planetColor }"
              @click="$emit('navigate-to-planet', cid)"
            >
              {{ planetTitle(cid) }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </DrawerShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DrawerShell from './DrawerShell.vue'
import EntityHero from './EntityHero.vue'
import EntityProse from './EntityProse.vue'
import type { MeshPlanet, GalaxyData, UUID } from '@/lib/meshApi'
import { planetStats } from '@/lib/entityStats'
import { renderMarkdownSectioned } from '@/lib/renderMarkdownSectioned'

const props = defineProps<{
  planet: MeshPlanet | null
  galaxyData: GalaxyData | null
  planetColor: string
  canGoBack?: boolean
}>()

const emit = defineEmits<{
  close: []
  back: []
  'navigate-to-planet': [planetId: UUID]
  'open-concept': [conceptId: UUID]
  'open-story': [storyId: UUID]
}>()

const stats = computed(() => {
  if (!props.planet || !props.galaxyData) {
    return { labelA: 'linked from', valueA: 0, labelB: 'tied to', valueB: 0 }
  }
  return planetStats(props.planet, props.galaxyData)
})

const prose = computed(() => {
  if (!props.planet || !props.galaxyData) return null
  return renderMarkdownSectioned(props.planet.markdown, props.galaxyData.wikiLinkIndex)
})

function planetTitle(id: UUID): string {
  return props.galaxyData?.planets[id]?.title ?? 'Unknown'
}

function onWikilink(link: { id: UUID; type: string }) {
  if (link.type === 'planet') emit('navigate-to-planet', link.id)
  else if (link.type === 'concept') emit('open-concept', link.id)
  else if (link.type === 'story') emit('open-story', link.id)
}
</script>

<style scoped>
.connections-footer {
  padding: 12px 0 14px;
}

.footer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 8px;
}
.footer-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
}
.footer-count {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.28);
  font-feature-settings: 'tnum' 1;
}

.connections-scroller {
  position: relative;
  overflow: hidden;
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 18px,
    #000 calc(100% - 18px),
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 18px,
    #000 calc(100% - 18px),
    transparent 100%
  );
}

.connections {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 24px 4px;
  scrollbar-width: none;
}
.connections::-webkit-scrollbar { display: none; }

.conn-chip {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-left: 2px solid var(--accent, rgba(140, 180, 255, 0.6));
  border-radius: 0 16px 16px 0;
  padding: 5px 12px 5px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conn-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-right-color: rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.25);
  border-bottom-color: rgba(255, 255, 255, 0.25);
}
</style>
