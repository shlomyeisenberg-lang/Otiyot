// Smoke test for the Ladder (T28): from the hub's map up the endless tower of letters. The climb
// starts grey; floors are typed by following the finger guide (learned keys only), the color comes
// back floor by floor and the score climbs; on Calm the grip never tires; Escape opens the panel
// and "Rest here" banks the height into the profile's high-score table; Enter starts a new climb;
// and the way home leaves no GPU objects behind. A second climb on Steady leaves the grip to tire:
// Dyo catches the climber once, then he drops softly into the clouds and the card shows the table.

import { expect, test, type Page } from '@playwright/test';
import { getTrack, recordLessonResult } from '../../src/learn';
import { createProfile } from '../../src/save';

/** A player in English who has learned a good part of the keyboard. */
function savedPlayer(lessons = 40): string {
  const p = createProfile('a', 'David', 0);
  p.layout = 'en';
  p.track = 1;
  p.settings.uiLanguage = 'en';
  p.settings.theme = 'light';
  p.settings.textSpeed = 'fast';
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

interface HubProbe {
  ready: boolean;
  doors: Record<string, string>;
  opened: string | null;
  step: (seconds: number) => void;
}

interface Probe {
  ready: boolean;
  failed: boolean;
  word: string;
  words: number;
  floors: number;
  floor: number;
  kind: string;
  grip: number;
  catches: number;
  slips: number;
  score: number;
  ahead: number;
  restoredShare: number;
  timers: boolean;
  difficulty: string;
  ended: boolean;
  reason: string | null;
  text: string;
  keys: string;
  nextKey: string | null;
  nextShift: string | null;
  results: { rank: string; score: number; floors: number; place: number } | null;
  leaked: number | null;
  sceneLeak: number;
  step: (seconds: number) => void;
}

const hub = (page: Page): Promise<HubProbe> =>
  page.evaluate(() => (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub);
const ladder = (page: Page): Promise<Probe> =>
  page.evaluate(() => {
    const p = (window as unknown as { __otiyotLadder: Probe }).__otiyotLadder;
    return JSON.parse(JSON.stringify(p)) as Probe;
  });
const step = (page: Page, seconds: number): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __otiyotLadder: Probe }).__otiyotLadder.step(s),
    seconds,
  );
const waitReady = (page: Page): Promise<unknown> =>
  page.waitForFunction(
    () => {
      const p = (window as unknown as { __otiyotLadder?: Probe }).__otiyotLadder;
      return p?.ready === true || p?.failed === true;
    },
    null,
    { timeout: 120_000 },
  );

async function pressGuide(page: Page): Promise<void> {
  const p = await ladder(page);
  if (!p.nextKey) throw new Error('the guide shows no key');
  if (p.nextShift) await page.keyboard.down(p.nextShift);
  await page.keyboard.press(p.nextKey);
  if (p.nextShift) await page.keyboard.up(p.nextShift);
}

async function stumble(page: Page): Promise<void> {
  const p = await ladder(page);
  await page.keyboard.press(p.nextKey === 'KeyQ' ? 'KeyZ' : 'KeyQ');
}

const savedTable = (page: Page): Promise<{ score: number; floors: number }[]> =>
  page.evaluate(() => {
    const raw = localStorage.getItem('otiyot_save');
    const save = raw
      ? (JSON.parse(raw) as { profiles: { ladder: { score: number; floors: number }[] }[] })
      : null;
    return save?.profiles[0]?.ladder ?? [];
  });

test.describe('The Ladder', () => {
  test.setTimeout(480_000);

  test('from the map: climb floors, rest and bank the height, climb again, and home', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one full climb is enough');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());

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
    await map.locator('[data-region="ladder"]').getByRole('button', { name: 'Play' }).click();

    await expect(page.getByTestId('ladder')).toBeVisible();
    await waitReady(page);
    let p = await ladder(page);
    expect(p.failed).toBe(false);
    expect(p.difficulty).toBe('calm');
    expect(p.timers).toBe(false);
    expect(p.floor).toBe(1);
    expect(p.kind).toBe('steps');
    expect(p.score).toBe(0);
    expect(p.restoredShare).toBeLessThan(0.05);
    expect(p.ahead).toBeGreaterThan(0);
    // Learned keys only.
    const keys = new Set(p.keys);
    expect(p.text.length).toBeGreaterThan(10);
    for (const ch of p.text.replace(/ /g, '')) expect(keys.has(ch), ch).toBe(true);

    // A slip loosens the grip, but on Calm it never tires and never gives out.
    await stumble(page);
    p = await ladder(page);
    expect(p.grip).toBeLessThan(1);
    expect(p.ended).toBe(false);
    const held = p.grip;
    await step(page, 30);
    p = await ladder(page);
    expect(p.grip).toBeCloseTo(held, 5);

    // Climb two floors by following the guide.
    let typed = 0;
    while ((p = await ladder(page)).floors < 2) {
      await pressGuide(page);
      typed += 1;
      if (typed % 10 === 0) await step(page, 0.4);
      if (typed > 600) throw new Error('two floors never ended');
    }
    expect(p.floor).toBe(3);
    expect(p.score).toBeGreaterThan(0);
    await step(page, 2);
    p = await ladder(page);
    expect(p.restoredShare).toBeGreaterThan(0.1);

    // Escape opens the panel; resting banks the height.
    await page.keyboard.press('Escape');
    await page.locator('[data-action="rest"]').click();
    p = await ladder(page);
    expect(p.ended).toBe(true);
    expect(p.reason).toBe('rest');
    expect(p.results?.floors).toBe(2);
    expect(p.results?.place).toBe(0);
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.locator('.rank')).toBeVisible();
    await expect(card).toContainText(/You rested on floor\W*2/);
    await expect(card.getByTestId('ladder-table').locator('tr[data-new="true"]')).toHaveCount(1);
    const table = await savedTable(page);
    expect(table).toHaveLength(1);
    expect(table[0]?.floors).toBe(2);
    expect(table[0]?.score).toBe(p.score);

    // Enter climbs again from the bottom.
    await page.keyboard.press('Enter');
    await expect(card).toBeHidden();
    p = await ladder(page);
    expect(p.ended).toBe(false);
    expect(p.floors).toBe(0);
    expect(p.score).toBe(0);

    // Home through the panel.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to the house' }).click();
    await expect(page.getByTestId('hub')).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { __otiyotLadder: Probe }).__otiyotLadder.leaked !== null,
    );
    p = await ladder(page);
    expect(p.sceneLeak).toBe(0);
    expect(p.leaked).toBe(0);
    expect(errors).toEqual([]);
  });

  test('on Steady the grip tires: Dyo catches the climber once, then he drops into the clouds', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the phone layout is checked in the shell test');
    await page.addInitScript((save) => {
      if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
    }, savedPlayer());
    await page.goto('/#/ladder');
    await waitReady(page);
    await page.keyboard.press('Escape');
    await page.locator('[data-pick="difficulty:steady"]').first().click();
    await page.getByRole('button', { name: 'Start a new climb' }).click();
    let p = await ladder(page);
    expect(p.difficulty).toBe('steady');
    expect(p.timers).toBe(true);
    // The grip waits for the first key of the floor before it tires.
    await step(page, 20);
    expect((await ladder(page)).grip).toBe(1);
    await pressGuide(page);
    await step(page, 130);
    p = await ladder(page);
    expect(p.catches).toBe(0);
    expect(p.ended).toBe(false);
    expect(p.grip).toBeGreaterThan(0);
    await step(page, 200);
    p = await ladder(page);
    expect(p.ended).toBe(true);
    expect(p.reason).toBe('fall');
    const card = page.locator('.meadow__results');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByTestId('ladder-table')).toBeVisible();
    expect((await savedTable(page)).length).toBe(1);
  });
});
