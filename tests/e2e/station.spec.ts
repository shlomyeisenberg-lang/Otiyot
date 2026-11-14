// Smoke test for the Star Station (T22): from the hub's map up to the station, the sentences typed
// from start to finish by following the finger guide, the apprentice drifting from module to
// module and docking, the turret breaking a rock for every word, the stars coming back, a rock
// that reaches the hull striking on Steady (and never on Calm), the station restored with a rank,
// the way back to the house, and no GPU objects left behind.

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
  p.story.flags['ch:station.start'] = true;
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
  rock: number;
  drift: number;
  strikes: number;
  cleared: number;
  rocks: number;
  docked: number;
  online: number;
  modules: number;
  stars: number;
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
const station = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotStation: Probe }).__otiyotStation);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotStation: Probe }).__otiyotStation.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotStation?: Probe }).__otiyotStation;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await station(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('The Star Station', () => {
  test.setTimeout(480_000);

  test('from the map: drift, dock, clear the debris, count the stars, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the Station once the course is at Level 4 and the Great Blot is beaten.
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
    await map.locator('[data-region="station"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('station')).toBeVisible();
    await waitReady(page);
    let p = await station(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('outer');
    expect(p.leg).toBe('drift');
    expect(p.difficulty).toBe('calm');
    expect(p.timers).toBe(false);
    expect(p.levels).toContain('easy');
    expect(p.modules).toBeGreaterThanOrEqual(3);
    expect(p.total).toBeGreaterThanOrEqual(p.modules * 2 * 2);
    expect(p.docked).toBe(0);
    const firstStars = p.stars;
    expect(firstStars).toBeGreaterThan(0);
    // Learned keys only: every character of the text is a learned key (or a space).
    const keys = new Set(p.keys);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);

    // A wrong key is soft: nothing ends and the word waits; the apprentice does not move.
    await page.keyboard.press('KeyZ');
    await step(page, 1);
    p = await station(page);
    expect(p.ended).toBe(false);
    expect(p.drift).toBe(0);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    const legs = new Set<string>();
    let keysTyped = 0;
    let lastDrift = 0;
    let lastLeg = 0;
    let lastStars = firstStars;
    let calmChecked = false;
    while (!(p = await station(page)).ended) {
      seen.add(p.chapter);
      legs.add(p.leg);
      // On Calm the first rock comes in to its hold and waits there, however long it takes.
      if (p.leg === 'turret' && !calmChecked) {
        calmChecked = true;
        await step(page, 30);
        const held = await station(page);
        expect(held.rock).toBeGreaterThan(0.3);
        expect(held.strikes).toBe(0);
      }
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 5 === 0) {
        await step(page, 0.5);
        const now = await station(page);
        // The drift only goes forward within a sentence; the stars only grow.
        if (now.leg === 'drift' && now.legIndex === lastLeg) {
          expect(now.drift).toBeGreaterThanOrEqual(lastDrift - 1e-6);
        }
        expect(now.stars).toBeGreaterThanOrEqual(lastStars);
        expect(now.cleared).toBeLessThanOrEqual(now.rocks);
        lastDrift = now.drift;
        lastLeg = now.legIndex;
        lastStars = now.stars;
      }
      if (keysTyped > 3000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['outer', 'ring', 'observatory']);
    expect(legs.has('drift') && legs.has('turret')).toBe(true);
    expect(calmChecked).toBe(true);
    expect(p.words).toBe(p.total);

    // The finale: every module docked and online, every rock broken cleanly, all the stars back.
    await step(page, 4);
    p = await station(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.docked).toBe(p.modules);
    expect(p.online).toBe(p.modules);
    expect(p.strikes).toBe(0);
    expect(p.cleared).toBe(p.rocks);
    expect(p.stars).toBeGreaterThan(firstStars);
    expect(p.travelled).toBeGreaterThan(30);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Star Station is restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.station ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:station:(easy|standard|hard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotStation: Probe }).__otiyotStation.leaked !== null,
    );
    p = await station(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('on Steady a rock that reaches the hull strikes and comes in again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/station');
    await waitReady(page);
    await page.locator('.meadow__pill').click();
    await page.locator('[data-pick="difficulty:steady"]').first().click();
    await page.getByRole('button', { name: 'Start again' }).click();
    let p = await station(page);
    expect(p.difficulty).toBe('steady');
    expect(p.timers).toBe(true);
    // The drift has no timer: wait as long as you like, nothing strikes.
    await step(page, 20);
    expect((await station(page)).strikes).toBe(0);
    // Float to the first module, then let the first rock come all the way in.
    while ((await station(page)).leg === 'drift') await pressGuide(page);
    p = await station(page);
    expect(p.leg).toBe('turret');
    expect(p.docked).toBe(1);
    await pressGuide(page);
    await step(page, 40);
    p = await station(page);
    expect(p.strikes).toBeGreaterThan(0);
    expect(p.ended).toBe(false);
    expect(p.rock).toBeGreaterThan(0);
    // The word is still there to finish; the rock that struck no longer counts as clean.
    const before = p.words;
    while ((await station(page)).words <= before) await pressGuide(page);
    p = await station(page);
    expect(p.cleared).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
