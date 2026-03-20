import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoCrawlResult, ApifyTweet } from '@/types/crypto';
import { extractCoinMentionsFromDB } from '@/lib/crypto/coin-extractor';
import {
  TWITTER_SEARCH_KEYWORDS,
  TWITTER_RESULTS_PER_KEYWORD,
  TWITTER_APIFY_ACTOR,
  TWITTER_APIFY_TIMEOUT_MS,
  POST_BODY_TRUNCATE_LENGTH,
} from '@/lib/crypto/config';

function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error('APIFY_API_TOKEN must be set');
  return token;
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\0/g, '');
}

function sanitizeObject<T>(obj: T): T {
  return JSON.parse(sanitizeText(JSON.stringify(obj))) as T;
}

function tweetToRow(tweet: ApifyTweet) {
  const cleanText = sanitizeText(tweet.full_text || tweet.text || '');
  const title = cleanText.slice(0, 200);
  const body = cleanText.length > 200
    ? cleanText.slice(0, POST_BODY_TRUNCATE_LENGTH)
    : cleanText || null;

  const permalink = `https://x.com/${tweet.username}/status/${tweet.id}`;

  // hashtags가 [{tag: "..."}, ...] 형태일 수 있음
  const hashtags = Array.isArray(tweet.hashtags)
    ? tweet.hashtags.map((h: string | { tag?: string }) =>
        typeof h === 'string' ? h : h?.tag || '')
      .filter(Boolean)
    : [];

  return {
    source: 'twitter' as const,
    source_id: `twitter_${tweet.id}`,
    channel: sanitizeText(`@${tweet.username || 'unknown'}`),
    title: sanitizeText(title),
    body: body ? sanitizeText(body) : null,
    author: tweet.username || null,
    permalink,
    upvotes: tweet.favorite_count || 0,
    upvote_ratio: 0,
    num_comments: tweet.reply_count || 0,
    num_awards: 0,
    score: (tweet.favorite_count || 0) + (tweet.retweet_count || 0) * 2,
    flair: null,
    posted_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
    crawled_at: new Date().toISOString(),
    metadata: {
      retweet_count: tweet.retweet_count || 0,
      quote_count: tweet.quote_count || 0,
      user_verified: tweet.user_verified || false,
      user_is_blue_verified: tweet.user_is_blue_verified || false,
      user_followers_count: tweet.user_followers_count || 0,
      hashtags,
      is_retweet: tweet.is_retweet || false,
    },
  };
}

async function searchTweets(query: string, maxResults: number, token: string): Promise<ApifyTweet[]> {
  const actorId = TWITTER_APIFY_ACTOR.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TWITTER_APIFY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'Advanced Search',
        query: `${query} lang:en`,
        query_type: 'Latest',
        max_results: maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Apify API error: ${response.status} — ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function crawlTwitterKeyword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  query: string,
  token: string
): Promise<CryptoCrawlResult> {
  const result: CryptoCrawlResult = {
    source: 'twitter',
    channel: query,
    postsFound: 0,
    postsNew: 0,
    mentionsExtracted: 0,
    errors: [],
  };

  try {
    const tweets = await searchTweets(query, TWITTER_RESULTS_PER_KEYWORD, token);
    result.postsFound = tweets.length;
    if (tweets.length === 0) return result;

    const rows = tweets.map((t) => sanitizeObject(tweetToRow(t)));

    const { data: upserted, error: upsertError } = await supabase
      .from('crypto_posts')
      .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: false })
      .select('id, source_id');

    if (upsertError) {
      result.errors.push(`upsert error: ${upsertError.message}`);
      return result;
    }

    const upsertedPosts = upserted || [];
    result.postsNew = upsertedPosts.length;

    const sourceIdToDbId = new Map<string, string>();
    for (const row of upsertedPosts) {
      sourceIdToDbId.set(row.source_id, row.id);
    }

    const mentionRows: {
      post_id: string;
      coin_symbol: string;
      coin_name: string | null;
      mention_count: number;
      context: string | null;
    }[] = [];

    for (const tweet of tweets) {
      const sourceId = `twitter_${tweet.id}`;
      const dbId = sourceIdToDbId.get(sourceId);
      if (!dbId) continue;

      const text = sanitizeText(tweet.full_text || tweet.text || '');
      const title = text.slice(0, 200);
      const body = text.length > 200 ? text : null;
      const mentions = await extractCoinMentionsFromDB(title, body, supabase);

      for (const m of mentions) {
        mentionRows.push({
          post_id: dbId,
          coin_symbol: m.symbol,
          coin_name: m.name,
          mention_count: m.count,
          context: m.context ? sanitizeText(m.context) : null,
        });
      }
    }

    if (mentionRows.length > 0) {
      const postIds = [...new Set(mentionRows.map((m) => m.post_id))];
      await supabase.from('crypto_mentions').delete().in('post_id', postIds);

      const { error: mentionError } = await supabase
        .from('crypto_mentions')
        .insert(mentionRows);

      if (mentionError) {
        result.errors.push(`mention insert error: ${mentionError.message}`);
      } else {
        result.mentionsExtracted = mentionRows.length;
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

export async function crawlAllTwitterKeywords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<CryptoCrawlResult[]> {
  const token = getApifyToken();
  const results: CryptoCrawlResult[] = [];

  for (const config of TWITTER_SEARCH_KEYWORDS) {
    console.log(`\n🐦 [크립토] Twitter "${config.query}" 검색 시작`);
    const result = await crawlTwitterKeyword(supabase, config.query, token);

    if (result.errors.length > 0) {
      console.error(`❌ [크립토] Twitter "${config.query}" 오류: ${result.errors.join('; ')}`);
    } else {
      console.log(`✅ [크립토] Twitter "${config.query}" — ${result.postsFound}개 발견, ${result.postsNew}개 저장, ${result.mentionsExtracted}개 멘션`);
    }

    results.push(result);
  }

  return results;
}
