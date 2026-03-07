import { LOCALES } from '@/lib/locale-config';

export function buildAlternateLanguages(path: string): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const locale of LOCALES) {
    langs[locale] = `https://aca-info.com/${locale}${path}`;
  }
  langs['x-default'] = `https://aca-info.com/ko${path}`;
  return langs;
}
