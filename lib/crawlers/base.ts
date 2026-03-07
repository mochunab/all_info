

// User agents
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const BOT_USER_AGENT = 'Mozilla/5.0 (compatible; InsightHub/1.0; +https://insight-hub.app)';

// Request headers
export const DEFAULT_HEADERS = {
  'User-Agent': BOT_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Fetch with timeout + redirect loop fallback (bot UA retry)
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    // redirect loop → retry with bot UA
    if (error instanceof TypeError && (error.cause as Error)?.message?.includes('redirect count exceeded')) {
      console.log(`[FETCH] Redirect loop detected, retrying with bot UA: ${url}`);
      clearTimeout(timeoutId);
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), timeoutMs);
      try {
        const headers = { ...(options.headers as Record<string, string>), 'User-Agent': BOT_USER_AGENT };
        return await fetch(url, { ...options, headers, signal: controller2.signal });
      } finally {
        clearTimeout(timeoutId2);
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

