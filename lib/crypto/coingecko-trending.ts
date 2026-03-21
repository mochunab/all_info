import type { SupabaseClient } from '@supabase/supabase-js';
import type { CryptoCrawlResult } from '@/types/crypto';
import { extractCoinMentionsFromDB } from '@/lib/crypto/coin-extractor';

const TRENDING_API = 'https://api.coingecko.com/api/v3/search/trending';
const FETCH_TIMEOUT_MS = 15_000;

type GeckoTrendingCoin = {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    slug: string;
    score: number; // 0-based rank (0 = #1)
    data?: {
      price?: string;
      price_change_percentage_24h?: Record<string, number>;
    };
  };
};

type GeckoTrendingResponse = {
  coins: GeckoTrendingCoin[];
};

export async function fetchTrendingCoins(): Promise<GeckoTrendingResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const response = await fetch(TRENDING_API, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'InsightHub/1.0 (Crypto Monitor)',
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  return response.json();
}

// Trending rank → event modifier 점수
export function trendingRankToScore(rank: number): number {
  if (rank <= 3) return 12;
  if (rank <= 7) return 8;
  return 5;
}

export async function crawlCoinGeckoTrending(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<CryptoCrawlResult> {
  const result: CryptoCrawlResult = {
    source: 'coingecko',
    channel: 'trending',
    postsFound: 0,
    postsNew: 0,
    mentionsExtracted: 0,
    errors: [],
  };

  try {
    const data = await fetchTrendingCoins();
    const coins = data.coins || [];
    result.postsFound = coins.length;

    if (coins.length === 0) return result;

    const now = new Date().toISOString();
    const rows = coins.map((c) => {
      const rank = c.item.score + 1;
      const symbol = c.item.symbol.toUpperCase();

      const title = `CoinGecko Trending #${rank}: ${c.item.name} (${symbol})`;
      const body = null; // 메타 시그널이므로 센티먼트 분석 대상 아님

      return {
        source: 'coingecko' as const,
        source_id: `cg_trending_${c.item.id}_${new Date().toISOString().slice(0, 13)}`,
        channel: 'trending',
        title,
        body,
        author: 'coingecko',
        permalink: `https://www.coingecko.com/en/coins/${c.item.slug}`,
        upvotes: 0,
        upvote_ratio: 0,
        num_comments: 0,
        num_awards: 0,
        score: trendingRankToScore(rank),
        flair: `rank_${rank}`,
        posted_at: now,
        crawled_at: now,
        metadata: {
          trending_rank: rank,
          coingecko_id: c.item.id,
          market_cap_rank: c.item.market_cap_rank,
        },
      };
    });

    const sourceIds = rows.map((r) => r.source_id);
    const { data: existing } = await supabase
      .from('crypto_posts')
      .select('source_id')
      .in('source_id', sourceIds);
    const existingSet = new Set((existing || []).map((e: { source_id: string }) => e.source_id));

    const { data: upserted, error: upsertError } = await supabase
      .from('crypto_posts')
      .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: false })
      .select('id, source_id');

    if (upsertError) {
      result.errors.push(`upsert error: ${upsertError.message}`);
      return result;
    }

    const upsertedPosts = upserted || [];
    result.postsNew = upsertedPosts.filter((r: { source_id: string }) => !existingSet.has(r.source_id)).length;

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

    for (const coin of coins) {
      const symbol = coin.item.symbol.toUpperCase();
      const sourceId = `cg_trending_${coin.item.id}_${now.slice(0, 13)}`;
      const dbId = sourceIdToDbId.get(sourceId);
      if (!dbId) continue;

      const rank = coin.item.score + 1;
      const title = `CoinGecko Trending #${rank}: ${coin.item.name} (${symbol})`;
      const mentions = await extractCoinMentionsFromDB(title, null, supabase);

      if (mentions.length === 0) {
        mentionRows.push({
          post_id: dbId,
          coin_symbol: symbol,
          coin_name: coin.item.name,
          mention_count: 1,
          context: `CoinGecko Trending #${rank}`,
        });
      } else {
        for (const m of mentions) {
          mentionRows.push({
            post_id: dbId,
            coin_symbol: m.symbol,
            coin_name: m.name,
            mention_count: m.count,
            context: m.context || `CoinGecko Trending #${rank}`,
          });
        }
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
