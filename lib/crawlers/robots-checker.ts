import robotsParser from 'robots-parser';
import { BOT_USER_AGENT } from './base';

type CacheEntry = {
  allowed: (url: string) => boolean;
  expiresAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const FETCH_TIMEOUT_MS = 3000;
const cache = new Map<string, CacheEntry>();

function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: controller.signal,
      headers: { 'User-Agent': BOT_USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkRobotsTxt(url: string): Promise<boolean> {
  const origin = getOrigin(url);

  const cached = cache.get(origin);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed(url);
  }

  const robotsTxt = await fetchRobotsTxt(origin);

  // fail-open: robots.txt 없거나 fetch 실패 시 크롤링 허용
  if (!robotsTxt) {
    cache.set(origin, {
      allowed: () => true,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return true;
  }

  const robots = robotsParser(`${origin}/robots.txt`, robotsTxt);
  const checker = (targetUrl: string) => robots.isAllowed(targetUrl, BOT_USER_AGENT) !== false;

  cache.set(origin, {
    allowed: checker,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return checker(url);
}
