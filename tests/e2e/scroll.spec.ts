// Smoke test for the Blank Scroll (T27): the whole final played from start to finish by
// following the finger guide (the five columns of the crossing, the Keeper's four phases, the
// ending cutscene, the typed credits, the results and the New Game+ flag), and the Keeper's
// last phase from a checkpoint in Hebrew on the night theme. Set SCROLL_SHOTS=dir to save
// screenshots on the way.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

const SHOTS = process.env.SCROLL_SHOTS ?? '';

/** A player who has learned most of the keyboard and restored everything up to the Arena. */
function savedPlayer(
  lang: 'en' | 'he' = 'en',
  flags: Record<string, boolean> = {},
  theme: 'light' | 'dark' = 'light',
): string {
  const p = createProfile('a', 'David', 0);
  p.layout = lang;
  p.track = 1;
  p.settings.uiLanguage = lang;
  p.settings.theme = theme;
  p.settings.textSpeed = 'instant';
  for (const id of ['meadow', 'cliffs', 'blot', 'arena']) p.story.ranks[id] = 3;
  p.story.flags.intro = true;
  p.story.flags.hub = true;
  Object.assign(p.story.flags, flags);
  let done = 0;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= 40) break;
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

interface Probe {
  ready: boolean;
  failed: boolean;
  phase: number;
  phases: number;
  state: string;
  health: number;
  texts: string[];
  keys: string;
  checkpoint: number;
  nextKey: string | null;
  nextShift: string | null;
  cutscene: { playing: boolean; beat: string; waiting: boolean; done: boolean };
  credits: { on: boolean; typed: number; total: number; lines: number; done: boolean };
  restored: boolean;
  blotBroken: boolean;
  boss: string;
  line: string;
  results: { rank: string; xp: number; accuracy: number; failed: boolean } | null;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
  scene: { drawn: number; pageLines: number; caller: string | null } | null;
}
type Win = { __otiyotArena: Probe };

const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as Win).__otiyotArena);
const stage = (page: Page): Promise<{ drawn: number; pageLines: number; caller: string | null }> =>
  page.evaluate(() => {
    const s = (window as unknown as Win).__otiyotArena.scene;
    return { drawn: s?.drawn ?? -1, pageLines: s?.pageLines ?? -1, caller: s?.caller ?? null };
  });
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate((s) => (window as unknown as Win).__otiyotArena.step(s), seconds);
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as Partial<Win>).__otiyotArena;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );
const guide = (
  page: Page,
): Promise<{
  key: string | null;
  shift: string | null;
  state: string;
  phase: number;
  credits: boolean;
}> =>
  page.evaluate(() => {
    const a = (window as unknown as Win).__otiyotArena;
    return {
      key: a.nextKey,
      shift: a.nextShift,
      state: a.state,
      phase: a.phase,
      credits: a.credits.on,
    };
  });

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function press(page: Page, g: { key: string | null; shift: string | null }): Promise<void> {
  if (!g.key) throw new Error('the guide shows no key');
  if (g.shift) await page.keyboard.down(g.shift);
  await page.keyboard.press(g.key);
  if (g.shift) await page.keyboard.up(g.shift);
}

/** Types the current phase to its end, stepping the world a little as a player would. */
async function typePhase(page: Page, label: string): Promise<void> {
  const phase = (await guide(page)).phase;
  let presses = 0;
  let called = false;
  for (;;) {
    const g = await guide(page);
    if (g.state !== 'fight' || g.phase !== phase) break;
    await press(page, g);
    presses += 1;
    if (presses % 12 === 0) await step(page, 0.4);
    if (presses === 26) await shot(page, `${label}-fight`);
    if (!called && presses % 6 === 0 && (await stage(page)).caller) {
      called = true;
      await step(page, 0.3);
      await shot(page, `${label}-call`);
    }
    if (presses > 600) throw new Error('the phase never ends');
  }
}

async function throughTransition(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(150);
  await step(page, 1.2);
  await shot(page, `${label}-walk`);
  for (let i = 0; i < 30 && (await probe(page)).state === 'transition'; i++) await step(page, 0.25);
}

const saved = (
  page: Page,
): Promise<{ ranks: Record<string, number>; flags: Record<string, boolean> }> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('otiyot_save') ?? '{}').profiles[0].story);

/** The ending (Enter through its lines), then the credits typed to their end. */
async function throughEnding(page: Page, label: string): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as Win).__otiyotArena.cutscene.playing,
    null,
    { timeout: 20_000 },
  );
  await step(page, 1.6);
  await shot(page, `${label}-still`);
  const seen = new Set<string>();
  for (let i = 0; i < 60 && (await probe(page)).cutscene.playing; i++) {
    const beat = (await probe(page)).cutscene.beat;
    if (!seen.has(beat)) {
      seen.add(beat);
      await step(page, 1.4);
      await shot(page, `${label}-beat-${beat}`);
    }
    await page.keyboard.press('Enter');
    await step(page, 1);
  }
  await page.waitForFunction(() => (window as unknown as Win).__otiyotArena.credits.on, null, {
    timeout: 20_000,
  });
}

test.describe('The Blank Scroll', () => {
  test.setTimeout(900_000);

  test('the whole final: the crossing, the Keeper, the ending and the credits', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full run is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    await page.goto('/#/scroll');
    await expect(page.getByTestId('scroll')).toBeVisible();
    await waitReady(page);
    let p = await probe(page);
    expect(p.failed).toBe(false);
    expect(p.boss).toBe('scroll');
    expect(p.phases).toBe(9);
    expect(p.texts).toHaveLength(9);
    // Learned letters only.
    for (const text of p.texts) {
      for (const ch of text) if (ch !== ' ') expect(p.keys).toContain(ch);
    }
    await step(page, 2);
    await shot(page, 'c1');
    expect((await stage(page)).drawn).toBe(0);

    for (let phase = 0; phase < 9; phase++) {
      const name = phase < 5 ? `c${phase + 1}` : `k${phase - 4}`;
      await typePhase(page, name);
      p = await probe(page);
      if (phase < 5) expect((await stage(page)).drawn).toBe((phase + 1) * 6);
      if (phase < 8) {
        expect(p.state).toBe('transition');
        await throughTransition(page, name);
        p = await probe(page);
        expect(p.state).toBe('fight');
        expect(p.phase).toBe(phase + 1);
        await step(page, 1.5);
        await shot(page, phase + 1 < 5 ? `c${phase + 2}` : `k${phase - 3}`);
      }
      if (phase === 6) expect((await stage(page)).pageLines).toBeGreaterThan(10);
    }
    p = await probe(page);
    expect(p.state).toBe('victory');
    expect(p.health).toBe(0);
    // Saved at once: the scroll's rank and the New Game+ flag.
    let story = await saved(page);
    expect(story.ranks.scroll).toBeGreaterThan(0);
    expect(story.flags.ngplus).toBe(true);

    await throughEnding(page, 'ending');
    p = await probe(page);
    expect(p.restored).toBe(true);
    expect(p.blotBroken).toBe(true);
    await expect(page.getByTestId('credits')).toBeVisible();
    expect(p.credits.total).toBe(7);
    // The credit words are from learned letters too.
    for (const ch of p.texts[9] ?? '') if (ch !== ' ') expect(p.keys).toContain(ch);
    await step(page, 2.5);
    await shot(page, 'credits-start');
    for (let n = 0; n < 400; n++) {
      const g = await guide(page);
      if (!g.credits) break;
      await press(page, g);
      if (n % 10 === 9) await step(page, 0.5);
      if (n === 18) await shot(page, 'credits-mid');
    }
    p = await probe(page);
    expect(p.credits.done).toBe(true);
    expect(p.credits.lines).toBe(7);
    await expect(page.locator('.credits__line').nth(5)).toContainText('David');
    await shot(page, 'credits-end');
    await expect(page.locator('.meadow__results')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.meadow__results')).toContainText('New Game+');
    p = await probe(page);
    expect(p.results?.rank).toMatch(/[SABC]/);
    await shot(page, 'results');
    story = await saved(page);
    expect(Object.keys(story.flags).filter((k) => k.startsWith('boss:scroll:'))).toHaveLength(0);

    // Enter leads home; nothing leaks.
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 30_000 });
    const left = await page.evaluate(() => (window as unknown as Win).__otiyotArena);
    expect(left.leaked).toBe(0);
    expect(left.sceneLeak).toBe(0);
    expect(errors).toEqual([]);
  });

  test('the Keeper erases in his last phase; Hebrew, night theme, from a checkpoint', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      (save) => {
        if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
      },
      savedPlayer('he', { 'boss:scroll:9': true }, 'dark'),
    );
    await page.goto('/#/scroll');
    await waitReady(page);
    let p = await probe(page);
    expect(p.failed).toBe(false);
    expect(p.checkpoint).toBe(8);
    expect(p.phase).toBe(8);
    // The crossing behind him stands drawn.
    expect((await stage(page)).drawn).toBe(30);
    for (const ch of p.texts[8] ?? '') if (ch !== ' ') expect(p.keys).toContain(ch);
    await step(page, 2);
    const before = (await stage(page)).pageLines;
    await shot(page, 'he-k4');
    // Type half a dozen letters, then wait: the eraser wins lines back on Calm too (a little).
    for (let i = 0; i < 14; i++) await press(page, await guide(page));
    const typed = (await probe(page)).health;
    await step(page, 6);
    await shot(page, 'he-k4-erased');
    p = await probe(page);
    expect(p.health).toBeGreaterThan(typed);
    expect(before).toBeGreaterThan(20);
    await typePhase(page, 'he-k4');
    p = await probe(page);
    expect(p.state).toBe('victory');
    // Escape skips the ending and then the credits: never a soft-lock.
    await page.waitForFunction(
      () => (window as unknown as Win).__otiyotArena.cutscene.playing,
      null,
      { timeout: 20_000 },
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window as unknown as Win).__otiyotArena.credits.on, null, {
      timeout: 20_000,
    });
    await step(page, 2);
    await shot(page, 'he-credits');
    await page.keyboard.press('Escape');
    await expect(page.locator('.meadow__results')).toBeVisible({ timeout: 20_000 });
    p = await probe(page);
    expect(p.restored).toBe(true);
    expect(p.blotBroken).toBe(true);
    expect(errors).toEqual([]);
  });
});
