// Smoke test for Wings over Hermon (T21): from the hub's map into the storm, the words typed
// from start to finish by following the finger guide, a hailstone broken for every word, the
// clouds breaking, lightning showing the next word, a stone that lands striking the eagle on
// Steady (and never on Calm), the valley restored with a rank, the way back to the house, and no
// GPU objects left behind.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/** A player in English who has learned most of the keyboard and restored the first three regions (the course is past Level 4). */
function savedPlayer(lessons = 60): string {
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
  stone: number;
  strikes: number;
  caught: number;
  reveal: number;
  storm: number;
  flown: number;
  timers: boolean;
  breaks: number;
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
const hermon = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotHermon: Probe }).__otiyotHermon);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotHermon: Probe }).__otiyotHermon.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotHermon?: Probe }).__otiyotHermon;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await hermon(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('Wings over Hermon', () => {
  test.setTimeout(480_000);

  test('from the map: break every stone, the storm passes, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers Hermon once the course is at Level 4 and the Great Blot is beaten.
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
    await map.locator('[data-region="hermon"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('hermon')).toBeVisible();
    await waitReady(page);
    let p = await hermon(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('gathering');
    expect(p.difficulty).toBe('calm');
    expect(p.timers).toBe(false);
    expect(p.levels).toContain('easy');
    expect(p.total).toBeGreaterThanOrEqual(9);
    expect(p.breaks).toBe(0);
    expect(p.storm).toBe(1);
    // Before the first key the stone hangs at the top of its fall.
    await step(page, 3);
    expect((await hermon(page)).stone).toBe(1);
    // Learned keys only: every character of the text is a learned key (or a space).
    const keys = new Set(p.keys);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);

    // A wrong key is soft: nothing ends and the word waits.
    await page.keyboard.press('KeyZ');
    p = await hermon(page);
    expect(p.ended).toBe(false);

    // On Calm a stone comes down to its hold and waits there, however long it takes.
    await step(page, 30);
    p = await hermon(page);
    expect(p.stone).toBeGreaterThan(0.3);
    expect(p.strikes).toBe(0);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    let keysTyped = 0;
    let lastBreaks = 0;
    let revealed = false;
    while (!(p = await hermon(page)).ended) {
      seen.add(p.chapter);
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 6 === 0) {
        await step(page, 0.5);
        const now = await hermon(page);
        expect(now.breaks).toBeGreaterThanOrEqual(lastBreaks);
        expect(now.breaks).toBeLessThanOrEqual(3);
        expect(now.storm).toBeGreaterThanOrEqual(0);
        expect(now.storm).toBeLessThanOrEqual(1);
        expect(now.caught).toBeLessThanOrEqual(now.words);
        if (now.words > 0 && now.reveal > 0) revealed = true;
        lastBreaks = now.breaks;
      }
      if (keysTyped > 2000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['gathering', 'heart', 'summit']);
    expect(p.words).toBe(p.total);
    // Lightning showed a next word at least once on the way.
    expect(revealed).toBe(true);

    // The finale: the clouds have parted, every stone was caught, and the card shows a rank.
    await step(page, 4);
    p = await hermon(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.breaks).toBe(3);
    expect(p.storm).toBe(0);
    expect(p.strikes).toBe(0);
    expect(p.caught).toBe(p.total);
    expect(p.flown).toBeGreaterThan(0);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('Wings over Hermon is restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.hermon ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:hermon:(easy|standard|hard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotHermon: Probe }).__otiyotHermon.leaked !== null,
    );
    p = await hermon(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('on Steady a stone that lands strikes the eagle and comes down again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/hermon');
    await waitReady(page);
    await page.locator('.meadow__pill').click();
    await page.locator('[data-pick="difficulty:steady"]').first().click();
    await page.getByRole('button', { name: 'Start again' }).click();
    let p = await hermon(page);
    expect(p.difficulty).toBe('steady');
    expect(p.timers).toBe(true);
    // Type two letters to start the flight and build a small streak, then wait it out.
    await pressGuide(page);
    await pressGuide(page);
    await step(page, 40);
    p = await hermon(page);
    expect(p.strikes).toBeGreaterThan(0);
    expect(p.ended).toBe(false);
    expect(p.stone).toBeGreaterThan(0);
    // The word is still there to finish; the stone that struck no longer counts as caught.
    while ((await hermon(page)).words < 1) await pressGuide(page);
    p = await hermon(page);
    expect(p.caught).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
