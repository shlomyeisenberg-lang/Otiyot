import { test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';
function savedPlayer(lang: 'en' | 'he'): string {
  const p = createProfile('a', 'David', 0);
  p.layout = lang; p.track = 1; p.settings.uiLanguage = lang; p.settings.theme = 'light'; p.settings.textSpeed = 'fast';
  p.story.flags.intro = true; p.story.flags.hub = true;
  let done = 0; const t = getTrack(p.track);
  for (const lvl of t.levels(p.layout, p.layout)) for (const l of t.lessons(lvl.id, p.layout, p.layout)) { if (done >= 40) break; recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 }); done++; }
  return JSON.stringify({ version: 8, profiles: [p], activeProfileId: 'a', meta: { legacyChecked: true, autoQuality: 'medium' } });
}
type P = Record<string, unknown> & { nextKey: string | null; nextShift: string | null; floors: number; ended: boolean };
const probe = (page: Page): Promise<P> => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__otiyotLadder)));
async function press(page: Page) { const p = await probe(page); if (!p.nextKey) return; if (p.nextShift) await page.keyboard.down(p.nextShift); await page.keyboard.press(p.nextKey); if (p.nextShift) await page.keyboard.up(p.nextShift); }
test('shots', async ({ page }) => {
  test.setTimeout(600_000);
  const lang = (process.env.LANG_UI ?? 'en') as 'en' | 'he';
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((s) => { localStorage.setItem('otiyot_save', s); }, savedPlayer(lang));
  await page.goto('http://localhost:4173/#/ladder');
  await page.waitForFunction(() => (window as any).__otiyotLadder?.ready || (window as any).__otiyotLadder?.failed, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/claude-0/shots/${lang}-0-start.png` });
  const target = Number(process.env.FLOORS ?? 13);
  let n = 0;
  while ((await probe(page)).floors < target && n < 3000) { await press(page); n++; if (n % 40 === 0) await page.evaluate(() => (window as any).__otiyotLadder.step(0.6)); 
    const p = await probe(page); if (n % 40 === 0) console.log(p.floors, p.kind, p.score, (p as any).grip);
    if ([3,6,9,12].includes(p.floors) && !(globalThis as any)['s'+p.floors]) { (globalThis as any)['s'+p.floors]=1; await page.evaluate(() => (window as any).__otiyotLadder.step(1.2)); await page.screenshot({ path: `/tmp/claude-0/shots/${lang}-f${p.floors}-${p.kind}.png` }); } }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/claude-0/shots/${lang}-options.png` });
  await page.locator('[data-action="rest"]').click();
  await page.evaluate(() => (window as any).__otiyotLadder.step(3));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `/tmp/claude-0/shots/${lang}-results.png` });
  console.log('ERRORS', JSON.stringify(errors));
});
