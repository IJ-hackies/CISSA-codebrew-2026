<script setup lang="ts"></script>

<template>
  <RouterView v-slot="{ Component }">
    <!-- No mode="out-in" — pages overlap during transition so there's no mount gap.
         Both pages share the same #02040a background. Nav-veil in each page handles
         the actual cross-fade so the 3D canvas never goes blank. -->
    <Transition name="void-fade">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
.void-fade-enter-active { transition: opacity 300ms ease; }
.void-fade-leave-active { transition: opacity 600ms ease; }
.void-fade-enter-from   { opacity: 0; }
.void-fade-leave-to     { opacity: 0; }
</style>
