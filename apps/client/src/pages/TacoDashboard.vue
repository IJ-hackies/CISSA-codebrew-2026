<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import ConstellationGlyph from '@/components/ConstellationGlyph.vue'
import { fetchGalaxyList, deleteGalaxy, type GalaxyRowSummary } from '@/lib/meshApi'

const router = useRouter()
const galaxies = ref<GalaxyRowSummary[]>([])
const loading = ref(true)
const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)

onMounted(async () => {
  try {
    galaxies.value = await fetchGalaxyList()
  } catch {
    // silently handle — empty state is fine
  } finally {
    loading.value = false
  }
})

function promptDelete(e: Event, id: string) {
  e.stopPropagation()
  confirmDeleteId.value = id
}

function cancelDelete() {
  confirmDeleteId.value = null
}

async function confirmDelete() {
  if (!confirmDeleteId.value || deleting.value) return
  deleting.value = true
  try {
    await deleteGalaxy(confirmDeleteId.value)
    galaxies.value = galaxies.value.filter((g) => g.id !== confirmDeleteId.value)
    confirmDeleteId.value = null
  } catch (err) {
    console.error('[taco] delete failed:', err)
  } finally {
    deleting.value = false
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusLabel(status: GalaxyRowSummary['status']): string {
  if (status === 'complete') return ''
  if (status === 'error') return 'Error'
  return 'Generating…'
}

function openGalaxy(g: GalaxyRowSummary) {
  router.push(`/galaxy/${g.id}/chat`)
}

const hasGalaxies = computed(() => galaxies.value.length > 0)
</script>

<template>
  <main class="taco-page">
    <!-- Background layers -->
    <div class="nebula nebula-1" />
    <div class="nebula nebula-2" />
    <div class="nebula nebula-3" />
    <div class="dot-grid" />
    <div class="noise" />
    <div class="vignette" />

    <!-- Header -->
    <header class="taco-header">
      <a href="/" class="logo-link" aria-label="Stella Taco">
        <img src="/logo.png" alt="Stella Taco" class="logo" />
        <span class="wordmark">STELLA&nbsp;TACO</span>
      </a>
      <button class="new-galaxy-btn" @click="router.push('/new')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        New Galaxy
      </button>
    </header>

    <!-- Hero quote -->
    <section class="hero-section">
      <p class="eyebrow">STELLA TACO</p>
      <h1 class="hero-quote">
        Upload your world.<br />
        Explore it as a <strong>galaxy</strong>.
      </h1>
      <p class="hero-sub">Journals, notes, PDFs, papers — drop anything. Your knowledge becomes a living 3D cosmos.</p>
    </section>

    <!-- Galaxy grid -->
    <section class="galaxies-section">
      <div v-if="loading" class="loading-row">
        <div class="loading-dot" />
        <div class="loading-dot" />
        <div class="loading-dot" />
      </div>

      <div v-else-if="!hasGalaxies" class="empty-state">
        <div class="empty-glyph">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.25">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 4"/>
            <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.5"/>
          </svg>
        </div>
        <p class="empty-label">No galaxies yet</p>
        <button class="empty-cta" @click="router.push('/new')">Create your first galaxy</button>
      </div>

      <div v-else class="galaxy-grid">
        <div
          v-for="g in galaxies"
          :key="g.id"
          class="galaxy-card constellation-card"
          @click="openGalaxy(g)"
        >
          <button
            class="card-delete-btn"
            @click.stop="promptDelete($event, g.id)"
            aria-label="Delete galaxy"
            title="Delete galaxy"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>

          <div class="card-glyph">
            <ConstellationGlyph :uuid="g.id" :size="72" />
          </div>
          <div class="card-body">
            <span class="card-title">{{ g.title }}</span>
            <span class="card-date">{{ formatDate(g.createdAt) }}</span>
            <span v-if="statusLabel(g.status)" class="card-status" :class="{ error: g.status === 'error' }">
              {{ statusLabel(g.status) }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Delete confirm dialog -->
    <Transition name="dialog-fade">
      <div v-if="confirmDeleteId" class="dialog-backdrop" @click.self="cancelDelete">
        <div class="dialog">
          <p class="dialog-title">Delete galaxy?</p>
          <p class="dialog-body">This cannot be undone. All planets, concepts, and stories will be permanently removed.</p>
          <div class="dialog-actions">
            <button class="dialog-btn cancel" @click="cancelDelete">Cancel</button>
            <button class="dialog-btn confirm" :disabled="deleting" @click="confirmDelete">
              {{ deleting ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.taco-page {
  position: relative;
  min-height: 100dvh;
  width: 100%;
  overflow-x: hidden;
  background: #02040a;
  color: var(--color-text-primary, #f5f0ea);
}

/* ── Background layers ──────────────────────────────────────────── */
.nebula {
  position: fixed;
  border-radius: 50%;
  filter: blur(110px);
  pointer-events: none;
  z-index: 0;
}
.nebula-1 {
  width: 600px; height: 600px;
  top: -140px; left: -120px;
  background: radial-gradient(circle, rgba(80, 120, 255, 0.13) 0%, transparent 65%);
  animation: nebula-drift 32s ease-in-out infinite alternate;
}
.nebula-2 {
  width: 500px; height: 500px;
  bottom: 10%; right: -100px;
  background: radial-gradient(circle, rgba(130, 80, 255, 0.10) 0%, transparent 65%);
  animation: nebula-drift 28s ease-in-out infinite alternate-reverse;
}
.nebula-3 {
  width: 400px; height: 400px;
  top: 40%; left: 40%;
  background: radial-gradient(circle, rgba(30, 160, 180, 0.08) 0%, transparent 65%);
  animation: nebula-drift 38s ease-in-out infinite alternate;
}
@keyframes nebula-drift {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(40px, 60px) scale(1.1); }
}

.dot-grid {
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.4) 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.4) 0%, transparent 70%);
}
.noise {
  position: fixed; inset: 0; z-index: 0;
  pointer-events: none;
  opacity: 0.022;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
.vignette {
  position: fixed; inset: 0; z-index: 0;
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(2,4,10,0.6) 100%);
  pointer-events: none;
}

/* ── Header ─────────────────────────────────────────────────────── */
.taco-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 40px;
}
.logo-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  opacity: 0.9;
  transition: opacity 200ms ease;
}
.logo-link:hover { opacity: 1; }
.logo { width: 110px; height: auto; display: block; user-select: none; }
.wordmark {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.78rem;
  font-weight: 500;
  letter-spacing: 0.28em;
  color: var(--color-text-primary, #f5f0ea);
  opacity: 0.8;
  user-select: none;
}
.new-galaxy-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 18px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #f5f0ea;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 100px;
  cursor: pointer;
  transition: background 200ms ease, border-color 200ms ease;
}
.new-galaxy-btn:hover {
  background: rgba(255,255,255,0.10);
  border-color: rgba(255,255,255,0.22);
}

/* ── Hero section ───────────────────────────────────────────────── */
.hero-section {
  position: relative;
  z-index: 5;
  text-align: center;
  padding: 56px 24px 52px;
  animation: heroIn 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes heroIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.eyebrow {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.32em;
  color: var(--color-accent, #ffb547);
  opacity: 0.75;
  margin: 0 0 20px;
}
.hero-quote {
  font-family: var(--font-body, serif);
  font-size: clamp(1.7rem, 4vw, 2.8rem);
  font-weight: 300;
  line-height: 1.22;
  letter-spacing: -0.02em;
  color: var(--color-text-primary, #f5f0ea);
  margin: 0 0 20px;
}
.hero-quote strong { font-weight: 600; color: #fff; }
.hero-sub {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.82rem;
  color: rgba(245, 240, 234, 0.62);
  margin: 0;
  max-width: 460px;
  margin-inline: auto;
  line-height: 1.55;
}

/* ── Galaxies section ───────────────────────────────────────────── */
.galaxies-section {
  position: relative;
  z-index: 5;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 40px 80px;
}

.loading-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 60px 0;
}
.loading-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  animation: dotPulse 1.4s ease-in-out infinite;
}
.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 0;
}
.empty-label {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.82rem;
  color: rgba(245,240,234,0.3);
  margin: 0;
}
.empty-cta {
  margin-top: 8px;
  height: 38px;
  padding: 0 20px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #f5f0ea;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 100px;
  cursor: pointer;
  transition: background 200ms, border-color 200ms;
}
.empty-cta:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); }

.galaxy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  animation: heroIn 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  animation-delay: 100ms;
}

.galaxy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 20px 22px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  cursor: pointer;
  text-align: center;
  transition: background 220ms ease, border-color 220ms ease, transform 220ms ease;
  color: inherit;
}
.galaxy-card:hover {
  background: rgba(255,255,255,0.055);
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-2px);
}

.card-delete-btn {
  position: absolute;
  top: 10px; right: 10px;
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.0);
  border: 1px solid transparent;
  border-radius: 50%;
  color: rgba(255,255,255,0.25);
  cursor: pointer;
  opacity: 0;
  transition: opacity 180ms ease, background 180ms ease, color 180ms ease, border-color 180ms ease;
}
.galaxy-card:hover .card-delete-btn {
  opacity: 1;
}
.card-delete-btn:hover {
  background: rgba(255, 80, 80, 0.12);
  border-color: rgba(255, 80, 80, 0.25);
  color: rgba(255, 120, 120, 0.9);
}

.card-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px; height: 80px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}
.card-title {
  font-family: var(--font-body, serif);
  font-size: 0.9rem;
  font-weight: 400;
  color: rgba(245,240,234,0.88);
  line-height: 1.3;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-date {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.65rem;
  color: rgba(245,240,234,0.35);
  letter-spacing: 0.04em;
}
.card-status {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--color-accent, #ffb547);
  opacity: 0.75;
}
.card-status.error { color: #ff6b6b; }

/* ── Delete confirm dialog ───────────────────────────────────────── */
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(2, 4, 10, 0.75);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.dialog {
  background: #0d1120;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 28px 28px 24px;
  max-width: 360px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dialog-title {
  font-family: var(--font-body, serif);
  font-size: 1rem;
  font-weight: 500;
  color: #f5f0ea;
  margin: 0;
}
.dialog-body {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.78rem;
  color: rgba(245,240,234,0.45);
  line-height: 1.5;
  margin: 0 0 6px;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialog-btn {
  height: 36px;
  padding: 0 18px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 100px;
  cursor: pointer;
  transition: background 180ms, border-color 180ms, color 180ms;
}
.dialog-btn.cancel {
  color: rgba(245,240,234,0.55);
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
}
.dialog-btn.cancel:hover {
  color: rgba(245,240,234,0.85);
  border-color: rgba(255,255,255,0.2);
}
.dialog-btn.confirm {
  color: #fff;
  background: rgba(200, 50, 50, 0.75);
  border: 1px solid rgba(220, 60, 60, 0.4);
}
.dialog-btn.confirm:hover:not(:disabled) {
  background: rgba(220, 60, 60, 0.9);
}
.dialog-btn.confirm:disabled {
  opacity: 0.5;
  cursor: default;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 180ms ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

/* ── Mobile ─────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .taco-header { padding: 18px 20px; }
  .wordmark { display: none; }
  .logo { width: 80px; }
  .hero-section { padding: 40px 20px 36px; }
  .galaxies-section { padding: 0 16px 60px; }
  .galaxy-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .galaxy-card { padding: 20px 14px 18px; }
  .card-glyph { width: 64px; height: 64px; }
  /* Always show delete button on touch devices */
  .card-delete-btn { opacity: 1; }
}
</style>
