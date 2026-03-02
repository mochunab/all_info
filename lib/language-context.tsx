'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Language } from '@/types';
import { translations, t as rawT, translateCategory } from '@/lib/i18n';

const STORAGE_KEY = 'ih:language';
const VALID_LANGUAGES = Object.keys(translations) as Language[];

function isValidLanguage(lang: string): lang is Language {
  return VALID_LANGUAGES.includes(lang as Language);
}

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'ko';
  try {
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang');
    if (urlLang && isValidLanguage(urlLang)) {
      localStorage.setItem(STORAGE_KEY, urlLang);
      return urlLang;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isValidLanguage(saved)) return saved;
  } catch { /* ignore */ }
  return 'ko';
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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const catTransMapRef = useRef<Record<string, Record<string, string>>>({});

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      const url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState(null, '', url.toString());
    } catch { /* ignore */ }
  }, []);

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

  useEffect(() => {
    document.documentElement.lang = language;
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
