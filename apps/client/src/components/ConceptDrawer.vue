<template>
  <DrawerShell
    :open="!!concept"
    side="right"
    :can-go-back="canGoBack"
    @close="$emit('close')"
    @back="$emit('back')"
  >
    <template #hero>
      <EntityHero
        v-if="concept"
        type="concept"
        :title="concept.title"
        :color="conceptColor"
        :stats="stats"
        :has-back="canGoBack"
      />
    </template>

    <template #body>
      <!-- Threads through chip row -->
      <div v-if="threadPlanets.length" class="threads-row">
        <div class="threads-label">Threads through</div>
        <div class="threads-chips">
          <button
            v-for="pid in threadPlanets"
            :key="pid"
            class="thread-chip"
            :style="{ '--accent': conceptColor }"
            @click="$emit('navigate-to-planet', pid)"
          >
            {{ planetTitle(pid) }}
          </button>
        </div>
      </div>

      <EntityProse
        v-if="prose"
        :prose="prose"
        @wikilink-click="onWikilink"
      />
    </template>

    <template v-if="featuredStories.length" #footer>
      <div class="stories-footer">
        <div class="footer-label">Stories featuring this idea</div>
        <div class="stories-list">
          <button
            v-for="story in featuredStories"
            :key="story.id"
            class="story-card"
            :style="{ '--accent': conceptColor }"
            @click="$emit('open-story', story.id)"
          >
            <div class="story-card-title">{{ story.title }}</div>
            <div class="story-card-preview">{{ storyPreview(story.introduction.markdown) }}</div>
            <div class="story-card-arrow">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M3 2l4 3.5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </button>
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
import type { MeshConcept, GalaxyData, UUID } from '@/lib/meshApi'
import { conceptStats, storiesFeaturingConcept } from '@/lib/entityStats'
import { renderMarkdownSectioned } from '@/lib/renderMarkdownSectioned'

const props = defineProps<{
  concept: MeshConcept | null
  galaxyData: GalaxyData | null
  conceptColor: string
  canGoBack?: boolean
}>()

const emit = defineEmits<{
  close: []
  back: []
  'navigate-to-planet': [planetId: UUID]
  'open-concept': [conceptId: UUID]
  'open-story': [storyId: UUID]
}>()

const stats = computed(() =>
  props.concept ? conceptStats(props.concept) : { labelA: 'threads through', valueA: 0, labelB: 'linked to', valueB: 0 },
)

const prose = computed(() => {
  if (!props.concept || !props.galaxyData) return null
  return renderMarkdownSectioned(props.concept.markdown, props.galaxyData.wikiLinkIndex)
})

const featuredStories = computed(() => {
  if (!props.concept || !props.galaxyData) return []
  return storiesFeaturingConcept(props.concept.id, props.galaxyData)
})

const threadPlanets = computed(() => {
  if (!props.concept) return []
  return props.concept.planetConnections.slice(0, 5)
})

function planetTitle(id: UUID): string {
  return props.galaxyData?.planets[id]?.title ?? 'Unknown'
}

function storyPreview(md: string): string {
  const stripped = md
    .replace(/\[\[([^\]]+)\]\]/g, (_m, n: string) => n.replace(/^\([^)]+\)\s*/, ''))
    .replace(/[#*_>]/g, '')
    .trim()
  const firstPara = stripped.split(/\n{2,}/)[0] ?? ''
  return firstPara.length > 130 ? firstPara.slice(0, 127) + '…' : firstPara
}

function onWikilink(link: { id: UUID; type: string }) {
  if (link.type === 'planet') emit('navigate-to-planet', link.id)
  else if (link.type === 'concept') emit('open-concept', link.id)
  else if (link.type === 'story') emit('open-story', link.id)
}
</script>

<style scoped>
/* ── Threads through chip row ────────────────────────────────────────────── */
.threads-row {
  padding: 14px 24px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  padding-bottom: 14px;
}

.threads-label {
  font-size: 9px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.38);
  margin-bottom: 8px;
}

.threads-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.thread-chip {
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 2px solid var(--accent, rgba(140, 180, 255, 0.6));
  border-radius: 0 14px 14px 0;
  padding: 4px 11px 4px 9px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.thread-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* ── Stories footer ─────────────────────────────────────────────────────── */
.stories-footer {
  padding: 18px 24px 22px;
}

.footer-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
}

.stories-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.story-card {
  position: relative;
  text-align: left;
  padding: 12px 34px 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, transform 0.18s;
}
.story-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: var(--accent, rgba(170, 200, 255, 0.6));
  border-radius: 0 1px 1px 0;
  opacity: 0.65;
}
.story-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
  transform: translateX(2px);
}

.story-card-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  margin-bottom: 4px;
  letter-spacing: -0.005em;
}

.story-card-preview {
  font-size: 11.5px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.story-card-arrow {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.35);
  display: flex;
}
.story-card:hover .story-card-arrow {
  color: rgba(255, 255, 255, 0.75);
}
</style>
