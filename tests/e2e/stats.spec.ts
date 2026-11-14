// Smoke test for the statistics dashboard and the journal (T32): after a few saved runs the
// dashboard shows the right numbers in both languages, the keys tab draws the heatmap, the
// achievements list shows what is earned, and the journal opens entries as the story advances.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

function savedPlayer(ui: 'en' | 'he'): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = ui;
  p.settings.theme = 'light';
  p.story.flags.intro = true;
  const t = getTrack(1);
  const first = t.lessons(0, 'en', 'en')[0];
  if (first) recordLessonResult(p, first.id, { wpm: 20, accuracy: 100, stars: 3 });
  const now = Date.now();
  [20, 30, 40, 50].forEach((wpm, i) => {
    p.history.push({
      at: now - (3 - i) * 86_400_000,
      track: 1,
      mode: 'lesson:L0-0',
      wpm,
      accuracy: 90 + i * 2,
      durationMs: 120_000,
      chars: 100,
    });
  });
  p.keys.f = { hits: 40, misses: 0, avgMs: 250, lastSeen: 1, ease: 2.5, due: 0, confusions: {} };
  p.keys.j = {
    hits: 10,
    misses: 10,
    avgMs: 800,
    lastSeen: 1,
    ease: 2.5,
    due: 0,
    confusions: { f: 5 },
  };
  return JSON.stringify({
    version: 8,
    profiles: [p],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'low' },
  });
}

async function open(page: Page, ui: 'en' | 'he', hash: string): Promise<void> {
  const save = savedPlayer(ui);
  await page.addInitScript((s) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', s);
  }, save);
  await page.goto(`/#/${hash}`);
}

/** The tab strip scrolls sideways on a phone, so click without waiting for it to settle. */
const openTab = (page: Page, name: string): Promise<void> =>
  page.getByRole('tab', { name }).click({ force: true });

const tile = (page: Page, label: string) => page.getByRole('group', { name: label });

test.describe('Statistics and journal', () => {
  test('the dashboard shows correct numbers in English', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, 'en', 'stats');
    await expect(page.getByRole('heading', { level: 1, name: 'Statistics' })).toBeVisible();
    await expect(tile(page, 'Sessions')).toContainText('4');
    await expect(tile(page, 'Average speed')).toContainText('35');
    await expect(tile(page, 'Best speed')).toContainText('50');
    await expect(tile(page, 'Average accuracy')).toContainText('93');
    await expect(tile(page, 'Time played')).toContainText(/8\W*min/);
    await expect(tile(page, 'Days played')).toContainText('4');
    await expect(tile(page, 'Streak')).toContainText('4');
    await expect(page.getByRole('img', { name: /Speed over your last\W*4\W*runs/ })).toBeVisible();

    await openTab(page, 'Keys');
    await expect(page.getByRole('img', { name: /heatmap/ })).toBeVisible();
    await expect(page.locator('.stats__count')).toContainText(/5\W* times/);

    await openTab(page, 'Lessons');
    await expect(page.getByText(/Lessons passed: \W*1\W* of/)).toBeVisible();

    await openTab(page, 'History');
    await expect(page.locator('.stats__table tbody tr')).toHaveCount(4);

    await openTab(page, 'Achievements');
    await expect(page.locator('[data-ach="firstLesson"]')).toHaveClass(/ach--earned/);
    await expect(page.locator('[data-ach="speed60"]')).not.toHaveClass(/ach--earned/);
    expect(errors).toEqual([]);
  });

  test('the dashboard and the journal speak Hebrew', async ({ page }) => {
    await open(page, 'he', 'stats');
    await expect(page.getByRole('heading', { level: 1, name: 'סטטיסטיקה' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'מפגשים' })).toContainText('4');
    await page.getByRole('button', { name: 'יומן' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'יומן' })).toBeVisible();
    await expect(page.locator('[data-entry="person-ezra"]')).toContainText('רב עזרא');
  });

  test('the journal opens entries as the story advances', async ({ page }) => {
    await open(page, 'en', 'journal');
    await expect(page.locator('[data-entry="person-ezra"]')).toHaveClass(/jr--open/);
    await expect(page.locator('[data-entry="person-naftali"]')).toHaveClass(/jr--locked/);
    await openTab(page, 'Places');
    await expect(page.locator('[data-entry="place-meadow"]')).toHaveClass(/jr--open/);
    await expect(page.locator('[data-entry="place-shuk"]')).toHaveClass(/jr--locked/);
    await openTab(page, 'Tips');
    await expect(page.locator('[data-entry="tip-posture"]')).toHaveClass(/jr--open/);
  });
});
