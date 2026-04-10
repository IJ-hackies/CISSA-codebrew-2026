<script setup lang="ts">
/**
 * HotspotScene — click glowing hotspots on a scene to reveal info.
 * All required hotspots must be discovered to proceed.
 */
import { ref, computed } from 'vue'

export interface Hotspot {
  id: string
  label: string
  x: number          // 0–100 (% of container width)
  y: number          // 0–100 (% of container height)
  revealText: string
  required: boolean
}

export interface HotspotChallenge {
  type: 'hotspot'
  instruction: string
  hotspots: Hotspot[]
}

const props = defineProps<{ challenge: HotspotChallenge }>()
const emit  = defineEmits<{ complete: [correct: boolean] }>()

const revealed   = ref<Set<string>>(new Set())
const activeId   = ref<string | null>(null)
const submitted  = ref(false)

const requiredAll = computed(() =>
  props.challenge.hotspots.filter((h) => h.required).map((h) => h.id),
)

const allFound = computed(() =>
  requiredAll.value.every((id) => revealed.value.has(id)),
)

function clickHotspot(h: Hotspot) {
  if (submitted.value) return
  revealed.value.add(h.id)
  activeId.value = activeId.value === h.id ? null : h.id
}

function proceed() {
  if (!allFound.value || submitted.value) return
  submitted.value = true
  emit('complete', true)
}
</script>

<template>
  <div class="hotspot-scene">
    <p class="instruction">{{ challenge.instruction }}</p>

    <!-- Scene area with hotspots -->
    <div class="scene-area">
      <!-- Hotspot markers -->
      <button
        v-for="h in challenge.hotspots"
        :key="h.id"
        class="hotspot-btn"
        :class="{
          discovered: revealed.has(h.id),
          active: activeId === h.id,
          required: h.required && !revealed.has(h.id),
        }"
        :style="{ left: `${h.x}%`, top: `${h.y}%` }"
        @click="clickHotspot(h)"
        :aria-label="h.label"
      >
        <span class="hotspot-ring" />
        <span class="hotspot-core">
          {{ revealed.has(h.id) ? '✓' : '?' }}
        </span>
      </button>

      <!-- Info panel for active hotspot -->
      <Transition name="pop">
        <div
          v-if="activeId"
          class="info-panel"
          :style="{
            left: `${Math.min(challenge.hotspots.find(h => h.id === activeId)!.x + 5, 55)}%`,
            top:  `${Math.max(challenge.hotspots.find(h => h.id === activeId)!.y - 10, 2)}%`,
          }"
        >
          <p class="info-label">{{ challenge.hotspots.find((h) => h.id === activeId)?.label }}</p>
          <p class="info-text">{{ challenge.hotspots.find((h) => h.id === activeId)?.revealText }}</p>
        </div>
      </Transition>
    </div>

    <!-- Discovery progress -->
    <div class="progress-row">
      <div
        v-for="h in challenge.hotspots.filter(h => h.required)"
        :key="h.id"
        class="progress-pip"
        :class="{ found: revealed.has(h.id) }"
        :title="h.label"
      />
      <span class="progress-label">
        {{ revealed.size }} / {{ challenge.hotspots.length }} discovered
      </span>
    </div>

    <Transition name="fade-up">
      <button v-if="allFound && !submitted" class="proceed-btn" @click="proceed">
        Continue →
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.hotspot-scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.instruction {
  font-family: var(--font-body);
  font-size: 0.92rem;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.5;
}

/* ─── Scene area ──────────────────────────────────────────────────── */
.scene-area {
  position: relative;
  width: 100%;
  height: 220px;
  border-radius: 14px;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(8,14,26,0.7);
  overflow: hidden;
}

/* ─── Hotspot button ──────────────────────────────────────────────── */
.hotspot-btn {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.hotspot-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1.5px solid rgba(140,190,255,0.5);
  animation: ring-pulse 2s ease-in-out infinite;
}
.hotspot-btn.discovered .hotspot-ring {
  border-color: rgba(52,211,153,0.5);
  animation: none;
}
.hotspot-btn.active .hotspot-ring {
  border-color: rgba(255,181,71,0.7);
  animation: none;
}

@keyframes ring-pulse {
  0%, 100% { transform: scale(1);    opacity: 0.6; }
  50%       { transform: scale(1.15); opacity: 1;   }
}

.hotspot-core {
  position: relative;
  z-index: 1;
  width: 28px; height: 28px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(140,190,255,0.15);
  border: 1px solid rgba(140,190,255,0.4);
  color: rgba(140,190,255,0.9);
  transition: background 200ms, border-color 200ms, color 200ms;
}
.hotspot-btn.discovered .hotspot-core {
  background: rgba(52,211,153,0.15);
  border-color: rgba(52,211,153,0.5);
  color: #34d399;
}
.hotspot-btn.active .hotspot-core {
  background: rgba(255,181,71,0.2);
  border-color: rgba(255,181,71,0.6);
  color: #ffb547;
}

/* ─── Info panel ──────────────────────────────────────────────────── */
.info-panel {
  position: absolute;
  z-index: 10;
  max-width: 200px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255,181,71,0.3);
  background: rgba(4,6,14,0.95);
  backdrop-filter: blur(12px);
  pointer-events: none;
}
.info-label {
  font-family: var(--font-ui);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #ffb547;
  margin: 0 0 5px;
}
.info-text {
  font-family: var(--font-body);
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  margin: 0;
}

/* ─── Progress ────────────────────────────────────────────────────── */
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.progress-pip {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1.5px solid rgba(140,190,255,0.3);
  background: transparent;
  transition: background 200ms, border-color 200ms;
}
.progress-pip.found {
  background: rgba(52,211,153,0.7);
  border-color: #34d399;
}
.progress-label {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
}

.proceed-btn {
  align-self: center;
  padding: 11px 36px;
  border-radius: 999px;
  border: 1px solid rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.08);
  color: #34d399;
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 180ms, transform 140ms;
}
.proceed-btn:hover { background: rgba(52,211,153,0.14); transform: translateY(-1px); }

/* ─── Transitions ─────────────────────────────────────────────────── */
.pop-enter-active { transition: transform 200ms cubic-bezier(0.22,1,0.36,1), opacity 160ms ease; }
.pop-enter-from   { transform: scale(0.85); opacity: 0; }
.fade-up-enter-active { transition: opacity 280ms ease, transform 280ms ease; }
.fade-up-enter-from   { opacity: 0; transform: translateY(6px); }
</style>
