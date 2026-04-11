<template>
  <Teleport to="body">
    <Transition name="wrap-appear">
      <div v-if="wrap" class="wrap-overlay" @click.self="$emit('close')">
        <div
          class="wrap-card"
          :style="{ '--accent': wrap?.color ?? '#7c9ef8', '--accent-dim': (wrap?.color ?? '#7c9ef8') + '22' }"
        >
          <!-- Close -->
          <button class="close-btn" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>

          <!-- Scrollable body -->
          <div class="card-scroll">
            <!-- Kind tag -->
            <div class="kind-tag">{{ entry?.kind }}</div>

            <!-- Headline -->
            <h1 class="headline">{{ wrap?.headline }}</h1>

            <!-- Mood chip -->
            <div class="mood-row">
              <span class="mood-chip" :style="{ background: (wrap?.color ?? '#7c9ef8') + '22', color: wrap?.color ?? '#7c9ef8' }">
                {{ wrap?.mood }}
              </span>
            </div>

            <!-- Summary -->
            <p class="summary">{{ wrap?.summary }}</p>

            <!-- Stats row -->
            <div v-if="wrap?.stats?.length" class="stats-row">
              <div v-for="stat in wrap.stats" :key="stat.label" class="stat-chip">
                <span class="stat-value">{{ stat.value }}</span>
                <span class="stat-label">{{ stat.label }}</span>
              </div>
            </div>

            <!-- Body (entry only) -->
            <div v-if="entryWrap?.body" class="section">
              <div class="section-label">About</div>
              <p class="body-text">{{ entryWrap.body }}</p>
            </div>

            <!-- Highlights -->
            <div v-if="wrap?.highlights?.length" class="section">
              <div class="section-label">Highlights</div>
              <ul class="highlights-list">
                <li v-for="(h, i) in wrap.highlights" :key="i" class="highlight-item">
                  <span class="highlight-marker" />
                  {{ h }}
                </li>
              </ul>
            </div>

            <!-- Key facts (entry only) -->
            <div v-if="entryWrap?.keyFacts?.length" class="section">
              <div class="section-label">Key facts</div>
              <div class="facts-grid">
                <div v-for="fact in entryWrap.keyFacts" :key="fact.label" class="fact-row">
                  <span class="fact-label">{{ fact.label }}</span>
                  <span class="fact-value">{{ fact.value }}</span>
                </div>
              </div>
            </div>

            <!-- Connections -->
            <div v-if="entryWrap?.connections?.length" class="section">
              <div class="section-label">Connections</div>
              <div class="connections-list">
                <div
                  v-for="conn in entryWrap.connections"
                  :key="conn.targetId"
                  class="connection-item"
                >
                  <span class="conn-dot" :style="{ background: targetColor(conn.targetId) }" />
                  <div class="conn-content">
                    <span class="conn-name">{{ targetTitle(conn.targetId) }}</span>
                    <span class="conn-reason">{{ conn.reason }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Source derivatives -->
            <div v-if="wrap?.derivatives?.length" class="section">
              <div class="section-label">Sources</div>
              <div class="derivatives-list">
                <blockquote
                  v-for="(d, i) in wrap.derivatives"
                  :key="i"
                  class="derivative"
                >
                  "{{ d.quote }}"
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Entry, EntryWrap, WrapsScope } from '@/lib/galaxyTypes'

const props = defineProps<{
  wrap: EntryWrap | null
  entry: Entry | null
  allWraps: WrapsScope
  allEntries: Entry[]
}>()

defineEmits<{ close: [] }>()

const entryWrap = computed(() => props.wrap)

function targetTitle(id: string): string {
  const entry = props.allEntries.find((e) => e.id === id)
  if (entry) return entry.title
  const w = props.allWraps[id]
  return w?.headline ?? id
}

function targetColor(id: string): string {
  const w = props.allWraps[id]
  return w?.color ?? '#4a5568'
}
</script>

<style scoped>
.wrap-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 4, 10, 0.72);
  backdrop-filter: blur(20px) saturate(0.8);
  padding: 24px;
}

.wrap-card {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: 82vh;
  background: rgba(6, 9, 22, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 20px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03),
    0 24px 80px rgba(0, 0, 0, 0.6),
    0 0 60px color-mix(in srgb, var(--accent) 12%, transparent);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 50%;
  color: #6f7989;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.close-btn:hover {
  color: #e8ecf2;
  background: rgba(255, 255, 255, 0.08);
}

.card-scroll {
  overflow-y: auto;
  padding: 36px 32px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.08) transparent;
}

.card-scroll::-webkit-scrollbar { width: 4px; }
.card-scroll::-webkit-scrollbar-track { background: transparent; }
.card-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

/* Kind tag */
.kind-tag {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent);
  opacity: 0.7;
}

/* Headline */
.headline {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #f0f4ff;
  line-height: 1.2;
  margin: 0;
  letter-spacing: -0.01em;
}

/* Mood */
.mood-row { display: flex; }
.mood-chip {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 100px;
}

/* Summary */
.summary {
  font-family: 'Nunito', sans-serif;
  font-size: 14px;
  color: #9aa5b8;
  line-height: 1.7;
  margin: 0;
}

/* Stats */
.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stat-chip {
  display: flex;
  flex-direction: column;
  padding: 10px 16px;
  background: var(--accent-dim);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-radius: 12px;
  min-width: 72px;
}

.stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1.1;
}

.stat-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 3px;
}

/* Sections */
.section { display: flex; flex-direction: column; gap: 10px; }

.section-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #3a4558;
  font-weight: 600;
}

/* Body */
.body-text {
  font-family: 'Nunito', sans-serif;
  font-size: 14px;
  color: #8a96ab;
  line-height: 1.75;
  margin: 0;
}

/* Highlights */
.highlights-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-family: 'Nunito', sans-serif;
  font-size: 13px;
  color: #8a96ab;
  line-height: 1.55;
}

.highlight-marker {
  flex-shrink: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.6;
  margin-top: 6px;
}

/* Key facts */
.facts-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
}

.fact-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
}

.fact-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  color: #3a4558;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.fact-value {
  font-family: 'Nunito', sans-serif;
  font-size: 13px;
  color: #9aa5b8;
  text-align: right;
}

/* Connections */
.connections-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.connection-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.conn-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  opacity: 0.8;
}

.conn-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.conn-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #c8d4e8;
}

.conn-reason {
  font-family: 'Nunito', sans-serif;
  font-size: 12px;
  color: #4a5568;
  line-height: 1.4;
}

/* Derivatives */
.derivatives-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.derivative {
  margin: 0;
  padding: 12px 16px;
  border-left: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
  font-family: 'Nunito', sans-serif;
  font-size: 12px;
  color: #4a5568;
  font-style: italic;
  line-height: 1.6;
  background: rgba(255, 255, 255, 0.015);
  border-radius: 0 8px 8px 0;
}

/* Transition */
.wrap-appear-enter-active {
  transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wrap-appear-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.wrap-appear-enter-from {
  opacity: 0;
  transform: scale(0.94);
}
.wrap-appear-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
