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

for (const { prefix } of [
  { prefix: '' },
  { prefix: '/zh' },
]) {
  test(`home narrative sections ${prefix || 'en'}`, async ({ page }) => {
    await page.goto(prefix + '/');
    await expect(page.locator('.feature-num')).toHaveCount(6);
    await expect(page.locator('main')).toContainText('SHA-256');
    await expect(page.locator('main').locator('figure')).toHaveCount(3);
  });
}

for (const { prefix, nameCol, capRow } of [
  { prefix: '', nameCol: 'Community', capRow: 'Team management' },
  { prefix: '/zh', nameCol: '社区版', capRow: '团队管理' },
]) {
  test(`pricing loads ${prefix || 'en'}`, async ({ page }) => {
    await page.goto(prefix + '/pricing');
    await expect(page.locator('table')).toContainText(nameCol);
    await expect(page.locator('table')).toContainText(capRow);
  });
}

for (const { prefix, platform, releases } of [
  { prefix: '', platform: 'Windows', releases: 'releases' },
  { prefix: '/zh', platform: 'Windows', releases: 'releases' },
]) {
  test(`download loads ${prefix || 'en'}`, async ({ page }) => {
    await page.goto(prefix + '/download');
    await expect(page.locator('main')).toContainText(platform);
    const link = page.getByRole('link', { name: new RegExp(releases) }).first();
    await expect(link).toHaveAttribute('href', /github\.com\/tokenmt\/tokenhub-desktop/);
  });
}

for (const { prefix, marker } of [
  { prefix: '', marker: 'self-hosted LLM gateway' },
  { prefix: '/zh', marker: '自托管 LLM 网关' },
]) {
  test(`about loads ${prefix || 'en'}`, async ({ page }) => {
    await page.goto(prefix + '/about');
    await expect(page.locator('main')).toContainText(marker);
  });
}

test('about page exposes no email address', async ({ page }) => {
  for (const prefix of ['', '/zh']) {
    await page.goto(prefix + '/about');
    await expect(page.locator('main')).not.toContainText('@');
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  }
});

test('dark-only theme: no toggle remnant', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.theme-toggle')).toHaveCount(0);
});

