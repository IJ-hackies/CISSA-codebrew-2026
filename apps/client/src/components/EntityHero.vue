<template>
  <div
    class="entity-hero"
    :class="[typeClass, { 'has-back': hasBack }]"
    :style="heroStyle"
  >
    <div class="hero-grain" />

    <div class="hero-content">
      <div ref="tagRef" class="hero-tag">{{ typeLabel }}</div>
      <h2 ref="titleRef" class="hero-title">{{ title }}</h2>

      <div ref="statsRef" class="hero-stats">
        <div class="stat">
          <div class="stat-label">{{ stats.labelA }}</div>
          <div class="stat-value">{{ displayA }}</div>
        </div>
        <div class="stat-divider" />
        <div class="stat">
          <div class="stat-label">{{ stats.labelB }}</div>
          <div class="stat-value">{{ displayB }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import type { EntityStatPair } from '@/lib/entityStats'

const props = withDefaults(
  defineProps<{
    type: 'planet' | 'concept' | 'story'
    title: string
    color: string
    stats: EntityStatPair
    animate?: boolean
    /** True when the parent drawer has a back button in the top bar (left edge). */
    hasBack?: boolean
  }>(),
  { animate: true, hasBack: false },
)

const tagRef   = ref<HTMLDivElement>()
const titleRef = ref<HTMLHeadingElement>()
const statsRef = ref<HTMLDivElement>()

// Count-up display values
const displayA = ref(0)
const displayB = ref(0)

const typeLabel = computed(() => props.type === 'concept' ? 'Soul' : capitalise(props.type))
const typeClass = computed(() => `type-${props.type}`)

function capitalise(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

/** Gradient: color at top, fading to the drawer background below. */
const heroStyle = computed(() => ({
  background: `
    linear-gradient(180deg,
      ${hexToRgba(props.color, 0.28)} 0%,
      ${hexToRgba(props.color, 0.12)} 45%,
      rgba(6, 8, 18, 0) 100%)
  `,
}))

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i)
  if (!m) return `rgba(140, 160, 255, ${alpha})`
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function runReveal() {
  if (!props.animate) {
    displayA.value = props.stats.valueA
    displayB.value = props.stats.valueB
    return
  }

  // Stagger top half (tag → title → stats)
  const targets = [tagRef.value, titleRef.value, statsRef.value].filter(Boolean) as HTMLElement[]
  gsap.set(targets, { y: 12, opacity: 0 })
  gsap.to(targets, {
    y: 0,
    opacity: 1,
    duration: 0.55,
    ease: 'power2.out',
    stagger: 0.08,
  })

  // Count up both stats simultaneously during the stats reveal
  const delay = 0.08 * 2 + 0.1
  const counterA = { v: 0 }
  const counterB = { v: 0 }
  displayA.value = 0
  displayB.value = 0
  gsap.to(counterA, {
    v: props.stats.valueA,
    duration: 0.9,
    delay,
    ease: 'power2.out',
    onUpdate: () => { displayA.value = Math.round(counterA.v) },
  })
  gsap.to(counterB, {
    v: props.stats.valueB,
    duration: 0.9,
    delay,
    ease: 'power2.out',
    onUpdate: () => { displayB.value = Math.round(counterB.v) },
  })
}

onMounted(runReveal)

// Re-run reveal when the hero content changes (navigating in a stack)
watch(
  () => [props.title, props.stats.valueA, props.stats.valueB],
  () => runReveal(),
)
</script>

<style scoped>
.entity-hero {
  position: relative;
  padding: 16px 24px 16px;
  overflow: hidden;
  isolation: isolate;
}

.hero-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 3px 3px;
  mix-blend-mode: screen;
  opacity: 0.4;
  z-index: 0;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-tag {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
  padding-right: 44px;
}
.entity-hero.has-back .hero-tag {
  padding-left: 40px;
}

.hero-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: #fff;
  margin: 0 0 14px;
  padding-right: 44px;
  letter-spacing: -0.01em;
  word-break: break-word;
}
.entity-hero.has-back .hero-title {
  padding-left: 40px;
}

.hero-stats {
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.stat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.02em;
}

.stat-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
  align-self: stretch;
}

/* ── Mobile: shrink the hero so the prose body has more room ─────────────── */
@media (max-width: 768px) {
  .entity-hero {
    padding: 10px 20px 12px;
  }
  .hero-tag {
    font-size: 9px;
    margin-bottom: 2px;
  }
  .hero-title {
    font-size: 17px;
    margin: 0 0 9px;
  }
  .hero-stats {
    gap: 12px;
    padding-top: 7px;
  }
  .stat-value {
    font-size: 20px;
  }
  .stat-label {
    font-size: 8px;
  }
}
</style>
