import type { Language, TranslationCache } from '@/types';

const CACHE_KEY = 'ih:translation:cache';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7일

export function getTranslationCache(): TranslationCache {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached);
  } catch {
    return {};
  }
}

export function setTranslationCache(cache: TranslationCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // quota 초과 시 오래된 캐시 삭제
    try {
      const now = Date.now();
      const filtered: TranslationCache = {};
      for (const [articleId, langs] of Object.entries(cache)) {
        for (const [lang, data] of Object.entries(langs)) {
          if (now - data.cached_at < CACHE_TTL) {
            if (!filtered[articleId]) filtered[articleId] = {};
            filtered[articleId][lang] = data;
          }
        }
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
    } catch {
      // 최후의 수단: 캐시 전체 삭제
      localStorage.removeItem(CACHE_KEY);
    }
  }
}

export function getCachedTranslation(
  articleId: string,
  lang: Language
): { title: string; ai_summary: string | null; summary: string | null; content_preview: string | null } | null {
  const cache = getTranslationCache();
  const translation = cache[articleId]?.[lang];
  if (!translation) return null;

  // TTL 체크
  if (Date.now() - translation.cached_at > CACHE_TTL) {
    return null;
  }

  return {
    title: translation.title,
    ai_summary: translation.ai_summary,
    summary: translation.summary,
    content_preview: translation.content_preview,
  };
}

export function setCachedTranslation(
  articleId: string,
  lang: Language,
  title: string,
  ai_summary: string | null,
  summary: string | null,
  content_preview: string | null
): void {
  const cache = getTranslationCache();
  if (!cache[articleId]) {
    cache[articleId] = {};
  }
  cache[articleId][lang] = {
    title,
    ai_summary,
    summary,
    content_preview,
    cached_at: Date.now(),
  };
  setTranslationCache(cache);
}

/**
 * 배치 번역 (DeepL API 호출)
 * texts 배열을 targetLang으로 번역
 */
export async function translateTexts(
  texts: string[],
  targetLang: Language,
  sourceLang: Language = 'ko'
): Promise<string[]> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts,
      targetLang: targetLang.toUpperCase(),
      sourceLang: sourceLang.toUpperCase(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.translations;
}
