// Smoke test for the 3D test range (T08): the engine starts, every effect, camera and animation
// runs, the scene stays inside the medium budget, typing restores color, and closing the screen
// leaves zero GPU objects behind.

import { expect, test, type Page } from '@playwright/test';

const SAVE = {
  version: 3,
  profiles: [
    {
      id: 'a',
      name: 'דבורה',
      settings: { uiLanguage: 'en', theme: 'light' },
      track: 1,
      layout: 'en',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true },
};

interface Probe {
  ready: boolean;
  failed: boolean;
  stats: { drawCalls: number; triangles: number; quality: string; geometries: number } | null;
  restored: number;
  word: string;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
}

type Readable = Exclude<keyof Probe, 'step'>;

const probe = <K extends Readable>(page: Page, key: K): Promise<Probe[K]> =>
  page.evaluate(
    (k) => (window as unknown as { __otiyotRange: Probe }).__otiyotRange[k] as Probe[K],
    key,
  );

const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotRange: Probe }).__otiyotRange.step(s),
    seconds,
  );

test.describe('test range', () => {
  // Software rendering on CI draws about one frame a second; the test steps the world itself.
  test.setTimeout(360_000);

  test('shows every effect, stays in budget, restores color and leaks nothing', async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !/GL Driver Message|GPU stall/.test(m.text()))
        errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, JSON.stringify(SAVE));

    await page.goto('/#/range');
    await expect(page.getByRole('heading', { name: 'Test range' })).toBeVisible();
    await page.waitForFunction(
      () => {
        const p = (window as unknown as { __otiyotRange?: Probe }).__otiyotRange;
        return p?.ready === true || p?.failed === true;
      },
      null,
      { timeout: 120_000 },
    );
    expect(await probe(page, 'failed')).toBe(false);
    await expect(page.getByTestId('perf')).toBeVisible();

    // No sideways scroll at either size.
    const extra = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(extra).toBeLessThanOrEqual(0);

    // The leak check needs the full tour only once; the phone run checks layout and start-up.
    if (testInfo.project.name === 'desktop') {
      // Fix the preset so the budget check always measures medium.
      await page.locator('[data-pick="quality:medium"]').click();
      await expect(page.locator('[data-pick="quality:medium"]')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        await page.keyboard.press(key);
        await step(page, 0.25);
      }
      for (const anim of ['write', 'hit', 'stagger', 'fall', 'cheer']) {
        await page.locator(`[data-pick="anim:${anim}"]`).click();
        await step(page, 0.3);
      }
      for (const camera of ['rail', 'cockpit', 'follow']) {
        await page.locator(`[data-pick="camera:${camera}"]`).click();
        await expect(page.locator(`[data-pick="camera:${camera}"]`)).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await step(page, 0.5);
      }

      // Type the floating word: color comes back one stage per word.
      const word = await probe(page, 'word');
      expect(word.length).toBeGreaterThan(0);
      const before = await probe(page, 'restored');
      await page.keyboard.type(word);
      await step(page, 2.5);
      expect(await probe(page, 'restored')).toBeGreaterThan(before);
      expect(await probe(page, 'word')).not.toBe('');

      // Wait for one real frame so the counters are fresh, then check the medium budget.
      await page.waitForTimeout(2500);
      const stats = await probe(page, 'stats');
      expect(stats?.quality).toBe('medium');
      expect(stats?.drawCalls).toBeGreaterThan(0);
      expect(stats?.drawCalls).toBeLessThanOrEqual(150);
      expect(stats?.triangles).toBeLessThanOrEqual(300_000);
    }

    // Leave: everything the engine and the scene made must be freed.
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotRange?: Probe }).__otiyotRange?.leaked !== null,
      null,
      { timeout: 30_000 },
    );
    expect(await probe(page, 'leaked')).toBe(0);
    expect(await probe(page, 'sceneLeak')).toBe(0);
    expect(errors).toEqual([]);
  });
});
