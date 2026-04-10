<script setup lang="ts">
/**
 * Unified history overlay — full-screen vertical constellation path.
 *
 * One component, two responsive forms:
 *  - Mobile (≤768px): opaque backdrop, smaller glyphs, narrower lane sweep,
 *    compact header.
 *  - Desktop (>768px): translucent backdrop (camera-pulled-back warped void
 *    shows through), larger glyphs, wider lane sweep, scaled-up header.
 *
 * Newest entry at top, oldest at bottom. Each glyph's horizontal column
 * is a deterministic function of its UUID. Strict-chain warp lanes
 * connect adjacent glyphs forming a zig-zag path down the page.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { GalaxyEntry } from '@/lib/recentGalaxies'
import { uuidHorizontalOffset } from '@/lib/uuidOffset'
import { relativeTime } from '@/composables/useRelativeTime'
import ConstellationGlyph from './ConstellationGlyph.vue'

const props = defineProps<{
  visible: boolean
  entries: GalaxyEntry[]
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()

const flourishingUuid = ref<string | null>(null)

// ── Responsive interpolation ────────────────────────────────────────────
// Glyph size, vertical pitch, and horizontal range all lerp linearly
// between mobile and desktop based on viewport width.
const MOBILE_W = 768
const DESKTOP_W = 1440
const GLYPH_MOBILE = 52
const GLYPH_DESKTOP = 124
const PITCH_MOBILE = 148
const PITCH_DESKTOP = 280
const HRANGE_MOBILE = 0.28
const HRANGE_DESKTOP = 0.36
const ROW_TOP_PAD = 32
/** Cap the path's drawable width so the constellation feels like a column,
 *  not a constellation stretched across an ultrawide screen. */
const PATH_MAX_WIDTH = 980

const vw = ref(window.innerWidth)
function onResize() {
  vw.value = window.innerWidth
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function progress() {
  return Math.min(1, Math.max(0, (vw.value - MOBILE_W) / (DESKTOP_W - MOBILE_W)))
}

const glyphSize = computed(() => Math.round(lerp(GLYPH_MOBILE, GLYPH_DESKTOP, progress())))
const rowPitch = computed(() => Math.round(lerp(PITCH_MOBILE, PITCH_DESKTOP, progress())))
const hRange = computed(() => lerp(HRANGE_MOBILE, HRANGE_DESKTOP, progress()))
/** Effective drawable width for path layout (capped). */
const pathWidth = computed(() => Math.min(vw.value, PATH_MAX_WIDTH))

// ── Scroll-triggered reveal ─────────────────────────────────────────────
const pathScrollRef = ref<HTMLElement | null>(null)
let revealObserver: IntersectionObserver | null = null

function attachReveals() {
  revealObserver?.disconnect()
  const root = pathScrollRef.value
  if (!root) return
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          ;(entry.target as HTMLElement).classList.add('revealed')
          revealObserver?.unobserve(entry.target)
        }
      }
    },
    { root, rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  )
  root.querySelectorAll('[data-reveal]').forEach((el) => revealObserver?.observe(el))
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      await nextTick()
      requestAnimationFrame(attachReveals)
    } else {
      revealObserver?.disconnect()
      revealObserver = null
    }
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  revealObserver?.disconnect()
  revealObserver = null
})

interface PathSlot {
  entry: GalaxyEntry
  offsetX: number
  delay: number
}

const slots = computed<PathSlot[]>(() =>
  props.entries.map((entry, i) => ({
    entry,
    offsetX: uuidHorizontalOffset(entry.uuid),
    delay: i * 70,
  })),
)

const pathHeight = computed(() => slots.value.length * rowPitch.value + ROW_TOP_PAD * 2)

function rowCenter(i: number, offset: number) {
  // Coordinates are in *path-local* pixel space (not viewport). The path
  // container is centered, so x ranges over [0, pathWidth].
  return {
    x: pathWidth.value / 2 + offset * pathWidth.value * hRange.value,
    y: ROW_TOP_PAD + i * rowPitch.value + rowPitch.value / 2,
  }
}

function onTap(entry: GalaxyEntry) {
  flourishingUuid.value = entry.uuid
  setTimeout(() => {
    router.push(`/galaxy/${entry.uuid}`)
  }, 320)
}

function onBackdropTap(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}

const isDesktop = computed(() => vw.value > MOBILE_W)
</script>

<template>
  <transition name="warp">
    <div
      v-if="visible"
      class="history-overlay"
      :class="{ desktop: isDesktop, mobile: !isDesktop }"
      role="dialog"
      aria-label="Recent galaxies"
      @click="onBackdropTap"
    >
      <button
        class="close-btn"
        type="button"
        aria-label="Close history"
        @click="emit('close')"
      >
        <svg viewBox="0 0 18 18" width="14" height="14">
          <path
            d="M3 3 L15 15 M15 3 L3 15"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <div class="header">
        <div class="label">YOUR JOURNEY</div>
        <div class="subtitle">
          {{ entries.length }} {{ entries.length === 1 ? 'galaxy' : 'galaxies' }}
        </div>
      </div>

      <div class="path-scroll" ref="pathScrollRef" @click="onBackdropTap">
        <div
          class="path"
          :style="{ height: `${pathHeight}px`, width: `${pathWidth}px` }"
          @click="onBackdropTap"
        >
          <svg
            class="lanes"
            :width="pathWidth"
            :height="pathHeight"
            :viewBox="`0 0 ${pathWidth} ${pathHeight}`"
          >
            <line
              v-for="(s, i) in slots.slice(0, -1)"
              :key="`lane-${i}`"
              :x1="rowCenter(i, s.offsetX).x"
              :y1="rowCenter(i, s.offsetX).y"
              :x2="rowCenter(i + 1, slots[i + 1].offsetX).x"
              :y2="rowCenter(i + 1, slots[i + 1].offsetX).y"
              stroke="rgba(255, 211, 128, 0.55)"
              stroke-width="1.2"
              stroke-dasharray="3 5"
              stroke-linecap="round"
              class="lane"
              data-reveal
            />
          </svg>

          <button
            v-for="(s, i) in slots"
            :key="s.entry.uuid"
            class="glyph-card constellation-card"
            :class="{ flourishing: flourishingUuid === s.entry.uuid }"
            :style="{
              left: `${rowCenter(i, s.offsetX).x}px`,
              top: `${rowCenter(i, s.offsetX).y}px`,
            }"
            data-reveal
            type="button"
            @click.stop="onTap(s.entry)"
          >
            <ConstellationGlyph :uuid="s.entry.uuid" :size="glyphSize" />
            <span class="title">{{ s.entry.title }}</span>
            <span class="time">{{ relativeTime(s.entry.createdAt) }}</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.history-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.history-overlay.mobile {
  background:
    radial-gradient(ellipse at 50% 30%, rgba(12, 18, 32, 0.88), rgba(2, 4, 8, 0.96));
  backdrop-filter: blur(2px);
}
.history-overlay.desktop {
  /* Translucent — let the camera-pulled-back warped void show through. */
  background:
    radial-gradient(ellipse at 50% 35%, rgba(12, 18, 32, 0.58), rgba(2, 4, 8, 0.65));
  backdrop-filter: blur(1px);
}

.close-btn {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 90;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(8, 12, 22, 0.72);
  border: 1px solid var(--color-hairline-strong);
  color: var(--color-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition:
    color 200ms ease,
    border-color 200ms ease;
}
.history-overlay.desktop .close-btn {
  top: 28px;
  right: 32px;
  width: 44px;
  height: 44px;
  border-radius: 14px;
}
.close-btn:hover,
.close-btn:active {
  color: var(--color-accent);
  border-color: rgba(255, 181, 71, 0.5);
}

.header {
  text-align: center;
  padding: 30px 20px 18px;
  pointer-events: none;
}
.label {
  font-family: var(--font-ui);
  font-size: 0.66rem;
  letter-spacing: 0.22em;
  color: var(--color-accent);
  font-weight: 600;
}
.subtitle {
  margin-top: 6px;
  font-family: var(--font-ui);
  font-size: 0.74rem;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}
.history-overlay.desktop .header {
  padding: 64px 20px 36px;
}
.history-overlay.desktop .label {
  font-size: 0.82rem;
  letter-spacing: 0.32em;
}
.history-overlay.desktop .subtitle {
  margin-top: 14px;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
}

.path-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 120px;
}
.path {
  position: relative;
  margin-inline: auto;
}

.lanes {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}
.lane {
  opacity: 0;
  stroke-dashoffset: 60;
  transition:
    opacity 700ms cubic-bezier(0.2, 0.7, 0.2, 1),
    stroke-dashoffset 900ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.lane.revealed {
  opacity: 1;
  stroke-dashoffset: 0;
}

.glyph-card {
  position: absolute;
  transform: translate(-50%, calc(-50% + 18px)) scale(0.85);
  background: transparent;
  border: none;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  opacity: 0;
  transition:
    transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 600ms ease,
    filter 320ms ease;
}
.glyph-card.revealed {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
.glyph-card.flourishing {
  filter: drop-shadow(0 0 18px rgba(255, 211, 128, 0.7));
  transform: translate(-50%, -50%) scale(1.12);
}
.glyph-card .title {
  font-family: var(--font-ui);
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--color-text-primary);
  max-width: 56vw;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.glyph-card .time {
  font-family: var(--font-ui);
  font-size: 0.64rem;
  color: var(--color-text-muted);
  letter-spacing: 0.04em;
}
.history-overlay.desktop .glyph-card .title {
  font-size: 0.92rem;
  max-width: 32vw;
}
.history-overlay.desktop .glyph-card .time {
  font-size: 0.74rem;
}

.warp-enter-active {
  transition:
    opacity 520ms ease,
    transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.warp-leave-active {
  transition:
    opacity 360ms ease,
    transform 420ms cubic-bezier(0.4, 0, 0.6, 1);
}
.warp-enter-from {
  opacity: 0;
  transform: scale(1.06) translateY(20px);
}
.warp-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-12px);
}
</style>
