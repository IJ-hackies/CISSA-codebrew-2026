<script setup lang="ts">
/**
 * ChallengePanel — dispatches to the correct mini-game based on challenge.type.
 * Drop this into any scene archetype. Emits complete(correct) when done.
 */
import type { Challenge } from './minigames/index'
import MCQChallenge       from './minigames/MCQChallenge.vue'
import DragSort           from './minigames/DragSort.vue'
import HotspotScene       from './minigames/HotspotScene.vue'
import MatchPairs         from './minigames/MatchPairs.vue'
import FillBlank          from './minigames/FillBlank.vue'
import TimerChallenge     from './minigames/TimerChallenge.vue'
import DialogueChoiceChallenge from './minigames/DialogueChoiceChallenge.vue'
import type { AnimationId } from './CharacterSprite.vue'

const props = defineProps<{
  challenge: Challenge
  /** Accent colour for the header rule (inherits from concept kind). */
  accentColor?: string
}>()

const emit = defineEmits<{
  complete: [correct: boolean]
  /** Forwarded from DialogueChoiceChallenge so parent can sync CharacterSprite. */
  emotion: [anim: AnimationId]
}>()
</script>

<template>
  <div class="challenge-panel">
    <div class="panel-inner">

      <!-- Header rule -->
      <div class="challenge-header">
        <div class="rule" :style="accentColor ? { background: `${accentColor}44` } : {}" />
        <span class="label">Challenge</span>
        <div class="rule" :style="accentColor ? { background: `${accentColor}44` } : {}" />
      </div>

      <!-- ── MCQ ──────────────────────────────────────────────────── -->
      <MCQChallenge
        v-if="challenge.type === 'mcq'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
      />

      <!-- ── Drag Sort ────────────────────────────────────────────── -->
      <DragSort
        v-else-if="challenge.type === 'drag-sort'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
      />

      <!-- ── Hotspot ──────────────────────────────────────────────── -->
      <HotspotScene
        v-else-if="challenge.type === 'hotspot'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
      />

      <!-- ── Match Pairs ──────────────────────────────────────────── -->
      <MatchPairs
        v-else-if="challenge.type === 'match-pairs'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
      />

      <!-- ── Fill Blank ───────────────────────────────────────────── -->
      <FillBlank
        v-else-if="challenge.type === 'fill-blank'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
      />

      <!-- ── Timer ────────────────────────────────────────────────── -->
      <TimerChallenge
        v-else-if="challenge.type === 'timer'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
      />

      <!-- ── Dialogue Choice ──────────────────────────────────────── -->
      <DialogueChoiceChallenge
        v-else-if="challenge.type === 'dialogue-choice'"
        :challenge="challenge"
        @complete="emit('complete', $event)"
        @emotion="emit('emotion', $event)"
      />

    </div>
  </div>
</template>

<style scoped>
.challenge-panel {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 40;
  max-height: 72dvh;
  overflow-y: auto;
  background: rgba(4, 6, 14, 0.94);
  border-top: 1px solid rgba(232, 236, 242, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  clip-path: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
}

.panel-inner {
  max-width: 620px;
  margin: 0 auto;
  padding: 22px 28px 36px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.challenge-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rule {
  flex: 1;
  height: 1px;
  background: var(--color-hairline-strong);
}
.label {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .panel-inner { padding: 18px 18px 28px; }
}
</style>
