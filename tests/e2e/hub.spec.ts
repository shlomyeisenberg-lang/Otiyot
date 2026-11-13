import { expect, test, type Page } from '@playwright/test';

// A player in English who has seen the opening and not restored anything yet.
const FRESH = {
  version: 7,
  profiles: [
    {
      id: 'a',
      name: 'David',
      settings: { uiLanguage: 'en', theme: 'light', textSpeed: 'fast' },
      track: 1,
      layout: 'en',
      story: { ranks: {}, flags: { intro: true, hub: true } },
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true, autoQuality: 'low' },
};

interface HubProbe {
  ready: boolean;
  failed: boolean;
  doors: Record<string, string>;
  typed: string;
  at: string | null;
  opened: string | null;
  walking: boolean;
  restored: number;
  litBeacons: number;
  leaked: number | null;
}

interface LessonProbe {
  lessonId: string | null;
  nextKey: string | null;
  nextShift: string | null;
  ended: boolean;
  passed: boolean | null;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const hub = (page: Page): Promise<HubProbe> =>
  page.evaluate(() => (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub);
const lesson = (page: Page): Promise<LessonProbe> =>
  page.evaluate(() => (window as unknown as { __otiyotLesson: LessonProbe }).__otiyotLesson);

/** Types a station's door word, then lets the apprentice walk there (the world is stepped). */
async function walkTo(page: Page, station: string): Promise<void> {
  const word = (await hub(page)).doors[station] ?? '';
  expect(word.length).toBeGreaterThan(1);
  for (const ch of word) await page.keyboard.press(ch);
  for (let i = 0; i < 40; i++) {
    const p = await hub(page);
    if (p.opened || p.failed) break;
    await page.evaluate(() =>
      (window as unknown as { __otiyotHub: { step(s: number): void } }).__otiyotHub.step(0.5),
    );
  }
  await page.waitForFunction(() => {
    const p = (window as unknown as { __otiyotHub: HubProbe }).__otiyotHub;
    return p.opened !== null;
  });
}

test('the hub: walk by typing, open the map, take a lesson and come home', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(FRESH));
  await page.goto('/#/hub');
  await expect(page.getByTestId('hub')).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as { __otiyotHub?: HubProbe }).__otiyotHub?.ready === true,
    null,
    { timeout: 90_000 },
  );

  // Every door word is spelled only with the letters a new player knows: f and j.
  const doors = (await hub(page)).doors;
  expect(Object.keys(doors)).toHaveLength(7);
  for (const w of Object.values(doors)) expect(w).toMatch(/^[fj]+$/);
  expect(new Set(Object.values(doors)).size).toBe(7);

  // A key no door wants is a miss and changes nothing; a right one narrows the doors.
  await page.keyboard.press('q');
  expect((await hub(page)).typed).toBe('');

  // The desk: the map of the land, with the Meadow open and the rest locked.
  await walkTo(page, 'desk');
  const map = page.getByTestId('hub-map');
  await expect(map).toBeVisible();
  await expect(map.locator('[data-region="meadow"]')).toHaveAttribute('data-state', 'open');
  await expect(map.locator('[data-region="cliffs"]')).toHaveAttribute('data-state', 'locked');
  await expect(map.locator('[data-region="cliffs"]')).toContainText('Learn first');
  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();

  // The practice slate opens the modes screen (T31); its "Next lesson" button leads to the
  // course, where typing the lesson by the guide passes it.
  await walkTo(page, 'practice');
  await expect(page.getByTestId('modes')).toBeVisible();
  await page.getByRole('button', { name: 'Next lesson' }).click();
  await expect(page.getByTestId('lesson')).toBeVisible();
  expect((await lesson(page)).lessonId).toBe('L0-0');
  let keys = 0;
  while (!(await lesson(page)).ended) {
    const l = await lesson(page);
    if (!l.nextKey) throw new Error('the guide shows no key');
    if (l.nextShift) await page.keyboard.down('Shift');
    await page.keyboard.press(l.nextKey === 'Space' ? 'Space' : l.nextKey);
    if (l.nextShift) await page.keyboard.up('Shift');
    keys += 1;
    if (keys > 2000) throw new Error('lesson never ended');
  }
  expect((await lesson(page)).passed).toBe(true);
  await expect(page.getByText('Lesson done')).toBeVisible();
  await page.keyboard.press('Enter');
  expect((await lesson(page)).lessonId).toBe('L0-1');

  // Progress is saved.
  const saved = await page.evaluate(() => localStorage.getItem('otiyot_save') ?? '');
  expect(saved).toContain('L0-0');

  // Home again: the hub frees everything it drew when it is left.
  await page.goto('/#/hub');
  await page.waitForFunction(
    () => (window as unknown as { __otiyotHub?: HubProbe }).__otiyotHub?.ready === true,
    null,
    { timeout: 90_000 },
  );
  await page.goto('/#/menu');
  await expect(page.getByRole('menu', { name: 'Main menu' })).toBeVisible();
  const left = await hub(page);
  if (!left.failed) expect(left.leaked).toBe(0);
  expect(errors).toEqual([]);
});

test('the hub gains color as regions are restored', async ({ page }) => {
  test.setTimeout(120_000);
  const save = structuredClone(FRESH);
  const p = save.profiles[0] as (typeof save.profiles)[number] & {
    story: { ranks: Record<string, number>; flags: Record<string, boolean> };
  };
  p.story = {
    ranks: { meadow: 4, cliffs: 2, rail: 3 },
    flags: { intro: true, hub: true, 'hub:meadow': true },
  };
  await page.addInitScript((s) => localStorage.setItem('otiyot_save', s), JSON.stringify(save));
  await page.goto('/#/hub');
  await page.waitForFunction(
    () => (window as unknown as { __otiyotHub?: HubProbe }).__otiyotHub?.ready === true,
    null,
    { timeout: 90_000 },
  );
  const h = await hub(page);
  expect(h.litBeacons).toBe(3);
  expect(h.restored).toBeCloseTo(3 / 14);
  // The new restorations are celebrated once, then remembered.
  const flags = await page.evaluate(
    () => JSON.parse(localStorage.getItem('otiyot_save') ?? '{}').profiles[0].story.flags,
  );
  expect(flags['hub:cliffs']).toBe(true);
  expect(flags['hub:rail']).toBe(true);

  // The trophy shelf shows the ranks (opened with the mouse, from the row of stations).
  await page.locator('[data-station="trophies"]').click();
  for (let i = 0; i < 40 && !(await hub(page)).opened; i++) {
    await page.evaluate(() =>
      (window as unknown as { __otiyotHub: { step(s: number): void } }).__otiyotHub.step(0.5),
    );
  }
  const shelf = page.locator('.hub-trophies');
  await expect(shelf).toBeVisible();
  await expect(shelf.locator('[data-region="meadow"]')).toContainText('S');
  await expect(shelf.locator('[data-region="forge"]')).toContainText('Not yet');
});
