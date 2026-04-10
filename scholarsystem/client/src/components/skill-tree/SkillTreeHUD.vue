<script setup lang="ts">
interface Props {
  title: string
  visitedCount: number
  totalNodes: number
  overallMastery: number
}

defineProps<Props>()
const emit = defineEmits<{ back: []; stats: [] }>()
</script>

<template>
  <header class="hud">
    <button class="back-btn" aria-label="Back to chat" @click="emit('back')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div class="center">
      <h1 class="galaxy-title">{{ title }}</h1>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: `${Math.round(overallMastery * 100)}%` }" />
      </div>
    </div>

    <div class="stats">
      <span class="stat-val">{{ visitedCount }}</span>
      <span class="stat-sep">/</span>
      <span class="stat-total">{{ totalNodes }}</span>
    </div>

    <button class="stats-btn" aria-label="View progress stats" @click="emit('stats')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.75" />
        <rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor" />
      </svg>
    </button>
  </header>
</template>

<style scoped>
.hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  background: linear-gradient(
    to bottom,
    rgba(2, 4, 10, 0.92) 0%,
    rgba(2, 4, 10, 0.72) 70%,
    rgba(2, 4, 10, 0) 100%
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-hairline);
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232, 236, 242, 0.04);
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
}
.back-btn:hover {
  background: rgba(232, 236, 242, 0.08);
  color: var(--color-text-primary);
  border-color: rgba(232, 236, 242, 0.22);
}

.center {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.galaxy-title {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.9;
}

.progress-track {
  height: 3px;
  background: rgba(232, 236, 242, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(to right, var(--color-accent), var(--color-accent-glow));
  border-radius: 2px;
  transition: width 800ms ease;
  min-width: 2px;
}

.stats {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.stat-val {
  color: var(--color-accent);
  font-weight: 600;
}
.stat-sep {
  opacity: 0.4;
}

.stats-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--color-hairline-strong);
  background: rgba(232, 236, 242, 0.04);
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
}
.stats-btn:hover {
  background: rgba(232, 236, 242, 0.08);
  color: var(--color-accent);
  border-color: rgba(232, 236, 242, 0.22);
}
</style>
