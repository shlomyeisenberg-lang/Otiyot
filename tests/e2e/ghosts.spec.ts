// Smoke test for ghosts and local leaderboards (T37): a saved best run appears as a translucent
// train on the Jaffa Line and moves with the clock, the Records tab lists the boards of this
// profile and this device, a ghost is exported and a friend's ghost file is imported.

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

function savedPlayer(): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.story.ranks.meadow = 3;
  p.story.ranks.cliffs = 3;
  p.story.ranks.blot = 3;
  p.story.flags.intro = true;
  p.story.flags['ch:rail.start'] = true;
  p.story.flags.hub = true;
  let done = 0;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) {
    for (const l of t.lessons(lvl.id, p.layout, p.layout)) {
      if (done >= 60) break;
      recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 });
      done += 1;
    }
  }
  p.ghosts['rail|easy:calm'] = [
    {
      at: 1,
      name: 'David',
      score: 321,
      wpm: 31,
      accuracy: 98,
      durationMs: 20000,
      marks: Array.from({ length: 12 }, (_, i) => (i + 1) * 2000),
      imported: false,
    },
  ];
  const other = createProfile('b', 'Miriam', 0);
  other.ghosts['rail|easy:calm'] = [
    {
      at: 2,
      name: 'Miriam',
      score: 400,
      wpm: 40,
      accuracy: 99,
      durationMs: 15000,
      marks: [1500],
      imported: false,
    },
  ];
  return JSON.stringify({
    version: 11,
    profiles: [p, other],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'low' },
  });
}

interface RailProbe {
  ready: boolean;
  failed: boolean;
  ghostScore: number | null;
  ghostAt: number;
  nextKey: string | null;
  nextShift: string | null;
  step: (seconds: number) => void;
}

const rail = (page: Page): Promise<RailProbe> =>
  page.evaluate(() => (window as unknown as { __otiyotRail: RailProbe }).__otiyotRail);

test.describe('Ghosts and records', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one viewport is enough');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
  });

  test('the best run is raced as a ghost train that moves with time', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/#/rail');
    await page.waitForFunction(
      () => {
        const p = (window as unknown as { __otiyotRail?: RailProbe }).__otiyotRail;
        return p?.ready === true || p?.failed === true;
      },
      null,
      { timeout: 120_000 },
    );
    let p = await rail(page);
    expect(p.failed).toBe(false);
    expect(p.ghostScore).toBe(321);
    expect(p.ghostAt).toBeCloseTo(0, 1);
    // The clock of the ghost starts with the first key.
    await step(page, 3);
    expect((await rail(page)).ghostAt).toBeCloseTo(0, 1);
    if (p.nextKey) await page.keyboard.press(p.nextKey);
    await step(page, 5);
    p = await rail(page);
    expect(p.ghostAt).toBeGreaterThan(0.3);
    expect(errors).toEqual([]);
  });

  test('records: boards of this profile and this device, export and import', async ({ page }) => {
    await page.goto('/#/stats');
    await page.getByRole('tab', { name: 'Records' }).click();
    const panel = page.getByTestId('records');
    await expect(panel).toBeVisible();
    await expect(panel.locator('select')).toContainText('Jaffa Line');
    // This profile has one line; the device board also shows Miriam's, ahead of it.
    const tables = panel.locator('table');
    await expect(tables.nth(0).locator('tbody tr')).toHaveCount(1);
    await expect(tables.nth(1).locator('tbody tr')).toHaveCount(2);
    await expect(tables.nth(1).locator('tbody tr').first()).toContainText('Miriam');

    // Export the ghost as a file: it holds numbers only.
    const download = page.waitForEvent('download');
    await panel.locator('[data-action="export"]').first().click();
    const file = await download;
    const text = readFileSync((await file.path()) ?? '', 'utf8');
    const parsed = JSON.parse(text) as { format: string; record: { marks: number[] } };
    expect(parsed.format).toBe('otiyot-ghost');
    expect(parsed.record.marks).toHaveLength(12);

    // A friend's ghost file lands on its board; a stranger's file is refused.
    const friend = JSON.stringify({
      format: 'otiyot-ghost',
      version: 1,
      key: 'rail|easy:calm',
      record: {
        name: 'Yosef',
        score: 500,
        wpm: 50,
        accuracy: 99,
        durationMs: 9000,
        marks: [1000, 2000],
      },
    });
    await panel
      .locator('[data-action="import"]')
      .setInputFiles({ name: 'g.json', mimeType: 'application/json', buffer: Buffer.from(friend) });
    await expect(panel.locator('tbody tr').first()).toContainText('Yosef');
    await expect(panel.locator('tbody tr').first()).toContainText('from a friend');
    await panel
      .locator('[data-action="import"]')
      .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(page.getByText('That file is not an Otiyot ghost.')).toBeVisible();
  });
});

async function step(page: Page, seconds: number): Promise<void> {
  await page.evaluate(
    (s) => (window as unknown as { __otiyotRail: RailProbe }).__otiyotRail.step(s),
    seconds,
  );
}
