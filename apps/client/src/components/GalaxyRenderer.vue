<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createRenderer } from '@/lib/renderer'
import type { RendererPublicAPI } from '@/lib/renderer'
import { detectQualityTier } from '@/lib/qualityTier'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: RendererPublicAPI | null = null

defineExpose({
  /** Expose the renderer instance to the parent. */
  getRenderer(): RendererPublicAPI | null {
    return renderer
  },
})

function handlePointerMove(e: PointerEvent) {
  if (!renderer || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  renderer.setPointer({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    active: 1,
  })
}
function handlePointerLeave() {
  renderer?.setPointer({ x: 0, y: 0, active: 0 })
}

onMounted(() => {
  if (!canvasRef.value) return
  const quality = detectQualityTier()
  renderer = createRenderer({ canvas: canvasRef.value, quality })
  renderer.start()
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointerleave', handlePointerLeave, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerleave', handlePointerLeave)
  renderer?.destroy()
  renderer = null
})
</script>

<template>
  <canvas ref="canvasRef" class="fixed inset-0 h-full w-full select-none" aria-hidden="true" />
</template>
