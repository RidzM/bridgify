/// <reference types="vite-plugin-pwa/vanillajs" />
/**
 * Offline and installable app (FR-PWA-01). Registers the service worker that vite-plugin-pwa
 * generates (vite.config.ts). The worker updates on "prompt": when a new version is ready, a
 * toast offers Reload, so nobody loses what they were typing to a surprise refresh.
 * Call once from main.tsx.
 */
import { toast } from '@/components/ui/Toast'

const HOUR = 60 * 60 * 1000
let started = false

export function registerPwa(): void {
  if (started || typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  started = true
  // Loaded after the page so the service-worker helper stays out of the first download.
  const start = () => { void import('virtual:pwa-register').then(({ registerSW }) => wire(registerSW)) }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

function wire(registerSW: typeof import('virtual:pwa-register').registerSW): void {
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      toast('A new version is ready', { label: 'Reload', run: () => { void update(true) } })
    },
    onRegisteredSW(_url, registration) {
      // Long-open tabs (a Bridge left running) still hear about new versions.
      if (registration) setInterval(() => { if (navigator.onLine) void registration.update().catch(() => {}) }, HOUR)
    },
    onRegisterError(error: unknown) {
      console.warn('[pwa] service worker not registered; the app still works online', error)
    },
  })
}
