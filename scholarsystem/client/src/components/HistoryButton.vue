<script setup lang="ts">
/**
 * Unified history button. Same component, two positions:
 * - Mobile (≤768px): top-left
 * - Desktop (>768px): top-right
 *
 * Hidden until the user has at least one galaxy. The first time the
 * button appears, it plays a one-shot glow to draw the user's eye.
 * The "seen" flag persists in localStorage so the glow only fires once.
 */
import { onMounted, ref, watch } from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'

const props = defineProps<{ visible: boolean }>()
defineEmits<{ open: [] }>()

const isMobile = useIsMobile()

const SEEN_KEY = 'scholarSystem.historyButtonSeen'
const playingDebut = ref(false)

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // ignore
  }
}
function hasBeenSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

onMounted(() => {
  if (props.visible && !hasBeenSeen()) {
    triggerDebut()
  }
})

watch(
  () => props.visible,
  (v) => {
    if (v && !hasBeenSeen()) triggerDebut()
  },
)

function triggerDebut() {
  playingDebut.value = true
  // Glow lasts ~1.6s. Mark seen at end so it never plays again.
  setTimeout(() => {
    playingDebut.value = false
    markSeen()
  }, 1800)
}
</script>

<template>
  <transition name="fade">
    <button
      v-if="visible"
      class="history-btn"
      :class="{ mobile: isMobile, desktop: !isMobile, debut: playingDebut }"
      type="button"
      aria-label="Open history"
      @click="$emit('open')"
    >
      <!-- Constellation silhouette icon — abstract dotted asterism. -->
      <svg
        :viewBox="'0 0 32 32'"
        :width="isMobile ? 22 : 26"
        :height="isMobile ? 22 : 26"
        aria-hidden="true"
      >
        <g fill="currentColor" stroke="currentColor" stroke-width="0.6">
          <line x1="8" y1="9" x2="16" y2="6" stroke-opacity="0.55" />
          <line x1="16" y1="6" x2="22" y2="14" stroke-opacity="0.55" />
          <line x1="22" y1="14" x2="14" y2="20" stroke-opacity="0.55" />
          <line x1="14" y1="20" x2="8" y2="9" stroke-opacity="0.55" />
          <line x1="22" y1="14" x2="26" y2="22" stroke-opacity="0.55" />
        </g>
        <g fill="currentColor">
          <circle cx="8" cy="9" r="1.4" />
          <circle cx="16" cy="6" r="1.6" />
          <circle cx="22" cy="14" r="2" />
          <circle cx="14" cy="20" r="1.4" />
          <circle cx="26" cy="22" r="1.2" />
        </g>
      </svg>
      <span v-if="!isMobile" class="label">JOURNEY</span>
    </button>
  </transition>
</template>

<style scoped>
.history-btn {
  position: fixed;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(8, 12, 22, 0.65);
  backdrop-filter: blur(10px);
  border: 1px solid var(--color-hairline-strong);
  color: var(--color-text-primary);
  transition:
    color 220ms ease,
    border-color 220ms ease,
    background 220ms ease,
    transform 220ms ease,
    box-shadow 320ms ease;
}
.history-btn.mobile {
  top: 10px;
  left: 10px;
  width: 38px;
  height: 38px;
}
.history-btn.desktop {
  top: 28px;
  right: 32px;
  height: 52px;
  padding: 0 20px 0 16px;
  gap: 12px;
  border-radius: 14px;
  /* Persistent subtle glow so it reads as a real button, not invisible chrome. */
  box-shadow:
    0 0 0 1px rgba(255, 181, 71, 0.18),
    0 0 32px -6px rgba(255, 181, 71, 0.3);
}
.history-btn.desktop .label {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: var(--color-text-primary);
  transition: color 200ms ease;
}
.history-btn.desktop:hover .label {
  color: var(--color-accent-glow);
}
.history-btn:hover,
.history-btn:active {
  color: var(--color-accent);
  border-color: rgba(255, 181, 71, 0.5);
  background: rgba(14, 20, 32, 0.78);
  transform: translateY(-1px);
  box-shadow:
    0 0 0 1px rgba(255, 181, 71, 0.18),
    0 0 28px -4px rgba(255, 181, 71, 0.45);
}

/* One-shot debut glow when the button first appears. */
.history-btn.debut {
  animation: btnDebut 1.7s cubic-bezier(0.2, 0.7, 0.2, 1);
}
@keyframes btnDebut {
  0% {
    box-shadow: 0 0 0 1px rgba(255, 181, 71, 0), 0 0 0 0 rgba(255, 181, 71, 0);
    transform: scale(0.85);
    opacity: 0.4;
  }
  20% {
    box-shadow:
      0 0 0 1px rgba(255, 211, 128, 0.6),
      0 0 60px 8px rgba(255, 181, 71, 0.55);
    transform: scale(1.06);
    opacity: 1;
  }
  60% {
    box-shadow:
      0 0 0 1px rgba(255, 181, 71, 0.4),
      0 0 40px 4px rgba(255, 181, 71, 0.35);
    transform: scale(1);
  }
  100% {
    box-shadow: 0 0 0 1px rgba(255, 181, 71, 0), 0 0 0 0 rgba(255, 181, 71, 0);
    transform: scale(1);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 320ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
