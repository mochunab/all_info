const SUPPORTED_LOCALES = ['ko', 'en', 'vi', 'zh', 'ja'] as const;

export function buildAlternateLanguages(path: string): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const locale of SUPPORTED_LOCALES) {
    langs[locale] = `${path}?lang=${locale}`;
  }
  langs['x-default'] = path;
  return langs;
}
