<script setup lang="ts">
import { computed } from 'vue'
import type { ZoomLevel } from '@/composables/useMapControls'
import type { Knowledge, Progress } from '@/types/galaxy'

const props = defineProps<{
  zoomLevel: ZoomLevel
  focusedSystemId: string | null
  focusedPlanetId: string | null
  knowledge: Knowledge | null
  progress: Progress
}>()

const emit = defineEmits<{
  navigate: [level: ZoomLevel, id?: string]
}>()

// ─── Breadcrumb segments ──────────────────────────────────────────────

interface Crumb {
  label: string
  level: ZoomLevel
  id?: string
  active: boolean
}

const breadcrumbs = computed<Crumb[]>(() => {
  const crumbs: Crumb[] = [
    {
      label: props.knowledge?.title ?? 'Galaxy',
      level: 'galaxy',
      active: props.zoomLevel === 'galaxy',
    },
  ]

  if (props.focusedSystemId && props.knowledge) {
    const topic = props.knowledge.topics.find(
      (t) => t.id === systemKnowledgeRef.value,
    )
    crumbs.push({
      label: topic?.title ?? 'System',
      level: 'system',
      id: props.focusedSystemId,
      active: props.zoomLevel === 'system',
    })
  }

  if (props.focusedPlanetId && props.knowledge) {
    const subtopic = props.knowledge.subtopics.find(
      (s) => s.id === planetKnowledgeRef.value,
    )
    crumbs.push({
      label: subtopic?.title ?? 'Planet',
      level: 'planet',
      id: props.focusedPlanetId,
      active: props.zoomLevel === 'planet',
    })
  }

  return crumbs
})

// Helpers to extract knowledgeRef — bodies are looked up by the parent page
// and passed as focusedSystemId/focusedPlanetId, but the knowledge lookup
// needs the knowledgeRef. For simplicity, the HUD receives knowledge
// separately and does the lookup by convention: system body ID format is
// e.g. "w1-sys-cell-biology" → topic ID is "w1-cell-biology". But this is
// fragile. Instead, accept the actual knowledgeRef as injected by the parent.
// For now, we'll reverse-lookup from the knowledge tree by matching IDs
// that the parent provides via the focused*Id props.

// The parent GalaxyMap will provide the knowledgeRef via the body lookup.
// These are provided as injection props or computed in the parent.
// For now, use a simple approach: extract from ID convention.
const systemKnowledgeRef = computed(() => {
  // The parent should ideally provide this. For now, search bodies
  // via the knowledge topics that match.
  if (!props.focusedSystemId || !props.knowledge) return null
  // Match: any topic whose ID appears as a suffix in the system body ID.
  return (
    props.knowledge.topics.find((t) =>
      props.focusedSystemId?.includes(t.id),
    )?.id ?? null
  )
})

const planetKnowledgeRef = computed(() => {
  if (!props.focusedPlanetId || !props.knowledge) return null
  return (
    props.knowledge.subtopics.find((s) =>
      props.focusedPlanetId?.includes(s.id),
    )?.id ?? null
  )
})

// ─── Progress stats ───────────────────────────────────────────────────

const progressText = computed(() => {
  const p = props.progress
  if (p.totalBodies === 0) return ''
  return `${p.visitedCount}/${p.totalBodies} visited`
})

const masteryPercent = computed(() =>
  Math.round(props.progress.overallMastery * 100),
)
</script>

<template>
  <div class="galaxy-hud">
    <!-- Breadcrumb -->
    <nav class="breadcrumb" aria-label="Galaxy navigation">
      <template v-for="(crumb, i) in breadcrumbs" :key="crumb.level + (crumb.id ?? '')">
        <span v-if="i > 0" class="separator">&rsaquo;</span>
        <button
          :class="['crumb', { active: crumb.active }]"
          :disabled="crumb.active"
          @click="emit('navigate', crumb.level, crumb.id)"
        >
          {{ crumb.label }}
        </button>
      </template>
    </nav>

    <!-- Progress bar -->
    <div class="progress-stats" v-if="progress.totalBodies > 0">
      <span class="stat">{{ progressText }}</span>
      <span class="dot-sep">&middot;</span>
      <span class="stat">{{ masteryPercent }}% mastery</span>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${(progress.visitedCount / Math.max(progress.totalBodies, 1)) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.galaxy-hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(2, 4, 10, 0.7) 0%,
    rgba(2, 4, 10, 0.3) 60%,
    transparent 100%
  );
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.crumb {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background: none;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 200ms ease,
    background 200ms ease;
}
.crumb:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.06);
}
.crumb.active {
  color: var(--color-text-primary);
  cursor: default;
}
.crumb:disabled {
  cursor: default;
}

.separator {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  opacity: 0.5;
  user-select: none;
}

.progress-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.stat {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.dot-sep {
  color: var(--color-text-muted);
  opacity: 0.4;
}

.progress-bar {
  width: 64px;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 400ms ease;
}

@media (max-width: 768px) {
  .galaxy-hud {
    padding: 12px 16px;
  }
  .progress-stats {
    display: none;
  }
}
</style>
