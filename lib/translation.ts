import type { Language, TranslationCache } from '@/types';

const CACHE_KEY = 'ih:translation:cache:v3';
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
): { title: string; summary: string | null; content_preview: string | null; tags?: string[] } | null {
  const cache = getTranslationCache();
  const translation = cache[articleId]?.[lang];
  if (!translation) return null;

  if (Date.now() - translation.cached_at > CACHE_TTL) {
    return null;
  }

  return {
    title: translation.title,
    summary: translation.summary,
    content_preview: translation.content_preview,
    tags: translation.tags,
  };
}

export function setCachedTranslation(
  articleId: string,
  lang: Language,
  title: string,
  ai_summary: string | null, // deprecated, kept for compatibility
  summary: string | null,
  content_preview: string | null,
  tags?: string[]
): void {
  const cache = getTranslationCache();
  if (!cache[articleId]) {
    cache[articleId] = {};
  }
  cache[articleId][lang] = {
    title,
    summary,
    content_preview,
    tags,
    cached_at: Date.now(),
  };
  setTranslationCache(cache);
}

// 동시 요청 제한 (DeepL Free API rate limit 방어)
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const requestQueue: Array<{ resolve: () => void }> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestQueue.push({ resolve });
  });
}

function releaseSlot(): void {
  activeRequests--;
  const next = requestQueue.shift();
  if (next) {
    activeRequests++;
    next.resolve();
  }
}

async function fetchTranslation(texts: string[], targetLang: string, sourceLang: string): Promise<string[]> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLang, sourceLang }),
  });

  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.translations;
}

/**
 * 배치 번역 (DeepL API 호출, 동시 요청 제한 + 1회 재시도)
 */
export async function translateTexts(
  texts: string[],
  targetLang: Language,
  sourceLang: Language = 'ko'
): Promise<string[]> {
  await acquireSlot();
  try {
    const tLang = targetLang.toUpperCase();
    const sLang = sourceLang.toUpperCase();

    try {
      return await fetchTranslation(texts, tLang, sLang);
    } catch {
      // 1회 재시도 (1초 대기)
      await new Promise((r) => setTimeout(r, 1000));
      return await fetchTranslation(texts, tLang, sLang);
    }
  } finally {
    releaseSlot();
  }
}
