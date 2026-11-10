import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4173' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 700 } } },
  ],
});
