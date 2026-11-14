// Performance and smoke pass over every screen (T38). Each route is opened on the medium preset
// by a player who has everything unlocked, left to run, and typed at for ten seconds. The test
// fails on any console error or page error, on a scene over budget (150 draw calls, 300k
// triangles, ARCHITECTURE section 7), and on GPU objects left behind after leaving. Numbers go
// to test-results/perf.json; `node scripts/perf-report.mjs` turns them into docs/PERF.md.

import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';
import { CURRENT_VERSION } from '../../src/save/migrations';

const DRAWS = 150;
const TRIANGLES = 300_000;
const RUN_SECONDS = Number(process.env.PERF_SECONDS ?? 10);

/** Routes that draw 3D, then the plain screens (checked for errors only). */
const SCENES = [
  'title',
  'intro',
  'chapter',
  'hub',
  'meadow',
  'cliffs',
  'forge',
  'shuk',
  'rail',
  'geniza',
  'hermon',
  'station',
  'atbash',
  'midbar',
  'caves',
  'arena',
  'trial',
  'scroll',
  'ladder',
  'range',
] as const;
const PLAIN = [
  'menu',
  'lesson',
  'modes',
  'players',
  'track',
  'layout',
  'settings',
  'stats',
  'journal',
  'shop',
  'trials',
  'arcade',
  'sound',
] as const;

function savedPlayer(): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.settings.textSpeed = 'instant';
  p.settings.quality = 'medium';
  for (const r of [
    'meadow',
    'cliffs',
    'forge',
    'shuk',
    'rail',
    'geniza',
    'hermon',
    'station',
    'atbash',
    'midbar',
    'caves',
  ])
    p.story.ranks[r] = 3;
  p.story.flags.intro = true;
  p.story.flags.hub = true;
  const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout))
    for (const l of t.lessons(lvl.id, p.layout, p.layout))
      recordLessonResult(p, l.id, { wpm: 25, accuracy: 100 });
  return JSON.stringify({
    version: CURRENT_VERSION,
    profiles: [p],
    activeProfileId: 'a',
    meta: { legacyChecked: true, autoQuality: 'medium' },
  });
}

interface Sample {
  route: string;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  quality: string;
  heapGrowthKB: number | null;
}
const results: Sample[] = [];

interface Hook {
  stats: Omit<Sample, 'route' | 'heapGrowthKB'>;
}
const engineStats = (page: Page): Promise<Hook['stats'] | null> =>
  page.evaluate(() => {
    const e = (window as unknown as { __otiyotEngine?: Hook }).__otiyotEngine;
    return e ? { ...e.stats } : null;
  });
const heap = (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return m ? m.usedJSHeapSize : null;
  });

test.describe('Every screen', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(testInfo.project.name !== 'desktop', 'one pass is enough');
  });
  test.setTimeout(240_000);

  for (const route of SCENES) {
    test(`3D: ${route} stays inside the budget`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.addInitScript((save) => {
        if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
      }, savedPlayer());
      await page.goto(`/#/${route}`);
      await page.waitForFunction(
        () => (window as unknown as { __otiyotEngine?: unknown }).__otiyotEngine !== undefined,
        null,
        { timeout: 90_000 },
      );
      await page.waitForTimeout(2_000);
      const before = await heap(page);
      // A scripted typist: the home-row keys, with spaces, for the whole run.
      const end = Date.now() + RUN_SECONDS * 1000;
      const keys = 'fjdksla ';
      let i = 0;
      let peak = await engineStats(page);
      while (Date.now() < end) {
        await page.keyboard.press(keys[i++ % keys.length] ?? 'f');
        await page.waitForTimeout(120);
        const s = await engineStats(page);
        if (s && (!peak || s.drawCalls > peak.drawCalls)) peak = s;
      }
      const last = (await engineStats(page)) ?? peak;
      const after = await heap(page);
      expect(last, `${route} has no engine`).not.toBeNull();
      const s = last as Hook['stats'];
      const worst = peak ?? s;
      results.push({
        route,
        ...s,
        drawCalls: Math.max(worst.drawCalls, s.drawCalls),
        triangles: Math.max(worst.triangles, s.triangles),
        heapGrowthKB:
          before !== null && after !== null ? Math.round((after - before) / 1024) : null,
      });
      expect(errors, `${route} console errors`).toEqual([]);
      expect(s.quality).toBe('medium');
      expect(Math.max(worst.drawCalls, s.drawCalls), `${route} draw calls`).toBeLessThanOrEqual(
        DRAWS,
      );
      expect(Math.max(worst.triangles, s.triangles), `${route} triangles`).toBeLessThanOrEqual(
        TRIANGLES,
      );
      // Leaving the screen frees the engine.
      await page.goto('/#/menu');
      await page.waitForFunction(
        () => (window as unknown as { __otiyotEngine?: unknown }).__otiyotEngine === undefined,
        null,
        { timeout: 15_000 },
      );
    });
  }

  for (const route of PLAIN) {
    test(`plain: ${route} opens without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.addInitScript((save) => {
        if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
      }, savedPlayer());
      await page.goto(`/#/${route}`);
      await expect(page.locator('.stage')).toHaveAttribute('data-route', route);
      await page.waitForTimeout(1_500);
      await page.keyboard.press('Tab');
      expect(errors, `${route} console errors`).toEqual([]);
    });
  }

  test.afterAll(() => {
    if (results.length === 0) return;
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/perf.json', JSON.stringify(results, null, 2));
  });
});
