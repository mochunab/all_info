import type { SupabaseClient } from '@supabase/supabase-js';
import type { SignalLabel, TimeWindow, SignalComputeResult, TopPostSummary } from '@/types/crypto';
import { TIME_WINDOWS, TIME_WINDOW_MS, SIGNAL_WEIGHTS } from '@/lib/crypto/config';

function computeSignalLabel(score: number): SignalLabel {
  if (score >= 80) return 'strong_buy';
  if (score >= 60) return 'buy';
  if (score >= 40) return 'neutral';
  if (score >= 20) return 'sell';
  return 'strong_sell';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function generateSignalsForWindow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  window: TimeWindow
): Promise<SignalComputeResult[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - TIME_WINDOW_MS[window]);
  const prevWindowStart = new Date(windowStart.getTime() - TIME_WINDOW_MS[window]);

  // 1. 현재 윈도우 멘션
  const { data: mentions, error: mentionErr } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count, post_id')
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', now.toISOString());

  if (mentionErr || !mentions || mentions.length === 0) return [];

  // 2. 관련 post_id 수집 → 게시물 + 센티먼트 조회
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
  for (const p of postsRes.data || []) {
    postMap.set(p.id, p);
  }

  const sentimentMap = new Map<string, { sentiment_score: number; fomo_score: number; fud_score: number }>();
  for (const s of sentimentsRes.data || []) {
    sentimentMap.set(s.post_id, s);
  }

  // 3. 이전 윈도우 멘션 (velocity 계산용)
  const { data: prevData } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count')
    .gte('created_at', prevWindowStart.toISOString())
    .lt('created_at', windowStart.toISOString());

  const prevCounts = new Map<string, number>();
  if (prevData) {
    for (const m of prevData) {
      prevCounts.set(m.coin_symbol, (prevCounts.get(m.coin_symbol) || 0) + m.mention_count);
    }
  }

  // 4. 코인별 집계
  type CoinAgg = {
    mentions: number;
    sentiments: number[];
    fomos: number[];
    engagements: number[];
    posts: TopPostSummary[];
  };

  const coinMap = new Map<string, CoinAgg>();

  for (const row of mentions) {
    const symbol = row.coin_symbol;
    if (!coinMap.has(symbol)) {
      coinMap.set(symbol, { mentions: 0, sentiments: [], fomos: [], engagements: [], posts: [] });
    }
    const agg = coinMap.get(symbol)!;
    agg.mentions += row.mention_count;

    const post = postMap.get(row.post_id);
    if (post) {
      const engagement = (post.upvotes || 0) * 1 + (post.num_comments || 0) * 2 + (post.num_awards || 0) * 5;
      agg.engagements.push(engagement);

      const sentiment = sentimentMap.get(row.post_id);
      if (sentiment) {
        agg.sentiments.push(sentiment.sentiment_score);
        agg.fomos.push(sentiment.fomo_score || 0);
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

  // 5. 시그널 계산
  const results: SignalComputeResult[] = [];

  for (const [symbol, agg] of coinMap) {
    const prevCount = prevCounts.get(symbol) || 0;
    const velocity = prevCount > 0
      ? (agg.mentions - prevCount) / prevCount
      : agg.mentions > 0 ? 1 : 0;

    const avgSentiment = agg.sentiments.length > 0
      ? agg.sentiments.reduce((a, b) => a + b, 0) / agg.sentiments.length
      : 0;

    const avgFomo = agg.fomos.length > 0
      ? agg.fomos.reduce((a, b) => a + b, 0) / agg.fomos.length
      : 0;

    const totalEngagement = agg.engagements.reduce((a, b) => a + b, 0);
    const engagementPerMention = agg.mentions > 0 ? totalEngagement / agg.mentions : 0;

    const velocityNorm = clamp((velocity + 1) * 50, 0, 100);
    const sentimentNorm = clamp((avgSentiment + 1) * 50, 0, 100);
    const trendNorm = 50;
    const engagementNorm = clamp(Math.log10(engagementPerMention + 1) * 25, 0, 100);
    const fomoNorm = clamp(avgFomo * 100, 0, 100);

    const weightedScore = clamp(
      velocityNorm * SIGNAL_WEIGHTS.MENTION_VELOCITY +
      sentimentNorm * SIGNAL_WEIGHTS.AVG_SENTIMENT +
      trendNorm * SIGNAL_WEIGHTS.SENTIMENT_TREND +
      engagementNorm * SIGNAL_WEIGHTS.ENGAGEMENT +
      fomoNorm * SIGNAL_WEIGHTS.FOMO_AVG,
      0, 100
    );

    agg.posts.sort((a, b) => b.score - a.score);

    results.push({
      coin_symbol: symbol,
      time_window: window,
      mention_count: agg.mentions,
      mention_velocity: Math.round(velocity * 10000) / 10000,
      avg_sentiment: Math.round(avgSentiment * 1000) / 1000,
      sentiment_trend: 0,
      weighted_score: Math.round(weightedScore * 100) / 100,
      engagement_score: Math.round(engagementPerMention * 100) / 100,
      signal_label: computeSignalLabel(weightedScore),
      top_posts: agg.posts.slice(0, 5),
    });
  }

  return results;
}

export async function generateAllSignals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<{ generated: number }> {
  let totalGenerated = 0;
  const computedAt = new Date().toISOString();

  for (const window of TIME_WINDOWS) {
    const signals = await generateSignalsForWindow(supabase, window);

    if (signals.length > 0) {
      const rows = signals.map((s) => ({
        ...s,
        top_posts: JSON.stringify(s.top_posts),
        computed_at: computedAt,
      }));

      const { error } = await supabase
        .from('crypto_signals')
        .upsert(rows, {
          onConflict: 'coin_symbol,time_window,computed_at',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`❌ [시그널] ${window} 저장 실패:`, error.message);
      } else {
        totalGenerated += signals.length;
        console.log(`   📊 [시그널] ${window}: ${signals.length}개 코인`);
      }
    }
  }

  return { generated: totalGenerated };
}
