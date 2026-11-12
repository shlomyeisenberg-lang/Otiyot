// Smoke test for the audio engine and the sound room (T10): sound starts only after the first key
// press, every theme renders real sound without clipping, more layers make more sound, a typed
// streak brings the stems in on the bar, and the volume settings are saved.

import { expect, test, type Page } from '@playwright/test';

const SAVE = {
  version: 5,
  profiles: [
    {
      id: 'a',
      name: 'Dov',
      settings: { uiLanguage: 'en', theme: 'light' },
      track: 1,
      layout: 'en',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true },
};

interface Status {
  ready: boolean;
  theme: string | null;
  bar: number;
  intensity: number;
  stems: Record<string, number>;
  ambiences: number;
}

async function open(page: Page, route: string): Promise<void> {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(SAVE));
  await page.goto(route);
}

const status = (page: Page): Promise<Status> =>
  page.evaluate(() => {
    const p = window.__otiyotSound;
    if (!p) throw new Error('no sound room');
    return p.status();
  });

test('every theme makes clean sound, and layers add to it', async ({ page }, info) => {
  test.skip(info.project.name === 'phone', 'Rendering is the same on every screen size');
  await open(page, '/#/sound');
  await expect(page.locator('.sound__theme')).toHaveCount(11);
  const results = await page.evaluate(async () => {
    const p = window.__otiyotSound;
    if (!p) throw new Error('no sound room');
    const measure = (d: Float32Array) => {
      let peak = 0;
      let sum = 0;
      let bad = 0;
      for (const v of d) {
        if (!Number.isFinite(v)) bad++;
        else {
          peak = Math.max(peak, Math.abs(v));
          sum += v * v;
        }
      }
      return { peak, rms: Math.sqrt(sum / d.length), bad };
    };
    const out: Record<string, { low: number; high: number; peak: number; bad: number }> = {};
    for (const id of [
      'title',
      'hub',
      'meadow',
      'cliffs',
      'forge',
      'shuk',
      'rail',
      'geniza',
      'hermon',
      'station',
      'boss',
    ] as const) {
      const low = measure(await p.render(id, 8, 0, 16000));
      const high = measure(await p.render(id, 8, 1, 16000));
      out[id] = {
        low: low.rms,
        high: high.rms,
        peak: Math.max(low.peak, high.peak),
        bad: low.bad + high.bad,
      };
    }
    return out;
  });
  for (const [id, r] of Object.entries(results)) {
    expect(r.bad, `${id} has broken samples`).toBe(0);
    expect(r.low, `${id} is silent at the start`).toBeGreaterThan(0.005);
    expect(r.high, `${id} does not build`).toBeGreaterThan(r.low * 1.25);
    expect(r.peak, `${id} clips`).toBeLessThan(1);
  }
});

test('the sound room wakes on a key, and a streak builds the music bar by bar', async ({
  page,
}) => {
  await open(page, '/#/sound');
  await expect(page.locator('.page__title')).toHaveText('The sound room');
  // Browser rule: nothing exists before the player does something.
  expect((await status(page)).ready).toBe(false);
  await page.keyboard.press('a');
  await expect.poll(async () => (await status(page)).ready).toBe(true);
  await expect.poll(async () => (await status(page)).theme).toBe('title');

  await page.locator('[data-theme="meadow"]').click();
  await expect.poll(async () => (await status(page)).theme).toBe('meadow');
  await expect(page.locator('[data-theme="meadow"]')).toHaveAttribute('aria-checked', 'true');
  expect((await status(page)).stems.perc).toBe(0);

  // 30 correct letters: streak tier 2 (silver), so the drums come in on the next bar.
  for (let i = 0; i < 30; i++) await page.keyboard.press('s');
  await expect(page.locator('.sound__combo-n')).toHaveText('31');
  await expect.poll(async () => (await status(page)).stems.perc, { timeout: 8000 }).toBe(1);
  await expect(page.locator('.sound__lamp[data-stem="perc"]')).toHaveClass(/is-on/);
  const bars = (await status(page)).bar;
  expect(bars).toBeGreaterThan(0);

  // A mistake ends the streak; the layers fall back at the next bar line.
  await page.keyboard.press('Backspace');
  await expect(page.locator('.sound__combo-n')).toHaveText('0');
  await expect.poll(async () => (await status(page)).stems.perc, { timeout: 8000 }).toBe(0);

  // Boss phases and a place sound.
  await page.locator('[data-phase="phase2"]').click();
  await expect.poll(async () => (await status(page)).theme).toBe('boss');
  await page.locator('[data-ambience="wind"]').click();
  await expect(page.locator('[data-ambience="wind"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await status(page)).ambiences).toBe(1);
  await page.locator('[data-action="stop"]').click();
  await expect.poll(async () => (await status(page)).theme).toBeNull();

  // Leaving the room stops its place sounds.
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/settings$/);
});

test('settings save all four volumes and open the sound room', async ({ page }) => {
  await open(page, '/#/settings');
  await page.getByRole('tab', { name: 'Sound' }).click();
  const sliders = page.locator('input.slider');
  await expect(sliders).toHaveCount(4);
  await sliders.nth(3).fill('20');
  const saved = (): Promise<{ uiVolume?: number; voiceVolume?: number }> =>
    page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('otiyot_save') ?? '{}');
      return raw.profiles?.[0]?.settings ?? {};
    });
  await expect.poll(async () => (await saved()).uiVolume).toBeCloseTo(0.2);
  expect((await saved()).voiceVolume).toBeCloseTo(0.9);
  await page.getByRole('button', { name: 'Open the sound room' }).click();
  await expect(page).toHaveURL(/#\/sound$/);
  await expect(page.locator('.sound__theme')).toHaveCount(11);
});
