// Smoke test for the Home Row Meadow (T14): from the hub's map into the scene, Reb Ezra's
// lesson and the words typed from start to finish by following the finger guide, the meadow
// restored with a rank, the way back to the house, and no GPU objects left behind.

import { expect, test, type Page } from '@playwright/test';

// A player in English who has seen the opening and not restored anything yet.
const FRESH = {
  version: 7,
  profiles: [
    {
      id: 'a',
      name: 'David',
      settings: { uiLanguage: 'en', theme: 'light', textSpeed: 'fast' },
      track: 1,
      layout: 'en',
      story: { ranks: {}, flags: { intro: true, hub: true } },
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true, autoQuality: 'low' },
};

interface HubProbe {
  ready: boolean;
  failed: boolean;
  doors: Record<string, string>;
  opened: string | null;
  restored: number;
  step: (seconds: number) => void;
}

interface Probe {
  ready: boolean;
  failed: boolean;
  word: string;
  words: number;
  total: number;
  chapter: string;
  tutorial: boolean;
  level: string;
  difficulty: string;
  levels: string[];
  ended: boolean;
  text: string;
  keys: string;
  bloomed: number;
  flowers: number;
  green: number;
  birds: number;
  restored: boolean;
  line: string;
  nextKey: string | null;
  nextShift: string | null;
  results: { rank: string; xp: number; accuracy: number; failed: boolean } | null;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
}

const hub = (page: Page): Promise<HubProbe> =>
  page.evaluate(() => (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub);
const meadow = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotMeadow: Probe }).__otiyotMeadow);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotMeadow: Probe }).__otiyotMeadow.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotMeadow?: Probe }).__otiyotMeadow;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await meadow(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('Home Row Meadow', () => {
  test.setTimeout(480_000);

  test('from the map: the lesson, the words, the meadow restored, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, JSON.stringify(FRESH));

    // The hub's map offers the Meadow as the next place on the road.
    await page.goto('/#/hub');
    await page.waitForFunction(
      () => (window as unknown as { __otiyotHub?: HubProbe }).__otiyotHub?.ready === true,
      null,
      { timeout: 120_000 },
    );
    const word = (await hub(page)).doors.desk ?? '';
    expect(word.length).toBeGreaterThan(1);
    for (const ch of word) await page.keyboard.press(ch);
    for (let i = 0; i < 40 && !(await hub(page)).opened; i++) {
      await page.evaluate(() =>
        (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub.step(0.5),
      );
    }
    const map = page.getByTestId('hub-map');
    await expect(map).toBeVisible();
    await map.locator('[data-region="meadow"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('meadow')).toBeVisible();
    await waitReady(page);
    let p = await meadow(page);
    expect(p.failed).toBe(false);

    // A first visit starts with Reb Ezra's lesson, on Calm and Easy, and the whole text is
    // spelled only with the keys of lesson one (learned letters only).
    expect(p.tutorial).toBe(true);
    expect(p.chapter).toBe('hands');
    expect(p.difficulty).toBe('calm');
    expect(p.levels).toEqual(['easy']);
    expect(p.keys.replace(/\s/g, '')).toMatch(/^[fj]+$/);
    expect(p.text).toMatch(/^[fj ]+$/);
    expect(p.total).toBeGreaterThan(20);
    expect(p.bloomed).toBe(0);
    await expect(page.locator('.meadow__skip')).toBeVisible();
    await expect(page.locator('[data-pick="level:hard"]').first()).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    // A wrong key is soft: nothing ends, the word waits.
    await page.keyboard.press('KeyQ');
    expect((await meadow(page)).ended).toBe(false);

    // Type the whole run by following the guide. Flowers open with the letters, the green
    // spreads with the words, and the chapters follow one another.
    const seen = new Set<string>();
    let keys = 0;
    let lastGreen = 0;
    while (!(p = await meadow(page)).ended) {
      seen.add(p.chapter);
      await pressGuide(page);
      keys += 1;
      if (keys % 20 === 0) {
        await step(page, 0.5);
        const now = await meadow(page);
        expect(now.green).toBeGreaterThanOrEqual(lastGreen);
        lastGreen = now.green;
        expect(now.bloomed).toBeGreaterThan(0);
      }
      if (keys > 2000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['hands', 'look', 'flow']);
    expect(p.words).toBe(p.total);

    // The finale: every flower opens, the birds are back, and the results card shows a rank.
    await step(page, 4);
    p = await meadow(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.bloomed).toBe(p.flowers);
    expect(p.birds).toBeGreaterThan(0);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Meadow is restored');

    // The rank is saved, and Enter leads back to the house, where the Meadow is now restored.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.meadow ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toBe('scene:meadow:easy:calm');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotMeadow: Probe }).__otiyotMeadow.leaked !== null,
    );
    p = await meadow(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('the lesson can be skipped, and a returning player goes straight to the words', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, JSON.stringify(FRESH));
    await page.goto('/#/meadow');
    await waitReady(page);
    expect((await meadow(page)).chapter).toBe('hands');
    const before = (await meadow(page)).total;
    await pressGuide(page);
    await page.keyboard.press('Escape');
    const p = await meadow(page);
    expect(p.tutorial).toBe(false);
    expect(p.chapter).toBe('look');
    expect(p.words).toBe(0);
    expect(p.total).toBeLessThan(before);
    expect(p.line).toBe('dyo:skip');
    await expect(page.locator('.meadow__skip')).toBeHidden();
    // Esc now leaves for the house, like everywhere else.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
