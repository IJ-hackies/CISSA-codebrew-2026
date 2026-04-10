<script setup lang="ts">
const SUGGESTIONS = [
  'Photosynthesis for a high school bio exam',
  'My CS lecture notes on Big-O',
  'The French Revolution, focused on causes',
  'Linear algebra: eigenvalues from scratch',
] as const

const emit = defineEmits<{
  pick: [text: string]
}>()
</script>

<template>
  <div class="chips">
    <button
      v-for="(s, i) in SUGGESTIONS"
      :key="s"
      class="chip"
      :style="{ '--i': i }"
      @click="emit('pick', s)"
      type="button"
    >
      {{ s }}
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 560px;
  margin-inline: auto;
}
.chip {
  font-family: var(--font-ui);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--color-text-muted);
  background: rgba(245, 240, 234, 0.025);
  border: 1px solid var(--color-hairline);
  padding: 6px 12px;
  border-radius: 999px;
  backdrop-filter: blur(6px);
  transition:
    color 220ms ease,
    border-color 220ms ease,
    background 220ms ease,
    transform 220ms ease;
  animation: fadeUp 600ms ease both;
  animation-delay: calc(var(--i) * 90ms + 400ms);
}
.chip:hover {
  color: var(--color-text-primary);
  border-color: var(--color-hairline-strong);
  background: rgba(255, 181, 71, 0.06);
  transform: translateY(-1px);
}
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
