import { expect, test } from '@playwright/test';

test('boot screen says Otiyot with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Otiyot' })).toBeVisible();
  expect(errors).toEqual([]);
});
