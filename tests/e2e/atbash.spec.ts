// Smoke test for Atbash City (T23): from the hub's map into the rain, every code typed from start
// to finish by following the finger guide, the gate signs shown in atbash, every gate opened in
// turn, the signs coming back on, a patrol drone that comes back before the code is done spotting
// the apprentice on Steady (and never on Calm), the city restored with a rank, the way back to
// the house, and no GPU objects left behind.

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
  patrol: number;
  spotted: number;
  unseen: number;
  legs: number;
  opened: number;
  gates: number;
  signs: number;
  travelled: number;
  cipher: string;
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
const city = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotAtbash: Probe }).__otiyotAtbash);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotAtbash: Probe }).__otiyotAtbash.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotAtbash?: Probe }).__otiyotAtbash;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** Presses the key the finger guide shows (holding its Shift when it asks for one). */
async function pressGuide(page: Page): Promise<void> {
  const p = await city(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

/** The alphabet turned backward (English only here). */
const atbash = (w: string): string =>
  [...w]
    .map((ch) => {
      const i = 'abcdefghijklmnopqrstuvwxyz'.indexOf(ch.toLowerCase());
      if (i < 0) return ch;
      const out = 'zyxwvutsrqponmlkjihgfedcba'[i] as string;
      return ch === ch.toLowerCase() ? out : out.toUpperCase();
    })
    .join('');

test.describe('Atbash City', () => {
  test.setTimeout(480_000);

  test('from the map: break the codes, open the gates, light the city, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The hub's map offers the city once the course is at Level 5.
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
    await map.locator('[data-region="atbash"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('atbash')).toBeVisible();
    await waitReady(page);
    let p = await city(page);
    expect(p.failed).toBe(false);
    expect(p.chapter).toBe('market');
    expect(p.leg).toBe('cipher');
    expect(p.difficulty).toBe('calm');
    expect(p.timers).toBe(false);
    expect(p.levels).toContain('easy');
    expect(p.gates).toBeGreaterThanOrEqual(3);
    expect(p.legs).toBe(p.gates * 2);
    expect(p.opened).toBe(0);
    // The gate's sign shows the code in atbash.
    expect(p.cipher).toBe(atbash(p.word));
    // Learned keys only: every character of the text is a learned key (or a space).
    const keys = new Set(p.keys);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);

    // A wrong key is soft: nothing ends and the word waits.
    await page.keyboard.press('KeyZ');
    await step(page, 1);
    p = await city(page);
    expect(p.ended).toBe(false);
    expect(p.words).toBe(0);

    // Type the whole run by following the guide.
    const seen = new Set<string>();
    const legs = new Set<string>();
    let keysTyped = 0;
    let lastSigns = 0;
    let lastOpened = 0;
    let calmChecked = false;
    while (!(p = await city(page)).ended) {
      seen.add(p.chapter);
      legs.add(p.leg);
      // On Calm the drone circles far off, however long it takes.
      if (p.words > 0 && !calmChecked) {
        calmChecked = true;
        await step(page, 40);
        const held = await city(page);
        expect(held.patrol).toBeGreaterThan(0.5);
        expect(held.spotted).toBe(0);
      }
      await pressGuide(page);
      keysTyped += 1;
      if (keysTyped % 5 === 0) {
        await step(page, 0.5);
        const now = await city(page);
        // The signs and the gates only ever come back.
        expect(now.signs).toBeGreaterThanOrEqual(lastSigns);
        expect(now.opened).toBeGreaterThanOrEqual(lastOpened);
        if (now.word) expect(now.cipher).toBe(atbash(now.word));
        lastSigns = now.signs;
        lastOpened = now.opened;
      }
      if (keysTyped > 3000) throw new Error('the run never ended');
    }
    expect([...seen]).toEqual(['market', 'towers', 'vault']);
    expect(legs.has('cipher') && legs.has('sequence')).toBe(true);
    expect(calmChecked).toBe(true);
    expect(p.words).toBe(p.total);

    // The finale: every gate open, never spotted, every sign lit.
    await step(page, 4);
    p = await city(page);
    expect(p.restored).toBe(true);
    expect(p.chapter).toBe('finale');
    expect(p.opened).toBe(p.gates);
    expect(p.spotted).toBe(0);
    expect(p.unseen).toBe(p.legs);
    expect(p.signs).toBe(48);
    expect(p.travelled).toBeGreaterThan(30);
    expect(p.results?.failed).toBe(false);
    expect(['S', 'A']).toContain(p.results?.rank);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText('Atbash City is restored');

    // The rank is saved, and Enter leads back to the house.
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('otiyot_save');
      const save = raw
        ? (JSON.parse(raw) as {
            profiles: { story: { ranks: Record<string, number> }; history: { mode: string }[] }[];
          })
        : null;
      const profile = save?.profiles[0];
      return { rank: profile?.story.ranks.atbash ?? 0, mode: profile?.history.at(-1)?.mode };
    });
    expect(saved.rank).toBeGreaterThanOrEqual(3);
    expect(saved.mode).toMatch(/^scene:atbash:(easy|standard|hard):calm$/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotAtbash: Probe }).__otiyotAtbash.leaked !== null,
    );
    p = await city(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('on Steady a patrol that comes back first spots the apprentice and goes round again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/atbash');
    await waitReady(page);
    await page.locator('.meadow__pill').click();
    await page.locator('[data-pick="difficulty:steady"]').first().click();
    await page.getByRole('button', { name: 'Start again' }).click();
    let p = await city(page);
    expect(p.difficulty).toBe('steady');
    expect(p.timers).toBe(true);
    // Walk up to the gate, type one letter (the drone leaves), then wait for it to come back.
    await step(page, 3);
    await pressGuide(page);
    await step(page, 60);
    p = await city(page);
    expect(p.spotted).toBeGreaterThan(0);
    expect(p.ended).toBe(false);
    expect(p.patrol).toBeGreaterThan(0);
    // The code is still there to finish; this leg no longer counts as unseen.
    while ((await city(page)).leg === 'cipher') await pressGuide(page);
    p = await city(page);
    expect(p.unseen).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub')).toBeVisible();
  });
});
