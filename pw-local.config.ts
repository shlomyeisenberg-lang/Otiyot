import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '/home/claude/otiyot/tests/e2e',
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }, { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 700 } } }],
});
