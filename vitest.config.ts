import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    // Mirror the Nuxt aliases so tests can import server and app modules directly.
    alias: {
      '~~': root,
      '@@': root,
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
})
