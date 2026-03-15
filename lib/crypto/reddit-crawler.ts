import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedditListingResponse, RedditPost, CryptoCrawlResult } from '@/types/crypto';
import { getRedditAccessToken } from '@/lib/crypto/reddit-auth';
import { extractCoinMentions } from '@/lib/crypto/coin-extractor';
import {
  CRYPTO_SUBREDDITS,
  REDDIT_API_BASE,
  REDDIT_RATE_LIMIT_MS,
  REDDIT_MAX_PAGES,
  REDDIT_PAGE_LIMIT,
} from '@/lib/crypto/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchSubredditPosts(
  subreddit: string,
  sort: 'hot' | 'new',
  token: string,
  maxPages: number = REDDIT_MAX_PAGES
): Promise<RedditPost[]> {
  const userAgent = process.env.REDDIT_USER_AGENT || 'InsightHub:MemePredictor:1.0';
  const posts: RedditPost[] = [];
  let after: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${REDDIT_API_BASE}/r/${subreddit}/${sort}`);
    url.searchParams.set('limit', String(REDDIT_PAGE_LIMIT));
    url.searchParams.set('raw_json', '1');
    if (after) url.searchParams.set('after', after);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
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
    const children = data.data.children
      .filter((c) => c.data.is_self)
      .map((c) => c.data);

    posts.push(...children);
    after = data.data.after;

    if (!after || children.length < REDDIT_PAGE_LIMIT) break;
    await sleep(REDDIT_RATE_LIMIT_MS);
  }

  return posts;
}

function redditPostToRow(post: RedditPost, subreddit: string) {
  return {
    source: 'reddit' as const,
    source_id: `reddit_${post.name}`,
    channel: subreddit,
    title: post.title,
    body: post.selftext || null,
    author: post.author,
    permalink: `https://reddit.com${post.permalink}`,
    upvotes: post.ups,
    upvote_ratio: post.upvote_ratio,
    num_comments: post.num_comments,
    num_awards: post.total_awards_received,
    score: post.score,
    flair: post.link_flair_text,
    posted_at: new Date(post.created_utc * 1000).toISOString(),
    crawled_at: new Date().toISOString(),
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
    const token = await getRedditAccessToken();

    const [hotPosts, newPosts] = await Promise.all([
      fetchSubredditPosts(subredditName, 'hot', token, 2),
      fetchSubredditPosts(subredditName, 'new', token, 1),
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

      const mentions = extractCoinMentions(post.title, post.selftext);
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
