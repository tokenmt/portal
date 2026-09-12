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
  { prefix: '', marker: 'Contact' },
  { prefix: '/zh', marker: '联系我们' },
]) {
  test(`about loads ${prefix || 'en'}`, async ({ page }) => {
    await page.goto(prefix + '/about');
    await expect(page.locator('main')).toContainText(marker);
  });
}

test('theme toggle flips data-theme and label names the action', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const toggle = page.locator('.theme-toggle');
  await expect(html).toHaveAttribute('data-theme', /^(light|dark)$/);
  const before = (await html.getAttribute('data-theme'))!;

  // The label names the theme being switched TO, so when the page is light it
  // must offer "dark". A hardcoded label passes a flip test but fails here.
  const expectLabel = (current: string) =>
    expect(toggle).toHaveAttribute(
      'aria-label',
      current === 'light' ? /dark|深色/ : /light|浅色/,
    );
  await expectLabel(before);

  await toggle.click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', after);
  await expectLabel(after);
});

test('theme choice persists across reload', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await page.locator('.theme-toggle').click();
  const chosen = await html.getAttribute('data-theme');
  expect(chosen).toMatch(/^(light|dark)$/);

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', chosen!);
});

