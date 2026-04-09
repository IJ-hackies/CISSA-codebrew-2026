<script setup lang="ts">
import { computed } from 'vue'
import { constellationFromUuid } from '@/lib/constellationGlyph'

const props = defineProps<{
  uuid: string
  size?: number
}>()

const size = computed(() => props.size ?? 64)
const glyph = computed(() => constellationFromUuid(props.uuid))

function pointPx(p: { x: number; y: number }) {
  return { cx: p.x * size.value, cy: p.y * size.value }
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="constellation block overflow-visible"
    aria-hidden="true"
  >
    <!-- edges -->
    <g class="edges">
      <line
        v-for="(edge, i) in glyph.edges"
        :key="`e-${i}`"
        :x1="pointPx(glyph.points[edge[0]]).cx"
        :y1="pointPx(glyph.points[edge[0]]).cy"
        :x2="pointPx(glyph.points[edge[1]]).cx"
        :y2="pointPx(glyph.points[edge[1]]).cy"
        stroke="rgba(245, 240, 234, 0.22)"
        stroke-width="0.7"
        stroke-linecap="round"
      />
    </g>
    <!-- points -->
    <g class="points">
      <circle
        v-for="(p, i) in glyph.points"
        :key="`p-${i}`"
        :cx="pointPx(p).cx"
        :cy="pointPx(p).cy"
        :r="i === glyph.brightStarIndex ? p.r * size * 1.6 : p.r * size"
        :fill="i === glyph.brightStarIndex ? '#ffd180' : '#f5f0ea'"
        :class="['star', { bright: i === glyph.brightStarIndex }]"
      />
    </g>
  </svg>
</template>

<style scoped>
.constellation {
  filter: drop-shadow(0 0 6px rgba(255, 181, 71, 0));
  transition: filter 280ms ease;
}
.star {
  transition:
    fill 240ms ease,
    r 240ms ease;
}
:deep(.constellation-card:hover) .constellation {
  filter: drop-shadow(0 0 10px rgba(255, 181, 71, 0.55));
}
:deep(.constellation-card:hover) .edges line {
  stroke: rgba(255, 211, 128, 0.6);
}
:deep(.constellation-card:hover) .star {
  fill: #ffd180;
}
:deep(.constellation-card:hover) .star.bright {
  fill: #fff4d6;
}
</style>
