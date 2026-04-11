<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '@/lib/auth'
import GalaxyRenderer from '@/components/GalaxyRenderer.vue'

const router = useRouter()
const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'register') {
      await register(username.value, password.value)
    } else {
      await login(username.value, password.value)
    }
    router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}

function toggle() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  error.value = ''
}
</script>

<template>
  <div class="login-page">
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
    <div class="login-scroll">

    <!-- Header -->
    <header class="login-header">
      <a href="/" class="logo-link" aria-label="Stella Taco">
        <img src="/logo.png" alt="Stella Taco" class="logo" />
        <span class="wordmark">STELLA&nbsp;TACO</span>
      </a>
    </header>

    <div class="login-body">
    <!-- Hero -->
    <div class="login-hero">
      <p class="hero-eyebrow">STELLA TACO</p>
      <h1 class="hero-headline">
        Upload your world.<br />Explore it as a <em>galaxy</em>.
      </h1>
      <p class="hero-sub">
        Drop your notes, PDFs, journals — anything.
        The Taco turns them into a cosmos you can wander.
      </p>
    </div>

    <!-- Card -->
    <div class="login-center">
      <div class="login-card">
        <!-- Eyebrow -->
        <p class="card-eyebrow">{{ mode === 'login' ? 'WELCOME BACK' : 'JOIN THE COSMOS' }}</p>

        <h1 class="card-title">{{ mode === 'login' ? 'Sign in' : 'Create account' }}</h1>

        <form @submit.prevent="submit" class="login-form">
          <div class="field">
            <label class="field-label" for="username">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="your_username"
              autocomplete="username"
              required
              class="field-input"
            />
          </div>

          <div class="field">
            <label class="field-label" for="password">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="current-password"
              required
              class="field-input"
            />
          </div>

          <Transition name="err">
            <p v-if="error" class="error-msg">{{ error }}</p>
          </Transition>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="btn-loading">
              <span class="btn-dot" /><span class="btn-dot" /><span class="btn-dot" />
            </span>
            <span v-else>{{ mode === 'login' ? 'Sign in' : 'Create account' }}</span>
          </button>
        </form>

        <div class="divider"><span>or</span></div>

        <p class="toggle-link" @click="toggle">
          {{ mode === 'login' ? "Don't have an account?" : 'Already have an account?' }}
          <span class="toggle-action">{{ mode === 'login' ? 'Sign up' : 'Sign in' }}</span>
        </p>
      </div>
    </div>
    </div> <!-- /login-body -->

    </div> <!-- /login-scroll -->
  </div>
</template>

<style scoped>
/* ── Page ──────────────────────────────────────────────────────────── */
.login-page {
  position: fixed;
  inset: 0;
  background: #02040a;
  color: var(--color-text-primary, #f5f0ea);
  overflow: hidden;
}

.login-scroll {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: none;
  display: flex;
  flex-direction: column;
  z-index: 5;
}

/* ── Background layers ─────────────────────────────────────────────── */
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
  0%   { transform: translate(0, 0)        scale(0.92); opacity: 1; }
  45%  { transform: translate(-20px, 25px) scale(1.2);  opacity: 0.8; }
  100% { transform: translate(15px, -20px) scale(1.0);  opacity: 0.9; }
}

.dot-grid {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background-image: radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.5) 0%, transparent 75%);
}
.hero-glow {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background: radial-gradient(ellipse 70% 55% at 50% 50%, rgba(80,120,255,0.06) 0%, transparent 100%);
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
  background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(2,4,10,0.65) 100%);
  pointer-events: none;
}

/* ── Header ────────────────────────────────────────────────────────── */
.login-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
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

/* ── Body layout — two-column on desktop, stacked on mobile ────────── */
.login-body {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 64px;
  padding: 24px 60px 72px;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}

/* ── Hero text ─────────────────────────────────────────────────────── */
.login-hero {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: heroIn 700ms cubic-bezier(0.2,0.7,0.2,1) both;
}
@keyframes heroIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.hero-eyebrow {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.3em;
  color: var(--color-accent, #ffb547);
  opacity: 0.8;
  margin: 0;
}
.hero-headline {
  font-family: var(--font-body, serif);
  font-size: clamp(2rem, 4.5vw, 3.4rem);
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.025em;
  color: var(--color-text-primary, #f5f0ea);
  margin: 0;
}
.hero-headline em {
  font-style: normal;
  font-weight: 600;
  color: #fff;
}
.hero-sub {
  font-family: var(--font-ui, sans-serif);
  font-size: clamp(0.85rem, 1.6vw, 1rem);
  line-height: 1.65;
  color: rgba(245,240,234,0.45);
  margin: 0;
  max-width: 380px;
}

/* ── Center layout ─────────────────────────────────────────────────── */
.login-center {
  flex-shrink: 0;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
}

/* ── Card ──────────────────────────────────────────────────────────── */
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 36px 32px 32px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 20px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 24px 64px rgba(0,0,0,0.4),
    0 0 80px rgba(80,120,255,0.05);
  animation: cardIn 600ms cubic-bezier(0.2,0.7,0.2,1) both;
}
@keyframes cardIn {
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

.card-eyebrow {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  color: var(--color-accent, #ffb547);
  opacity: 0.75;
  margin: 0 0 10px;
}
.card-title {
  font-family: var(--font-body, serif);
  font-size: 1.55rem;
  font-weight: 300;
  letter-spacing: -0.02em;
  color: var(--color-text-primary, #f5f0ea);
  margin: 0 0 28px;
  line-height: 1.2;
}

/* ── Form ──────────────────────────────────────────────────────────── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(245,240,234,0.45);
}
.field-input {
  height: 44px;
  padding: 0 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  color: var(--color-text-primary, #f5f0ea);
  font-family: var(--font-ui, sans-serif);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 180ms, background 180ms, box-shadow 180ms;
}
.field-input::placeholder {
  color: rgba(245,240,234,0.22);
}
.field-input:hover {
  background: rgba(255,255,255,0.09);
  border-color: rgba(255,255,255,0.2);
}
.field-input:focus {
  background: rgba(255,255,255,0.08);
  border-color: rgba(100,150,255,0.55);
  box-shadow: 0 0 0 3px rgba(80,120,255,0.12), 0 0 16px rgba(80,120,255,0.08);
}

/* ── Error ─────────────────────────────────────────────────────────── */
.error-msg {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.78rem;
  color: rgba(255,107,107,0.9);
  margin: 0;
  padding: 10px 12px;
  background: rgba(255,80,80,0.08);
  border: 1px solid rgba(255,80,80,0.18);
  border-radius: 8px;
}
.err-enter-active { transition: opacity 200ms, transform 200ms; }
.err-leave-active { transition: opacity 150ms; }
.err-enter-from  { opacity: 0; transform: translateY(-4px); }
.err-leave-to    { opacity: 0; }

/* ── Submit button ─────────────────────────────────────────────────── */
.submit-btn {
  height: 46px;
  padding: 0 20px;
  margin-top: 4px;
  font-family: var(--font-ui, sans-serif);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #0e1020;
  background: var(--color-accent, #ffb547);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 200ms, opacity 200ms, box-shadow 200ms, transform 120ms;
  box-shadow: 0 4px 20px rgba(255,181,71,0.2);
}
.submit-btn:hover:not(:disabled) {
  background: #ffc56a;
  box-shadow: 0 6px 28px rgba(255,181,71,0.35);
  transform: translateY(-1px);
}
.submit-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(255,181,71,0.2);
}
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Loading dots inside button */
.btn-loading {
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(14,16,32,0.7);
  animation: btnDot 1.2s ease-in-out infinite;
}
.btn-dot:nth-child(2) { animation-delay: 0.18s; }
.btn-dot:nth-child(3) { animation-delay: 0.36s; }
@keyframes btnDot {
  0%,80%,100% { opacity: 0.3; transform: scale(0.75); }
  40%          { opacity: 1;   transform: scale(1.15); }
}

/* ── Divider ───────────────────────────────────────────────────────── */
.divider {
  position: relative;
  display: flex;
  align-items: center;
  margin: 24px 0 20px;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255,255,255,0.08);
}
.divider span {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.68rem;
  color: rgba(245,240,234,0.25);
  padding: 0 12px;
  letter-spacing: 0.06em;
}

/* ── Toggle link ───────────────────────────────────────────────────── */
.toggle-link {
  font-family: var(--font-ui, sans-serif);
  font-size: 0.78rem;
  color: rgba(245,240,234,0.4);
  text-align: center;
  margin: 0;
  cursor: pointer;
  user-select: none;
  transition: color 160ms;
}
.toggle-link:hover { color: rgba(245,240,234,0.65); }
.toggle-action {
  color: rgba(255,181,71,0.8);
  margin-left: 4px;
  font-weight: 500;
  transition: color 160ms;
}
.toggle-link:hover .toggle-action { color: rgba(255,181,71,1); }

/* ── Mobile overrides (must be last to win specificity order) ──────── */
@media (max-width: 720px) {
  .login-header { padding: 12px 16px; }

  .login-body {
    flex: none;
    flex-direction: column;
    align-items: stretch;
    gap: 32px;
    padding: 16px 14px 32px;
    max-width: 100%;
    width: 100%;
    margin: 0;
  }

  /* Hero: don't stretch, just hug its content */
  .login-hero {
    flex: none;
    text-align: center;
    align-items: center;
    gap: 0;
    padding: 20px 0 0;
  }
  .hero-eyebrow { display: none; }
  .hero-headline { font-size: 1.55rem; line-height: 1.25; }
  .hero-sub { display: none; }

  /* Card column: fill the body width */
  .login-center {
    flex: none;
    width: 100%;
    max-width: 100%;
  }

  /* Card itself: fill its container, no fixed max-width */
  .login-card {
    width: 100%;
    max-width: 100%;
    padding: 22px 18px 20px;
    box-sizing: border-box;
  }

  .card-title { font-size: 1.2rem; margin-bottom: 18px; }
  .divider { margin: 16px 0 14px; }
}
</style>
