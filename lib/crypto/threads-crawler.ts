import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoCrawlResult, ThreadsSearchPost, ThreadsSearchResponse } from '@/types/crypto';
import { extractCoinMentions } from '@/lib/crypto/coin-extractor';
import {
  THREADS_API_BASE,
  THREADS_SEARCH_KEYWORDS,
  THREADS_SEARCH_LIMIT,
  THREADS_RATE_LIMIT_MS,
  POST_BODY_TRUNCATE_LENGTH,
} from '@/lib/crypto/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getAccessToken(): string {
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!token) throw new Error('THREADS_ACCESS_TOKEN must be set');
  return token;
}

async function searchThreadsPosts(
  keyword: string,
  accessToken: string,
  since?: number
): Promise<ThreadsSearchPost[]> {
  const params = new URLSearchParams({
    q: keyword,
    search_type: 'RECENT',
    fields: 'id,text,media_type,permalink,timestamp,username',
    limit: String(THREADS_SEARCH_LIMIT),
    access_token: accessToken,
  });

  if (since) params.set('since', String(since));

  const response = await fetch(`${THREADS_API_BASE}/keyword_search?${params}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Threads API error: ${response.status} — ${text}`);
  }

  const data = (await response.json()) as ThreadsSearchResponse;
  return data.data || [];
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function threadsPostToRow(post: ThreadsSearchPost) {
  const cleanText = sanitizeText(post.text || '');
  const title = cleanText.slice(0, 200);
  const body = cleanText.length > 200
    ? cleanText.slice(0, POST_BODY_TRUNCATE_LENGTH)
    : cleanText || null;

  return {
    source: 'threads' as const,
    source_id: `threads_${post.id}`,
    channel: `@${post.username}`,
    title,
    body,
    author: post.username,
    permalink: post.permalink,
    upvotes: 0,
    upvote_ratio: 0,
    num_comments: 0,
    num_awards: 0,
    score: 0,
    flair: null,
    posted_at: new Date(post.timestamp).toISOString(),
    crawled_at: new Date().toISOString(),
    metadata: { media_type: post.media_type },
  };
}

export async function crawlThreadsKeyword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  keyword: string,
  accessToken: string,
  since?: number
): Promise<CryptoCrawlResult> {
  const result: CryptoCrawlResult = {
    source: 'threads',
    channel: keyword,
    postsFound: 0,
    postsNew: 0,
    mentionsExtracted: 0,
    errors: [],
  };

  try {
    const posts = await searchThreadsPosts(keyword, accessToken, since);
    result.postsFound = posts.length;
    if (posts.length === 0) return result;

    const rows = posts.map((p) => threadsPostToRow(p));

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

    for (const post of posts) {
      const sourceId = `threads_${post.id}`;
      const dbId = sourceIdToDbId.get(sourceId);
      if (!dbId) continue;

      const text = sanitizeText(post.text || '');
      const title = text.slice(0, 200);
      const body = text.length > 200 ? text : null;
      const mentions = extractCoinMentions(title, body);

      for (const m of mentions) {
        mentionRows.push({
          post_id: dbId,
          coin_symbol: m.symbol,
          coin_name: m.name,
          mention_count: m.count,
          context: m.context,
        });
      }
    }

    if (mentionRows.length > 0) {
      const postIds = [...new Set(mentionRows.map((m) => m.post_id))];
      await supabase
        .from('crypto_mentions')
        .delete()
        .in('post_id', postIds);

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

export async function crawlAllThreadsKeywords(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<CryptoCrawlResult[]> {
  const accessToken = getAccessToken();
  const results: CryptoCrawlResult[] = [];

  // 마지막 크롤링 이후 게시물만 수집 (30분 전)
  const since = Math.floor((Date.now() - 35 * 60 * 1000) / 1000);

  for (const config of THREADS_SEARCH_KEYWORDS) {
    console.log(`\n🧵 [크립토] Threads "${config.keyword}" 검색 시작`);
    const result = await crawlThreadsKeyword(supabase, config.keyword, accessToken, since);

    if (result.errors.length > 0) {
      console.error(`❌ [크립토] Threads "${config.keyword}" 오류: ${result.errors.join('; ')}`);
    } else {
      console.log(`✅ [크립토] Threads "${config.keyword}" — ${result.postsFound}개 발견, ${result.postsNew}개 저장, ${result.mentionsExtracted}개 멘션`);
    }

    results.push(result);
    await sleep(THREADS_RATE_LIMIT_MS);
  }

  return results;
}
