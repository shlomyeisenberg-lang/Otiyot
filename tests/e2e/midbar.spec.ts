// Smoke test for the Long Midbar (T24): from the hub's map out onto the caravan road, the
// sentences typed from start to finish by following the finger guide, the caravan walking from
// well to well, the sandstorm closing the sight and hiding the words ahead, a gust for every storm
// word that waits on Calm and buffets the caravan on Steady, the oasis restored with a rank, the
// way back to the house, and no GPU objects left behind.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/** A player in English who has learned most of the keyboard and restored the first three regions (the course is past Level 5). */
function savedPlayer(lessons = 90): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.settings.textSpeed = 'fast';
  p.story.ranks.meadow = 3;
  p.story.ranks.cliffs = 3;
  p.story.ranks.blot = 3;
  p.story.flags.intro = true;
  p.story.flags.hub = true;
  let done = 0;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= lessons) break;
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
  leg: string;
  legIndex: number;
  gust: number;
  march: number;
  storm: number;
  sight: number;
  ahead: number;
  veiled: boolean;
  buffets: number;
  steady: number;
  gusts: number;
  wells: number;
  stages: number;
  travelled: number;
  timers: boolean;
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
const midbar = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotMidbar: Probe }).__otiyotMidbar);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotMidbar: Probe }).__otiyotMidbar.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotMidbar?: Probe }).__otiyotMidbar;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await midbar(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('The Long Midbar', () => {
  test.setTimeout(480_000);

  test('from the map: cross the dunes, weather the storms, reach the oasis, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the Midbar once the course is at Level 5 and the Great Blot is beaten.
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
    await map.locator('[data-region="midbar"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('midbar')).toBeVisible();
    await waitReady(page);
    let p = await midbar(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('dunes');
    expect(p.leg).toBe('trek');
    expect(p.difficulty).toBe('calm');
    expect(p.timers).toBe(false);
    expect(p.levels).toContain('easy');
    expect(p.stages).toBeGreaterThanOrEqual(3);
    expect(p.total).toBeGreaterThanOrEqual(p.stages * 2 * 3);
    expect(p.wells).toBe(0);
    expect(p.storm).toBe(0);
    // In clear weather the next words can be read on the road ahead.
    expect(p.ahead).toBeGreaterThan(0);
    expect(p.veiled).toBe(false);
    // Learned keys only: every character of the text is a learned key (or a space).
    const keys = new Set(p.keys);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);

    // A wrong key is soft: nothing ends and the word waits; the caravan does not move.
    await page.keyboard.press('KeyZ');
    await step(page, 1);
    p = await midbar(page);
    expect(p.ended).toBe(false);
    expect(p.march).toBe(0);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    const legs = new Set<string>();
    let keysTyped = 0;
    let lastMarch = 0;
    let lastLeg = 0;
    let lastWells = 0;
    let calmChecked = false;
    while (!(p = await midbar(page)).ended) {
      seen.add(p.chapter);
      legs.add(p.leg);
      if (p.leg === 'storm' && !calmChecked) {
        calmChecked = true;
        // On Calm the first gust rolls in to its hold and waits there, however long it takes.
        await step(page, 30);
        const held = await midbar(page);
        expect(held.gust).toBeGreaterThan(0.3);
        expect(held.buffets).toBe(0);
        // The storm is thick: the sight has closed in.
        expect(held.storm).toBeGreaterThan(0.8);
        expect(held.sight).toBeLessThan(40);
      }
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 5 === 0) {
        await step(page, 0.5);
        const now = await midbar(page);
        // The caravan only goes forward within a stage; the wells only add up.
        if (now.legIndex === lastLeg) expect(now.march).toBeGreaterThanOrEqual(lastMarch - 1e-6);
        expect(now.wells).toBeGreaterThanOrEqual(lastWells);
        expect(now.steady).toBeLessThanOrEqual(now.gusts);
        lastMarch = now.legIndex === lastLeg || now.march > 0 ? now.march : 0;
        lastLeg = now.legIndex;
        lastWells = now.wells;
      }
      if (keysTyped > 4000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['dunes', 'wadi', 'oasis']);
    expect(legs.has('trek') && legs.has('storm')).toBe(true);
    expect(calmChecked).toBe(true);
    expect(p.words).toBe(p.total);

    // The finale: every well reached, every gust walked through, the storm gone, the oasis green.
    await step(page, 4);
    p = await midbar(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.wells).toBe(p.stages);
    expect(p.buffets).toBe(0);
    expect(p.steady).toBe(p.gusts);
    expect(p.storm).toBeLessThan(0.2);
    expect(p.travelled).toBeGreaterThan(100);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Long Midbar is restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.midbar ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:midbar:(easy|standard|hard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotMidbar: Probe }).__otiyotMidbar.leaked !== null,
    );
    p = await midbar(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('on Standard a storm hides the words ahead, and a gust that arrives buffets the caravan', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/midbar');
    await waitReady(page);
    await page.locator('.meadow__pill').click();
    await page.locator('[data-pick="difficulty:steady"]').first().click();
    await page.locator('[data-pick="level:standard"]').first().click();
    await page.getByRole('button', { name: 'Start again' }).click();
    let p = await midbar(page);
    expect(p.difficulty).toBe('steady');
    expect(p.level).toBe('standard');
    expect(p.timers).toBe(true);
    // The clear road has no timer: wait as long as you like, nothing buffets the caravan.
    await step(page, 20);
    expect((await midbar(page)).buffets).toBe(0);
    // Walk the clear sentence, then the storm comes and the words ahead go into the sand.
    while ((await midbar(page)).leg === 'trek') await pressGuide(page);
    p = await midbar(page);
    expect(p.leg).toBe('storm');
    expect(p.ahead).toBe(0);
    expect(p.veiled).toBe(true);
    await expect(page.locator('.hud[data-veil="storm"]')).toHaveCount(1);
    await pressGuide(page);
    await step(page, 40);
    p = await midbar(page);
    expect(p.buffets).toBeGreaterThan(0);
    expect(p.ended).toBe(false);
    expect(p.gust).toBeGreaterThan(0);
    // The word is still there to finish; the gust that buffeted no longer counts as walked through.
    const before = p.words;
    while ((await midbar(page)).words <= before) await pressGuide(page);
    p = await midbar(page);
    expect(p.steady).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
