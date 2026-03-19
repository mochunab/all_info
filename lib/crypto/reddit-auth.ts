// Reddit OAuth2 인증 — 현재 미사용 (공개 JSON 엔드포인트 사용 중)
// Reddit API 승인 후 복귀 시 reddit-crawler.ts에서 다시 import

import { getCache, setCache } from '@/lib/cache';

const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const OAUTH_TOKEN_TTL_MS = 55 * 60 * 1000;
const CACHE_KEY = 'reddit:oauth_token';

type RedditTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export async function getRedditAccessToken(): Promise<string> {
  const cached = getCache<string>(CACHE_KEY);
  if (cached) return cached;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT || 'InsightHub:MemePredictor:1.0';

  if (!clientId || !clientSecret) {
    throw new Error('REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(REDDIT_AUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Reddit OAuth failed: ${response.status} — ${text}`);
  }

  const data = (await response.json()) as RedditTokenResponse;
  setCache(CACHE_KEY, data.access_token, OAUTH_TOKEN_TTL_MS);

  return data.access_token;
}
