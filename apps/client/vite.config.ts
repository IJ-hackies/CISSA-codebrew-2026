import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(here, 'src'),
    },
  },
  server: {
    port: 8888,
    proxy: {
      // Forward API calls to the Bun backend in dev so the frontend can use
      // relative URLs and nothing hardcodes localhost:8889.
      '/api': {
        target: 'http://localhost:8889',
        changeOrigin: true,
      },
    },
  },
})
