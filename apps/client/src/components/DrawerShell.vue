<template>
  <Teleport to="body">
    <Transition :name="transitionName" appear>
      <div
        v-if="open"
        class="drawer-shell"
        :class="[side, { mobile: isMobile }]"
        :style="shellStyle"
        role="dialog"
        aria-modal="false"
      >
        <!-- Top bar: back + close -->
        <div class="shell-topbar">
          <button
            v-if="canGoBack"
            class="shell-back"
            :aria-label="'Back'"
            @click="$emit('back')"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="shell-spacer" />
          <button class="shell-close" :aria-label="'Close'" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Hero slot -->
        <div v-if="$slots.hero" class="shell-hero-wrap">
          <slot name="hero" />
        </div>

        <!-- Scrollable body -->
        <div class="shell-body" ref="bodyRef">
          <slot name="body" />
        </div>

        <!-- Footer slot -->
        <div v-if="$slots.footer" class="shell-footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useIsMobile } from '@/composables/useIsMobile'

const props = withDefaults(
  defineProps<{
    open: boolean
    side: 'left' | 'right'
    canGoBack?: boolean
    width?: number
  }>(),
  { canGoBack: false, width: 380 },
)

const emit = defineEmits<{
  close: []
  back: []
}>()

const isMobile = useIsMobile()
const bodyRef = ref<HTMLDivElement>()

const transitionName = computed(() =>
  isMobile.value ? 'sheet-slide' : props.side === 'left' ? 'rail-slide-left' : 'rail-slide-right',
)

const shellStyle = computed(() => {
  if (isMobile.value) return {}
  return { width: `${props.width}px` }
})

// Reset scroll to top on top-of-stack change (content changed)
watch(
  () => props.open,
  (o) => { if (o && bodyRef.value) bodyRef.value.scrollTop = 0 },
)

// ESC key: pop back if we can, otherwise close
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) return
  if (props.canGoBack) emit('back')
  else emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.drawer-shell {
  position: fixed;
  top: 0;
  height: 100%;
  background: rgba(6, 8, 18, 0.94);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  display: flex;
  flex-direction: column;
  z-index: 50;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.85);
}
.drawer-shell.left {
  left: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}
.drawer-shell.right {
  right: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

/* Mobile: full-screen sheet. Trigger pills are hidden behind it; the user
   uses the drawer's own close button to dismiss. */
.drawer-shell.mobile {
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100vw !important;
  height: 100dvh;
  border-left: none;
  border-right: none;
  border-top: none;
  border-radius: 0;
}

.shell-topbar {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 3;
  pointer-events: none;
}
.shell-topbar > * { pointer-events: auto; }
.shell-spacer { flex: 1; }

.shell-back,
.shell-close {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(8, 10, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  backdrop-filter: blur(10px);
}
.shell-back:hover,
.shell-close:hover {
  background: rgba(20, 25, 45, 0.9);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.25);
}

.shell-hero-wrap {
  flex-shrink: 0;
}

.shell-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}
.shell-body::-webkit-scrollbar { width: 3px; }
.shell-body::-webkit-scrollbar-track { background: transparent; }
.shell-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 2px; }

.shell-footer {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

/* ── Transitions ───────────────────────────────────────── */

.rail-slide-right-enter-active,
.rail-slide-right-leave-active,
.rail-slide-left-enter-active,
.rail-slide-left-leave-active,
.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}
.rail-slide-right-enter-from,
.rail-slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.rail-slide-left-enter-from,
.rail-slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
