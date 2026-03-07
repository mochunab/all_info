'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Language } from '@/types';
import { translations, t as rawT, translateCategory } from '@/lib/i18n';
import { LOCALES } from '@/lib/locale-config';

const VALID_LANGUAGES = Object.keys(translations) as Language[];
const LOCALE_SET = new Set<string>(LOCALES);

function isValidLanguage(lang: string): lang is Language {
  return VALID_LANGUAGES.includes(lang as Language);
}

type CategoryWithTranslations = {
  name: string;
  translations?: Record<string, string>;
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  setCategoryTranslations: (cats: CategoryWithTranslations[]) => void;
  translateCat: (name: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  locale = 'ko',
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  const initialLang: Language = isValidLanguage(locale) ? locale : 'ko';
  const [language, setLanguageState] = useState<Language>(initialLang);
  const catTransMapRef = useRef<Record<string, Record<string, string>>>({});
  const router = useRouter();
  const pathname = usePathname();

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    // Navigate to the new locale path
    const segments = pathname.split('/');
    if (segments.length > 1 && LOCALE_SET.has(segments[1])) {
      segments[1] = lang;
    } else {
      segments.splice(1, 0, lang);
    }
    router.push(segments.join('/') || '/');
  }, [router, pathname]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => rawT(language, key, params),
    [language]
  );

  const setCategoryTranslations = useCallback((cats: CategoryWithTranslations[]) => {
    const map: Record<string, Record<string, string>> = {};
    for (const cat of cats) {
      if (cat.translations && Object.keys(cat.translations).length > 0) {
        map[cat.name] = cat.translations;
      }
    }
    catTransMapRef.current = map;
  }, []);

  const translateCat = useCallback((name: string): string => {
    if (language === 'ko') return name;
    const dbTrans = catTransMapRef.current[name]?.[language];
    if (dbTrans) return dbTrans;
    return translateCategory(name, language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, setCategoryTranslations, translateCat }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
