<script setup lang="ts">
import { formatBytes } from '@/lib/fileTypes'

const props = defineProps<{
  file: File
}>()
const emit = defineEmits<{ remove: [] }>()

function ext(name: string) {
  const m = name.match(/\.[^.]+$/)
  return m ? m[0].slice(1).toUpperCase() : 'FILE'
}
</script>

<template>
  <div class="chip">
    <span class="ext">{{ ext(props.file.name) }}</span>
    <span class="name" :title="props.file.name">{{ props.file.name }}</span>
    <span class="size">{{ formatBytes(props.file.size) }}</span>
    <button class="remove" type="button" @click="emit('remove')" aria-label="Remove file">
      <svg viewBox="0 0 12 12" width="10" height="10">
        <path
          d="M2 2 L10 10 M10 2 L2 10"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px 6px 6px;
  background: rgba(245, 240, 234, 0.04);
  border: 1px solid var(--color-hairline-strong);
  border-radius: 8px;
  font-family: var(--font-ui);
  font-size: 0.72rem;
  color: var(--color-text-primary);
  max-width: 260px;
}
.ext {
  font-weight: 700;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  color: var(--color-accent);
  background: rgba(255, 181, 71, 0.1);
  padding: 3px 6px;
  border-radius: 4px;
}
.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.size {
  color: var(--color-text-muted);
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
}
.remove {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  transition: color 180ms ease;
}
.remove:hover {
  color: var(--color-accent);
}
</style>
