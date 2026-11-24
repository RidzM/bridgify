/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const DAY = 24 * 60 * 60

/**
 * Installable, offline PWA (FR-PWA-01, SYSTEM-ARCHITECTURE §6.8). The app shell is precached;
 * models, wasm and sign media are cached the first time a tool uses them; /api is never cached.
 * `injectRegister: 'auto'` registers the worker by itself until src/app/pwa.ts (registerPwa) is
 * imported, which then takes over and adds the "new version" toast.
 */
function pwa() {
  return VitePWA({
    strategies: 'generateSW',
    registerType: 'prompt',
    injectRegister: 'auto',
    manifest: {
      id: '/',
      name: 'Bridgify',
      short_name: 'Bridgify',
      description: 'Speech, text, braille and sign, every way. Private, and works offline.',
      lang: 'en-IN',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      theme_color: '#3d0075',
      background_color: '#f6f5f8',
      categories: ['accessibility', 'education', 'utilities'],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      ],
      shortcuts: [
        { name: 'SOS', short_name: 'SOS', url: '/sos', description: 'Emergency cards. Work without internet.', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        { name: 'Bridge', short_name: 'Bridge', url: '/bridge', description: 'Talk with someone on another phone.', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,woff2,svg,json}'],
      globIgnores: ['models/**', 'wasm/**', 'signs/**', 'evidence/**', '**/*.map', 'assets/asr.worker-*.js'],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/^\/api\//, /^\/(models|wasm|signs)\//],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          // The model list changes when models do: always ask the network first, use the copy offline.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === '/models/manifest.json',
          handler: 'NetworkFirst',
          options: { cacheName: 'bridgify-model-list', networkTimeoutSeconds: 4, expiration: { maxEntries: 4 }, cacheableResponse: { statuses: [200] } },
        },
        {
          // Model files are stored (and checked by SHA-256) by the app's own model cache; a second copy here would double the space.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/models/'),
          handler: 'NetworkOnly',
        },
        {
          // The on-device Whisper worker is opt-in, so it is cached on first use instead of precached.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/assets\/asr\.worker-[\w-]+\.js$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'bridgify-asr', expiration: { maxEntries: 4, maxAgeSeconds: 180 * DAY, purgeOnQuotaError: true }, cacheableResponse: { statuses: [200] } },
        },
        {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/wasm/'),
          handler: 'CacheFirst',
          options: { cacheName: 'bridgify-wasm', expiration: { maxEntries: 20, maxAgeSeconds: 180 * DAY, purgeOnQuotaError: true }, cacheableResponse: { statuses: [200] } },
        },
        {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/signs/'),
          handler: 'CacheFirst',
          options: { cacheName: 'bridgify-signs', expiration: { maxEntries: 300, maxAgeSeconds: 90 * DAY, purgeOnQuotaError: true }, cacheableResponse: { statuses: [200] } },
        },
        {
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
          handler: 'NetworkOnly',
        },
      ],
    },
  })
}

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
  plugins: [react(), tailwindcss(), preloadFonts(), pwa()],
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
