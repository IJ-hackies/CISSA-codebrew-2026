<template>
  <Transition name="tip-fade">
    <div v-if="visible" class="onboarding-tip" :class="positionClass" :style="positionStyle">
      <div class="tip-inner">
        <p class="tip-text">{{ text }}</p>
        <button class="tip-dismiss" @click="dismiss" aria-label="Got it">Got it</button>
      </div>
      <div class="tip-arrow" :class="arrowClass" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
  storageKey: string
  text: string
  /** 'top-left' | 'top-center' | 'bottom-left' | 'bottom-center' (default: 'bottom-center') */
  position?: string
  /** Extra inline styles to fine-tune placement (e.g. { top: '80px', left: '22px' }) */
  offset?: Record<string, string>
}>()

const visible = ref(false)

onMounted(() => {
  if (!localStorage.getItem(props.storageKey)) {
    visible.value = true
  }
})

function dismiss() {
  visible.value = false
  localStorage.setItem(props.storageKey, '1')
}

const pos = computed(() => props.position ?? 'bottom-center')

const positionClass = computed(() => `pos-${pos.value}`)

const positionStyle = computed(() => ({
  ...(props.offset ?? {}),
}))

const arrowClass = computed(() => `arrow-${pos.value}`)
</script>

<style scoped>
.onboarding-tip {
  position: fixed;
  z-index: 200;
  max-width: 240px;
  pointer-events: auto;
}

/* Positioning presets */
.pos-bottom-left  { bottom: 80px; left: 22px; }
.pos-bottom-center { bottom: 80px; left: 50%; transform: translateX(-50%); }
.pos-top-left     { top: 80px; left: 22px; }
.pos-top-right    { top: 80px; right: 22px; }
.pos-top-center   { top: 80px; left: 50%; transform: translateX(-50%); }

/* When offset overrides are supplied, nuke the preset transforms */
.onboarding-tip[style] {
  transform: none;
}

.tip-inner {
  background: rgba(14, 17, 34, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  padding: 12px 14px 10px;
  backdrop-filter: blur(18px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

.tip-text {
  font-size: 12.5px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 9px;
}

.tip-dismiss {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(170, 200, 255, 0.9);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-transform: uppercase;
  transition: color 0.15s;
}
.tip-dismiss:hover { color: #fff; }

/* Arrow indicator */
.tip-arrow {
  width: 0;
  height: 0;
  position: absolute;
}
.arrow-bottom-left,
.arrow-bottom-center {
  top: -7px;
  left: 22px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid rgba(255, 255, 255, 0.14);
}
.arrow-top-left,
.arrow-top-center {
  bottom: -7px;
  left: 22px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid rgba(255, 255, 255, 0.14);
}
.arrow-top-right {
  bottom: -7px;
  right: 22px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid rgba(255, 255, 255, 0.14);
}

/* Fade in/out */
.tip-fade-enter-active {
  transition: opacity 0.4s ease 0.6s, transform 0.4s ease 0.6s;
}
.tip-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
/* Override for top-positioned tips */
.pos-top-left.tip-fade-enter-from,
.pos-top-center.tip-fade-enter-from,
.pos-top-right.tip-fade-enter-from,
.pos-top-left.tip-fade-leave-to,
.pos-top-center.tip-fade-leave-to,
.pos-top-right.tip-fade-leave-to {
  transform: translateY(-6px);
}
</style>
