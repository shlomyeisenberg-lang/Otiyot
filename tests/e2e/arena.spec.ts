// Smoke test for the Silent Arena and the Great Blot (T16): from the hub's map into the fight,
// all four phases typed by following the finger guide (with a cinematic transition between
// each), the victory cutscene, the region restored with a rank, Act Two opened on the map, a
// checkpoint kept and resumed, and no GPU objects left behind. Set ARENA_SHOTS=dir to save
// screenshots of every phase on the way (used for the visual review).

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
  p.story.flags.intro = true;
  p.story.flags['ch:blot.start'] = true;
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
  results: { rank: string; xp: number; accuracy: number; failed: boolean } | null;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
}

interface HubProbe {
  ready: boolean;
  doors: Record<string, string>;
  opened: string | null;
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

test.describe('The Silent Arena', () => {
  test.setTimeout(600_000);

  test('from the map: four phases, the victory, Act Two opens, and home again', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full fight is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    // The map offers the Great Blot once the Cliffs are restored; Act Two still waits for it.
    await page.goto('/#/hub');
    await page.waitForFunction(
      () => (window as unknown as { __otiyotHub?: HubProbe }).__otiyotHub?.ready === true,
      null,
      { timeout: 120_000 },
    );
    const desk = (await page.evaluate(
      () => (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub.doors.desk,
    )) as string;
    for (const ch of desk) await page.keyboard.press(ch);
    const map = page.getByTestId('hub-map');
    for (let i = 0; i < 40 && !(await map.isVisible()); i++) {
      await page.evaluate(() =>
        (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub.step(0.5),
      );
    }
    await expect(map).toBeVisible();
    await expect(map.locator('[data-region="shuk"]')).toHaveAttribute('data-state', 'locked');
    await expect(map.locator('[data-region="shuk"]')).toContainText('Great Blot');
    await map.locator('[data-region="blot"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('arena')).toBeVisible();
    await waitReady(page);
    let p = await arena(page);
    expect(p.failed).toBe(false);
    expect(p.phase).toBe(0);
    expect(p.difficulty).toBe('calm');
    expect(p.texts).toHaveLength(4);
    // Learned letters only, in every phase.
    for (const text of p.texts) {
      for (const ch of text) if (ch !== ' ') expect(p.keys).toContain(ch);
    }
    // Phase IV gives back Phase I's words, last first.
    const firstWords = p.texts[0]!.split(' ');
    const mirrored = p.texts[3]!.split(' ');
    expect(mirrored).toEqual([...firstWords].reverse().slice(0, mirrored.length));
    await expect(page.locator('.arena__boss')).toBeVisible();
    await step(page, 2);
    await shot(page, 'p1-start');

    // On Calm the attack creeps in and waits; it never lands.
    await step(page, 20);
    p = await arena(page);
    expect(p.windup).toBeGreaterThan(0.5);
    expect(p.state).toBe('fight');

    for (let phase = 0; phase < 4; phase++) {
      await typePhase(page, `p${phase + 1}`);
      p = await arena(page);
      if (phase < 3) {
        expect(p.state).toBe('transition');
        await page.waitForTimeout(150);
        await step(page, 0.9);
        await shot(page, `p${phase + 1}-to-p${phase + 2}`);
        // The quill rests between phases.
        await page.keyboard.press('a');
        for (let i = 0; i < 20 && (await arena(page)).state === 'transition'; i++) {
          await step(page, 0.25);
        }
        p = await arena(page);
        expect(p.state).toBe('fight');
        expect(p.phase).toBe(phase + 1);
        await step(page, 1.5);
        await shot(page, `p${phase + 2}-start`);
        // A checkpoint is kept for the new phase.
        const flags = await page.evaluate(
          () => JSON.parse(localStorage.getItem('otiyot_save') ?? '{}').profiles[0].story.flags,
        );
        expect(flags[`boss:blot:${phase + 2}`]).toBe(true);
      }
    }
    p = await arena(page);
    expect(p.state).toBe('victory');
    expect(p.health).toBe(0);

    // The victory cutscene plays: the Blot breaks, the arena is restored.
    await page.waitForFunction(
      () => (window as unknown as { __otiyotArena: Probe }).__otiyotArena.cutscene.playing,
      null,
      { timeout: 20_000 },
    );
    await step(page, 1.6);
    await shot(page, 'victory-shatter');
    await step(page, 3);
    p = await arena(page);
    expect(p.blotBroken).toBe(true);
    for (let i = 0; i < 30 && !(await arena(page)).restored; i++) await step(page, 0.5);
    expect((await arena(page)).restored).toBe(true);
    await step(page, 2);
    await shot(page, 'victory-restored');
    // Lines wait for Enter; the last beat is the act card, then the results.
    for (let i = 0; i < 40 && (await arena(page)).cutscene.playing; i++) {
      await page.keyboard.press('Enter');
      await step(page, 1);
      if (i === 3) await shot(page, 'victory-ezra');
    }
    await expect(page.locator('.meadow__results')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'results');
    p = await arena(page);
    expect(p.cutscene.done).toBe(true);
    expect(p.results?.failed).toBe(false);
    expect(p.results?.rank).toMatch(/[SABC]/);

    // Saved: the region's rank, Act Two, and the checkpoints forgotten.
    const story = await page.evaluate(
      () => JSON.parse(localStorage.getItem('otiyot_save') ?? '{}').profiles[0].story,
    );
    expect(story.ranks.blot).toBeGreaterThan(0);
    expect(story.flags.act2).toBe(true);
    expect(Object.keys(story.flags).filter((k) => k.startsWith('boss:blot:'))).toHaveLength(0);

    // Enter leads home; nothing is left on the graphics card.
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('arena')).toBeHidden({ timeout: 30_000 });
    const left = await page.evaluate(
      () => (window as unknown as { __otiyotArena: Probe }).__otiyotArena,
    );
    expect(left.leaked).toBe(0);
    expect(left.sceneLeak).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a checkpoint resumes the fight at its phase, and Esc skips the victory', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop only');
    await page.addInitScript(
      (save) => {
        if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
      },
      savedPlayer({ 'boss:blot:2': true, 'boss:blot:3': true, 'boss:blot:4': true }, 'dark'),
    );
    await page.goto('/#/arena');
    await waitReady(page);
    let p = await arena(page);
    expect(p.checkpoint).toBe(3);
    expect(p.phase).toBe(3);
    expect(p.health).toBeLessThan(0.4);
    await step(page, 2);
    await shot(page, 'dark-p4');
    await typePhase(page, 'dark-p4');
    p = await arena(page);
    expect(p.state).toBe('victory');
    await page.waitForFunction(
      () => (window as unknown as { __otiyotArena: Probe }).__otiyotArena.cutscene.playing,
      null,
      { timeout: 20_000 },
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.meadow__results')).toBeVisible({ timeout: 20_000 });
    p = await arena(page);
    expect(p.restored).toBe(true);
    await step(page, 3);
    await shot(page, 'dark-results');
  });

  test('fits a phone screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'phone only');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/arena');
    await waitReady(page);
    await expect(page.locator('.arena__boss')).toBeVisible();
    const box = await page.locator('.arena__boss').boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  });
});
