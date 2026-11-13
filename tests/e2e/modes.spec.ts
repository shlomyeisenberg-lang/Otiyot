// Smoke test for the modes screen (T31): Practice, Time Attack, Survival and the Daily Challenge,
// all opened from #/modes (the hub's practice slate leads here). Words are typed by following the
// finger guide, which only ever shows learned letters; each finished run writes a statistics-only
// history entry; Escape goes back to the lobby.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

function savedPlayer(lessons = 24): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
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
    version: 8,
    profiles: [p],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'low' },
  });
}

interface Probe {
  view: string;
  mode: string;
  word: string;
  nextKey: string | null;
  nextShift: string | null;
  words: number;
  goal: number;
  grip: number | null;
  timeLeft: number | null;
  mods: string;
  region: string;
  guide: string;
  ended: boolean;
  outcome: string | null;
  score: number;
  saved: number;
  empty: boolean;
}

const probe = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const p = (window as unknown as { __otiyotModes: Probe }).__otiyotModes;
    return JSON.parse(JSON.stringify(p)) as Probe;
  });
const stepClock = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) =>
      (window as unknown as { __otiyotModes: { step(s: number): void } }).__otiyotModes.step(s),
    seconds,
  );
const history = (page: Page): Promise<{ mode: string; chars: number; accuracy: number }[]> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('otiyot_save');
    const save = raw
      ? (JSON.parse(raw) as {
          profiles: { history: { mode: string; chars: number; accuracy: number }[] }[];
        })
      : null;
    return save?.profiles[0]?.history ?? [];
  });

async function pressGuide(page: Page): Promise<void> {
  const p = await probe(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

/** Types by the guide until the run is over (or the key budget is spent). */
async function typeToEnd(page: Page, budget = 1500): Promise<void> {
  for (let i = 0; i < budget; i++) {
    if ((await probe(page)).ended) return;
    await pressGuide(page);
  }
  throw new Error('the run never ended');
}

test.describe('Modes', () => {
  test.setTimeout(240_000);

  test('practice, time attack, survival and the daily challenge', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full pass is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

    await page.goto('/#/modes');
    const modes = page.getByTestId('modes');
    await expect(modes).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Next lesson' })).toBeVisible();

    // Practice: weak keys (a general drill for a fresh record), typed through and saved.
    await page.getByRole('radio', { name: /Practice/ }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect.poll(async () => (await probe(page)).view).toBe('run');
    const first = await probe(page);
    expect(first.word.length).toBeGreaterThan(0);
    await typeToEnd(page);
    await expect(modes.getByRole('button', { name: 'Choose another mode' })).toBeVisible();
    let h = await history(page);
    expect(h.some((e) => e.mode.startsWith('mode:practice:'))).toBe(true);

    // Escape from the results goes back to the lobby.
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await probe(page)).view).toBe('lobby');

    // Time Attack on Calm: no clock, a quota of words, with the mirror and the fog.
    await page.getByRole('radio', { name: /Time Attack/ }).click();
    await page.locator('[data-field="difficulty"]').selectOption('calm');
    await expect(page.getByText(/20.*words, no clock/)).toBeVisible();
    await page.locator('[data-mod="mirror"]').click();
    await page.locator('[data-mod="fog"]').click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect.poll(async () => (await probe(page)).view).toBe('run');
    expect((await probe(page)).mods).toBe('mirror,fog');
    await expect(modes).toHaveClass(/modes--fog/);
    await typeToEnd(page);
    let p = await probe(page);
    expect(p.outcome).toBe('quota');
    expect(p.words).toBe(20);
    expect(p.score).toBeGreaterThan(0);
    h = await history(page);
    expect(h.some((e) => e.mode.startsWith('mode:timeattack:'))).toBe(true);
    await modes.getByRole('button', { name: 'Choose another mode' }).click();

    // Survival on Steady: the grip drains with the clock and the run falls when it is gone.
    await page.getByRole('radio', { name: /Survival/ }).click();
    await page.locator('[data-field="difficulty"]').selectOption('steady');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect.poll(async () => (await probe(page)).view).toBe('run');
    await pressGuide(page);
    await stepClock(page, 5);
    p = await probe(page);
    expect(p.grip).not.toBeNull();
    expect(p.grip as number).toBeLessThan(100);
    await stepClock(page, 200);
    p = await probe(page);
    expect(p.outcome).toBe('tired');
    await expect(modes.getByText('Your grip gave out')).toBeVisible();
    h = await history(page);
    expect(h.some((e) => e.mode.startsWith('mode:survival:'))).toBe(true);
    await modes.getByRole('button', { name: 'Choose another mode' }).click();

    // Daily Challenge: today's plan is shown, a fixed number of words, best kept for the date.
    await page.getByRole('radio', { name: /Daily Challenge/ }).click();
    await expect(page.getByTestId('modes-daily')).toContainText('Not played today yet');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect.poll(async () => (await probe(page)).view).toBe('run');
    expect((await probe(page)).goal).toBe(30);
    await typeToEnd(page, 3000);
    p = await probe(page);
    expect(['crossed', 'quota', 'tired']).toContain(p.outcome);
    h = await history(page);
    expect(h.some((e) => /^mode:daily:\d{4}-\d{2}-\d{2}$/.test(e.mode))).toBe(true);

    await modes.getByRole('button', { name: 'Choose another mode' }).click();
    await page.getByRole('radio', { name: /Daily Challenge/ }).click();
    await expect(page.getByTestId('modes-daily')).toContainText('Your best today');

    // Nothing typed is ever stored: only counts and statistics.
    for (const e of h)
      expect(Object.keys(e).sort()).toEqual([
        'accuracy',
        'at',
        'chars',
        'durationMs',
        'mode',
        'track',
        'wpm',
      ]);
    expect(errors).toEqual([]);
  });
});
