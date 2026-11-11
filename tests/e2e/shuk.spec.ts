// Smoke test for the Night Shuk (T18): from the hub's map into the scene, the trades typed from
// start to finish by following the finger guide (words with the punctuation marks the player has
// learned), coins in the purse, clean deals in a row, a lantern lit for every quarter, the market
// restored with a rank, the way back to the house, and no GPU objects left behind.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/** A player in English who has learned most of the keyboard and restored the first three regions. */
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
  coins: number;
  streak: number;
  haggles: number;
  marks: number;
  usable: string;
  planCoins: number;
  stalls: number;
  lanterns: number;
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
const shuk = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotShuk: Probe }).__otiyotShuk);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotShuk: Probe }).__otiyotShuk.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotShuk?: Probe }).__otiyotShuk;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await shuk(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

test.describe('Night Shuk', () => {
  test.setTimeout(480_000);

  test('from the map: trade at every stall, the lanterns light, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the Shuk once the course is at Level 2 and the Great Blot is beaten.
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
    await map.locator('[data-region="shuk"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('shuk')).toBeVisible();
    await waitReady(page);
    let p = await shuk(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('lane');
    expect(p.difficulty).toBe('calm');
    expect(p.levels).toContain('easy');
    expect(p.total).toBeGreaterThanOrEqual(8);
    expect(p.lanterns).toBe(0);
    expect(p.coins).toBe(0);
    // Learned keys only: every character of the text is a learned key (or a space).
    const keys = new Set(p.keys);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);
    // The marks in the text are exactly the usable ones.
    const marks = [...p.text].filter((ch) => /[.,;:!?'-]/.test(ch));
    for (const m of marks) expect(p.usable.includes(m), m).toBe(true);
    expect(p.planCoins).toBeGreaterThanOrEqual(p.total);

    // A wrong key is soft: nothing ends and the trade waits.
    await page.keyboard.press('KeyZ');
    p = await shuk(page);
    expect(p.ended).toBe(false);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    let keysTyped = 0;
    let lastLanterns = 0;
    let lastCoins = 0;
    while (!(p = await shuk(page)).ended) {
      seen.add(p.chapter);
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 6 === 0) {
        await step(page, 0.8);
        const now = await shuk(page);
        expect(now.lanterns).toBeGreaterThanOrEqual(lastLanterns);
        expect(now.lanterns).toBeLessThanOrEqual(4);
        expect(now.coins).toBeGreaterThanOrEqual(lastCoins);
        expect(now.stalls).toBeLessThanOrEqual(now.words);
        lastLanterns = now.lanterns;
        lastCoins = now.coins;
      }
      if (keysTyped > 2000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['lane', 'bazaar', 'square']);
    expect(p.words).toBe(p.total);

    // The finale: every lantern is lit, a stall was opened for every trade, the results card
    // shows a rank.
    await step(page, 4);
    p = await shuk(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.lanterns).toBe(4);
    expect(p.coins).toBeGreaterThanOrEqual(p.planCoins);
    expect(p.marks).toBe(marks.length);
    expect(p.haggles).toBeGreaterThanOrEqual(1);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('The Night Shuk is restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.shuk ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:shuk:(easy|standard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotShuk: Probe }).__otiyotShuk.leaked !== null,
    );
    p = await shuk(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Esc leaves, and a restart lays out a fresh run', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/shuk');
    await waitReady(page);
    const before = await shuk(page);
    expect(before.failed).toBe(false);
    await pressGuide(page);
    await pressGuide(page);
    await page.locator('.meadow__pill').click();
    await page.getByRole('button', { name: 'Start again' }).click();
    const after = await shuk(page);
    expect(after.words).toBe(0);
    expect(after.coins).toBe(0);
    expect(after.lanterns).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
