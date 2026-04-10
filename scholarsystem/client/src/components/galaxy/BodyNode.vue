<script setup lang="ts">
import { computed } from 'vue'
import type {
  Body,
  BodyVisual,
  Palette,
  StarVisual,
  PlanetVisual,
  MoonVisual,
  CometVisual,
  BlackHoleVisual,
  NebulaVisual,
  DustCloudVisual,
  AsteroidBeltVisual,
  AsteroidVisual,
} from '@/types/galaxy'

const props = defineProps<{
  body: Body
  visual: BodyVisual | undefined
  label: string | undefined
  visited: boolean
  hovered: boolean
  /** Scale factor for labels — at higher zoom levels, labels need smaller font. */
  labelScale: number
}>()

const emit = defineEmits<{
  click: [body: Body]
  pointerenter: [body: Body]
  pointerleave: [body: Body]
}>()

const palette = computed<Palette>(() =>
  props.visual?.palette ?? { primary: '#444', secondary: '#222', accent: '#888', atmosphere: 'rgba(0,0,0,0)' },
)

const isInteractive = computed(() =>
  ['system', 'planet', 'moon', 'asteroid'].includes(props.body.kind),
)

// Unique gradient ID per body for SVG defs.
const gradId = computed(() => `grad-${props.body.id}`)
const glowId = computed(() => `glow-${props.body.id}`)

// Generate an irregular polygon path for asteroids.
function asteroidPath(cx: number, cy: number, r: number): string {
  const points = 7
  const pts: string[] = []
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2
    const jitter = 0.6 + Math.sin(i * 2.7 + cx * 0.01) * 0.4
    const px = cx + Math.cos(angle) * r * jitter
    const py = cy + Math.sin(angle) * r * jitter
    pts.push(`${px},${py}`)
  }
  return `M${pts.join('L')}Z`
}
</script>

<template>
  <g
    :class="[
      'body-node',
      `kind-${body.kind}`,
      { interactive: isInteractive, visited, hovered },
    ]"
    @click.stop="isInteractive && emit('click', body)"
    @pointerenter="isInteractive && emit('pointerenter', body)"
    @pointerleave="emit('pointerleave', body)"
  >
    <defs>
      <radialGradient :id="gradId">
        <stop offset="0%" :stop-color="palette.accent" stop-opacity="0.9" />
        <stop offset="50%" :stop-color="palette.primary" stop-opacity="0.85" />
        <stop offset="100%" :stop-color="palette.secondary" stop-opacity="0.6" />
      </radialGradient>
      <filter :id="glowId">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- ─── Star ──────────────────────────────────────────────── -->
    <template v-if="body.kind === 'star'">
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius * 1.5"
        :fill="palette.atmosphere"
        class="star-corona"
      />
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius"
        :fill="`url(#${gradId})`"
        class="star-core"
        :style="{ '--pulse-rate': `${((visual as StarVisual)?.pulseRate ?? 0.3) * 4 + 2}s` }"
      />
    </template>

    <!-- ─── System (galaxy zoom level) ────────────────────────── -->
    <template v-else-if="body.kind === 'system'">
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius * 0.2"
        :fill="palette.atmosphere"
        class="system-aura"
      />
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius * 0.12"
        :fill="`url(#${gradId})`"
        :filter="`url(#${glowId})`"
        class="system-core"
      />
    </template>

    <!-- ─── Planet ────────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'planet'">
      <!-- Atmosphere halo -->
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius * 1.6"
        :fill="palette.atmosphere"
        class="planet-atmo"
      />
      <!-- Ring (if applicable) -->
      <ellipse
        v-if="(visual as PlanetVisual)?.ring"
        :cx="body.position.x"
        :cy="body.position.y"
        :rx="body.radius * 1.8"
        :ry="body.radius * 0.4"
        fill="none"
        :stroke="palette.accent"
        stroke-opacity="0.4"
        :stroke-width="body.radius * 0.12"
      />
      <!-- Body -->
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius"
        :fill="`url(#${gradId})`"
        class="planet-surface"
      />
    </template>

    <!-- ─── Moon ──────────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'moon'">
      <circle
        v-if="(visual as MoonVisual)?.glow"
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius * 2"
        :fill="palette.accent"
        opacity="0.15"
        class="moon-glow"
      />
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius"
        :fill="`url(#${gradId})`"
        class="moon-surface"
      />
      <!-- Crater marks -->
      <circle
        v-if="(visual as MoonVisual)?.cratered"
        :cx="body.position.x + body.radius * 0.3"
        :cy="body.position.y - body.radius * 0.2"
        :r="body.radius * 0.25"
        :fill="palette.secondary"
        opacity="0.4"
      />
    </template>

    <!-- ─── Asteroid ──────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'asteroid'">
      <path
        :d="asteroidPath(body.position.x, body.position.y, body.radius)"
        :fill="`url(#${gradId})`"
        class="asteroid-shape"
      />
    </template>

    <!-- ─── Nebula ────────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'nebula'">
      <ellipse
        :cx="body.position.x"
        :cy="body.position.y"
        :rx="body.radius"
        :ry="body.radius * 0.7"
        :fill="palette.primary"
        :opacity="(visual as NebulaVisual)?.density ?? 0.3"
        class="nebula-cloud"
      />
      <ellipse
        :cx="body.position.x + body.radius * 0.2"
        :cy="body.position.y - body.radius * 0.1"
        :rx="body.radius * 0.6"
        :ry="body.radius * 0.4"
        :fill="palette.accent"
        :opacity="((visual as NebulaVisual)?.density ?? 0.3) * 0.5"
      />
    </template>

    <!-- ─── Dust Cloud ────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'dust-cloud'">
      <ellipse
        :cx="body.position.x"
        :cy="body.position.y"
        :rx="body.radius"
        :ry="body.radius * 0.65"
        :fill="palette.primary"
        :opacity="(visual as DustCloudVisual)?.opacity ?? 0.25"
        class="dust-cloud"
      />
    </template>

    <!-- ─── Comet ─────────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'comet'">
      <line
        :x1="body.position.x"
        :y1="body.position.y"
        :x2="body.position.x - Math.cos(body.trajectoryAngle) * ((visual as CometVisual)?.tailLength ?? 40)"
        :y2="body.position.y - Math.sin(body.trajectoryAngle) * ((visual as CometVisual)?.tailLength ?? 40)"
        :stroke="palette.accent"
        stroke-opacity="0.5"
        :stroke-width="body.radius * 0.8"
        stroke-linecap="round"
        class="comet-tail"
      />
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius"
        :fill="palette.primary"
        class="comet-head"
      />
    </template>

    <!-- ─── Black Hole ────────────────────────────────────────── -->
    <template v-else-if="body.kind === 'black-hole'">
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius * 2.5"
        fill="none"
        :stroke="palette.accent"
        :stroke-opacity="(visual as BlackHoleVisual)?.accretionIntensity ?? 0.5"
        :stroke-width="body.radius * 0.4"
        class="bh-accretion"
      />
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="body.radius"
        fill="#000000"
        class="bh-core"
      />
    </template>

    <!-- ─── Asteroid Belt ─────────────────────────────────────── -->
    <template v-else-if="body.kind === 'asteroid-belt'">
      <circle
        :cx="body.position.x"
        :cy="body.position.y"
        :r="(body.innerRadius + body.outerRadius) / 2"
        fill="none"
        :stroke="palette.primary"
        :stroke-width="body.outerRadius - body.innerRadius"
        stroke-opacity="0.08"
        stroke-dasharray="8 12"
        class="belt-ring"
      />
    </template>

    <!-- ─── Label ─────────────────────────────────────────────── -->
    <text
      v-if="label && (hovered || body.kind === 'system' || body.kind === 'planet')"
      :x="body.position.x"
      :y="body.position.y + body.radius + 6 * labelScale"
      text-anchor="middle"
      :font-size="9 * labelScale"
      font-family="var(--font-ui)"
      font-weight="500"
      :fill="hovered ? '#fff' : body.kind === 'system' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'"
      :opacity="hovered ? 1 : 0.85"
      class="body-label"
    >
      {{ label }}
    </text>

    <!-- ─── Visited indicator ─────────────────────────────────── -->
    <circle
      v-if="visited && (body.kind === 'moon' || body.kind === 'asteroid')"
      :cx="body.position.x + body.radius * 0.7"
      :cy="body.position.y - body.radius * 0.7"
      :r="3 * labelScale"
      fill="var(--color-accent)"
      class="visited-dot"
    />
  </g>
</template>

<style scoped>
.body-node.interactive {
  cursor: pointer;
}
.body-node.interactive:not(.visited) {
  opacity: 0.75;
}
.body-node.interactive.visited {
  opacity: 1;
}
.body-node.interactive.hovered {
  opacity: 1;
}

.star-corona {
  animation: pulse var(--pulse-rate, 3s) ease-in-out infinite alternate;
}
.star-core {
  animation: pulse var(--pulse-rate, 3s) ease-in-out infinite alternate;
}
@keyframes pulse {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

.system-aura {
  opacity: 0.08;
  transition: opacity 300ms ease;
}
.body-node.hovered .system-aura {
  opacity: 0.15;
}

.planet-atmo {
  opacity: 0.15;
  transition: opacity 300ms ease;
}
.body-node.hovered .planet-atmo {
  opacity: 0.3;
}

.moon-glow {
  transition: opacity 300ms ease;
}
.body-node.hovered .moon-glow {
  opacity: 0.3;
}

.body-label {
  pointer-events: none;
  user-select: none;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

.nebula-cloud,
.dust-cloud {
  pointer-events: none;
}

.bh-accretion {
  animation: bh-spin 12s linear infinite;
  transform-origin: center;
}
@keyframes bh-spin {
  to { transform: rotate(360deg); }
}

.belt-ring {
  pointer-events: none;
}

.visited-dot {
  pointer-events: none;
}
</style>
