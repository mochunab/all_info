export const LOCALES = ['ko', 'en', 'vi', 'zh', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';
export const OG_LOCALES: Record<Locale, string> = {
  ko: 'ko_KR',
  en: 'en_US',
  vi: 'vi_VN',
  zh: 'zh_CN',
  ja: 'ja_JP',
};
