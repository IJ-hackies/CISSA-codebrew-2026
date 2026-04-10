<script setup lang="ts">
import { computed } from 'vue'
import type { Concept, Palette, Subtopic } from '@/types/galaxy'

export type NodeState = 'locked' | 'available' | 'in-progress' | 'mastered'

export interface ConstellationNode {
  subtopic: Subtopic
  concepts: Concept[]
  palette: Palette | null
  state: NodeState
  completedCount: number
  paletteIndex: number
}

const props = defineProps<{
  nodes: ConstellationNode[]
  /** Topic ID — used as seed for unique per-section glyph shape. */
  sectionId: string
}>()

const emit = defineEmits<{ navigate: [subtopicId: string] }>()

function onNodeClick(id: string, state: NodeState) {
  if (state === 'locked') return
  emit('navigate', id)
}

// ─── SVG layout — seeded unique glyph per section ────────────────────
const SVG_W = 480

/** Linear-congruential RNG — deterministic from a numeric seed. */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/**
 * Generate constellation node positions seeded from `sectionId`.
 * Each call with the same id produces identical positions (stable layout),
 * but different ids produce visually distinct glyph shapes.
 *
 * Rules:
 *  - First node starts near the center-ish of the SVG.
 *  - Each subsequent node moves diagonally: ≥90px horizontal shift,
 *    130–190px vertical drop. The horizontal direction is mostly random
 *    but avoids staying on the same side too long.
 *  - x is clamped to [105, SVG_W - 105] so planets don't clip edges.
 */
function generatePositions(sectionId: string, count: number): Array<{ x: number; y: number }> {
  const rng = makeRng(hash(sectionId))

  const minX = 108
  const maxX = SVG_W - 108

  // Vary the starting x so first nodes don't all cluster at the same spot
  let x = minX + rng() * (maxX - minX)
  let y = 78

  const pts: Array<{ x: number; y: number }> = []

  for (let i = 0; i < count; i++) {
    pts.push({ x: Math.round(x), y: Math.round(y) })

    if (i < count - 1) {
      // Bias direction: if near an edge, push back toward center.
      const midX = SVG_W / 2
      let dir: number
      if (x < minX + 60) {
        dir = 1 // too far left — go right
      } else if (x > maxX - 60) {
        dir = -1 // too far right — go left
      } else {
        // Slight preference toward center, with randomness
        dir = rng() < 0.55 ? (x < midX ? 1 : -1) : (rng() < 0.5 ? 1 : -1)
      }

      const hStep = 90 + rng() * 150  // 90–240px horizontal
      const vStep = 130 + rng() * 60  // 130–190px vertical

      x = Math.max(minX, Math.min(maxX, x + dir * hStep))
      y += vStep
    }
  }

  return pts
}

const positions = computed(() =>
  generatePositions(props.sectionId, props.nodes.length),
)

const svgHeight = computed(() => {
  if (!positions.value.length) return 200
  return Math.max(...positions.value.map((p) => p.y)) + 90
})

// ─── Node radii by state ──────────────────────────────────────────────
function nodeRadius(state: NodeState): number {
  if (state === 'locked') return 14
  if (state === 'mastered') return 28
  return 32
}

// ─── Palette ──────────────────────────────────────────────────────────
const DEFAULT_PALETTES: Palette[] = [
  { primary: '#3a8fe8', secondary: '#0d2a5e', accent: '#92ccff', atmosphere: 'rgba(58,143,232,0.24)' },
  { primary: '#b76ef5', secondary: '#3d0f6b', accent: '#dba8ff', atmosphere: 'rgba(183,110,245,0.24)' },
  { primary: '#2ec48a', secondary: '#083d28', accent: '#6eebb7', atmosphere: 'rgba(46,196,138,0.24)' },
  { primary: '#f0852a', secondary: '#6e2a06', accent: '#ffb86b', atmosphere: 'rgba(240,133,42,0.24)' },
  { primary: '#e8609a', secondary: '#6b0a35', accent: '#f9a8d4', atmosphere: 'rgba(232,96,154,0.24)' },
  { primary: '#18c8e0', secondary: '#082d38', accent: '#5eeeff', atmosphere: 'rgba(24,200,224,0.24)' },
  { primary: '#90d420', secondary: '#274208', accent: '#c8f065', atmosphere: 'rgba(144,212,32,0.24)' },
  { primary: '#f0b420', secondary: '#6b4006', accent: '#ffe080', atmosphere: 'rgba(240,180,32,0.24)' },
  { primary: '#e85858', secondary: '#6b0808', accent: '#ffaaaa', atmosphere: 'rgba(232,88,88,0.24)' },
]

function getPalette(node: ConstellationNode): Palette {
  return node.palette ?? DEFAULT_PALETTES[node.paletteIndex % DEFAULT_PALETTES.length]
}

// ─── Deterministic terrain / cloud generation ─────────────────────────
function hash(str: string): number {
  let h = 0x811c9dc5
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  return h >>> 0
}

interface TerrainMark {
  dx: number; dy: number; rx: number; ry: number; rot: number; opacity: number
}
function terrainMarks(id: string, r: number): TerrainMark[] {
  const seed = hash(id)
  const count = 3 + (seed % 3)
  const marks: TerrainMark[] = []
  for (let i = 0; i < count; i++) {
    const a = ((seed * (i * 137 + 1)) >>> 0) % 628318 / 100000 // 0..2π
    const dist = r * (0.08 + ((seed * (i * 31 + 7)) % 44) / 100)
    const dx = Math.cos(a) * dist
    const dy = Math.sin(a) * dist * 0.72
    const rx = r * (0.14 + ((seed * (i * 17 + 3)) % 18) / 100)
    const ry = r * (0.07 + ((seed * (i * 11 + 5)) % 9) / 100)
    const rot = ((seed * (i * 7 + 9)) % 70) - 35
    const opacity = 0.18 + ((seed * (i + 13)) % 22) / 100
    marks.push({ dx, dy, rx, ry, rot, opacity })
  }
  return marks
}

interface CloudWisp {
  dx: number; dy: number; rx: number; ry: number; rot: number
}
function cloudWisps(id: string, r: number): CloudWisp[] {
  const seed = hash(id) ^ 0xdeadbeef
  const count = 2 + (seed % 2)
  const wisps: CloudWisp[] = []
  for (let i = 0; i < count; i++) {
    const a = ((seed * (i * 113 + 3)) >>> 0) % 628318 / 100000
    const dist = r * (0.12 + ((seed * (i * 53 + 9)) % 38) / 100)
    const dx = Math.cos(a) * dist
    const dy = Math.sin(a) * dist * 0.45
    const rx = r * (0.32 + ((seed * (i * 23 + 7)) % 28) / 100)
    const ry = r * (0.07 + ((seed * (i * 13 + 2)) % 7) / 100)
    const rot = ((seed * (i * 9 + 4)) % 40) - 20
    wisps.push({ dx, dy, rx, ry, rot })
  }
  return wisps
}

// ─── Progress arc ─────────────────────────────────────────────────────
function arcMetrics(r: number, completed: number, total: number) {
  const frac = total > 0 ? completed / total : 0
  const C = 2 * Math.PI * r
  return { C, offset: C * (1 - frac) }
}

</script>

<template>
  <div class="constellation">
    <!-- ─── Constellation SVG ──────────────────────────────────────────── -->
    <svg
      :viewBox="`0 0 ${SVG_W} ${svgHeight}`"
      :height="svgHeight"
      width="100%"
      style="display:block; overflow: visible;"
    >
      <defs>
        <!-- Per-node clip paths and gradients -->
        <template v-for="(node, i) in nodes" :key="`defs-${node.subtopic.id}`">
          <!-- Clip to sphere -->
          <clipPath :id="`clip-${node.subtopic.id}`">
            <circle :cx="positions[i].x" :cy="positions[i].y" :r="nodeRadius(node.state) - 0.5" />
          </clipPath>

          <!-- Main planet gradient (lit top-left) -->
          <radialGradient
            v-if="node.state !== 'locked'"
            :id="`main-${node.subtopic.id}`"
            :cx="positions[i].x - nodeRadius(node.state) * 0.22"
            :cy="positions[i].y - nodeRadius(node.state) * 0.24"
            :r="nodeRadius(node.state) * 1.1"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" :stop-color="getPalette(node).accent" stop-opacity="1" />
            <stop offset="30%" :stop-color="getPalette(node).primary" stop-opacity="0.98" />
            <stop offset="70%" :stop-color="getPalette(node).primary" stop-opacity="0.88" />
            <stop offset="100%" :stop-color="getPalette(node).secondary" stop-opacity="0.9" />
          </radialGradient>

          <!-- Terminator shadow (dark crescent on bottom-right) -->
          <radialGradient
            v-if="node.state !== 'locked'"
            :id="`shadow-${node.subtopic.id}`"
            :cx="positions[i].x + nodeRadius(node.state) * 0.55"
            :cy="positions[i].y + nodeRadius(node.state) * 0.5"
            :r="nodeRadius(node.state) * 0.95"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stop-color="#000" stop-opacity="0" />
            <stop offset="55%" stop-color="#000" stop-opacity="0" />
            <stop offset="100%" stop-color="#000" stop-opacity="0.72" />
          </radialGradient>

          <!-- Locked planet gradient -->
          <radialGradient
            v-if="node.state === 'locked'"
            :id="`locked-${node.subtopic.id}`"
            :cx="positions[i].x - nodeRadius(node.state) * 0.2"
            :cy="positions[i].y - nodeRadius(node.state) * 0.2"
            :r="nodeRadius(node.state) * 1.1"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stop-color="#2a3848" stop-opacity="1" />
            <stop offset="100%" stop-color="#0e151e" stop-opacity="1" />
          </radialGradient>

          <!-- Glow blur filter -->
          <filter
            v-if="node.state !== 'locked'"
            :id="`glow-${node.subtopic.id}`"
            x="-60%" y="-60%" width="220%" height="220%"
          >
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </template>
      </defs>

      <!-- ─── Connector lines ──────────────────────────────────────── -->
      <line
        v-for="i in nodes.length - 1"
        :key="`line-${i}`"
        :x1="positions[i - 1].x"
        :y1="positions[i - 1].y"
        :x2="positions[i].x"
        :y2="positions[i].y"
        :stroke="nodes[i].state === 'locked' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.14)'"
        stroke-width="1.5"
        stroke-dasharray="5 6"
        stroke-linecap="round"
      />

      <!-- ─── Planets ────────────────────────────────────────────────── -->
      <g
        v-for="(node, i) in nodes"
        :key="`planet-${node.subtopic.id}`"
        class="planet-group"
        :class="[
          `state-${node.state}`,
          { interactive: node.state !== 'locked', selected: selectedId === node.subtopic.id }
        ]"
        @click="onNodeClick(node.subtopic.id, node.state)"
      >
        <!-- Atmosphere glow blob (behind planet) -->
        <circle
          v-if="node.state !== 'locked'"
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state) + 10"
          :fill="getPalette(node).atmosphere"
          class="atmo-glow"
        />

        <!-- Pulse ring (available state) -->
        <circle
          v-if="node.state === 'available'"
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state) + 4"
          fill="none"
          :stroke="getPalette(node).accent"
          stroke-width="1.8"
          stroke-opacity="0.7"
          class="pulse-ring"
        />

        <!-- Progress arc (in-progress state) -->
        <circle
          v-if="node.state === 'in-progress'"
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state) + 5"
          fill="none"
          :stroke="getPalette(node).accent"
          stroke-width="2.5"
          stroke-linecap="round"
          :stroke-dasharray="arcMetrics(nodeRadius(node.state) + 5, node.completedCount, node.concepts.length).C"
          :stroke-dashoffset="arcMetrics(nodeRadius(node.state) + 5, node.completedCount, node.concepts.length).offset"
          :transform="`rotate(-90 ${positions[i].x} ${positions[i].y})`"
          class="progress-arc"
        />

        <!-- Planet body -->
        <circle
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state)"
          :fill="node.state === 'locked' ? `url(#locked-${node.subtopic.id})` : `url(#main-${node.subtopic.id})`"
          :filter="node.state !== 'locked' ? `url(#glow-${node.subtopic.id})` : undefined"
          class="planet-body"
        />

        <!-- Terrain marks (clipped to sphere) -->
        <g
          v-if="node.state !== 'locked'"
          :clip-path="`url(#clip-${node.subtopic.id})`"
          class="terrain-layer"
        >
          <ellipse
            v-for="(mark, mi) in terrainMarks(node.subtopic.id, nodeRadius(node.state))"
            :key="`t-${mi}`"
            :cx="positions[i].x + mark.dx"
            :cy="positions[i].y + mark.dy"
            :rx="mark.rx"
            :ry="mark.ry"
            :fill="getPalette(node).secondary"
            :opacity="mark.opacity"
            :transform="`rotate(${mark.rot} ${positions[i].x + mark.dx} ${positions[i].y + mark.dy})`"
          />
        </g>

        <!-- Terminator shadow (clipped to sphere) -->
        <circle
          v-if="node.state !== 'locked'"
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state)"
          :fill="`url(#shadow-${node.subtopic.id})`"
          :clip-path="`url(#clip-${node.subtopic.id})`"
          style="pointer-events: none;"
        />

        <!-- Cloud wisps (clipped to sphere) -->
        <g
          v-if="node.state !== 'locked'"
          :clip-path="`url(#clip-${node.subtopic.id})`"
          class="cloud-layer"
          style="pointer-events: none;"
        >
          <ellipse
            v-for="(wisp, wi) in cloudWisps(node.subtopic.id, nodeRadius(node.state))"
            :key="`c-${wi}`"
            :cx="positions[i].x + wisp.dx"
            :cy="positions[i].y + wisp.dy"
            :rx="wisp.rx"
            :ry="wisp.ry"
            fill="white"
            opacity="0.14"
            :transform="`rotate(${wisp.rot} ${positions[i].x + wisp.dx} ${positions[i].y + wisp.dy})`"
          />
        </g>

        <!-- Atmosphere rim (border highlight) -->
        <circle
          v-if="node.state !== 'locked'"
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state) - 0.5"
          fill="none"
          :stroke="getPalette(node).accent"
          stroke-width="1"
          stroke-opacity="0.35"
          style="pointer-events: none;"
        />

        <!-- Specular highlight (top-left) -->
        <ellipse
          v-if="node.state !== 'locked'"
          :cx="positions[i].x - nodeRadius(node.state) * 0.26"
          :cy="positions[i].y - nodeRadius(node.state) * 0.28"
          :rx="nodeRadius(node.state) * 0.30"
          :ry="nodeRadius(node.state) * 0.17"
          fill="white"
          opacity="0.28"
          :transform="`rotate(-30 ${positions[i].x - nodeRadius(node.state) * 0.26} ${positions[i].y - nodeRadius(node.state) * 0.28})`"
          style="pointer-events: none;"
        />

        <!-- Lock icon for locked state -->
        <g
          v-if="node.state === 'locked'"
          style="pointer-events: none;"
        >
          <!-- Shackle -->
          <path
            :d="`M${positions[i].x - 4} ${positions[i].y - 1} V${positions[i].y - 5} a4 4 0 0 1 8 0 V${positions[i].y - 1}`"
            fill="none"
            stroke="#364555"
            stroke-width="2"
            stroke-linecap="round"
          />
          <!-- Body -->
          <rect
            :x="positions[i].x - 5.5"
            :y="positions[i].y - 1"
            width="11"
            height="8"
            rx="2"
            fill="#1e2e3e"
          />
          <!-- Keyhole -->
          <circle :cx="positions[i].x" :cy="positions[i].y + 3" r="1.6" fill="#364555" />
        </g>

        <!-- Mastered star badge -->
        <g
          v-if="node.state === 'mastered'"
          style="pointer-events: none;"
        >
          <circle
            :cx="positions[i].x + nodeRadius(node.state) - 2"
            :cy="positions[i].y - nodeRadius(node.state) + 4"
            r="9"
            fill="#02040a"
          />
          <circle
            :cx="positions[i].x + nodeRadius(node.state) - 2"
            :cy="positions[i].y - nodeRadius(node.state) + 4"
            r="7"
            fill="#ffb547"
          />
          <text
            :x="positions[i].x + nodeRadius(node.state) - 2"
            :y="positions[i].y - nodeRadius(node.state) + 8"
            text-anchor="middle"
            font-size="8"
            fill="#02040a"
          >★</text>
        </g>

        <!-- Selection ring -->
        <circle
          v-if="selectedId === node.subtopic.id"
          :cx="positions[i].x"
          :cy="positions[i].y"
          :r="nodeRadius(node.state) + 7"
          fill="none"
          stroke="white"
          stroke-width="1.5"
          stroke-opacity="0.5"
          stroke-dasharray="4 5"
          style="pointer-events: none;"
        />

        <!-- Label -->
        <text
          :x="positions[i].x"
          :y="positions[i].y + nodeRadius(node.state) + 16"
          text-anchor="middle"
          font-family="var(--font-ui)"
          :font-size="node.state === 'locked' ? 9 : 11"
          font-weight="600"
          letter-spacing="0.04em"
          :fill="node.state === 'locked' ? '#364555' : '#e8ecf2'"
          :opacity="node.state === 'locked' ? 0.55 : 0.9"
          style="pointer-events: none; text-shadow: 0 1px 6px rgba(0,0,0,0.9);"
        >{{ node.subtopic.title }}</text>

        <!-- Progress fraction label (in-progress) -->
        <text
          v-if="node.state === 'in-progress'"
          :x="positions[i].x"
          :y="positions[i].y + nodeRadius(node.state) + 28"
          text-anchor="middle"
          font-family="var(--font-ui)"
          font-size="9"
          fill="#6f7989"
          style="pointer-events: none;"
        >{{ node.completedCount }}/{{ node.concepts.length }}</text>
      </g>
    </svg>

  </div>
</template>

<style scoped>
.constellation {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

/* ─── Planet group interactions ─────────────────────────────────── */
.planet-group {
  transition: transform 220ms ease;
  transform-box: fill-box;
  transform-origin: center;
}
.planet-group.interactive {
  cursor: pointer;
}
.planet-group.interactive:hover {
  transform: scale(1.06);
}
.planet-group.interactive.selected {
  transform: scale(1.04);
}
.planet-group.state-locked {
  cursor: not-allowed;
  opacity: 0.7;
}

/* ─── Glow / atmosphere animations ──────────────────────────────── */
.atmo-glow {
  transition: opacity 300ms ease;
  opacity: 0.65;
}
.planet-group.interactive:hover .atmo-glow,
.planet-group.selected .atmo-glow {
  opacity: 1;
}

.pulse-ring {
  animation: pulse-ring 2.8s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes pulse-ring {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50%       { opacity: 0.75; transform: scale(1.15); }
}

.progress-arc {
  transition: stroke-dashoffset 0.7s ease;
}

</style>
