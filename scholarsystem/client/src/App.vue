<script setup lang="ts"></script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="void-fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.void-fade-enter-active,
.void-fade-leave-active {
  transition: opacity 400ms ease;
}
.void-fade-enter-from,
.void-fade-leave-to {
  opacity: 0;
}
</style>
