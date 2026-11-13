// Smoke test for the Game Room (T29): the lobby groups the games, each of the five 3D classics
// launches in its frame and starts a round, the page is told the profile's layout and learned
// letters (the games type only those), and a finished round's scores come back into the profile.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

function savedPlayer(layout: 'he' | 'en'): string {
  const p = createProfile('a', 'David', 0);
  p.layout = layout;
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.story.flags.intro = true;
  p.story.flags.hub = true;
  let done = 0;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= 12) break;
      recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 });
      done += 1;
    }
  }
  return JSON.stringify({
    version: 8,
    profiles: [p],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'low' },
  });
}

async function openArcade(page: Page, layout: 'he' | 'en'): Promise<void> {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, savedPlayer(layout));
  await page.goto('/#/arcade');
  await expect(page.locator('.arcade__group')).toHaveCount(3);
}

test.describe('Game Room', () => {
  test('the lobby shows three groups and five playable classics', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openArcade(page, 'en');
    await expect(page.locator('[data-group="classics"] .arcade__card')).toHaveCount(5);
    await expect(page.locator('[data-group="newgen"] .arcade__card')).toHaveCount(3);
    await expect(page.locator('[data-group="quick"] .arcade__card')).toHaveCount(2);
    expect(errors).toEqual([]);
  });

  for (const [i, id] of ['galaxy', 'sefarim', 'race', 'arena', 'tower'].entries()) {
    test(`${id} launches and starts a round`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop' && i > 0, 'one game is enough on the phone');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openArcade(page, i % 2 === 0 ? 'en' : 'he');
      await page
        .locator('[data-group="classics"] .arcade__card')
        .nth(i)
        .getByRole('button')
        .click();
      const frame = page.frameLocator('.arcade__frame');
      await expect(frame.locator('#g3Play')).toBeVisible({ timeout: 20_000 });
      const probe = await page.evaluate(() => window.__otiyotArcade);
      expect(probe?.game).toBe(id);
      expect(probe?.letters).toBeGreaterThan(1);
      await frame.locator('#g3Play').click();
      await expect(frame.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
      // Back to the lobby with the button.
      await page.getByRole('button', { name: 'Back to the Game Room' }).click();
      await expect(page.locator('.arcade__group')).toHaveCount(3);
      expect(errors).toEqual([]);
    });
  }

  test('the frame is told the profile layout', async ({ page }) => {
    await openArcade(page, 'he');
    await page.locator('[data-group="classics"] .arcade__card').first().getByRole('button').click();
    const frame = page.frameLocator('.arcade__frame');
    await expect(frame.locator('#g3Play')).toBeVisible({ timeout: 20_000 });
    const lang = await frame.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
    const probe = await page.evaluate(() => window.__otiyotArcade);
    expect(probe?.layout).toBe('he');
  });

  test('scores come back into the profile', async ({ page }) => {
    await openArcade(page, 'en');
    await page.locator('[data-group="classics"] .arcade__card').first().getByRole('button').click();
    const frame = page.frameLocator('.arcade__frame');
    await expect(frame.locator('#g3Play')).toBeVisible({ timeout: 20_000 });
    // The games save their settings when Play is pressed: the blob reaches the save.
    await frame.locator('#g3Play').click();
    await expect
      .poll(() => page.evaluate(() => window.__otiyotArcade?.saved ?? 0))
      .toBeGreaterThan(0);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('otiyot_save') ?? ''), {
        timeout: 10_000,
      })
      .toContain('games3d');
  });
});
