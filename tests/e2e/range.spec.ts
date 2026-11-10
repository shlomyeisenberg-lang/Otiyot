// Smoke test for the 3D test range (T08, T09): the engine starts, every effect, camera and
// animation runs, the scene stays inside the medium budget, a whole lesson is typed by following
// the finger guide (in English and in Hebrew) with the HUD and keyboard reacting, typing restores
// color, and closing the screen leaves zero GPU objects behind.

import { expect, test, type Page } from '@playwright/test';

const SAVE = {
  version: 3,
  profiles: [
    {
      id: 'a',
      name: 'דוד',
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
  words: number;
  ended: boolean;
  combo: number;
  nextKey: string | null;
  nextShift: string | null;
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

/** Types the next key exactly as the finger guide shows it. */
async function followGuide(page: Page): Promise<void> {
  const code = await probe(page, 'nextKey');
  if (!code) throw new Error('the guide shows no key');
  const shift = await probe(page, 'nextShift');
  if (shift) await page.keyboard.down('Shift');
  await page.keyboard.press(code === 'Space' ? 'Space' : code);
  if (shift) await page.keyboard.up('Shift');
}

/** Types the whole lesson by following the guide; returns how many keys it took. */
async function typeLesson(page: Page): Promise<number> {
  let keys = 0;
  while (!(await probe(page, 'ended'))) {
    await followGuide(page);
    keys += 1;
    if (keys > 2000) throw new Error('lesson never ended');
  }
  return keys;
}

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

      // The HUD and the keyboard guide are up, with exactly one key lit.
      await expect(page.getByTestId('hud')).toBeVisible();
      await expect(page.locator('.hud-l[data-state="next"]')).toHaveCount(1);
      await expect(page.locator('.kg__key.is-next')).toHaveCount(1);
      const first = await probe(page, 'nextKey');
      await expect(page.locator(`.kg__key.is-next[data-code="${first}"]`)).toHaveCount(1);

      // A wrong key: the letter turns red, nothing blocks, the guide moves on to the next key.
      await page.keyboard.press(first === 'KeyQ' ? 'KeyZ' : 'KeyQ');
      await expect(page.locator('.hud-l[data-state="err"]')).toHaveCount(1);
      await expect(page.locator('.kg__key.is-next')).toHaveCount(1);
      expect(await probe(page, 'combo')).toBe(0);
      // Backspace takes it back; the guide returns to the first key.
      await page.keyboard.press('Backspace');
      expect(await probe(page, 'nextKey')).toBe(first);

      // Type the whole lesson by following the guide: color comes back, the card shows.
      const before = await probe(page, 'restored');
      await typeLesson(page);
      await step(page, 2.5);
      expect(await probe(page, 'words')).toBeGreaterThan(0);
      expect(await probe(page, 'restored')).toBeGreaterThan(before);
      expect(await probe(page, 'combo')).toBeGreaterThan(5);
      await expect(page.getByText('Lesson complete')).toBeVisible();
      // Enter starts the next lesson.
      await page.keyboard.press('Enter');
      await expect(page.getByText('Lesson complete')).toBeHidden();
      expect(await probe(page, 'ended')).toBe(false);
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

  test('a Hebrew lesson reads right to left and can be typed by following the guide', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one layout check is enough');
    const save = {
      ...SAVE,
      profiles: [
        { ...SAVE.profiles[0], settings: { uiLanguage: 'he', theme: 'dark' }, layout: 'he' },
      ],
    };
    await page.addInitScript((s) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', s);
    }, JSON.stringify(save));
    await page.goto('/#/range');
    await page.waitForFunction(
      () => {
        const p = (window as unknown as { __otiyotRange?: Probe }).__otiyotRange;
        return p?.ready === true || p?.failed === true;
      },
      null,
      { timeout: 120_000 },
    );
    expect(await probe(page, 'failed')).toBe(false);
    await expect(page.locator('.hud-word')).toHaveAttribute('dir', 'rtl');
    // The keyboard itself is physical: always left to right.
    await expect(page.locator('.kg__deck')).toHaveAttribute('dir', 'ltr');
    // Keys pressed with the computer set to English still type Hebrew (physical keys).
    await typeLesson(page);
    await expect(page.getByText('השיעור הושלם')).toBeVisible();
    await page.getByRole('button', { name: 'חזרה' }).click();
  });
});
