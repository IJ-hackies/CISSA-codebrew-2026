<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '@/lib/auth'

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
    <div class="login-card">
      <h1>{{ mode === 'login' ? 'Sign in' : 'Create account' }}</h1>

      <form @submit.prevent="submit">
        <input
          v-model="username"
          type="text"
          placeholder="Username"
          autocomplete="username"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
          required
        />
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account' }}
        </button>
      </form>

      <p class="toggle" @click="toggle">
        {{ mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #02040a;
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 2rem;
}

h1 {
  color: #e8e8e8;
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  text-align: center;
}

form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

input {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #333;
  background: #111;
  color: #e8e8e8;
  font-size: 1rem;
  outline: none;
}

input:focus {
  border-color: #666;
}

button {
  padding: 0.75rem;
  border-radius: 8px;
  border: none;
  background: #e8e8e8;
  color: #111;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.25rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background: #fff;
}

.error {
  color: #f87171;
  font-size: 0.875rem;
  margin: 0;
}

.toggle {
  color: #888;
  font-size: 0.875rem;
  text-align: center;
  margin-top: 1rem;
  cursor: pointer;
}

.toggle:hover {
  color: #e8e8e8;
}
</style>
