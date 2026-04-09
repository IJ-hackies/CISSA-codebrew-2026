<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
</script>

<template>
  <main class="placeholder">
    <div class="card hairline-strong">
      <div class="label">GALAXY</div>
      <code class="uuid">{{ route.params.id }}</code>
      <p class="copy">
        The galaxy view isn't built yet. The renderer just delivered you here as the
        cinematic destination.
      </p>
      <button class="back" @click="router.push('/')">← back to the void</button>
    </div>
  </main>
</template>

<style scoped>
.placeholder {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.card {
  max-width: 480px;
  background: rgba(20, 8, 28, 0.6);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}
.label {
  font-family: var(--font-ui);
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  color: var(--color-accent);
}
.uuid {
  font-family: var(--font-ui);
  font-size: 0.74rem;
  color: var(--color-text-muted);
  word-break: break-all;
}
.copy {
  color: var(--color-text-muted);
  font-size: 0.92rem;
  line-height: 1.6;
  margin: 0;
}
.back {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  color: var(--color-accent);
  background: transparent;
  border: 1px solid rgba(255, 181, 71, 0.4);
  padding: 9px 16px;
  border-radius: 999px;
  transition:
    background 200ms ease,
    color 200ms ease;
}
.back:hover {
  background: rgba(255, 181, 71, 0.1);
  color: #fff4d6;
}
</style>
