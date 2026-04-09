<script setup lang="ts">
defineProps<{ visible: boolean }>()
</script>

<template>
  <transition name="drop">
    <div v-if="visible" class="drop-overlay" aria-hidden="true">
      <div class="frame">
        <div class="corner tl" />
        <div class="corner tr" />
        <div class="corner bl" />
        <div class="corner br" />
        <div class="text">
          <div class="line">RELEASE TO INGEST INTO THE VOID</div>
          <div class="sub">PDF · DOCX · MD · TEX · IPYNB · and more</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% 50%, rgba(255, 181, 71, 0.08), rgba(10, 5, 16, 0.5));
  backdrop-filter: blur(4px);
  pointer-events: none;
}
.frame {
  position: absolute;
  inset: 28px;
  border: 1px dashed rgba(255, 181, 71, 0.4);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.corner {
  position: absolute;
  width: 36px;
  height: 36px;
  border-color: var(--color-accent);
  border-style: solid;
  border-width: 0;
}
.corner.tl {
  top: -1px;
  left: -1px;
  border-top-width: 2px;
  border-left-width: 2px;
  border-top-left-radius: 18px;
}
.corner.tr {
  top: -1px;
  right: -1px;
  border-top-width: 2px;
  border-right-width: 2px;
  border-top-right-radius: 18px;
}
.corner.bl {
  bottom: -1px;
  left: -1px;
  border-bottom-width: 2px;
  border-left-width: 2px;
  border-bottom-left-radius: 18px;
}
.corner.br {
  bottom: -1px;
  right: -1px;
  border-bottom-width: 2px;
  border-right-width: 2px;
  border-bottom-right-radius: 18px;
}
.text {
  text-align: center;
  font-family: var(--font-ui);
  color: var(--color-accent);
}
.line {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.sub {
  margin-top: 10px;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  color: rgba(255, 211, 128, 0.7);
  text-transform: uppercase;
}
.drop-enter-active,
.drop-leave-active {
  transition: opacity 200ms ease;
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
}
</style>
