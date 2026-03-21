import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeWindow, SignalType, SignalComputeResult, TopPostSummary } from '@/types/crypto';
import { TIME_WINDOWS, TIME_WINDOW_MS, SIGNAL_WEIGHTS } from '@/lib/crypto/config';
import {
  clamp,
  normalizeVelocity,
  normalizeSentiment,
  normalizeSentimentForFud,
  normalizeSentimentTrend,
  normalizeEngagement,
  normalizeFomo,
  normalizeFud,
  computeSignalLabel,
  computeMentionConfidence,
  computeMarketCapDampening,
} from '@/lib/crypto/score-utils';

type WindowRawData = {
  mentions: { coin_symbol: string; mention_count: number; post_id: string }[];
  postMap: Map<string, {
    source_id: string; title: string; score: number; channel: string;
    upvotes: number; num_comments: number; num_awards: number;
  }>;
  sentimentMap: Map<string, { sentiment_score: number; fomo_score: number; fud_score: number }>;
  prevCounts: Map<string, number>;
  prevSentimentMap: Map<string, number[]>;
  rankMap: Map<string, number | null>;
};

async function fetchWindowData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  window: TimeWindow
): Promise<WindowRawData | null> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - TIME_WINDOW_MS[window]);
  const prevWindowStart = new Date(windowStart.getTime() - TIME_WINDOW_MS[window]);

  const { data: mentions, error: mentionErr } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count, post_id')
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', now.toISOString());

  if (mentionErr || !mentions || mentions.length === 0) return null;

  const postIds = [...new Set(mentions.map((m: { post_id: string }) => m.post_id))];

  const [postsRes, sentimentsRes] = await Promise.all([
    supabase
      .from('crypto_posts')
      .select('id, source_id, title, score, channel, upvotes, num_comments, num_awards')
      .in('id', postIds),
    supabase
      .from('crypto_sentiments')
      .select('post_id, sentiment_score, fomo_score, fud_score')
      .in('post_id', postIds),
  ]);

  const postMap = new Map<string, {
    source_id: string; title: string; score: number; channel: string;
    upvotes: number; num_comments: number; num_awards: number;
  }>();
  for (const p of postsRes.data || []) postMap.set(p.id, p);

  const sentimentMap = new Map<string, { sentiment_score: number; fomo_score: number; fud_score: number }>();
  for (const s of sentimentsRes.data || []) sentimentMap.set(s.post_id, s);

  const { data: prevData } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count, post_id')
    .gte('created_at', prevWindowStart.toISOString())
    .lt('created_at', windowStart.toISOString());

  const prevCounts = new Map<string, number>();
  const prevPostIds: string[] = [];
  if (prevData) {
    for (const m of prevData) {
      prevCounts.set(m.coin_symbol, (prevCounts.get(m.coin_symbol) || 0) + m.mention_count);
      prevPostIds.push(m.post_id);
    }
  }

  const prevSentimentMap = new Map<string, number[]>();
  if (prevPostIds.length > 0) {
    const uniquePrevPostIds = [...new Set(prevPostIds)];
    const { data: prevSentiments } = await supabase
      .from('crypto_sentiments')
      .select('post_id, sentiment_score')
      .in('post_id', uniquePrevPostIds);

    if (prevSentiments && prevData) {
      const prevPostToSentiment = new Map<string, number>();
      for (const s of prevSentiments) prevPostToSentiment.set(s.post_id, s.sentiment_score);
      for (const m of prevData) {
        const score = prevPostToSentiment.get(m.post_id);
        if (score !== undefined) {
          if (!prevSentimentMap.has(m.coin_symbol)) prevSentimentMap.set(m.coin_symbol, []);
          prevSentimentMap.get(m.coin_symbol)!.push(score);
        }
      }
    }
  }

  const allSymbols = [...new Set(mentions.map((m: { coin_symbol: string }) => m.coin_symbol))];
  const { data: coinRows } = await supabase
    .from('crypto_coins')
    .select('symbol, market_cap_rank')
    .in('symbol', allSymbols);

  const rankMap = new Map<string, number | null>();
  for (const c of coinRows || []) rankMap.set(c.symbol.toUpperCase(), c.market_cap_rank);

  return { mentions, postMap, sentimentMap, prevCounts, prevSentimentMap, rankMap };
}

function computeSignals(
  raw: WindowRawData,
  signalType: SignalType,
  window: TimeWindow
): SignalComputeResult[] {
  type CoinAgg = {
    mentions: number;
    sentiments: number[];
    fomos: number[];
    engagements: number[];
    posts: TopPostSummary[];
  };

  const coinMap = new Map<string, CoinAgg>();

  for (const row of raw.mentions) {
    const symbol = row.coin_symbol;
    if (!coinMap.has(symbol)) {
      coinMap.set(symbol, { mentions: 0, sentiments: [], fomos: [], engagements: [], posts: [] });
    }
    const agg = coinMap.get(symbol)!;
    agg.mentions += row.mention_count;

    const post = raw.postMap.get(row.post_id);
    if (post) {
      const engagement = (post.upvotes || 0) * 1 + (post.num_comments || 0) * 2 + (post.num_awards || 0) * 5;
      agg.engagements.push(engagement);

      const sentiment = raw.sentimentMap.get(row.post_id);
      if (sentiment) {
        const include = signalType === 'fomo'
          ? sentiment.sentiment_score >= 0
          : sentiment.sentiment_score <= 0;

        if (include) {
          agg.sentiments.push(sentiment.sentiment_score);
          agg.fomos.push(signalType === 'fomo' ? (sentiment.fomo_score || 0) : (sentiment.fud_score || 0));
        }
      }

      if (agg.posts.length < 5) {
        agg.posts.push({
          source_id: post.source_id,
          title: post.title,
          score: post.score,
          sentiment_score: sentiment?.sentiment_score || 0,
          channel: post.channel,
        });
      }
    }
  }

  const results: SignalComputeResult[] = [];

  for (const [symbol, agg] of coinMap) {
    const prevCount = raw.prevCounts.get(symbol) || 0;
    const velocity = prevCount > 0 ? (agg.mentions - prevCount) / prevCount : 0;

    const avgSentiment = agg.sentiments.length > 0
      ? agg.sentiments.reduce((a, b) => a + b, 0) / agg.sentiments.length
      : 0;

    const avgFomoFud = agg.fomos.length > 0
      ? agg.fomos.reduce((a, b) => a + b, 0) / agg.fomos.length
      : 0;

    const totalEngagement = agg.engagements.reduce((a, b) => a + b, 0);
    const engagementPerMention = agg.mentions > 0 ? totalEngagement / agg.mentions : 0;

    const prevSentiments = raw.prevSentimentMap.get(symbol);
    const prevAvgSentiment = prevSentiments && prevSentiments.length > 0
      ? prevSentiments.reduce((a, b) => a + b, 0) / prevSentiments.length
      : null;
    const sentimentTrend = prevAvgSentiment !== null ? avgSentiment - prevAvgSentiment : 0;

    const velocityNorm = normalizeVelocity(velocity);
    const sentimentNorm = signalType === 'fomo'
      ? normalizeSentiment(avgSentiment)
      : normalizeSentimentForFud(avgSentiment);
    const trendNorm = normalizeSentimentTrend(sentimentTrend);
    const engagementNorm = normalizeEngagement(engagementPerMention);
    const fomoFudNorm = signalType === 'fomo'
      ? normalizeFomo(avgFomoFud)
      : normalizeFud(avgFomoFud);

    const mentionConfidence = computeMentionConfidence(agg.mentions);
    const marketCapDampening = computeMarketCapDampening(raw.rankMap.get(symbol) ?? null);

    const rawScore =
      velocityNorm * SIGNAL_WEIGHTS.MENTION_VELOCITY +
      sentimentNorm * SIGNAL_WEIGHTS.AVG_SENTIMENT +
      trendNorm * SIGNAL_WEIGHTS.SENTIMENT_TREND +
      engagementNorm * SIGNAL_WEIGHTS.ENGAGEMENT +
      fomoFudNorm * SIGNAL_WEIGHTS.FOMO_AVG;

    const weightedScore = clamp(rawScore * mentionConfidence * marketCapDampening, 0, 100);

    agg.posts.sort((a, b) => b.score - a.score);

    results.push({
      coin_symbol: symbol,
      time_window: window,
      signal_type: signalType,
      mention_count: agg.mentions,
      mention_velocity: Math.round(velocity * 10000) / 10000,
      avg_sentiment: Math.round(avgSentiment * 1000) / 1000,
      sentiment_trend: Math.round(sentimentTrend * 1000) / 1000,
      weighted_score: Math.round(weightedScore * 100) / 100,
      engagement_score: Math.round(engagementPerMention * 100) / 100,
      signal_label: computeSignalLabel(weightedScore),
      top_posts: agg.posts.slice(0, 5),
    });
  }

  return results;
}

export async function generateSignalsForWindow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  window: TimeWindow,
  signalType: SignalType = 'fomo'
): Promise<SignalComputeResult[]> {
  const raw = await fetchWindowData(supabase, window);
  if (!raw) return [];
  return computeSignals(raw, signalType, window);
}

export async function generateAllSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<{ generated: number }> {
  let totalGenerated = 0;
  const computedAt = new Date().toISOString();
  const signalTypes: SignalType[] = ['fomo', 'fud'];

  for (const window of TIME_WINDOWS) {
    const raw = await fetchWindowData(supabase, window);
    if (!raw) continue;

    for (const signalType of signalTypes) {
      const signals = computeSignals(raw, signalType, window);

      if (signals.length > 0) {
        const rows = signals.map((s) => ({
          ...s,
          top_posts: JSON.stringify(s.top_posts),
          computed_at: computedAt,
        }));

        const { error } = await supabase
          .from('crypto_signals')
          .upsert(rows, {
            onConflict: 'coin_symbol,time_window,signal_type,computed_at',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`❌ [시그널] ${window}/${signalType} 저장 실패:`, error.message);
        } else {
          totalGenerated += signals.length;
          console.log(`   📊 [시그널] ${window}/${signalType}: ${signals.length}개 코인`);
        }
      }
    }
  }

  return { generated: totalGenerated };
}
