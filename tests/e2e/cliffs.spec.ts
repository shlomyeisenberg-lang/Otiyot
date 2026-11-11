// Smoke test for the Cliffs of Ein Gedi (T15): from the hub's map into the scene, the words
// typed from start to finish by following the finger guide, the scribe reaching up and down
// from stone to stone, the four waterfalls started again, the canyon restored with a rank, the
// way back to the house, and no GPU objects left behind.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/** A player in English who has learned most of the keyboard and restored the Meadow. */
function savedPlayer(): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.settings.textSpeed = 'fast';
  p.story.ranks.meadow = 3;
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
  stone: number;
  height: number;
  reach: 'up' | 'level' | 'down';
  reaches: string[];
  falls: number;
  ibex: number;
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
const cliffs = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotCliffs: Probe }).__otiyotCliffs);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotCliffs: Probe }).__otiyotCliffs.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotCliffs?: Probe }).__otiyotCliffs;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await cliffs(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('Cliffs of Ein Gedi', () => {
  test.setTimeout(480_000);

  test('from the map: stone by stone across the canyon, the falls flow, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the Cliffs once enough letters are learned.
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
    await map.locator('[data-region="cliffs"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('cliffs')).toBeVisible();
    await waitReady(page);
    let p = await cliffs(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('ledge');
    expect(p.difficulty).toBe('calm');
    expect(p.levels).toContain('easy');
    expect(p.total).toBeGreaterThanOrEqual(12);
    expect(p.falls).toBe(0);
    expect(p.ibex).toBe(0);
    expect(p.stone).toBe(0);
    // Learned letters only: every letter of the run is a key this player has learned.
    const keys = new Set(p.keys.replace(/\s/g, ''));
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);
    // He has learned the top and bottom rows, so the run has stones that reach both ways.
    expect(p.reaches).toContain('up');
    expect(p.reaches).toContain('down');

    // A wrong key is soft: nothing ends, the word waits.
    await page.keyboard.press('Digit9');
    expect((await cliffs(page)).ended).toBe(false);

    // Type the whole run by following the guide. The scribe hops up and down the stones, a
    // waterfall starts at the end of each quarter, and the chapters follow one another.
    const seen = new Set<string>();
    const reaches = new Set<string>();
    const heights = new Set<number>();
    let keysTyped = 0;
    let lastFalls = 0;
    while (!(p = await cliffs(page)).ended) {
      seen.add(p.chapter);
      reaches.add(p.reach);
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 10 === 0) {
        await step(page, 0.8);
        const now = await cliffs(page);
        heights.add(Math.round(now.height * 10));
        expect(now.falls).toBeGreaterThanOrEqual(lastFalls);
        expect(now.falls - lastFalls).toBeLessThanOrEqual(1);
        lastFalls = now.falls;
        expect(now.stone).toBeLessThanOrEqual(now.words + 1);
      }
      if (keysTyped > 2000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['ledge', 'canyon', 'summit']);
    expect(reaches.has('up')).toBe(true);
    expect(reaches.has('down')).toBe(true);
    expect(heights.size).toBeGreaterThan(1);
    expect(p.words).toBe(p.total);

    // The finale: every waterfall flows, the ibex are back, and the results card shows a rank.
    await step(page, 4);
    p = await cliffs(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.falls).toBe(4);
    expect(p.ibex).toBeGreaterThan(0);
    expect(p.stone).toBe(p.total);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Cliffs are restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.cliffs ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:cliffs:(easy|standard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotCliffs: Probe }).__otiyotCliffs.leaked !== null,
    );
    p = await cliffs(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Esc leaves for the house, and a restart lays out a fresh run', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/cliffs');
    await waitReady(page);
    const before = await cliffs(page);
    expect(before.failed).toBe(false);
    await pressGuide(page);
    await page.locator('.meadow__pill').click();
    await page.getByRole('button', { name: 'Start again' }).click();
    const after = await cliffs(page);
    expect(after.words).toBe(0);
    expect(after.stone).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
