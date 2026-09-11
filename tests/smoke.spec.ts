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

for (const { prefix, hero, feature } of [
  { prefix: '', hero: 'TokenMate', feature: 'Multi-provider' },
  { prefix: '/zh', hero: 'TokenMate', feature: '多供应商' },
]) {
  test(`home content ${prefix || 'en'}`, async ({ page }) => {
    await page.goto(prefix + '/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(hero);
    await expect(page.locator('main')).toContainText(feature);
  });
}
