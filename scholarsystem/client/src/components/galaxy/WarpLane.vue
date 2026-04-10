<script setup lang="ts">
import { computed } from 'vue'
import type { Position, RelationshipKind } from '@/types/galaxy'

const props = defineProps<{
  from: Position
  to: Position
  kind: RelationshipKind
  /** 1 = single edge, higher = aggregated (thicker line). */
  weight: number
  /** Scale factor relative to current zoom. */
  strokeScale: number
}>()

// Curved path via a control point offset perpendicular to the midpoint.
const pathD = computed(() => {
  const mx = (props.from.x + props.to.x) / 2
  const my = (props.from.y + props.to.y) / 2
  const dx = props.to.x - props.from.x
  const dy = props.to.y - props.from.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Perpendicular offset: 15% of the distance, for a subtle curve.
  const offset = len * 0.15
  const cx = mx + (-dy / len) * offset
  const cy = my + (dx / len) * offset
  return `M${props.from.x},${props.from.y} Q${cx},${cy} ${props.to.x},${props.to.y}`
})

const strokeWidth = computed(() => {
  const base = Math.min(props.weight, 5) * 0.8 + 0.5
  return base * props.strokeScale
})

const dashArray = computed(() => {
  switch (props.kind) {
    case 'prerequisite':
      return 'none'
    case 'related':
      return `${6 * props.strokeScale} ${4 * props.strokeScale}`
    case 'contrasts':
      return `${2 * props.strokeScale} ${3 * props.strokeScale}`
    case 'example-of':
      return `${8 * props.strokeScale} ${2 * props.strokeScale} ${2 * props.strokeScale} ${2 * props.strokeScale}`
    default:
      return 'none'
  }
})

const color = computed(() => {
  switch (props.kind) {
    case 'prerequisite':
      return 'rgba(255,181,71,0.35)'
    case 'related':
      return 'rgba(160,196,255,0.25)'
    case 'contrasts':
      return 'rgba(255,100,100,0.25)'
    case 'example-of':
      return 'rgba(140,255,170,0.25)'
    default:
      return 'rgba(255,255,255,0.15)'
  }
})
</script>

<template>
  <path
    :d="pathD"
    fill="none"
    :stroke="color"
    :stroke-width="strokeWidth"
    :stroke-dasharray="dashArray"
    stroke-linecap="round"
    class="warp-lane"
  />
</template>

<style scoped>
.warp-lane {
  pointer-events: none;
  transition: opacity 300ms ease;
}
</style>
