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
  /** When true the parent group is rotated 90°; counter-rotate labels so they stay readable. */
  rotated?: boolean
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
      <!-- Sphere gradient: bright accent centre → dark secondary edge (upper-left lit) -->
      <radialGradient :id="gradId" cx="38%" cy="35%" r="60%">
        <stop offset="0%"   :stop-color="palette.accent"    stop-opacity="1"   />
        <stop offset="45%"  :stop-color="palette.primary"   stop-opacity="0.95"/>
        <stop offset="100%" :stop-color="palette.secondary"  stop-opacity="0.8" />
      </radialGradient>

      <!-- Shadow mask — dark crescent on lower-right for sphere shading -->
      <radialGradient :id="`shadow-${body.id}`" cx="68%" cy="65%" r="55%">
        <stop offset="0%"   stop-color="#000" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0"   />
      </radialGradient>

      <!-- Clip to planet disc -->
      <clipPath :id="`clip-${body.id}`">
        <circle :cx="body.position.x" :cy="body.position.y" :r="body.radius * 0.22" />
      </clipPath>

      <!-- Wide soft bloom for system halos -->
      <filter :id="`${glowId}-wide`" x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="12" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- Tight bloom for stars, planets, moons -->
      <filter :id="glowId" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4" result="blur" />
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

    <!-- ─── System / planet node (galaxy zoom level) ──────────── -->
    <template v-else-if="body.kind === 'system'">
      <!-- Layer 1: wide diffuse nebula cloud -->
      <circle
        :cx="body.position.x" :cy="body.position.y"
        :r="body.radius * 0.72"
        :fill="palette.atmosphere"
        class="system-halo-outer"
      />

      <!-- Layer 2: mid atmospheric glow -->
      <circle
        :cx="body.position.x" :cy="body.position.y"
        :r="body.radius * 0.34"
        :fill="palette.primary"
        opacity="0.40"
        class="system-halo-mid"
      />

      <!-- Layer 3: bloom behind the sphere (soft) -->
      <circle
        :cx="body.position.x" :cy="body.position.y"
        :r="body.radius * 0.22"
        :fill="`url(#${gradId})`"
        :filter="`url(#${glowId}-wide)`"
        opacity="0.7"
      />

      <!-- Layer 4: planet sphere with surface detail (clipped) -->
      <g :clip-path="`url(#clip-${body.id})`">
        <!-- Base sphere -->
        <circle
          :cx="body.position.x" :cy="body.position.y"
          :r="body.radius * 0.22"
          :fill="`url(#${gradId})`"
        />
        <!-- Surface bands (simulates gas-giant / continental detail) -->
        <ellipse
          :cx="body.position.x"
          :cy="body.position.y - body.radius * 0.04"
          :rx="body.radius * 0.22" :ry="body.radius * 0.026"
          :fill="palette.accent" opacity="0.25"
        />
        <ellipse
          :cx="body.position.x"
          :cy="body.position.y + body.radius * 0.07"
          :rx="body.radius * 0.22" :ry="body.radius * 0.020"
          :fill="palette.secondary" opacity="0.35"
        />
        <ellipse
          :cx="body.position.x"
          :cy="body.position.y + body.radius * 0.14"
          :rx="body.radius * 0.22" :ry="body.radius * 0.024"
          :fill="palette.accent" opacity="0.20"
        />
        <!-- Shadow (lower-right crescent) -->
        <circle
          :cx="body.position.x" :cy="body.position.y"
          :r="body.radius * 0.22"
          :fill="`url(#shadow-${body.id})`"
        />
        <!-- Specular highlight (upper-left) -->
        <ellipse
          :cx="body.position.x - body.radius * 0.06"
          :cy="body.position.y - body.radius * 0.07"
          :rx="body.radius * 0.10" :ry="body.radius * 0.07"
          fill="rgba(255,255,255,0.20)"
        />
      </g>

      <!-- Layer 5: atmospheric rim ring -->
      <circle
        :cx="body.position.x" :cy="body.position.y"
        :r="body.radius * 0.22"
        fill="none"
        :stroke="palette.atmosphere"
        :stroke-width="body.radius * 0.032"
        opacity="0.85"
        class="system-atm-rim"
      />

      <!-- Layer 6: 8-point diffraction spikes (star-like lens flare) -->
      <g class="system-spike" opacity="0.32">
        <!-- Cardinal -->
        <line
          :x1="body.position.x - body.radius * 0.40" :y1="body.position.y"
          :x2="body.position.x + body.radius * 0.40" :y2="body.position.y"
          stroke="white" :stroke-width="body.radius * 0.007" stroke-linecap="round"
        />
        <line
          :x1="body.position.x" :y1="body.position.y - body.radius * 0.40"
          :x2="body.position.x" :y2="body.position.y + body.radius * 0.40"
          stroke="white" :stroke-width="body.radius * 0.007" stroke-linecap="round"
        />
        <!-- Diagonal (dimmer) -->
        <line
          :x1="body.position.x - body.radius * 0.26" :y1="body.position.y - body.radius * 0.26"
          :x2="body.position.x + body.radius * 0.26" :y2="body.position.y + body.radius * 0.26"
          stroke="white" :stroke-width="body.radius * 0.005" stroke-linecap="round" opacity="0.6"
        />
        <line
          :x1="body.position.x + body.radius * 0.26" :y1="body.position.y - body.radius * 0.26"
          :x2="body.position.x - body.radius * 0.26" :y2="body.position.y + body.radius * 0.26"
          stroke="white" :stroke-width="body.radius * 0.005" stroke-linecap="round" opacity="0.6"
        />
      </g>
    </template>

    <!-- ─── Planet (system zoom) ─────────────────────────────── -->
    <template v-else-if="body.kind === 'planet'">
      <defs>
        <clipPath :id="`clip-${body.id}`">
          <circle :cx="body.position.x" :cy="body.position.y" :r="body.radius" />
        </clipPath>
      </defs>

      <!-- Atmosphere glow -->
      <circle
        :cx="body.position.x" :cy="body.position.y"
        :r="body.radius * 1.55"
        :fill="palette.atmosphere"
        class="planet-atmo"
      />

      <!-- Ring behind planet -->
      <ellipse
        v-if="(visual as PlanetVisual)?.ring"
        :cx="body.position.x" :cy="body.position.y"
        :rx="body.radius * 1.85" :ry="body.radius * 0.38"
        fill="none"
        :stroke="palette.accent" stroke-opacity="0.35"
        :stroke-width="body.radius * 0.14"
      />

      <!-- Planet sphere with detail (clipped) -->
      <g :clip-path="`url(#clip-${body.id})`">
        <circle
          :cx="body.position.x" :cy="body.position.y"
          :r="body.radius" :fill="`url(#${gradId})`"
          class="planet-surface"
        />
        <!-- Surface bands -->
        <ellipse
          :cx="body.position.x" :cy="body.position.y - body.radius * 0.15"
          :rx="body.radius" :ry="body.radius * 0.10"
          :fill="palette.accent" opacity="0.18"
        />
        <ellipse
          :cx="body.position.x" :cy="body.position.y + body.radius * 0.25"
          :rx="body.radius" :ry="body.radius * 0.08"
          :fill="palette.secondary" opacity="0.25"
        />
        <!-- Shadow crescent -->
        <circle
          :cx="body.position.x" :cy="body.position.y"
          :r="body.radius"
          :fill="`url(#shadow-${body.id})`"
        />
        <!-- Specular highlight -->
        <ellipse
          :cx="body.position.x - body.radius * 0.25"
          :cy="body.position.y - body.radius * 0.28"
          :rx="body.radius * 0.35" :ry="body.radius * 0.22"
          fill="rgba(255,255,255,0.15)"
        />
      </g>

      <!-- Atmospheric rim -->
      <circle
        :cx="body.position.x" :cy="body.position.y"
        :r="body.radius"
        fill="none"
        :stroke="palette.atmosphere"
        :stroke-width="body.radius * 0.12"
        opacity="0.7"
        class="planet-rim"
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
      :transform="rotated
        ? `rotate(-90, ${body.position.x}, ${body.position.y + body.radius + 6 * labelScale})`
        : undefined"
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

.system-halo-outer {
  opacity: 0.12;
  animation: system-breathe 5s ease-in-out infinite alternate;
  transition: opacity 300ms ease;
}
.system-halo-mid {
  animation: system-breathe 5s ease-in-out infinite alternate-reverse;
  transition: opacity 300ms ease;
}
.body-node.hovered .system-halo-outer { opacity: 0.22; }
.body-node.hovered .system-halo-mid   { opacity: 0.65; }
.body-node.hovered .system-spike      { opacity: 0.55; }
.body-node.hovered .system-atm-rim    { opacity: 1; }

.system-atm-rim { transition: opacity 250ms ease; }
.system-spike   { pointer-events: none; transition: opacity 250ms ease; }

@keyframes system-breathe {
  from { opacity: 0.09; }
  to   { opacity: 0.17; }
}

.planet-rim { pointer-events: none; }
.planet-atmo {
  opacity: 0.18;
  transition: opacity 300ms ease;
}
.body-node.hovered .planet-atmo { opacity: 0.32; }

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
