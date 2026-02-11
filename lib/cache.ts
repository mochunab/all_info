// Simple in-memory cache with TTL for serverless (Vercel process lifetime)
type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

// Cache keys
export const CACHE_KEYS = {
  SOURCES: 'api:sources',
  CATEGORIES: 'api:categories',
  ARTICLES_PREFIX: 'api:articles:', // + query string
} as const;

// TTLs
export const CACHE_TTL = {
  SOURCES: 60 * 1000,       // 60s — 소스는 자주 안 바뀌지만 저장 직후 반영 필요
  CATEGORIES: 5 * 60 * 1000, // 5min — 카테고리는 거의 안 바뀜
  ARTICLES: 30 * 1000,      // 30s — 아티클은 크롤링 시에만 변경, 짧게 유지
} as const;
