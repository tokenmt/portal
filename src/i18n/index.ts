import { ui } from './ui';

export type Locale = 'en' | 'zh';
export { ui };

export function t(locale: Locale, key: string): string {
  const dict = ui[locale] as Record<string, string>;
  const v = dict[key];
  if (v === undefined) throw new Error(`missing i18n key: ${key} (${locale})`);
  return v;
}

// '/' -> '/zh', '/pricing' -> '/zh/pricing', '/zh/x' -> '/x'
export function altPath(locale: Locale, path: string): string {
  if (locale === 'en') return '/zh' + (path === '/' ? '' : path);
  return path.replace(/^\/zh/, '') || '/';
}
