// Smoke test for settings (T36): every tab can be reached and tabbed through with the keyboard,
// each control has a name, options change the page at once and persist, the player's own pause
// key goes back, and the break reminder appears on time.

import { expect, test, type Page } from '@playwright/test';

const SAVE = {
  version: 10,
  profiles: [
    {
      id: 'a',
      name: 'Dov',
      settings: { uiLanguage: 'en', theme: 'light', breakMinutes: 15 },
      track: 1,
      layout: 'en',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true },
};

async function open(page: Page, route: string): Promise<void> {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(SAVE));
  await page.goto(route);
}

const saved = (page: Page): Promise<Record<string, unknown>> =>
  page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('otiyot_save') ?? '{}');
    return raw.profiles[0].settings;
  });

test('every tab can be tabbed through and every control has a name', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, '/#/settings');
  const tabs = page.getByRole('tab');
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(7);
  for (let i = 0; i < count; i++) {
    await tabs.nth(i).click();
    const panel = page.getByRole('tabpanel');
    const controls = panel.locator('select, input, button');
    const n = await controls.count();
    for (let j = 0; j < n; j++) {
      const c = controls.nth(j);
      const named = await c.evaluate(
        (el) =>
          (el.getAttribute('aria-label') ?? '') !== '' ||
          (el.getAttribute('aria-labelledby') ?? '') !== '' ||
          ((el as HTMLElement).innerText ?? '').trim() !== '' ||
          ((el as HTMLInputElement).labels?.length ?? 0) > 0,
      );
      expect(named).toBe(true);
    }
    // Tab from the tab strip reaches the first control of the panel.
    await tabs.nth(i).focus();
    for (let k = 0; k < n; k++) await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[role="tabpanel"]') !== null,
    );
    if (n > 0) expect(inside).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('options change the page at once and are saved', async ({ page }) => {
  await open(page, '/#/settings');
  await page.getByRole('tab', { name: 'Accessibility' }).click();
  await page
    .locator('[data-setting="largeText"] input, [data-setting="largeText"]')
    .first()
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
  await page.locator('[data-setting="captions"]').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-captions', 'off');
  const shake = page.locator('[data-setting="shake"] input, input[data-setting="shake"]').first();
  await shake.fill('0');
  await shake.dispatchEvent('input');
  await shake.dispatchEvent('change');
  await page.getByRole('tab', { name: 'Graphics' }).click();
  await page.locator('select[data-setting="quality"]').selectOption('low');
  await page.getByRole('tab', { name: 'Health' }).click();
  await page.locator('select[data-setting="breakMinutes"]').selectOption('0');
  await expect.poll(async () => (await saved(page)).quality).toBe('low');
  const s = await saved(page);
  expect(s).toMatchObject({ largeText: true, captions: false, shake: 0, breakMinutes: 0 });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
});

test('the player’s own pause key goes back', async ({ page }) => {
  await open(page, '/#/settings');
  await page.getByRole('tab', { name: 'Keys' }).click();
  await page.locator('select[data-setting="menuKey"]').selectOption('F2');
  await page.keyboard.press('F2');
  await expect(page).toHaveURL(/#\/menu$/);
});

test('the break reminder shows after the chosen time, and not before', async ({ page }) => {
  await open(page, '/#/menu');
  await page.evaluate(() => window.__otiyotHealth?.(14 * 60));
  await expect(page.locator('.toast')).toHaveCount(0);
  await page.evaluate(() => window.__otiyotHealth?.(90));
  await expect(page.locator('.toast')).toContainText('short rest');
});
