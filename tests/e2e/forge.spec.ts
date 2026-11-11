// Smoke test for the Gematria Forge (T17): from the hub's map into the scene, the numbers typed
// from start to finish by following the finger guide, the furnace warming with every key and
// cooling with time, a letter forged for every number, the four lamps lit, the cave restored
// with a rank, the way back to the house, and no GPU objects left behind.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/**
 * A player in English who has learned most of the keyboard and the number row, and has restored
 * the Meadow, the Cliffs and the Great Blot.
 */
function savedPlayer(): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.settings.textSpeed = 'fast';
  p.story.ranks.meadow = 3;
  p.story.ranks.cliffs = 3;
  p.story.ranks.blot = 3;
  p.story.flags.numberRow = true;
  p.story.flags.intro = true;
  p.story.flags.hub = true;
  let done = 0;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= 60) break;
      recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 });
      done += 1;
    }
  }
  return JSON.stringify({
    version: 7,
    profiles: [p],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'low' },
  });
}

interface HubProbe {
  ready: boolean;
  failed: boolean;
  doors: Record<string, string>;
  opened: string | null;
  step: (seconds: number) => void;
}

interface Probe {
  ready: boolean;
  failed: boolean;
  word: string;
  words: number;
  total: number;
  chapter: string;
  level: string;
  difficulty: string;
  levels: string[];
  ended: boolean;
  text: string;
  keys: string;
  heat: number;
  temper: 'cold' | 'good' | 'hot';
  forged: ('cold' | 'good' | 'hot')[];
  glyphs: string;
  values: number[];
  lamps: number;
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
const forge = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotForge: Probe }).__otiyotForge);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotForge: Probe }).__otiyotForge.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotForge?: Probe }).__otiyotForge;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await forge(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('Gematria Forge', () => {
  test.setTimeout(480_000);

  test('from the map: forge a letter for every number, the lamps light, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the Forge once the number row is learned and the Great Blot is beaten.
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
    await map.locator('[data-region="forge"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('forge')).toBeVisible();
    await waitReady(page);
    let p = await forge(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('stoke');
    expect(p.difficulty).toBe('calm');
    expect(p.levels).toContain('easy');
    expect(p.total).toBeGreaterThanOrEqual(8);
    expect(p.lamps).toBe(0);
    expect(p.forged).toEqual([]);
    // Learned keys only: the whole text is digits and spaces, all of them learned.
    const keys = new Set(p.keys.replace(/\s/g, ''));
    expect(p.text).toMatch(/^[0-9 ]+$/);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);
    // One letter and one value for every number.
    expect([...p.glyphs]).toHaveLength(p.total);
    expect(p.values.map(String)).toEqual(p.text.split(' '));

    // A wrong key is soft: nothing ends, the fire flares and the number waits.
    const cold = p.heat;
    await page.keyboard.press('KeyZ');
    p = await forge(page);
    expect(p.ended).toBe(false);
    expect(p.heat).toBeGreaterThan(cold);
    // Without typing the fire only cools.
    const warm = (await forge(page)).heat;
    await step(page, 3);
    // (It does not cool before the first right key.)
    expect((await forge(page)).heat).toBeLessThanOrEqual(warm);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    let keysTyped = 0;
    let lastLamps = 0;
    let peak = 0;
    while (!(p = await forge(page)).ended) {
      seen.add(p.chapter);
      peak = Math.max(peak, p.heat);
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 6 === 0) {
        await step(page, 0.8);
        const now = await forge(page);
        expect(now.heat).toBeGreaterThanOrEqual(0);
        expect(now.heat).toBeLessThanOrEqual(1);
        expect(now.lamps).toBeGreaterThanOrEqual(lastLamps);
        expect(now.lamps).toBeLessThanOrEqual(4);
        lastLamps = now.lamps;
        expect(now.forged.length).toBeLessThanOrEqual(now.words);
      }
      if (keysTyped > 2000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['stoke', 'forge', 'quench']);
    expect(peak).toBeGreaterThan(0.4);
    expect(p.words).toBe(p.total);

    // The finale: every lamp is lit, a letter was forged for every number, the results card
    // shows a rank.
    await step(page, 4);
    p = await forge(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.lamps).toBe(4);
    expect(p.forged).toHaveLength(p.total);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Forge is restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.forge ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:forge:(easy|standard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotForge: Probe }).__otiyotForge.leaked !== null,
    );
    p = await forge(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('the fire cools between keys, Esc leaves, and a restart lays out a fresh run', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/forge');
    await waitReady(page);
    const before = await forge(page);
    expect(before.failed).toBe(false);
    await pressGuide(page);
    await pressGuide(page);
    const hot = (await forge(page)).heat;
    await step(page, 6);
    expect((await forge(page)).heat).toBeLessThan(hot);
    await page.locator('.meadow__pill').click();
    await page.getByRole('button', { name: 'Start again' }).click();
    const after = await forge(page);
    expect(after.words).toBe(0);
    expect(after.forged).toEqual([]);
    expect(after.lamps).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });

  test('without the number row the Forge stays shut and sends the player home', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one check is enough');
    await page.addInitScript(
      (save) => {
        if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
      },
      savedPlayer().replace('"numberRow":true', '"numberRow":false'),
    );
    await page.goto('/#/forge');
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 120_000 });
  });
});
