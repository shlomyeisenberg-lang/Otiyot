import { expect, test, type Page } from '@playwright/test';

// A player who has been here before, in English, who has not seen the opening yet.
const SAVE = {
  version: 7,
  profiles: [
    {
      id: 'a',
      name: 'David',
      settings: { uiLanguage: 'en', theme: 'dark', textSpeed: 'fast' },
      track: 1,
      layout: 'en',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true, autoQuality: 'low' },
};

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('launch: title, then the opening plays, can be skipped, and hands over', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(SAVE));
  await page.goto('/');

  // The title: gold letters fall onto the page; any key jumps to the finished picture.
  await expect(page.getByTestId('title')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Otiyot' })).toBeAttached();
  await page.keyboard.press('Shift');
  const begin = page.getByRole('menuitem', { name: /Begin the story/ });
  await expect(begin).toBeVisible();
  const title = await page.evaluate(() => window.__otiyotTitle);
  expect(title?.ready).toBe(true);
  if (!title?.failed) expect(title?.landed).toBe(12);
  await begin.click();

  // The opening: lines type themselves out; Enter shows the rest, then moves on.
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.waitForFunction(() => window.__otiyotIntro?.leaked === null);
  await page.waitForFunction(() => (window.__otiyotIntro?.shown.length ?? 0) > 0, null, {
    timeout: 60_000,
  });
  const dialogue = page.locator('.cutscene__dialogue');
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText('Narrator');
  await page.waitForFunction(() => window.__otiyotIntro?.waiting === true);
  await expect(dialogue).toContainText('In the Land of Letters');
  const first = await page.evaluate(() => window.__otiyotIntro?.beat);
  await page.keyboard.press('Enter');
  await page.waitForFunction((b) => window.__otiyotIntro?.beat !== b, first);

  // Esc skips the rest and hands over to the main menu; nothing is left on the graphics card.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
  const intro = await page.evaluate(() => window.__otiyotIntro);
  expect(intro?.skipped).toBe(true);
  expect(intro?.leaked).toBe(0);

  // The story remembers: the title now offers Continue and the opening again.
  await page.goto('/');
  await page.keyboard.press('Shift');
  await expect(page.getByRole('menuitem', { name: /Continue/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Watch the opening again/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
  expect(await page.evaluate(() => window.__otiyotTitle?.leaked)).toBe(0);
  expect(errors).toEqual([]);
});

test('settings: story text speed and voices', async ({ page }) => {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(SAVE));
  await page.goto('/#/settings');
  const speed = page.locator('[data-setting="textSpeed"]');
  await expect(speed).toHaveValue('fast');
  await speed.selectOption('slow');
  await page.getByRole('tab', { name: 'Sound' }).click();
  const voices = page.locator('[data-setting="storyVoices"]');
  await expect(voices).toBeVisible();
  await voices.click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('otiyot_save') ?? ''))
    .toContain('"textSpeed":"slow"');
});
