import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/.npm-global/lib/node_modules/')('playwright');
import { getTrack, recordLessonResult } from './src/learn';
import { createProfile } from './src/save';
const theme = process.argv[2] ?? 'light';
const p = createProfile('a', 'David', 0);
p.layout = 'en'; p.track = 1; p.settings.uiLanguage = 'en'; p.settings.theme = theme as 'light'; p.settings.textSpeed='fast';
p.story.ranks.meadow = 3; p.story.ranks.cliffs = 3; p.story.ranks.blot = 3; p.story.flags.intro = true; p.story.flags.hub = true;
let done = 0; const t = getTrack(p.track);
for (const lvl of t.levels(p.layout, p.layout)) for (const l of t.lessons(lvl.id, p.layout, p.layout)) { if (done >= 90) break; recordLessonResult(p, l.id, { wpm: 20, accuracy: 100 }); done++; }
const save = JSON.stringify({ version: 7, profiles: [p], activeProfileId: 'a', meta: { legacyChecked: true, autoQuality: 'medium' } });
(async () => {
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.addInitScript((s) => localStorage.setItem('otiyot_save', s), save);
  await page.goto('http://localhost:5199/#/caves');
  await page.waitForFunction(() => (window as any).__otiyotCaves?.ready || (window as any).__otiyotCaves?.failed, null, { timeout: 120000 });
  const pr = () => page.evaluate(() => { const p = (window as any).__otiyotCaves; return { light: p.light, word: p.word, nextKey: p.nextKey, nextShift: p.nextShift, words: p.words, total: p.total, ended: p.ended, chapter: p.chapter, lamps: p.lamps, ahead: p.ahead, reach: p.reach, failed: p.failed, stats: p.stats && p.stats.fps }; });
  const step = (s: number) => page.evaluate((s) => (window as any).__otiyotCaves.step(s), s);
  const press = async () => { const q = await pr(); if (q.nextShift) await page.keyboard.down(q.nextShift); await page.keyboard.press(q.nextKey!); if (q.nextShift) await page.keyboard.up(q.nextShift); };
  await step(1); await page.waitForTimeout(500);
  console.log(JSON.stringify(await pr()));
  await page.screenshot({ path: `/tmp/claude-0/shots/${theme}-0.png` });
  for (let i = 0; i < 25; i++) await press();
  await step(1.5); await page.waitForTimeout(300);
  await page.screenshot({ path: `/tmp/claude-0/shots/${theme}-1.png` });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyQ'); await step(0.2); }
  await step(0.6); await page.waitForTimeout(300);
  console.log(JSON.stringify(await pr()));
  await page.screenshot({ path: `/tmp/claude-0/shots/${theme}-2.png` });
  let n = 0;
  while (!(await pr()).ended && n++ < 3000) { await press(); if (n % 8 === 0) await step(0.4); if ((await pr()).lamps >= 1 && n % 400 === 1) {} }
  await step(1); 
  await page.screenshot({ path: `/tmp/claude-0/shots/${theme}-3.png` });
  await step(4); await page.waitForTimeout(500);
  console.log(JSON.stringify(await pr()));
  await page.screenshot({ path: `/tmp/claude-0/shots/${theme}-4.png` });
  await b.close();
})();
