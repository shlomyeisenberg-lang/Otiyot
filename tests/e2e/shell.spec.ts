import { expect, test, type Page } from '@playwright/test';

const SAVE = {
  version: 3,
  profiles: [
    {
      id: 'a',
      name: 'דוד',
      settings: { uiLanguage: 'he', theme: 'light' },
      track: 1,
      layout: 'he',
    },
  ],
  activeProfileId: 'a',
  meta: { legacyChecked: true },
};

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function seed(page: Page): Promise<void> {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('otiyot_save')) localStorage.setItem('otiyot_save', save);
  }, JSON.stringify(SAVE));
}

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const extra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(extra).toBeLessThanOrEqual(0);
}

test('first run: a new player picks a name, a keyboard and a track', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');

  // The title comes first: Hebrew by default, right to left. Switch to English from the top bar.
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('[data-action="language"]').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // Any key brings the choices; a brand-new player can only begin (or open the settings).
  await page.keyboard.press('Shift');
  await expect(page.getByRole('menuitem', { name: /Begin the story/ })).toBeVisible();
  await page.keyboard.press('Enter');

  // Step 1: the name.
  await expect(page.getByRole('heading', { name: 'What shall we call you?' })).toBeVisible();
  await page.getByLabel('Your name').fill('Moshe');
  await page.keyboard.press('Enter');

  // Step 2: keyboard, picked by typing its gold letter.
  await expect(page.getByRole('heading', { name: 'Choose your keyboard' })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.keyboard.press('e');
  await expect(page.getByRole('radio', { name: /English/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.locator('[data-action="next"]').click();

  // Step 3: lesson track, both explained in plain words.
  await expect(page.getByRole('heading', { name: 'Choose how you learn' })).toBeVisible();
  await expect(page.getByText('One new letter per lesson')).toBeVisible();
  await expect(page.getByText('Two new letters per lesson')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole('radio', { name: /Words from the start/ }).click();
  await page.locator('[data-action="next"]').click();

  // The story opens; Esc skips it and hands over to the House of the Scribe, and Esc there
  // leads to the main menu.
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.waitForFunction(() => window.__otiyotIntro?.ready === true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hub')).toBeVisible();
  await page.keyboard.press('Escape');

  // Main menu greets the new player and shows the choices.
  await expect(page.getByText(/Shalom, .Moshe./)).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Lesson track/ })).toContainText(
    'Words from the start',
  );
  await expect(page.getByRole('menuitem', { name: /Keyboard/ })).toContainText('English');
  await expectNoSidewaysScroll(page);

  // It is saved: a reload goes straight to the menu with the same player.
  await page.reload();
  await expect(page.getByText(/Shalom, .Moshe./)).toBeVisible();
  expect(errors).toEqual([]);
});

test('menus answer to typed letters, arrows, Enter and Esc in Hebrew', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await page.goto('/#/menu');
  await expect(page.getByRole('heading', { name: 'אותיות' })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // ה is the gold letter of "הגדרות". The computer keyboard is in English here, so the game
  // reads the physical key (V carries ה on a Hebrew keyboard).
  await page.keyboard.press('KeyV');
  await expect(page.getByRole('heading', { name: 'הגדרות' })).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Dark theme and high contrast from the settings, then Esc back to the menu.
  await page.locator('[data-setting="theme"]').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const contrast = page.locator('[data-setting="highContrast"]');
  await contrast.click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await contrast.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-contrast', 'high');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'אותיות' })).toBeVisible();

  // Arrows and Enter: focus starts on the first item, "המסע" (the journey); one step down is
  // "שחקנים" (players).
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'שחקנים' })).toBeVisible();

  // Add a second player with the keyboard only; Enter walks through the steps.
  await page.locator('[data-action="new-player"]').click();
  await page.getByLabel('השם שלך').fill('Eli');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'בחרו מקלדת' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'בחרו איך ללמוד' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/שלום, .Eli./)).toBeVisible();
  expect(errors).toEqual([]);
});

test('pause menu opens as a dialog and Esc resumes', async ({ page }) => {
  const errors = watchErrors(page);
  await seed(page);
  await page.goto('/#/pause');
  const dialog = page.getByRole('dialog', { name: 'הפסקה' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('menuitem')).toHaveCount(3);
  await expectNoSidewaysScroll(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('menu', { name: 'תפריט ראשי' })).toBeVisible();
  expect(errors).toEqual([]);
});
