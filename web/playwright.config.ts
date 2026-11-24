import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', reducedMotion: 'reduce' },
  webServer: { command: 'pnpm preview --port 4173', port: 4173, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
