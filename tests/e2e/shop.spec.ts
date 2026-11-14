// Smoke test for the ink shop (T33): a player with some XP, glyphs, ink and two hidden letters
// buys and wears a robe, learns an ability, crafts a gold quill, and sees his letters. Phone
// width included. The hub's shop station leads here.

import { expect, test, type Page } from '@playwright/test';
import { xpForLevel } from '../../src/game/progression';
import { createProfile } from '../../src/save';

function savedPlayer(ui: 'en' | 'he'): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.settings.uiLanguage = ui;
  p.settings.theme = 'light';
  p.settings.quality = 'low';
  p.story.flags.intro = true;
  p.story.flags.hub = true;
  p.progress = {
    xp: xpForLevel(5) + 40,
    skills: ['echo'],
    off: [],
    secrets: ['meadow', 'cliffs'],
  };
  p.wallet = { glyphs: 300, ink: 60 };
  p.cosmetics = {
    owned: ['quill:hawk', 'ink:sepia', 'decor:banners'],
    equipped: { quill: 'quill:hawk', ink: 'ink:sepia' },
  };
  return JSON.stringify({
    version: 9,
    profiles: [p],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'low' },
  });
}

async function open(page: Page, ui: 'en' | 'he', hash: string): Promise<void> {
  const save = savedPlayer(ui);
  await page.addInitScript((s) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', s);
  }, save);
  await page.goto(`/#/${hash}`);
}

const openTab = (page: Page, name: RegExp | string): Promise<void> =>
  page.getByRole('tab', { name }).click({ force: true });

test.describe('Ink shop', () => {
  test('buy, wear, learn, craft and see the letters', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, 'en', 'shop');
    await expect(page.getByRole('heading', { level: 1, name: 'The Ink Shop' })).toBeVisible();
    await expect(page.locator('.level-bar')).toHaveAttribute('data-level', '5');
    await expect(page.getByTestId('wallet-glyphs')).toContainText('300');
    await expect(page.getByRole('img', { name: /apprentice/ })).toBeVisible();

    // The shelf: buy the linen robe; it is worn at once and the glyphs go down.
    const linen = page.locator('[data-item="robe:linen"]');
    await linen.getByRole('button', { name: 'Buy' }).click();
    await expect(page.locator('[data-item="robe:linen"]')).toHaveAttribute(
      'data-state',
      'equipped',
    );
    await expect(page.getByTestId('wallet-glyphs')).toContainText('240');
    // Something above the player's level waits, with its level.
    await expect(page.locator('[data-item="robe:night"]')).toHaveAttribute('data-state', 'locked');

    // Skills: four points, Echo learned; learn Steady Hand.
    await openTab(page, /Skills/);
    await expect(page.locator('[data-skill="echo"]')).toHaveAttribute('data-state', 'learned');
    await page.locator('[data-skill="steady"]').getByRole('button', { name: 'Learn' }).click();
    await expect(page.locator('[data-skill="steady"]')).toHaveAttribute('data-state', 'learned');
    await expect(page.locator('[data-skill="warm"]')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('[data-skill="steady2"]')).toHaveAttribute('data-state', 'needsPrev');

    // Crafting: the hawk quill, two letters and 40 ink make the gold-leaf quill.
    await openTab(page, 'Crafting');
    const gold = page.locator('[data-recipe="quill:gold"]');
    await expect(gold).toHaveAttribute('data-state', 'ready');
    await gold.getByRole('button', { name: 'Craft' }).click();
    await expect(page.locator('[data-recipe="quill:gold"]')).toHaveAttribute('data-state', 'made');
    await expect(page.getByTestId('wallet-ink')).toContainText('20');

    // Letters: two found, the rest keep their riddle.
    await openTab(page, 'Hidden letters');
    await expect(page.locator('.letter-tile--found')).toHaveCount(2);
    await expect(page.locator('[data-region="meadow"] .letter-tile__glyph')).toHaveText('פ');

    // Everything was saved.
    const saved = await page.evaluate(() => localStorage.getItem('otiyot_save') ?? '');
    expect(saved).toContain('robe:linen');
    expect(saved).toContain('quill:gold');
    expect(errors).toEqual([]);
  });

  test('Hebrew, right to left', async ({ page }) => {
    await open(page, 'he', 'shop');
    await expect(page.getByRole('heading', { level: 1, name: 'חנות הדיו' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-item="robe:linen"]')).toBeVisible();
  });
});
