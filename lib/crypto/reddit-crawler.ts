import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedditListingResponse, RedditPost, CryptoCrawlResult } from '@/types/crypto';
import { extractCoinMentionsFromDB } from '@/lib/crypto/coin-extractor';
import {
  CRYPTO_SUBREDDITS,
  REDDIT_RATE_LIMIT_MS,
  REDDIT_MAX_PAGES,
  REDDIT_PAGE_LIMIT,
} from '@/lib/crypto/config';

const REDDIT_PUBLIC_BASE = 'https://www.reddit.com';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchSubredditPosts(
  subreddit: string,
  sort: 'hot' | 'new',
  maxPages: number = REDDIT_MAX_PAGES
): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${REDDIT_PUBLIC_BASE}/r/${subreddit}/${sort}.json`);
    url.searchParams.set('limit', String(REDDIT_PAGE_LIMIT));
    url.searchParams.set('raw_json', '1');
    if (after) url.searchParams.set('after', after);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'InsightHub:MemePredictor:1.0 (by /u/insighthub)',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[Reddit] Rate limited on r/${subreddit}/${sort}, waiting 2s`);
        await sleep(2000);
        continue;
      }
      throw new Error(`Reddit API error: ${response.status} for r/${subreddit}/${sort}`);
    }

    const data = (await response.json()) as RedditListingResponse;
    const children = data.data.children.map((c) => c.data);

    posts.push(...children);
    after = data.data.after;

    if (!after || children.length < REDDIT_PAGE_LIMIT) break;
    await sleep(REDDIT_RATE_LIMIT_MS);
  }

  return posts;
}

function sanitizeText(text: string): string {
  return text
    .replace(/\x00/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '');
}

function redditPostToRow(post: RedditPost, subreddit: string) {
  return {
    source: 'reddit' as const,
    source_id: `reddit_${post.name}`,
    channel: subreddit,
    title: sanitizeText(post.title),
    body: post.selftext ? sanitizeText(post.selftext) : null,
    author: post.author,
    permalink: `https://reddit.com${post.permalink}`,
    upvotes: post.ups,
    upvote_ratio: post.upvote_ratio,
    num_comments: post.num_comments,
    num_awards: post.total_awards_received,
    score: post.score,
    flair: post.link_flair_text ? sanitizeText(post.link_flair_text) : null,
    posted_at: new Date(post.created_utc * 1000).toISOString(),
    crawled_at: new Date().toISOString(),
    metadata: { subreddit_subscribers: post.subreddit_subscribers || 0 },
  };
}

export async function crawlSubreddit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  subredditName: string,
  minScore: number
): Promise<CryptoCrawlResult> {
  const result: CryptoCrawlResult = {
    source: 'reddit',
    channel: subredditName,
    postsFound: 0,
    postsNew: 0,
    mentionsExtracted: 0,
    errors: [],
  };

  try {
    const [hotPosts, newPosts] = await Promise.all([
      fetchSubredditPosts(subredditName, 'hot', 2),
      fetchSubredditPosts(subredditName, 'new', 1),
    ]);

    const seen = new Set<string>();
    const allPosts: RedditPost[] = [];
    for (const post of [...hotPosts, ...newPosts]) {
      if (!seen.has(post.name) && post.score >= minScore) {
        seen.add(post.name);
        allPosts.push(post);
      }
    }

    result.postsFound = allPosts.length;
    if (allPosts.length === 0) return result;

    const rows = allPosts.map((p) => redditPostToRow(p, subredditName));

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

    for (const post of allPosts) {
      const dbId = sourceIdToDbId.get(`reddit_${post.name}`);
      if (!dbId) continue;

      const mentions = await extractCoinMentionsFromDB(sanitizeText(post.title), post.selftext ? sanitizeText(post.selftext) : null, supabase);
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

export async function crawlAllSubreddits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<CryptoCrawlResult[]> {
  const results: CryptoCrawlResult[] = [];

  for (const config of CRYPTO_SUBREDDITS) {
    console.log(`\n📌 [크립토] r/${config.name} 크롤링 시작 (minScore: ${config.minScore})`);
    const result = await crawlSubreddit(supabase, config.name, config.minScore);

    if (result.errors.length > 0) {
      console.error(`❌ [크립토] r/${config.name} 오류: ${result.errors.join('; ')}`);
    } else {
      console.log(`✅ [크립토] r/${config.name} — ${result.postsFound}개 발견, ${result.postsNew}개 저장, ${result.mentionsExtracted}개 멘션`);
    }

    results.push(result);
    await sleep(REDDIT_RATE_LIMIT_MS);
  }

  return results;
}
