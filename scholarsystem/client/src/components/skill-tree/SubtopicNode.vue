<script setup lang="ts">
import { computed } from 'vue'
import type { Palette } from '@/types/galaxy'

export type NodeState = 'locked' | 'available' | 'in-progress' | 'mastered'

interface Props {
  id: string
  title: string
  conceptCount: number
  completedCount: number
  state: NodeState
  expanded: boolean
  palette: Palette | null
  paletteIndex: number
}

const props = defineProps<Props>()
const emit = defineEmits<{ click: [id: string] }>()

const DEFAULT_PALETTES: Palette[] = [
  { primary: '#4a9eff', secondary: '#1a3a7a', accent: '#7dc1ff', atmosphere: 'rgba(74,158,255,0.18)' },
  { primary: '#c084fc', secondary: '#4a1a7a', accent: '#e0aaff', atmosphere: 'rgba(192,132,252,0.18)' },
  { primary: '#34d399', secondary: '#0a4a2a', accent: '#6ee7b7', atmosphere: 'rgba(52,211,153,0.18)' },
  { primary: '#fb923c', secondary: '#7a2a0a', accent: '#fdba74', atmosphere: 'rgba(251,146,60,0.18)' },
  { primary: '#f472b6', secondary: '#7a0a3a', accent: '#f9a8d4', atmosphere: 'rgba(244,114,182,0.18)' },
  { primary: '#22d3ee', secondary: '#0a3a4a', accent: '#67e8f9', atmosphere: 'rgba(34,211,238,0.18)' },
  { primary: '#a3e635', secondary: '#2a4a0a', accent: '#bef264', atmosphere: 'rgba(163,230,53,0.18)' },
  { primary: '#fbbf24', secondary: '#7a4a0a', accent: '#fde68a', atmosphere: 'rgba(251,191,36,0.18)' },
  { primary: '#f87171', secondary: '#7a0a0a', accent: '#fca5a5', atmosphere: 'rgba(248,113,113,0.18)' },
]

const pal = computed<Palette>(() =>
  props.palette ?? DEFAULT_PALETTES[props.paletteIndex % DEFAULT_PALETTES.length],
)

const S = 64 // orb diameter
const cx = S / 2
const cy = S / 2
const r = S / 2 - 3
const progressR = S / 2 + 5
const circumference = computed(() => 2 * Math.PI * progressR)
const progressOffset = computed(() => {
  if (props.conceptCount === 0) return circumference.value
  const frac = props.completedCount / props.conceptCount
  return circumference.value * (1 - frac)
})

const gradId = `grad-${props.id}`
const glowId = `glow-${props.id}`
</script>

<template>
  <div
    class="node"
    :class="[`state-${state}`, { expanded }]"
    role="button"
    :aria-disabled="state === 'locked'"
    :tabindex="state === 'locked' ? -1 : 0"
    @click="state !== 'locked' && emit('click', id)"
    @keydown.enter="state !== 'locked' && emit('click', id)"
    @keydown.space.prevent="state !== 'locked' && emit('click', id)"
  >
    <svg
      :width="S + 24"
      :height="S + 24"
      :viewBox="`-12 -12 ${S + 24} ${S + 24}`"
      class="orb-svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient :id="gradId" cx="38%" cy="32%" r="65%">
          <stop offset="0%" :stop-color="pal.accent" stop-opacity="0.95" />
          <stop offset="48%" :stop-color="pal.primary" stop-opacity="0.88" />
          <stop offset="100%" :stop-color="pal.secondary" stop-opacity="0.75" />
        </radialGradient>
        <filter :id="glowId" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Atmosphere halo -->
      <circle
        v-if="state !== 'locked'"
        :cx="cx"
        :cy="cy"
        :r="S / 2 + 8"
        :fill="pal.atmosphere"
        class="atmo"
      />

      <!-- Pulse ring (available) -->
      <circle
        v-if="state === 'available'"
        :cx="cx"
        :cy="cy"
        :r="S / 2 + 3"
        fill="none"
        :stroke="pal.accent"
        stroke-width="2"
        stroke-opacity="0.7"
        class="pulse-ring"
      />

      <!-- Progress ring (in-progress) -->
      <circle
        v-if="state === 'in-progress'"
        :cx="cx"
        :cy="cy"
        :r="progressR"
        fill="none"
        :stroke="pal.accent"
        stroke-width="3"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="progressOffset"
        :transform="`rotate(-90 ${cx} ${cy})`"
        class="progress-arc"
      />

      <!-- Planet body -->
      <circle
        :cx="cx"
        :cy="cy"
        :r="r"
        :fill="state === 'locked' ? '#111824' : `url(#${gradId})`"
        :filter="state !== 'locked' ? `url(#${glowId})` : undefined"
        class="planet-body"
      />

      <!-- Specular highlight -->
      <ellipse
        v-if="state !== 'locked'"
        :cx="cx - r * 0.22"
        :cy="cy - r * 0.24"
        :rx="r * 0.28"
        :ry="r * 0.16"
        fill="white"
        opacity="0.18"
        class="specular"
      />

      <!-- Lock icon (locked) -->
      <g v-if="state === 'locked'" :transform="`translate(${cx - 9} ${cy - 11})`">
        <!-- Lock body -->
        <rect x="2" y="9" width="14" height="10" rx="2.5" fill="#2a3a50" />
        <!-- Lock shackle -->
        <path
          d="M5 9V6.5a4 4 0 0 1 8 0V9"
          fill="none"
          stroke="#2a3a50"
          stroke-width="2.5"
          stroke-linecap="round"
        />
        <!-- Keyhole -->
        <circle cx="9" cy="14.5" r="2" fill="#111824" />
        <rect x="8.2" y="14.5" width="1.6" height="2.5" rx="0.8" fill="#111824" />
      </g>

      <!-- Mastered star badge -->
      <g v-if="state === 'mastered'">
        <circle :cx="S - 2" :cy="6" r="9" fill="#02040a" />
        <circle :cx="S - 2" :cy="6" r="7.5" fill="#ffb547" />
        <!-- Star path -->
        <path
          :d="`M${S - 2} 0.5 l1.5 3 3.2 0.4 -2.3 2.2 0.5 3.2 -2.9-1.5 -2.9 1.5 0.5-3.2 -2.3-2.2 3.2-0.4z`"
          fill="#02040a"
        />
      </g>
    </svg>

    <div class="node-label">
      <span class="label-text">{{ title }}</span>
      <span v-if="state === 'in-progress'" class="progress-fraction">
        {{ completedCount }}/{{ conceptCount }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  z-index: 1;
}
.node.state-locked {
  cursor: not-allowed;
}

.orb-svg {
  display: block;
  transition: transform 220ms ease;
  filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.6));
}
.node:not(.state-locked):hover .orb-svg {
  transform: scale(1.08);
}
.node.expanded .orb-svg {
  transform: scale(1.05);
}

.planet-body {
  transition: opacity 220ms ease;
}
.node.state-locked .planet-body {
  opacity: 0.45;
}

.atmo {
  transition: opacity 300ms ease;
  opacity: 0.6;
}
.node:not(.state-locked):hover .atmo {
  opacity: 1;
}

.pulse-ring {
  animation: pulse-ring 2.4s ease-in-out infinite;
  transform-origin: center;
}
@keyframes pulse-ring {
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.12); }
}

.progress-arc {
  transition: stroke-dashoffset 0.6s ease;
}

.node-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.label-text {
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-primary);
  text-align: center;
  max-width: 120px;
  line-height: 1.3;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.9);
}
.node.state-locked .label-text {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.progress-fraction {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.specular {
  pointer-events: none;
}
</style>
