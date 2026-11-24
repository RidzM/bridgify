import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  testIgnore: process.env.SLOW ? [] : ['**/*.slow.spec.ts'],
  timeout: 60_000,
  reporter: [['list']],
  // Service workers are blocked by default so each test doesn't download the offline precache; offline specs opt back in.
  // The SLOW suites download models and run camera/Whisper inference; one at a time keeps them stable.
  workers: process.env.SLOW ? 1 : undefined,
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4173', reducedMotion: 'reduce', serviceWorkers: 'block' },
  webServer: process.env.BASE_URL ? undefined : { command: 'pnpm preview --port 4173', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: ['**/a11y.spec.ts', '**/*.slow.spec.ts'] },
  ],
})
