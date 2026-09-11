import { test, expect } from '@playwright/test';

const locales = [
  { prefix: '', lang: 'en', navText: 'Pricing' },
  { prefix: '/zh', lang: 'zh', navText: '版本与价格' },
];

for (const { prefix, lang, navText } of locales) {
  test(`home loads ${lang}`, async ({ page }) => {
    await page.goto(prefix + '/');
    await expect(page).toHaveTitle(/TokenMate/);
    await expect(page.locator('nav')).toContainText(navText);
  });
}

test('lang switcher navigates en -> zh -> en', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: '中文' }).click();
  await expect(page).toHaveURL(/\/zh\/?$/);
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/$/);
});
