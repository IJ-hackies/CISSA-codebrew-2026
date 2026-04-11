<template>
  <!-- Desktop HUD / non-sheet mobile: bottom-right panel -->
  <div
    v-if="!pillMode"
    ref="hudRootEl"
    class="concept-hud"
    :class="{ collapsed }"
  >
    <Transition name="hud-expand">
      <div v-if="!collapsed" class="hud-body">
        <div class="hud-header">
          <span class="hud-title">Souls</span>
          <span class="hud-count">{{ collected.length }}<span class="hud-total"> / {{ totalConcepts }}</span></span>
        </div>

        <div class="hud-slots" ref="slotsRef">
          <TransitionGroup name="soul-slot" tag="div" class="slots-grid">
            <button
              v-for="concept in collected"
              :key="concept.id"
              class="soul-slot"
              :title="concept.title"
              :data-concept-id="concept.id"
              @click="onSlotClick(concept.id, $event)"
            >
              <svg class="soul-icon" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
                  :fill="concept.color"
                  fill-opacity="0.88"
                />
                <circle cx="9" cy="11" r="1.5" fill="rgba(0,0,0,0.55)"/>
                <circle cx="15" cy="11" r="1.5" fill="rgba(0,0,0,0.55)"/>
              </svg>
              <span class="soul-label">{{ concept.title }}</span>
            </button>
          </TransitionGroup>

          <div v-if="collected.length === 0" class="hud-empty">
            <p>Click glowing souls in solar systems to collect ideas.</p>
          </div>
        </div>
      </div>
    </Transition>

    <button
      class="hud-toggle"
      :title="collapsed ? 'Show souls' : 'Collapse'"
      @click="collapsed = !collapsed"
    >
      <!-- Soul ghost icon (collapsed: show it; expanded: show chevron) -->
      <svg v-if="collapsed" width="17" height="20" viewBox="0 0 24 28" fill="none">
        <path
          d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
          fill="currentColor"
          fill-opacity="0.75"
        />
        <circle cx="9" cy="11" r="1.5" fill="rgba(0,0,0,0.45)"/>
        <circle cx="15" cy="11" r="1.5" fill="rgba(0,0,0,0.45)"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <!-- Mobile pill mode: floating top-right icon + badge -->
  <button
    v-else
    class="hud-pill"
    :class="{ 'has-souls': collected.length > 0 }"
    :aria-label="`Souls: ${collected.length} collected`"
    @click="pillOverlayOpen = true"
  >
    <svg width="18" height="20" viewBox="0 0 24 28" fill="none">
      <path
        d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
        fill="rgba(255,255,255,0.88)"
      />
    </svg>
    <span v-if="collected.length" class="pill-count">{{ collected.length }}</span>
  </button>

  <!-- Mobile pill overlay: full-screen soul grid -->
  <Teleport to="body">
    <Transition name="pill-overlay">
      <div v-if="pillOverlayOpen" class="pill-overlay" @click.self="pillOverlayOpen = false">
        <div class="overlay-card">
          <div class="overlay-topbar">
            <div class="overlay-title">Souls <span class="overlay-count">{{ collected.length }} / {{ totalConcepts }}</span></div>
            <button class="overlay-close" @click="pillOverlayOpen = false" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="overlay-body">
            <div v-if="collected.length === 0" class="overlay-empty">
              Click glowing souls in the galaxy to collect ideas.
            </div>
            <div v-else class="overlay-grid">
              <button
                v-for="concept in collected"
                :key="concept.id"
                class="overlay-slot"
                @click="onSlotClick(concept.id, $event); pillOverlayOpen = false"
              >
                <svg class="soul-icon" viewBox="0 0 24 28" fill="none">
                  <path
                    d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
                    :fill="concept.color"
                    fill-opacity="0.9"
                  />
                </svg>
                <span class="overlay-label">{{ concept.title }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, defineExpose, onUnmounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { useMeshStore } from '@/lib/meshStore'
import type { GalaxyData, UUID } from '@/lib/meshApi'

export interface CollectedConcept {
  id: UUID
  title: string
  color: string
}

const props = defineProps<{
  galaxyData: GalaxyData | null
  /** True when a drawer/sheet is open on mobile — forces the HUD into pill mode. */
  pillMode?: boolean
}>()

const emit = defineEmits<{
  open: [conceptId: UUID]
}>()

const { collectedConceptIds } = useMeshStore()

// Start collapsed — the user expands the panel manually when they want to
// see what they've collected. Avoids covering the 3D scene on entry.
const collapsed = ref(true)
const pillOverlayOpen = ref(false)
const slotsRef = ref<HTMLDivElement>()
const hudRootEl = ref<HTMLDivElement>()

// Click-outside-to-close: when the souls panel is expanded, any click that
// lands outside the panel root collapses it. setTimeout(0) ensures the
// click that opened it doesn't immediately close it.
function onWindowMouseDown(e: MouseEvent) {
  if (collapsed.value) return
  if (!hudRootEl.value) return
  if (hudRootEl.value.contains(e.target as Node)) return
  collapsed.value = true
}

watch(collapsed, (val) => {
  if (!val) {
    setTimeout(() => window.addEventListener('mousedown', onWindowMouseDown), 0)
  } else {
    window.removeEventListener('mousedown', onWindowMouseDown)
  }
})

onUnmounted(() => {
  window.removeEventListener('mousedown', onWindowMouseDown)
})

/** Seeded color picker for concept souls (matches SolarSystemView's CONCEPT_COLORS). */
const CONCEPT_COLORS = [
  '#b5a0ff', '#ffc8e8', '#a0f0d0', '#ffeaa7',
  '#dfe0ff', '#c8f0ff', '#ffd8b8', '#e8f4a0',
]
function conceptHex(id: UUID): string {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return CONCEPT_COLORS[Math.abs(h) % CONCEPT_COLORS.length]
}

/** Derived list of collected concepts, looked up in the current galaxy. */
const collected = computed<CollectedConcept[]>(() => {
  if (!props.galaxyData) return []
  const out: CollectedConcept[] = []
  for (const id of collectedConceptIds.value) {
    const c = props.galaxyData.concepts[id]
    if (!c) continue
    out.push({ id: c.id, title: c.title, color: conceptHex(c.id) })
  }
  return out
})

const totalConcepts = computed(() =>
  props.galaxyData ? Object.keys(props.galaxyData.concepts).length : 0,
)

function onSlotClick(conceptId: UUID, e: MouseEvent) {
  // Subtle pulse feedback on the clicked slot
  const el = (e.currentTarget as HTMLElement) ?? null
  if (el) {
    gsap.fromTo(
      el,
      { scale: 1 },
      { scale: 1.12, duration: 0.1, ease: 'power2.out', yoyo: true, repeat: 1 },
    )
  }
  emit('open', conceptId)
}

/**
 * Returns the DOM rect of the HUD slot container so the 3D flying soul
 * knows where to aim. Used by SolarSystemView's GSAP fly-in.
 */
function getTargetRect(): DOMRect | null {
  // slotsRef is inside v-if="!collapsed" — fall back to the root panel when collapsed
  return slotsRef.value?.getBoundingClientRect() ?? hudRootEl.value?.getBoundingClientRect() ?? null
}

defineExpose({ getTargetRect, collected })
</script>

<style scoped>
/* ── Desktop / non-pill HUD ────────────────────────────────────────────── */
.concept-hud {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: auto;
}

.hud-toggle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: border-color 0.2s, color 0.2s;
  flex-shrink: 0;
}
.hud-toggle:hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.hud-body {
  background: rgba(8, 10, 20, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(16px);
  width: 240px;
  overflow: hidden;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.hud-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}
.hud-count {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  font-feature-settings: 'tnum' 1;
}
.hud-total {
  color: rgba(255, 255, 255, 0.32);
  font-weight: 500;
}

.hud-slots {
  padding: 10px;
  /* Exactly 3 grid rows: 3 × 63px slots + 2 × 6px row gaps + 20px container padding */
  max-height: calc(3 * 63px + 2 * 6px + 20px); /* = 221px */
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}
.hud-slots::-webkit-scrollbar { width: 3px; }
.hud-slots::-webkit-scrollbar-track { background: transparent; }
.hud-slots::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
.hud-slots::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

.slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.soul-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 6px 4px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.soul-slot:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}
.soul-icon {
  width: 30px;
  height: 36px;
  filter: drop-shadow(0 0 6px currentColor);
  animation: soul-float 3s ease-in-out infinite;
}
.soul-slot:nth-child(2n) .soul-icon { animation-delay: -1.2s; }
.soul-slot:nth-child(3n) .soul-icon { animation-delay: -2.1s; }

@keyframes soul-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}

.soul-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.2;
  text-align: center;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-empty {
  padding: 12px 4px;
  text-align: center;
}
.hud-empty p {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.45;
  margin: 0;
}

/* Expand/collapse transition */
.hud-expand-enter-active {
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
  transform-origin: bottom right;
}
.hud-expand-leave-active {
  transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.4, 0, 1, 1);
  transform-origin: bottom right;
}
.hud-expand-enter-from,
.hud-expand-leave-to {
  opacity: 0;
  transform: scale(0.88) translateY(10px);
}

/* Soul slot appear/leave (from TransitionGroup) */
.soul-slot-enter-active,
.soul-slot-leave-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.soul-slot-enter-from,
.soul-slot-leave-to {
  opacity: 0;
  transform: scale(0.6) translateY(6px);
}

/* ── Mobile pill mode ──────────────────────────────────────────────────── */
.hud-pill {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 70;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(16px);
  transition: background 0.2s, border-color 0.2s;
}
.hud-pill.has-souls {
  border-color: rgba(181, 160, 255, 0.4);
}
.hud-pill:hover {
  background: rgba(20, 25, 45, 0.95);
}
.pill-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #b5a0ff;
  color: #1a0f2e;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-feature-settings: 'tnum' 1;
}

/* Pill overlay */
.pill-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(4, 6, 14, 0.7);
  backdrop-filter: blur(20px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
}
.overlay-card {
  width: 100%;
  max-width: 520px;
  max-height: 75vh;
  background: rgba(12, 14, 24, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.overlay-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.overlay-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.01em;
}
.overlay-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  margin-left: 6px;
  font-feature-settings: 'tnum' 1;
}
.overlay-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.overlay-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.overlay-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.overlay-empty {
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.42);
  padding: 30px 20px;
  line-height: 1.5;
}
.overlay-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.overlay-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 6px;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s, border-color 0.15s;
}
.overlay-slot:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
}
.overlay-slot .soul-icon {
  width: 34px;
  height: 40px;
}
.overlay-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.2;
  text-align: center;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}

.pill-overlay-enter-active,
.pill-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.pill-overlay-enter-from,
.pill-overlay-leave-to {
  opacity: 0;
}
.pill-overlay-enter-active .overlay-card,
.pill-overlay-leave-active .overlay-card {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.pill-overlay-enter-from .overlay-card,
.pill-overlay-leave-to .overlay-card {
  transform: translateY(100%);
}
</style>
