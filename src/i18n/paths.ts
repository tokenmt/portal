import type { Locale } from './index';
export function translateUrl(path: string, locale: Locale): string {
  if (locale === 'en') return path;
  return '/zh' + (path === '/' ? '' : path);
}
