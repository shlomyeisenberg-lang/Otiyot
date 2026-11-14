// Smoke test for the Lantern Caves (T25): from the hub's map down into the chalk caves, every
// passage typed from start to finish by following the finger guide, the lantern fed by right
// letters and dimmed by stumbles (the shadows creeping closer), a lamp lit at the end of every
// chamber, the Hall of Lamps restored with a rank, the way back to the house, and no GPU objects
// left behind. A second run on Steady lets the lantern burn down until the light goes out.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/** A player in English who has learned most of the keyboard and restored the first three regions (the course is past Level 6). */
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
  p.story.flags['ch:caves.start'] = true;
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
  chamber: number;
  level: string;
  difficulty: string;
  levels: string[];
  ended: boolean;
  text: string;
  keys: string;
  light: number;
  reach: number;
  streak: number;
  walk: number;
  ahead: number;
  veiled: boolean;
  flares: number;
  outs: number;
  lamps: number;
  chambers: number;
  burn: number;
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
const caves = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const p = (window as unknown as { __otiyotCaves: Probe }).__otiyotCaves;
    // A plain copy, so the live getters are read inside the page.
    return JSON.parse(JSON.stringify(p)) as Probe;
  });
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotCaves: Probe }).__otiyotCaves.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotCaves?: Probe }).__otiyotCaves;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await caves(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

/** Presses a key that is not the one the guide asks for: a stumble. */
async function stumble(page: Page): Promise<void> {
  const p = await caves(page);
  await page.keyboard.press(p.nextKey === 'KeyQ' ? 'KeyZ' : 'KeyQ');
}

test.describe('The Lantern Caves', () => {
  test.setTimeout(480_000);

  test('from the map: keep the lantern lit, light the lamps, reach the Hall, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the caves once the course is at Level 6 and the Great Blot is beaten.
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
    await map.locator('[data-region="caves"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('caves')).toBeVisible();
    await waitReady(page);
    let p = await caves(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('mouth');
    expect(p.difficulty).toBe('calm');
    expect(p.timers).toBe(false);
    expect(p.burn).toBe(0);
    expect(p.levels).toContain('easy');
    expect(p.chambers).toBeGreaterThanOrEqual(3);
    expect(p.total).toBeGreaterThanOrEqual(p.chambers * 5);
    expect(p.lamps).toBe(0);
    expect(p.light).toBeGreaterThan(0.5);
    // With the lantern burning bright the next words can be read on the chalk ahead.
    expect(p.ahead).toBeGreaterThan(0);
    expect(p.veiled).toBe(false);
    // Learned keys only: every character of the text is a learned key (or a space).
    const keys = new Set(p.keys);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);

    // A stumble is soft: nothing ends, the apprentice does not step, the lantern dims and the
    // shadows creep closer.
    const before = p;
    await stumble(page);
    await step(page, 1);
    p = await caves(page);
    expect(p.ended).toBe(false);
    expect(p.walk).toBe(0);
    expect(p.light).toBeLessThan(before.light);
    expect(p.reach).toBeLessThan(before.reach);
    // On Calm the flame never burns down, however long one waits.
    const waited = p.light;
    await step(page, 30);
    p = await caves(page);
    expect(p.light).toBeCloseTo(waited, 5);
    expect(p.outs).toBe(0);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    let keysTyped = 0;
    let lastLamps = 0;
    while (!(p = await caves(page)).ended) {
      seen.add(p.chapter);
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 6 === 0) {
        await step(page, 0.5);
        const now = await caves(page);
        // The lamps only add up; on Calm the light never goes out.
        expect(now.lamps).toBeGreaterThanOrEqual(lastLamps);
        expect(now.light).toBeGreaterThan(0.2);
        expect(now.outs).toBe(0);
        lastLamps = now.lamps;
      }
      if (keysTyped > 4000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['mouth', 'galleries', 'hall']);
    expect(p.words).toBe(p.total);
    // Clean streaks made the lantern flare and pushed the shadows back.
    expect(p.flares).toBeGreaterThan(0);

    // The finale: every lamp lit, the shadows gone, the Hall of Lamps restored.
    await step(page, 4);
    p = await caves(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.lamps).toBe(p.chambers);
    expect(p.outs).toBe(0);
    expect(p.light).toBe(1);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A', 'B']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Lantern Caves are restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.caves ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(2);
    expect(saved.mode).toMatch(/^scene:caves:(easy|standard|hard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotCaves: Probe }).__otiyotCaves.leaked !== null,
    );
    p = await caves(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('on Steady stumbles hide the words ahead, and a lantern left to burn goes out', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/caves');
    await waitReady(page);
    await page.locator('.meadow__pill').click();
    await page.locator('[data-pick="difficulty:steady"]').first().click();
    await page.locator('[data-pick="level:standard"]').first().click();
    await page.getByRole('button', { name: 'Start again' }).click();
    let p = await caves(page);
    expect(p.difficulty).toBe('steady');
    expect(p.level).toBe('standard');
    expect(p.timers).toBe(true);
    expect(p.burn).toBeGreaterThan(0);
    // The flame waits for the first key of the passage before it burns.
    const start = p.light;
    await step(page, 20);
    expect((await caves(page)).light).toBeCloseTo(start, 5);
    // Three stumbles: the lantern gutters, and the words ahead are lost in the dark.
    for (let i = 0; i < 3; i++) await stumble(page);
    await step(page, 0.3);
    p = await caves(page);
    expect(p.light).toBeLessThan(0.33);
    expect(p.ahead).toBe(0);
    expect(p.veiled).toBe(true);
    await expect(page.locator('.hud[data-veil="dark"]')).toHaveCount(1);
    // Left to burn, the light goes out: the shadows touch the apprentice, and it is lit again.
    await step(page, 60);
    p = await caves(page);
    expect(p.outs).toBeGreaterThan(0);
    expect(p.ended).toBe(false);
    expect(p.light).toBeGreaterThan(0);
    // Typing on feeds it again and the apprentice walks on.
    const words = p.words;
    while ((await caves(page)).words <= words) await pressGuide(page);
    p = await caves(page);
    expect(p.walk).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
