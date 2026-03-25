import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5299',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx wrangler dev src/api/index.ts --port 8899',
      port: 8899,
      timeout: 30_000,
      reuseExistingServer: false,
    },
    {
      command: 'VITE_API_URL=http://localhost:8899 npx vite --port 5299',
      port: 5299,
      timeout: 30_000,
      reuseExistingServer: false,
    },
  ],
})
