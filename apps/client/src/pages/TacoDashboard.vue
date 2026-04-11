<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'
import ConstellationGlyph from '@/components/ConstellationGlyph.vue'
import { logout, currentUser } from '@/lib/auth'
import {
  deleteGalaxy,
  publishToTaco,
  unpublishFromTaco,
  updateTacoTagline,
  reconcileOwnership,
  isOwner,
  type GalaxyRowSummary,
  type GalleryCard,
  type GallerySortOrder,
} from '@/lib/meshApi'
import {
  galaxyList as galaxies,
  galaxyListLoading as myLoading,
  galleryCards,
  galleryCardsLoading as galleryLoading,
  galleryError,
  fetchGalaxyListCached,
  fetchGalleryCached,
  syncGalaxyListCache,
} from '@/lib/dataCache'

const router = useRouter()

// ── Tab state ──────────────────────────────────────────────────────
type Tab = 'mine' | 'taco'
const activeTab = ref<Tab>('mine')

// ── My Galaxies ────────────────────────────────────────────────────
const confirmDeleteId = ref<string | null>(null)
const deleting = ref(false)

// Publish modal state
const publishModalId = ref<string | null>(null)
const publishTagline = ref('')
const publishError = ref('')
const publishing = ref(false)
// Edit tagline modal
const editTaglineId = ref<string | null>(null)
const editTaglineValue = ref('')
const editTaglineError = ref('')
const editTaglineSaving = ref(false)

function openPublishModal(id: string) {
  const g = galaxies.value.find(x => x.id === id)
  if (!g) return
  publishModalId.value = id
  publishTagline.value = g.tagline ?? ''
  publishError.value = ''
}

function closePublishModal() {
  publishModalId.value = null
  publishTagline.value = ''
  publishError.value = ''
}

async function submitPublish() {
  if (!publishModalId.value || publishing.value) return
  if (!isOwner(publishModalId.value)) {
    publishError.value = 'This galaxy was created before sharing was enabled. Create a new galaxy to share it.'
    return
  }
  publishing.value = true
  publishError.value = ''
  try {
    await publishToTaco(publishModalId.value, publishTagline.value)
    // Update local state
    const g = galaxies.value.find(x => x.id === publishModalId.value)
    if (g) {
      g.isPublic = true
      g.tagline = publishTagline.value.trim()
    }
    syncGalaxyListCache()
    closePublishModal()
  } catch (err) {
    publishError.value = err instanceof Error ? err.message : 'Failed to publish'
  } finally {
    publishing.value = false
  }
}

const unpublishConfirmId = ref<string | null>(null)
const unpublishPhase = ref<'idle' | 'removing' | 'removed'>('idle')

function promptUnpublish(id: string) {
  unpublishConfirmId.value = id
  unpublishPhase.value = 'idle'
}

async function confirmUnpublish() {
  const id = unpublishConfirmId.value
  if (!id || unpublishPhase.value !== 'idle') return
  unpublishPhase.value = 'removing'
  try {
    await unpublishFromTaco(id)
    const g = galaxies.value.find(x => x.id === id)
    if (g) g.isPublic = false
    syncGalaxyListCache()
    unpublishPhase.value = 'removed'
    setTimeout(() => {
      unpublishConfirmId.value = null
      unpublishPhase.value = 'idle'
    }, 1200)
  } catch (err) {
    console.error('[taco] unpublish failed:', err)
    unpublishPhase.value = 'idle'
  }
}

function openEditTagline(id: string) {
  const g = galaxies.value.find(x => x.id === id)
  if (!g) return
  editTaglineId.value = id
  editTaglineValue.value = g.tagline ?? ''
  editTaglineError.value = ''
}

function closeEditTagline() {
  editTaglineId.value = null
  editTaglineValue.value = ''
  editTaglineError.value = ''
}

async function submitEditTagline() {
  if (!editTaglineId.value || editTaglineSaving.value) return
  editTaglineSaving.value = true
  editTaglineError.value = ''
  try {
    await updateTacoTagline(editTaglineId.value, editTaglineValue.value)
    const g = galaxies.value.find(x => x.id === editTaglineId.value)
    if (g) g.tagline = editTaglineValue.value.trim()
    syncGalaxyListCache()
    closeEditTagline()
  } catch (err) {
    editTaglineError.value = err instanceof Error ? err.message : 'Failed to update tagline'
  } finally {
    editTaglineSaving.value = false
  }
}

function promptDelete(e: Event, id: string) {
  e.stopPropagation()
  confirmDeleteId.value = id
}
function cancelDelete() { confirmDeleteId.value = null }
async function confirmDelete() {
  if (!confirmDeleteId.value || deleting.value) return
  deleting.value = true
  try {
    await deleteGalaxy(confirmDeleteId.value)
    galaxies.value = galaxies.value.filter(g => g.id !== confirmDeleteId.value)
    syncGalaxyListCache()
    confirmDeleteId.value = null
  } catch (err) {
    console.error('[taco] delete failed:', err)
  } finally {
    deleting.value = false
  }
}

function openGalaxy(g: GalaxyRowSummary) {
  router.push({ path: `/galaxy/${g.id}/chat`, state: { title: g.title } })
}

const logoutConfirm = ref(false)

function handleLogout() {
  logoutConfirm.value = true
}

function confirmLogout() {
  logoutConfirm.value = false
  logout()
  router.push('/login')
}

// ── The Taco ───────────────────────────────────────────────────────
const gallerySort = ref<GallerySortOrder>('newest')
const gallerySearch = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(gallerySort, () => fetchGalleryCached(gallerySort.value, gallerySearch.value).catch(() => {}))
watch(gallerySearch, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchGalleryCached(gallerySort.value, gallerySearch.value).catch(() => {}), 300)
})

function openTacoGalaxy(card: GalleryCard) {
  router.push(`/galaxy/${card.id}?source=taco`)
}

// ── Shared ─────────────────────────────────────────────────────────
onMounted(async () => {
  // Reconcile runs silently — keeps published galaxies alive in the Taco.
  reconcileOwnership().catch(() => {})
  // Cache may already have data (instant render); this refreshes in background.
  await fetchGalaxyListCached()
  fetchGalleryCached().catch(() => {})
})

watch(activeTab, (tab) => {
  if (tab === 'taco' && galleryCards.value.length === 0) fetchGalleryCached().catch(() => {})
})

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function statusLabel(status: GalaxyRowSummary['status']): string {
  if (status === 'complete') return ''
  if (status === 'error') return 'Error'
  return 'Generating…'
}
const hasGalaxies = computed(() => galaxies.value.length > 0)

// ── Custom sort dropdown ───────────────────────────────────────────
const sortOpen = ref(false)
const sortOptions: Array<{ value: GallerySortOrder; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'planets', label: 'Most planets' },
  { value: 'alpha', label: 'A → Z' },
]
const sortLabel = computed(() => sortOptions.find(o => o.value === gallerySort.value)?.label ?? 'Newest')

function selectSort(v: GallerySortOrder) {
  gallerySort.value = v
  sortOpen.value = false
}

function onSortClickOutside(e: MouseEvent) {
  const el = document.getElementById('sort-dropdown-root')
  if (el && !el.contains(e.target as Node)) sortOpen.value = false
}

watch(sortOpen, (open) => {
  if (open) document.addEventListener('mousedown', onSortClickOutside)
  else document.removeEventListener('mousedown', onSortClickOutside)
})

onUnmounted(() => document.removeEventListener('mousedown', onSortClickOutside))
</script>

<template>
  <main class="taco-page">
    <!-- Starfield canvas -->
    <GalaxyRenderer />
    <!-- Background layers -->
    <div class="nebula nebula-1" />
    <div class="nebula nebula-2" />
    <div class="nebula nebula-3" />
    <div class="dot-grid" />
    <div class="hero-glow" />
    <div class="noise" />
    <div class="vignette" />

    <!-- Scrollable content layer -->
    <div class="taco-scroll">

    <!-- Header -->
    <header class="taco-header">
      <a href="/" class="logo-link" aria-label="Stella Taco">
        <img src="/logo.png" alt="Stella Taco" class="logo" />
        <span class="wordmark">STELLA&nbsp;TACO</span>
      </a>
      <div class="header-actions">
        <button class="new-galaxy-btn" @click="router.push('/new')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="new-galaxy-label">New Galaxy</span>
        </button>
        <button v-if="currentUser" class="user-btn" @click="handleLogout" title="Sign out">
          <span class="user-avatar">{{ currentUser.username.slice(0,1).toUpperCase() }}</span>
          <span class="user-name">{{ currentUser.username }}</span>
          <svg class="user-logout-icon" width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero-section">
      <p class="eyebrow">STELLA TACO</p>
      <h1 class="hero-quote">
        Upload your world.<br />
        Explore it as a <strong>galaxy</strong>.
      </h1>
    </section>

    <!-- Tabs -->
    <div class="tabs-row">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'mine' }"
        @click="activeTab = 'mine'"
      >My Galaxies</button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'taco' }"
        @click="activeTab = 'taco'"
      >The Taco</button>
    </div>

    <!-- ── MY GALAXIES TAB ─────────────────────────────────────── -->
    <section v-if="activeTab === 'mine'" class="content-section">
      <div v-if="myLoading" class="loading-row">
        <div class="loading-dot" /><div class="loading-dot" /><div class="loading-dot" />
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
          class="galaxy-card"
          @click="openGalaxy(g)"
        >
          <!-- Delete btn -->
          <button class="card-delete-btn" @click.stop="promptDelete($event, g.id)" aria-label="Delete galaxy" title="Delete galaxy">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>

          <!-- Published badge -->
          <div v-if="g.isPublic" class="card-taco-badge" title="Published to The Taco">LIVE</div>

          <div class="card-glyph">
            <ConstellationGlyph :uuid="g.id" :size="72" />
          </div>
          <div class="card-body">
            <span class="card-title">{{ g.title }}</span>
            <span class="card-date">{{ formatDate(g.updatedAt) }}</span>
            <span v-if="statusLabel(g.status)" class="card-status" :class="{ error: g.status === 'error' }">
              {{ statusLabel(g.status) }}
            </span>
          </div>

          <!-- Taco actions (complete galaxies only) -->
          <div v-if="g.status === 'complete'" class="card-taco-actions" @click.stop>
            <template v-if="!g.isPublic">
              <button class="taco-action-btn publish" @click="openPublishModal(g.id)">
                Share to Taco
              </button>
            </template>
            <template v-else>
              <button class="taco-action-btn edit" @click="openEditTagline(g.id)">
                Edit tagline
              </button>
              <button class="taco-action-btn remove" @click="promptUnpublish(g.id)">
                Remove from Taco
              </button>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- ── THE TACO TAB ────────────────────────────────────────── -->
    <section v-else class="content-section">
      <!-- Toolbar -->
      <div class="gallery-toolbar">
        <div class="search-wrap">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.3"/>
            <path d="M9 9l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <input
            v-model="gallerySearch"
            class="search-input"
            type="text"
            placeholder="Search galaxies…"
            aria-label="Search galaxies"
          />
        </div>
        <div class="sort-dropdown" id="sort-dropdown-root">
          <button class="sort-trigger" @click="sortOpen = !sortOpen" :aria-expanded="sortOpen">
            {{ sortLabel }}
            <svg class="sort-chevron" :class="{ open: sortOpen }" width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <Transition name="sort-pop">
            <div v-if="sortOpen" class="sort-menu" role="listbox">
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                class="sort-option"
                :class="{ selected: gallerySort === opt.value }"
                role="option"
                :aria-selected="gallerySort === opt.value"
                @click="selectSort(opt.value)"
              >
                <svg v-if="gallerySort === opt.value" class="sort-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span v-else class="sort-check-placeholder" />
                {{ opt.label }}
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <div v-if="galleryLoading" class="loading-row">
        <div class="loading-dot" /><div class="loading-dot" /><div class="loading-dot" />
      </div>

      <div v-else-if="galleryError" class="empty-state">
        <p class="empty-label">{{ galleryError }}</p>
      </div>

      <div v-else-if="galleryCards.length === 0" class="empty-state">
        <div class="empty-glyph">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.25">
            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 4"/>
            <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.5"/>
          </svg>
        </div>
        <p class="empty-label">{{ gallerySearch ? 'No galaxies match your search' : 'No galaxies in The Taco yet' }}</p>
        <button v-if="!gallerySearch" class="empty-cta" @click="activeTab = 'mine'">
          Share one of yours
        </button>
      </div>

      <div v-else class="gallery-grid">
        <div
          v-for="card in galleryCards"
          :key="card.id"
          class="gallery-card"
          @click="openTacoGalaxy(card)"
        >
          <div class="gallery-card-glyph">
            <ConstellationGlyph :uuid="card.id" :size="56" />
          </div>
          <div class="gallery-card-body">
            <span class="gallery-card-title">{{ card.title }}</span>
            <span v-if="card.tagline" class="gallery-card-tagline">{{ card.tagline }}</span>
            <div class="gallery-card-meta">
              <span class="meta-chip">{{ card.solarSystemCount }} systems</span>
              <span class="meta-chip">{{ card.planetCount }} planets</span>
              <span class="meta-date">{{ formatDate(card.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Remove from Taco confirm ─────────────────────────── -->
    <Transition name="dialog-fade">
      <div v-if="unpublishConfirmId" class="dialog-backdrop" @click.self="unpublishPhase === 'idle' && (unpublishConfirmId = null)">
        <div class="dialog">
          <p class="dialog-title">
            {{ unpublishPhase === 'removed' ? 'Removed from The Taco' : 'Remove from The Taco?' }}
          </p>
          <p class="dialog-body">
            {{ unpublishPhase === 'removed'
              ? 'Your galaxy has been removed from the public gallery.'
              : 'This galaxy will no longer appear in the public gallery. You can re-publish it any time.' }}
          </p>
          <div v-if="unpublishPhase === 'idle'" class="dialog-actions">
            <button class="dialog-btn cancel" @click="unpublishConfirmId = null">Cancel</button>
            <button class="dialog-btn confirm" @click="confirmUnpublish">Remove</button>
          </div>
          <div v-else class="dialog-actions">
            <button class="dialog-btn cancel" disabled>
              {{ unpublishPhase === 'removing' ? 'Removing…' : 'Removed' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Delete dialog ──────────────────────────────────────── -->
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

    <!-- ── Publish modal ──────────────────────────────────────── -->
    <Transition name="dialog-fade">
      <div v-if="publishModalId" class="dialog-backdrop" @click.self="closePublishModal">
        <div class="dialog">
          <p class="dialog-title">Share to The Taco</p>
          <p class="dialog-body">Write a short tagline so others know what to expect.</p>
          <textarea
            v-model="publishTagline"
            class="tagline-input"
            placeholder="A journey through machine learning fundamentals…"
            maxlength="280"
            rows="3"
            @keydown.enter.ctrl="submitPublish"
          />
          <p class="tagline-count">{{ publishTagline.length }}/280</p>
          <p v-if="publishError" class="dialog-error">{{ publishError }}</p>
          <div class="dialog-actions">
            <button class="dialog-btn cancel" @click="closePublishModal">Cancel</button>
            <button
              class="dialog-btn publish"
              :disabled="publishing || !publishTagline.trim()"
              @click="submitPublish"
            >
              {{ publishing ? 'Publishing…' : 'Publish' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Sign out confirm ──────────────────────────────────── -->
    <Transition name="dialog-fade">
      <div v-if="logoutConfirm" class="dialog-backdrop" @click.self="logoutConfirm = false">
        <div class="dialog">
          <p class="dialog-title">Sign out?</p>
          <p class="dialog-body">You'll be returned to the login screen.</p>
          <div class="dialog-actions">
            <button class="dialog-btn cancel" @click="logoutConfirm = false">Cancel</button>
            <button class="dialog-btn confirm" @click="confirmLogout">Sign out</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Edit tagline modal ─────────────────────────────────── -->
    <Transition name="dialog-fade">
      <div v-if="editTaglineId" class="dialog-backdrop" @click.self="closeEditTagline">
        <div class="dialog">
          <p class="dialog-title">Edit tagline</p>
          <textarea
            v-model="editTaglineValue"
            class="tagline-input"
            placeholder="A journey through…"
            maxlength="280"
            rows="3"
            @keydown.enter.ctrl="submitEditTagline"
          />
          <p class="tagline-count">{{ editTaglineValue.length }}/280</p>
          <p v-if="editTaglineError" class="dialog-error">{{ editTaglineError }}</p>
          <div class="dialog-actions">
            <button class="dialog-btn cancel" @click="closeEditTagline">Cancel</button>
            <button
              class="dialog-btn publish"
              :disabled="editTaglineSaving || !editTaglineValue.trim()"
              @click="submitEditTagline"
            >
              {{ editTaglineSaving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    </div> <!-- /taco-scroll -->
  </main>
</template>

<style scoped>
.taco-page {
  position: fixed;
  inset: 0;
  background: #02040a;
  color: var(--color-text-primary, #f5f0ea);
  overflow: hidden;
}

/* Inner scroll container — only this moves, background stays still */
.taco-scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: none;
  z-index: 5;
}

/* ── Background ─────────────────────────────────────────────────── */
.nebula {
  position: fixed;
  border-radius: 50%;
  filter: blur(110px);
  pointer-events: none;
  z-index: 1;
  will-change: transform;
  transform: translateZ(0);
}
.nebula-1 {
  width: 600px; height: 600px;
  top: -140px; left: -120px;
  background: radial-gradient(circle, rgba(80, 120, 255, 0.18) 0%, transparent 65%);
  animation: nebula-1 32s ease-in-out infinite alternate;
}
.nebula-2 {
  width: 520px; height: 520px;
  bottom: -100px; right: -100px;
  background: radial-gradient(circle, rgba(130, 80, 255, 0.15) 0%, transparent 65%);
  animation: nebula-2 28s ease-in-out infinite alternate;
}
.nebula-3 {
  width: 440px; height: 440px;
  top: 40%; left: 55%;
  background: radial-gradient(circle, rgba(30, 160, 180, 0.12) 0%, transparent 65%);
  animation: nebula-3 38s ease-in-out infinite alternate;
}
@keyframes nebula-1 {
  0%   { transform: translate(0, 0)       scale(1);    opacity: 1; }
  40%  { transform: translate(30px, 40px) scale(1.15); opacity: 0.75; }
  100% { transform: translate(60px, 80px) scale(0.92); opacity: 0.9; }
}
@keyframes nebula-2 {
  0%   { transform: translate(0, 0)         scale(1.05); opacity: 0.8; }
  50%  { transform: translate(-25px, -30px) scale(0.88); opacity: 1; }
  100% { transform: translate(-50px, -60px) scale(1.12); opacity: 0.75; }
}
@keyframes nebula-3 {
  0%   { transform: translate(0, 0)       scale(0.92); opacity: 1; }
  45%  { transform: translate(-20px, 25px) scale(1.2);  opacity: 0.8; }
  100% { transform: translate(15px, -20px) scale(1.0);  opacity: 0.9; }
}
.dot-grid {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
}
.hero-glow {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse 90% 70% at 50% 50%, rgba(255, 181, 71, 0.04) 0%, transparent 100%);
}
.noise {
  position: fixed; inset: 0; z-index: 3;
  pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
}
.vignette {
  position: fixed; inset: 0; z-index: 2;
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(2, 4, 10, 0.65) 100%);
  pointer-events: none;
}

/* ── Header ─────────────────────────────────────────────────────── */
.taco-header { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 28px 40px; }
.logo-link { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; opacity: 0.9; transition: opacity 200ms ease; }
.logo-link:hover { opacity: 1; }
.logo { width: 110px; height: auto; display: block; user-select: none; }
.wordmark { font-family: var(--font-ui, sans-serif); font-size: 0.78rem; font-weight: 500; letter-spacing: 0.28em; color: var(--color-text-primary, #f5f0ea); opacity: 0.8; user-select: none; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.new-galaxy-btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 18px; font-family: var(--font-ui, sans-serif); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; color: #f5f0ea; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 100px; cursor: pointer; transition: background 200ms, border-color 200ms; }
.new-galaxy-btn:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); }

/* User pill — combines username + sign-out into one control */
.user-btn {
  display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 14px 0 6px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 100px;
  cursor: pointer;
  transition: background 200ms, border-color 200ms;
}
.user-btn:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); }
.user-btn:hover .user-logout-icon { opacity: 1; }
.user-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: rgba(255,181,71,0.18);
  border: 1px solid rgba(255,181,71,0.3);
  color: rgba(255,181,71,0.95);
  font-family: var(--font-ui, sans-serif);
  font-size: 0.68rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0;
  line-height: 1;
  text-align: center;
}
.user-name {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.75rem; font-weight: 500;
  color: rgba(245,240,234,0.85);
  letter-spacing: 0.02em;
}
.user-logout-icon {
  color: rgba(245,240,234,0.45);
  opacity: 0;
  transition: opacity 200ms;
  flex-shrink: 0;
}

@media (max-width: 600px) {
  .taco-header { padding: 16px 18px; }
  .logo { width: 80px; }
  .wordmark { display: none; }
  .new-galaxy-btn { width: 38px; height: 38px; padding: 0; justify-content: center; }
  .new-galaxy-label { display: none; }
  .user-btn { padding: 0; width: 38px; height: 38px; gap: 0; justify-content: center; align-items: center; }
  .user-avatar { width: 28px; height: 28px; font-size: 0.72rem; }
  .user-name, .user-logout-icon { display: none; }
}

/* ── Hero ───────────────────────────────────────────────────────── */
.hero-section { position: relative; z-index: 5; text-align: center; padding: 40px 24px 24px; animation: heroIn 900ms cubic-bezier(0.2,0.7,0.2,1) both; }
@keyframes heroIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.eyebrow { font-family: var(--font-ui, sans-serif); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.32em; color: var(--color-accent, #ffb547); opacity: 0.75; margin: 0 0 16px; }
.hero-quote { font-family: var(--font-body, serif); font-size: clamp(1.5rem, 3.5vw, 2.4rem); font-weight: 300; line-height: 1.22; letter-spacing: -0.02em; color: var(--color-text-primary, #f5f0ea); margin: 0; }
.hero-quote strong { font-weight: 600; color: #fff; }

/* ── Tabs ───────────────────────────────────────────────────────── */
.tabs-row {
  position: relative; z-index: 5;
  display: flex; align-items: stretch;
  max-width: 1100px; margin: 32px auto 0; padding: 0 40px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.tab-btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  height: 48px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.92rem; font-weight: 500; letter-spacing: 0.03em;
  color: rgba(245,240,234,0.4);
  background: transparent; border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 180ms, border-color 180ms;
}
.tab-btn:hover { color: rgba(245,240,234,0.7); }
.tab-btn.active { color: #f5f0ea; border-bottom-color: rgba(255,181,71,0.7); }

/* ── Content section ────────────────────────────────────────────── */
.content-section { position: relative; z-index: 5; max-width: 1100px; margin: 0 auto; padding: 32px 40px 80px; }

/* ── Loading / empty ────────────────────────────────────────────── */
.loading-row { display: flex; justify-content: center; gap: 10px; padding: 60px 0; }
.loading-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,181,71,0.9); animation: dotPulse 1.4s ease-in-out infinite; }
.loading-dot:nth-child(2) { animation-delay: 0.2s; }
.loading-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotPulse { 0%,80%,100% { opacity:0.25; transform:scale(0.7); } 40% { opacity:1; transform:scale(1.2); } }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 0; }
.empty-label { font-family: var(--font-ui, sans-serif); font-size: 0.82rem; color: rgba(245,240,234,0.3); margin: 0; }
.empty-cta { margin-top: 8px; height: 38px; padding: 0 20px; font-family: var(--font-ui, sans-serif); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.05em; color: #f5f0ea; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 100px; cursor: pointer; transition: background 200ms, border-color 200ms; }
.empty-cta:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); }

/* ── My Galaxies grid ───────────────────────────────────────────── */
.galaxy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; animation: heroIn 700ms cubic-bezier(0.2,0.7,0.2,1) both; animation-delay: 100ms; }

.galaxy-card {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 28px 20px 18px;
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.20); border-radius: 16px;
  cursor: pointer; text-align: center;
  transition: background 220ms, border-color 220ms, transform 220ms;
}
.galaxy-card:hover { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.32); transform: translateY(-2px); }

.card-delete-btn { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid transparent; border-radius: 50%; color: rgba(255,255,255,0.25); cursor: pointer; opacity: 0; transition: opacity 180ms, background 180ms, color 180ms, border-color 180ms; }
.galaxy-card:hover .card-delete-btn { opacity: 1; }
.card-delete-btn:hover { background: rgba(255,80,80,0.12); border-color: rgba(255,80,80,0.25); color: rgba(255,120,120,0.9); }

.card-taco-badge {
  position: absolute; top: 10px; left: 10px;
  display: inline-flex; align-items: center; gap: 5px;
  height: 18px; padding: 0 8px 0 6px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.55rem; font-weight: 700; letter-spacing: 0.1em;
  line-height: 1;
  color: rgba(255,181,71,0.9);
  background: rgba(255,181,71,0.08);
  border: 1px solid rgba(255,181,71,0.18);
  border-radius: 100px;
}
.card-taco-badge::before {
  content: '';
  display: block;
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(255,181,71,0.9);
  box-shadow: 0 0 4px rgba(255,181,71,0.6);
  flex-shrink: 0;
}

.card-glyph { display: flex; align-items: center; justify-content: center; width: 80px; height: 80px; }
.card-body { display: flex; flex-direction: column; gap: 4px; align-items: center; }
.card-title { font-family: var(--font-body, serif); font-size: 0.9rem; font-weight: 400; color: rgba(245,240,234,0.88); line-height: 1.3; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-date { font-family: var(--font-ui, sans-serif); font-size: 0.65rem; color: rgba(245,240,234,0.35); letter-spacing: 0.04em; }
.card-status { font-family: var(--font-ui, sans-serif); font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em; color: var(--color-accent, #ffb547); opacity: 0.75; }
.card-status.error { color: #ff6b6b; }

.card-taco-actions {
  display: flex; flex-direction: column; gap: 5px; width: 100%;
  opacity: 0; transition: opacity 180ms;
}
.galaxy-card:hover .card-taco-actions { opacity: 1; }

.taco-action-btn {
  width: 100%; height: 28px;
  font-family: var(--font-ui, sans-serif); font-size: 0.65rem; font-weight: 600; letter-spacing: 0.04em;
  border-radius: 8px; cursor: pointer;
  transition: background 180ms, border-color 180ms, color 180ms;
}
.taco-action-btn.publish { color: #f5f0ea; background: rgba(255,181,71,0.12); border: 1px solid rgba(255,181,71,0.25); }
.taco-action-btn.publish:hover { background: rgba(255,181,71,0.22); border-color: rgba(255,181,71,0.45); }
.taco-action-btn.edit { color: rgba(245,240,234,0.7); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
.taco-action-btn.edit:hover { background: rgba(255,255,255,0.08); }
.taco-action-btn.remove { color: rgba(255,120,120,0.7); background: transparent; border: 1px solid rgba(255,80,80,0.15); }
.taco-action-btn.remove:hover { background: rgba(255,80,80,0.08); border-color: rgba(255,80,80,0.3); }

/* ── Gallery toolbar ────────────────────────────────────────────── */
.gallery-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }

.search-wrap {
  flex: 1; min-width: 180px;
  position: relative; display: flex; align-items: center;
}
.search-icon { position: absolute; left: 11px; color: rgba(245,240,234,0.55); pointer-events: none; }
.search-input {
  width: 100%; height: 38px;
  padding: 0 14px 0 34px;
  font-family: var(--font-ui, sans-serif); font-size: 0.78rem;
  color: #f5f0ea; background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.26); border-radius: 10px;
  outline: none; transition: border-color 180ms, background 180ms;
}
.search-input::placeholder { color: rgba(245,240,234,0.45); }
.search-input:focus { background: rgba(255,255,255,0.20); border-color: rgba(255,255,255,0.42); }

/* ── Custom sort dropdown ───────────────────────────────────────── */
.sort-dropdown { position: relative; flex-shrink: 0; }

.sort-trigger {
  display: inline-flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 14px;
  font-family: var(--font-ui, sans-serif); font-size: 0.75rem; font-weight: 500;
  color: rgba(245,240,234,0.92);
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.26); border-radius: 10px;
  cursor: pointer; white-space: nowrap;
  transition: background 160ms, border-color 160ms, color 160ms;
}
.sort-trigger:hover { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.38); color: #f5f0ea; }

.sort-chevron { flex-shrink: 0; color: rgba(245,240,234,0.65); transition: transform 180ms ease; }
.sort-chevron.open { transform: rotate(180deg); }

.sort-menu {
  position: absolute; top: calc(100% + 6px); right: 0;
  min-width: 148px;
  background: #0e1322;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 10px;
  padding: 4px;
  z-index: 50;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.sort-option {
  display: flex; align-items: center; gap: 8px;
  width: 100%; height: 34px; padding: 0 10px;
  font-family: var(--font-ui, sans-serif); font-size: 0.76rem; font-weight: 400;
  color: rgba(245,240,234,0.65);
  background: transparent; border: none; border-radius: 7px;
  cursor: pointer; text-align: left;
  transition: background 130ms, color 130ms;
}
.sort-option:hover { background: rgba(255,255,255,0.07); color: #f5f0ea; }
.sort-option.selected { color: #f5f0ea; font-weight: 500; }

.sort-check { flex-shrink: 0; color: rgba(255,181,71,0.85); }
.sort-check-placeholder { display: inline-block; width: 12px; flex-shrink: 0; }

.sort-pop-enter-active { transition: opacity 130ms ease, transform 130ms ease; }
.sort-pop-leave-active { transition: opacity 100ms ease, transform 100ms ease; }
.sort-pop-enter-from, .sort-pop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.97); }

/* ── Gallery grid ───────────────────────────────────────────────── */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  animation: heroIn 500ms cubic-bezier(0.2,0.7,0.2,1) both;
}

.gallery-card {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 20px 18px;
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.20); border-radius: 14px;
  cursor: pointer;
  transition: background 200ms, border-color 200ms, transform 200ms;
}
.gallery-card:hover { background: rgba(255,255,255,0.22); border-color: rgba(255,255,255,0.32); transform: translateY(-2px); }

.gallery-card-glyph { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; }
.gallery-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.gallery-card-title { font-family: var(--font-body, serif); font-size: 0.9rem; font-weight: 500; color: rgba(245,240,234,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gallery-card-tagline { font-family: var(--font-ui, sans-serif); font-size: 0.73rem; color: rgba(245,240,234,0.5); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gallery-card-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.meta-chip { font-family: var(--font-ui, sans-serif); font-size: 0.62rem; font-weight: 600; letter-spacing: 0.04em; color: rgba(245,240,234,0.35); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 100px; padding: 2px 8px; }
.meta-date { font-family: var(--font-ui, sans-serif); font-size: 0.62rem; color: rgba(245,240,234,0.25); margin-left: auto; }

/* ── Dialogs ────────────────────────────────────────────────────── */
.dialog-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(2,4,10,0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog { background: #0d1120; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px 28px 24px; max-width: 380px; width: 100%; display: flex; flex-direction: column; gap: 10px; }
.dialog-title { font-family: var(--font-body, serif); font-size: 1rem; font-weight: 500; color: #f5f0ea; margin: 0; }
.dialog-body { font-family: var(--font-ui, sans-serif); font-size: 0.78rem; color: rgba(245,240,234,0.45); line-height: 1.5; margin: 0; }
.dialog-error { font-family: var(--font-ui, sans-serif); font-size: 0.72rem; color: #ff8a8a; margin: 0; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.dialog-btn { height: 36px; padding: 0 18px; font-family: var(--font-ui, sans-serif); font-size: 0.72rem; font-weight: 600; border-radius: 100px; cursor: pointer; transition: background 180ms, border-color 180ms, color 180ms; }
.dialog-btn.cancel { color: rgba(245,240,234,0.55); background: transparent; border: 1px solid rgba(255,255,255,0.1); }
.dialog-btn.cancel:hover { color: rgba(245,240,234,0.85); border-color: rgba(255,255,255,0.2); }
.dialog-btn.publish { color: #fff; background: rgba(255,181,71,0.2); border: 1px solid rgba(255,181,71,0.4); }
.dialog-btn.publish:hover:not(:disabled) { background: rgba(255,181,71,0.35); }
.dialog-btn.publish:disabled { opacity: 0.4; cursor: default; }
.dialog-btn.confirm { color: #fff; background: rgba(200,50,50,0.75); border: 1px solid rgba(220,60,60,0.4); }
.dialog-btn.confirm:hover:not(:disabled) { background: rgba(220,60,60,0.9); }
.dialog-btn.confirm:disabled { opacity: 0.5; cursor: default; }

.tagline-input {
  width: 100%; padding: 10px 12px;
  font-family: var(--font-ui, sans-serif); font-size: 0.8rem; line-height: 1.5;
  color: #f5f0ea; background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
  resize: none; outline: none; transition: border-color 180ms;
  box-sizing: border-box;
}
.tagline-input:focus { border-color: rgba(255,255,255,0.25); }
.tagline-input::placeholder { color: rgba(245,240,234,0.3); }
.tagline-count { font-family: var(--font-ui, sans-serif); font-size: 0.65rem; color: rgba(245,240,234,0.25); text-align: right; margin: -4px 0 0; }

/* ── Transitions ────────────────────────────────────────────────── */
.dialog-fade-enter-active, .dialog-fade-leave-active { transition: opacity 180ms ease; }
.dialog-fade-enter-from, .dialog-fade-leave-to { opacity: 0; }

/* ── Mobile ─────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .taco-header { padding: 18px 20px; }
  .wordmark { display: none; }
  .logo { width: 80px; }
  .hero-section { padding: 28px 20px 16px; }
  .tabs-row { padding: 0 16px; margin-top: 24px; }
  .content-section { padding: 24px 16px 60px; }
  .galaxy-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .galaxy-card { padding: 20px 14px 16px; }
  .card-glyph { width: 64px; height: 64px; }
  .card-delete-btn { opacity: 1; }
  .card-taco-actions { opacity: 1; }
  .gallery-grid { grid-template-columns: 1fr; }
  .gallery-toolbar { flex-direction: column; align-items: stretch; }
  .sort-dropdown { width: 100%; }
  .sort-trigger { width: 100%; justify-content: space-between; }
  .sort-menu { left: 0; right: 0; min-width: unset; }
}
</style>
