<template>
  <div class="concept-hud" :class="{ collapsed }">
    <!-- Toggle button -->
    <button class="hud-toggle" @click="collapsed = !collapsed" :title="collapsed ? 'Show concepts' : 'Collapse'">
      <svg v-if="collapsed" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.4"/>
        <circle cx="8" cy="8" r="2" fill="currentColor"/>
        <path d="M8 2v1M8 13v1M2 8h1M13 8h1M3.5 3.5l.7.7M11.8 11.8l.7.7M11.8 4.2l-.7.7M4.2 11.8l-.7.7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <Transition name="hud-expand">
      <div v-if="!collapsed" class="hud-body">
        <div class="hud-header">
          <span class="hud-title">Concepts</span>
          <span class="hud-count">{{ collected.length }}</span>
        </div>

        <div class="hud-slots" ref="slotsRef">
          <TransitionGroup name="soul-slot" tag="div" class="slots-grid">
            <div
              v-for="concept in collected"
              :key="concept.id"
              class="soul-slot"
              :title="concept.title"
            >
              <!-- Soul icon (ghost silhouette) -->
              <svg class="soul-icon" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2C7.03 2 3 6.03 3 11v8.5c0 .83.67 1.5 1.5 1.5.5 0 .94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63s.94-.25 1.2-.63l1.3-1.87 1.3 1.87c.26.38.7.63 1.2.63.83 0 1.5-.67 1.5-1.5V11c0-4.97-4.03-9-9-9z"
                  :fill="concept.color"
                  :fill-opacity="0.85"
                />
                <circle cx="9" cy="11" r="1.5" fill="rgba(0,0,0,0.5)"/>
                <circle cx="15" cy="11" r="1.5" fill="rgba(0,0,0,0.5)"/>
              </svg>
              <span class="soul-label">{{ concept.title }}</span>
            </div>
          </TransitionGroup>

          <div v-if="collected.length === 0" class="hud-empty">
            <p>Collect souls from the galaxy to see them here.</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, defineExpose } from 'vue'

export interface CollectedConcept {
  id: string
  title: string
  color: string
}

const collapsed = ref(false)
const collected = ref<CollectedConcept[]>([])
const slotsRef = ref<HTMLDivElement>()

function collect(concept: CollectedConcept) {
  if (collected.value.some((c) => c.id === concept.id)) return
  collected.value.push(concept)
}

/** Returns the DOM rect of the HUD slot container so the flying soul knows where to aim. */
function getTargetRect(): DOMRect | null {
  return slotsRef.value?.getBoundingClientRect() ?? null
}

defineExpose({ collect, getTargetRect, collected })
</script>

<style scoped>
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
  width: 220px;
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
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}
.hud-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.hud-slots {
  padding: 10px;
  max-height: 260px;
  overflow-y: auto;
  overflow-x: hidden;
}
.hud-slots::-webkit-scrollbar { width: 3px; }
.hud-slots::-webkit-scrollbar-track { background: transparent; }
.hud-slots::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

.slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.soul-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: default;
}
.soul-icon {
  width: 32px;
  height: 38px;
  filter: drop-shadow(0 0 6px currentColor);
  animation: soul-float 3s ease-in-out infinite;
}
.soul-slot:nth-child(2n) .soul-icon { animation-delay: -1.2s; }
.soul-slot:nth-child(3n) .soul-icon { animation-delay: -2.1s; }

@keyframes soul-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.soul-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
  line-height: 1.2;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-empty {
  padding: 12px 4px;
  text-align: center;
}
.hud-empty p {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  line-height: 1.5;
}

/* Transitions */
.hud-expand-enter-active,
.hud-expand-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform-origin: bottom right;
}
.hud-expand-enter-from,
.hud-expand-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(8px);
}

.soul-slot-enter-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.soul-slot-enter-from {
  opacity: 0;
  transform: scale(0.4) translateY(12px);
}
.soul-slot-leave-active { display: none; }

/* Mobile */
@media (max-width: 640px) {
  .concept-hud {
    bottom: 16px;
    right: 16px;
  }
  .hud-body {
    width: 190px;
  }
}
</style>
