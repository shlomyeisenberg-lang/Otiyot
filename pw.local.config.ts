import base from '/home/claude/otiyot2/playwright.config';
const exe = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
export default {
  ...base,
  testDir: '/home/claude/otiyot2/tests/e2e',
  use: { ...base.use, launchOptions: { ...(base.use?.launchOptions ?? {}), executablePath: exe } },
  webServer: { ...base.webServer, cwd: '/home/claude/otiyot2' },
};
