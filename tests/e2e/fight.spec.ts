// Smoke test for the combat kit (T11): a wave fight in the 3D test range. Blots with word
// shields come in waves, the player breaks every shield by following the finger guide, a
// results card with a rank appears, and leaving the range leaves no GPU objects behind.

import { expect, test, type Page } from '@playwright/test';

const SAVE = {
  version: 3,
  profiles: [
    {
      id: 'a',
      name: 'David',
      settings: { uiLanguage: 'en', theme: 'light' },
      track: 1,
      layout: 'en',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true },
};

interface Fight {
  wave: number;
  waves: number;
  onField: number;
  broken: number;
  total: number;
  done: boolean;
}

interface Probe {
  ready: boolean;
  failed: boolean;
  word: string;
  nextKey: string | null;
  nextShift: string | null;
  fight: Fight | null;
  results: { rank: string; xp: number; glyphs: number; ink: number } | null;
  levels: string[];
  leaked: number | null;
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

test.describe('wave fight', () => {
  test.setTimeout(480_000);

  test('breaks every shield on Calm and ends with a results card', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full fight is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, JSON.stringify(SAVE));

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
    // A brand-new learner has only Easy open; the others say why they are locked.
    expect(await probe(page, 'levels')).toEqual(['easy']);
    await expect(page.locator('[data-pick="level:hard"]')).toHaveAttribute('aria-disabled', 'true');

    await page.locator('[data-pick="difficulty:calm"]').click();
    await expect(page.locator('[data-pick="mode:fight"]')).toHaveAttribute('aria-pressed', 'true');
    await step(page, 3);
    const fight = await probe(page, 'fight');
    expect(fight?.waves).toBe(3);
    expect(fight?.onField ?? 0).toBeGreaterThan(0);

    // Shields use only the learned home-row keys of lesson one.
    const learned = new Set('asdfjkl;'.split(''));
    let keys = 0;
    while (!(await probe(page, 'results'))) {
      const f = await probe(page, 'fight');
      if (f?.done) {
        await page.waitForTimeout(250);
        continue;
      }
      const word = await probe(page, 'word');
      for (const ch of word) expect(learned.has(ch), `"${ch}" in "${word}"`).toBe(true);
      const code = await probe(page, 'nextKey');
      if (!code) throw new Error('the guide shows no key');
      const shift = await probe(page, 'nextShift');
      if (shift) await page.keyboard.down('Shift');
      await page.keyboard.press(code);
      if (shift) await page.keyboard.up('Shift');
      keys += 1;
      if (keys % 6 === 0) await step(page, 0.6);
      if (keys > 1500) throw new Error('the fight never ended');
    }
    const end = await probe(page, 'fight');
    expect(end?.done).toBe(true);
    expect(end?.broken).toBe(end?.total);
    const results = await probe(page, 'results');
    expect(['S', 'A']).toContain(results?.rank);
    expect(results?.xp ?? 0).toBeGreaterThan(0);
    await expect(page.locator('.range__results')).toBeVisible();
    await expect(page.locator('.range__results .rank')).toHaveText(results?.rank ?? '');
    await page.screenshot({ path: testInfo.outputPath('results.png') });

    // Enter starts another fight.
    await page.keyboard.press('Enter');
    await expect(page.locator('.range__results')).toBeHidden();
    expect((await probe(page, 'fight'))?.broken).toBe(0);

    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotRange?: Probe }).__otiyotRange?.leaked !== null,
    );
    expect(await probe(page, 'leaked')).toBe(0);
    expect(errors).toEqual([]);
  });
});
