<script setup lang="ts">
import { onMounted } from 'vue'
import { prefetchAll } from '@/lib/dataCache'

onMounted(() => {
  prefetchAll()
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <!-- mode="out-in": old page fully leaves before new page enters.
         Eliminates double-canvas jitter and scrollbar from two full-height
         pages coexisting. Body background (#02040a) fills the brief gap
         invisibly since all pages share the same base colour. -->
    <Transition name="void-fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.void-fade-enter-active { transition: opacity 240ms ease; }
.void-fade-leave-active { transition: opacity 160ms ease; }
.void-fade-enter-from   { opacity: 0; }
.void-fade-leave-to     { opacity: 0; }
</style>
