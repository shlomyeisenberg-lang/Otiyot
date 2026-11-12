// Smoke test for the Silent Arena's trials (T26): the trials board, the Storm Hawk fought from
// start to finish by following the finger guide (bursts, transitions, the victory cutscene, its
// rank on the board), the Glass Golem healed by a slip, and the Long Tide's last phase from a
// checkpoint restoring the whole Arena. Set ARENA_SHOTS=dir to save screenshots on the way.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

const SHOTS = process.env.ARENA_SHOTS ?? '';

/** A player in English who has learned most of the keyboard and restored the Meadow and Cliffs. */
function savedPlayer(
  flags: Record<string, boolean> = {},
  theme: 'light' | 'dark' = 'light',
): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = theme;
  p.settings.textSpeed = 'instant';
  p.story.ranks.meadow = 3;
  p.story.ranks.cliffs = 3;
  p.story.ranks.blot = 3;
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
  windup: number;
  word: string;
  words: number;
  total: number;
  texts: string[];
  keys: string;
  checkpoint: number;
  difficulty: string;
  nextKey: string | null;
  nextShift: string | null;
  cutscene: { playing: boolean; beat: string; waiting: boolean; done: boolean };
  restored: boolean;
  blotBroken: boolean;
  boss: string;
  look: string;
  healed: number;
  resting: boolean;
  level: string;
  results: { rank: string; xp: number; accuracy: number; failed: boolean } | null;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
}

const arena = (page: Page): Promise<Probe> =>
  page.evaluate(() => (window as unknown as { __otiyotArena: Probe }).__otiyotArena);
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotArena: Probe }).__otiyotArena.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotArena?: Probe }).__otiyotArena;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

/** The key the finger guide shows now, and where the fight is (one light round trip). */
const guide = (
  page: Page,
): Promise<{ key: string | null; shift: string | null; state: string; phase: number }> =>
  page.evaluate(() => {
    const a = (window as unknown as { __otiyotArena: Probe }).__otiyotArena;
    return { key: a.nextKey, shift: a.nextShift, state: a.state, phase: a.phase };
  });

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Types the current phase to its end, stepping the world a little as a player would. */
async function typePhase(page: Page, label: string): Promise<void> {
  const phase = (await guide(page)).phase;
  let presses = 0;
  for (;;) {
    const g = await guide(page);
    if (g.state !== 'fight' || g.phase !== phase) break;
    if (!g.key) throw new Error(`the guide shows no key (state ${g.state})`);
    if (g.shift) await page.keyboard.down(g.shift);
    await page.keyboard.press(g.key);
    if (g.shift) await page.keyboard.up(g.shift);
    presses += 1;
    if (presses % 12 === 0) await step(page, 0.4);
    if (presses === 14) await shot(page, `${label}-fight`);
    if (presses > 400) throw new Error('the phase never ends');
  }
}

/** Plays out the victory cutscene (Enter through its lines) until the results card shows. */
async function throughVictory(page: Page, label: string): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __otiyotArena: Probe }).__otiyotArena.cutscene.playing,
    null,
    { timeout: 20_000 },
  );
  await step(page, 1.6);
  await shot(page, `${label}-shatter`);
  for (let i = 0; i < 40 && (await arena(page)).cutscene.playing; i++) {
    await page.keyboard.press('Enter');
    await step(page, 1);
    if (i === 2) await shot(page, `${label}-restored`);
  }
  await expect(page.locator('.meadow__results')).toBeVisible({ timeout: 20_000 });
}

const saved = (
  page: Page,
): Promise<{ ranks: Record<string, number>; flags: Record<string, boolean> }> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('otiyot_save') ?? '{}').profiles[0].story);

test.describe('The Trials of the Arena', () => {
  test.setTimeout(600_000);

  test('the board, and the Storm Hawk from start to finish', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full fight is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    await page.goto('/#/trials');
    const board = page.getByTestId('trials');
    await expect(board).toBeVisible();
    await expect(board.locator('.trials__card')).toHaveCount(3);
    await expect(board.locator('[data-trial="storm"]')).toHaveAttribute('data-state', 'next');
    await shot(page, 'board');

    await page.keyboard.press('1');
    await expect(page.getByTestId('trial')).toBeVisible();
    await expect(page.getByTestId('trial')).toHaveAttribute('data-boss', 'storm');
    await waitReady(page);
    let p = await arena(page);
    expect(p.failed).toBe(false);
    expect(p.boss).toBe('trial-storm');
    expect(p.texts).toHaveLength(3);
    for (const text of p.texts) {
      for (const ch of text) if (ch !== ' ') expect(p.keys).toContain(ch);
    }
    await step(page, 2);
    await shot(page, 'storm-p1');

    for (let phase = 0; phase < 3; phase++) {
      await typePhase(page, `storm-p${phase + 1}`);
      p = await arena(page);
      if (phase < 2) {
        expect(p.state).toBe('transition');
        await page.waitForTimeout(150);
        await step(page, 0.9);
        await shot(page, `storm-p${phase + 1}-to-p${phase + 2}`);
        for (let i = 0; i < 20 && (await arena(page)).state === 'transition'; i++) {
          await step(page, 0.25);
        }
        p = await arena(page);
        expect(p.state).toBe('fight');
        expect(p.phase).toBe(phase + 1);
        await step(page, 1.5);
        await shot(page, `storm-p${phase + 2}`);
      }
    }
    p = await arena(page);
    expect(p.state).toBe('victory');
    await throughVictory(page, 'storm');
    p = await arena(page);
    expect(p.results?.rank).toMatch(/[SABC]/);
    await shot(page, 'storm-results');
    const story = await saved(page);
    expect(story.ranks['trial:storm']).toBeGreaterThan(0);
    expect(story.ranks.arena).toBeUndefined();

    // Enter leads back to the board, where the Storm Hawk now shows its rank.
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('trials')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-trial="storm"]')).toHaveAttribute('data-state', 'beaten');
    await expect(page.locator('[data-trial="glass"]')).toHaveAttribute('data-state', 'next');
    const left = await page.evaluate(
      () => (window as unknown as { __otiyotArena: Probe }).__otiyotArena,
    );
    expect(left.leaked).toBe(0);
    expect(left.sceneLeak).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a slip heals the Golem; the last trial restores the Arena', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const base = JSON.parse(savedPlayer({ 'boss:trial-tide:3': true }, 'dark'));
    base.profiles[0].story.ranks['trial:storm'] = 4;
    base.profiles[0].story.ranks['trial:glass'] = 3;
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, JSON.stringify(base));

    // The Glass Golem: type a few right letters, then a wrong one — the crack mends.
    await page.goto('/#/trials');
    await page.keyboard.press('2');
    await waitReady(page);
    await step(page, 2);
    await shot(page, 'glass-p1');
    for (let i = 0; i < 3; i++) {
      const g = await guide(page);
      if (g.shift) await page.keyboard.down(g.shift);
      await page.keyboard.press(g.key ?? 'KeyA');
      if (g.shift) await page.keyboard.up(g.shift);
    }
    const g = await guide(page);
    await page.keyboard.press(g.key === 'KeyF' ? 'KeyJ' : 'KeyF');
    const p0 = await arena(page);
    expect(p0.look).toBe('glass');
    expect(p0.healed).toBeGreaterThan(0);
    await step(page, 0.3);
    await shot(page, 'glass-heal');

    // The Long Tide, from its last phase's checkpoint.
    await page.goto('/#/trials');
    await expect(page.getByTestId('trials')).toBeVisible();
    await page.keyboard.press('3');
    await waitReady(page);
    let p = await arena(page);
    expect(p.look).toBe('tide');
    expect(p.checkpoint).toBe(2);
    expect(p.phase).toBe(2);
    await step(page, 2);
    await shot(page, 'tide-p3');
    await typePhase(page, 'tide-p3');
    p = await arena(page);
    expect(p.state).toBe('victory');
    await throughVictory(page, 'tide');
    await expect(page.locator('.meadow__results')).toContainText('Silent Arena is restored');
    const story = await saved(page);
    expect(story.ranks['trial:tide']).toBeGreaterThan(0);
    expect(story.ranks.arena).toBeGreaterThan(0);
    expect(Object.keys(story.flags).filter((k) => k.startsWith('boss:trial-tide:'))).toHaveLength(
      0,
    );
    await page.keyboard.press('Enter');
    await expect(page.locator('.trials__whole')).toBeVisible({ timeout: 30_000 });
    await shot(page, 'board-whole');
    expect(errors).toEqual([]);
  });

  test('the board fits a phone screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'phone only');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/trials');
    const cards = page.locator('.trials__card');
    await expect(cards).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const box = await cards.nth(i).boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scroll).toBeLessThanOrEqual(375);
  });
});
