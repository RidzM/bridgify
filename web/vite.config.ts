/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

/** Preloads the interface font files so text doesn't shift when the font arrives. */
function preloadFonts(): Plugin {
  return {
    name: 'bridgify-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => /atkinson-hyperlegible-next-latin-(400|600)-normal-[\w-]+\.woff2$/.test(f))
        const tags = files.map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`).join('')
        return html.replace('</title>', `</title>${tags}`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('../content', import.meta.url)),
    },
  },
  server: { fs: { allow: ['..'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test-setup.ts'],
  },
})
