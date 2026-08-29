import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve('src/renderer/player'),
  base: '/',
  build: {
    outDir: resolve('dist/player'),
    emptyOutDir: true
  },
  server: {
    port: 5174
  }
})
