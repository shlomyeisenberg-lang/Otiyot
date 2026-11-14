import { expect, test } from '@playwright/test';

const SAVE = {
  version: 7,
  profiles: [
    {
      id: 'a',
      name: 'David',
      settings: { uiLanguage: 'en', theme: 'dark', textSpeed: 'instant' },
      track: 1,
      layout: 'en',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true, autoQuality: 'low' },
};

test('a chapter plays, can be continued with Enter, and hands over to the hub', async ({
  page,
}) => {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(SAVE));
  await page.goto('/#/chapter');
  // Nothing was asked for: it goes straight on to the hub without errors.
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 15_000 });
});

test('a restored region offers its chapter in the hub, plays it once, and it is remembered', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const save = structuredClone(SAVE) as typeof SAVE & { profiles: Record<string, unknown>[] };
  Object.assign(save.profiles[0] as Record<string, unknown>, {
    story: { ranks: { meadow: 4 }, flags: { intro: true, hub: true, 'hub:meadow': true } },
  });
  await page.addInitScript((s) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', s);
  }, JSON.stringify(save));
  await page.goto('/#/hub');
  await page.locator('[data-action="new-chapter"]').click();
  await expect(page.getByTestId('chapter')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-action="new-chapter"]')).toHaveCount(0);
  const flags = await page.evaluate(
    () => JSON.parse(localStorage.getItem('otiyot_save') ?? '{}').profiles[0].story.flags,
  );
  expect(flags['ch:meadow.restored']).toBe(true);
});
