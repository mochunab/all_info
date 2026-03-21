import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeWindow, SignalType, SignalComputeResult, TopPostSummary } from '@/types/crypto';
import { TIME_WINDOWS, TIME_WINDOW_MS, SIGNAL_WEIGHTS, KG_BOOST as KG_BOOST_CONFIG } from '@/lib/crypto/config';
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
  computeZScore,
  computeZScoreMultiplier,
  computeCrossPlatformMultiplier,
  computeContrarianWarning,
  computeEventModifier,
  computeKGBoost,
} from '@/lib/crypto/score-utils';
import type { KGContext } from '@/lib/crypto/score-utils';
import { ZSCORE_ROLLING_PERIODS } from '@/lib/crypto/config';

type WindowRawData = {
  mentions: { coin_symbol: string; mention_count: number; post_id: string }[];
  postMap: Map<string, {
    source_id: string; title: string; score: number; channel: string;
    upvotes: number; num_comments: number; num_awards: number;
    source: string;
  }>;
  sentimentMap: Map<string, { sentiment_score: number; fomo_score: number; fud_score: number; key_phrases: string[] }>;
  prevCounts: Map<string, number>;
  prevSentimentMap: Map<string, number[]>;
  rankMap: Map<string, number | null>;
  historicalCounts: Map<string, number[]>;
  kgContextMap: Map<string, KGContext>;
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
      .select('id, source_id, title, score, channel, upvotes, num_comments, num_awards, source')
      .in('id', postIds),
    supabase
      .from('crypto_sentiments')
      .select('post_id, sentiment_score, fomo_score, fud_score, key_phrases')
      .in('post_id', postIds),
  ]);

  const postMap = new Map<string, {
    source_id: string; title: string; score: number; channel: string;
    upvotes: number; num_comments: number; num_awards: number;
    source: string;
  }>();
  for (const p of postsRes.data || []) postMap.set(p.id, p);

  const sentimentMap = new Map<string, { sentiment_score: number; fomo_score: number; fud_score: number; key_phrases: string[] }>();
  for (const s of sentimentsRes.data || []) sentimentMap.set(s.post_id, { ...s, key_phrases: s.key_phrases || [] });

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

  // Historical mention counts for Z-score (last N periods)
  const windowMs = TIME_WINDOW_MS[window];
  const historyStart = new Date(now.getTime() - windowMs * (ZSCORE_ROLLING_PERIODS + 1));
  const { data: histMentions } = await supabase
    .from('crypto_mentions')
    .select('coin_symbol, mention_count, created_at')
    .gte('created_at', historyStart.toISOString())
    .lt('created_at', windowStart.toISOString());

  const historicalCounts = new Map<string, number[]>();
  if (histMentions) {
    const buckets = new Map<string, Map<number, number>>();
    for (const m of histMentions) {
      const t = new Date(m.created_at).getTime();
      const bucketIdx = Math.floor((t - historyStart.getTime()) / windowMs);
      if (!buckets.has(m.coin_symbol)) buckets.set(m.coin_symbol, new Map());
      const coinBuckets = buckets.get(m.coin_symbol)!;
      coinBuckets.set(bucketIdx, (coinBuckets.get(bucketIdx) || 0) + m.mention_count);
    }
    for (const [symbol, coinBuckets] of buckets) {
      historicalCounts.set(symbol, [...coinBuckets.values()]);
    }
  }

  // ── Knowledge Graph context per coin ──
  const kgContextMap = new Map<string, KGContext>();
  try {
    const { data: coinEntities } = await supabase
      .from('crypto_entities')
      .select('id, name')
      .eq('entity_type', 'coin')
      .in('name', allSymbols);

    if (coinEntities && coinEntities.length > 0) {
      const entityIdToSymbol = new Map<string, string>();
      const symbolToEntityId = new Map<string, string>();
      for (const e of coinEntities) {
        entityIdToSymbol.set(e.id, e.name);
        symbolToEntityId.set(e.name, e.id);
      }
      const entityIds = coinEntities.map(e => e.id);

      const { data: relations } = await supabase
        .from('crypto_relations')
        .select('source_entity_id, target_entity_id, relation_type, metadata')
        .gt('weight', 0)
        .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`);

      // Pre-build per-coin KG context
      const recommendsSet = new Set<string>();
      const correlatedCoins = new Map<string, string[]>();
      const narrativeCoins = new Map<string, string[]>(); // narrativeEntityId → coin symbols
      const eventImpactsMap = new Map<string, ('positive' | 'negative' | 'neutral')[]>();

      for (const rel of relations || []) {
        const srcSymbol = entityIdToSymbol.get(rel.source_entity_id);
        const tgtSymbol = entityIdToSymbol.get(rel.target_entity_id);

        if (rel.relation_type === 'recommends' && tgtSymbol) {
          recommendsSet.add(tgtSymbol);
        }
        if (rel.relation_type === 'correlates_with' && srcSymbol && tgtSymbol) {
          if (!correlatedCoins.has(srcSymbol)) correlatedCoins.set(srcSymbol, []);
          correlatedCoins.get(srcSymbol)!.push(tgtSymbol);
          if (!correlatedCoins.has(tgtSymbol)) correlatedCoins.set(tgtSymbol, []);
          correlatedCoins.get(tgtSymbol)!.push(srcSymbol);
        }
        if (rel.relation_type === 'part_of' && srcSymbol) {
          const narrativeId = rel.target_entity_id;
          if (!narrativeCoins.has(narrativeId)) narrativeCoins.set(narrativeId, []);
          narrativeCoins.get(narrativeId)!.push(srcSymbol);
        }
        if (rel.relation_type === 'impacts' && tgtSymbol) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const impact = (rel.metadata as any)?.impact || 'neutral';
          if (!eventImpactsMap.has(tgtSymbol)) eventImpactsMap.set(tgtSymbol, []);
          eventImpactsMap.get(tgtSymbol)!.push(impact);
        }
      }

      for (const symbol of allSymbols) {
        kgContextMap.set(symbol, {
          hasRecommends: recommendsSet.has(symbol),
          correlatedHotCount: 0,
          narrativeAvgScore: null,
          eventImpacts: eventImpactsMap.get(symbol) || [],
        });
      }

      // correlatedHotCount and narrativeAvgScore are resolved in computeSignals (needs scores)
      // Store raw correlations for deferred resolution
      for (const [symbol, correlated] of correlatedCoins) {
        const ctx = kgContextMap.get(symbol);
        if (ctx) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any)._correlatedSymbols = correlated;
        }
      }
      for (const [narrativeId, coins] of narrativeCoins) {
        for (const symbol of coins) {
          const ctx = kgContextMap.get(symbol);
          if (ctx) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (ctx as any)._narrativePeers = coins.filter(c => c !== symbol);
          }
        }
      }
    }
  } catch (e) {
    console.error('⚠️ [시그널] KG 컨텍스트 조회 실패 (무시):', e instanceof Error ? e.message : 'unknown');
  }

  return { mentions, postMap, sentimentMap, prevCounts, prevSentimentMap, rankMap, historicalCounts, kgContextMap };
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
    sources: Set<string>;
    keyPhrases: string[][];
  };

  const coinMap = new Map<string, CoinAgg>();

  for (const row of raw.mentions) {
    const symbol = row.coin_symbol;
    if (!coinMap.has(symbol)) {
      coinMap.set(symbol, { mentions: 0, sentiments: [], fomos: [], engagements: [], posts: [], sources: new Set(), keyPhrases: [] });
    }
    const agg = coinMap.get(symbol)!;
    agg.mentions += row.mention_count;

    const post = raw.postMap.get(row.post_id);
    if (post) {
      if (post.source) agg.sources.add(post.source);
      const engagement = (post.upvotes || 0) * 1 + (post.num_comments || 0) * 2 + (post.num_awards || 0) * 5;
      agg.engagements.push(engagement);

      const sentiment = raw.sentimentMap.get(row.post_id);
      if (sentiment) {
        if (sentiment.key_phrases?.length) agg.keyPhrases.push(sentiment.key_phrases);
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

  type Intermediate = {
    symbol: string;
    agg: CoinAgg;
    baseWeightedScore: number;
    velocity: number; avgSentiment: number; sentimentTrend: number; engagementPerMention: number;
    zScore: number; sourceCount: number;
    contrarianWarning: 'potential_reversal' | 'potential_bounce' | null;
    sentimentSkew: number;
    detectedEvents: string[]; eventModifier: number;
  };
  const intermediates: Intermediate[] = [];

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

    // V2: Z-score anomaly detection
    const history = raw.historicalCounts.get(symbol) || [];
    const zScore = computeZScore(agg.mentions, history);
    const zScoreMultiplier = computeZScoreMultiplier(zScore);

    // V2: Cross-platform confirmation
    const sourceCount = agg.sources.size;
    const crossPlatformMultiplier = computeCrossPlatformMultiplier(sourceCount);

    // V2: Event-type scoring
    const { modifier: eventModifier, events: detectedEvents } = computeEventModifier(agg.keyPhrases);

    // V2: Contrarian detection
    const allSentimentScores = agg.sentiments;
    const { warning: contrarianWarning, skew: sentimentSkew } = computeContrarianWarning(allSentimentScores);

    const rawScore =
      velocityNorm * SIGNAL_WEIGHTS.MENTION_VELOCITY +
      sentimentNorm * SIGNAL_WEIGHTS.AVG_SENTIMENT +
      trendNorm * SIGNAL_WEIGHTS.SENTIMENT_TREND +
      engagementNorm * SIGNAL_WEIGHTS.ENGAGEMENT +
      fomoFudNorm * SIGNAL_WEIGHTS.FOMO_AVG;

    const baseWeightedScore =
      rawScore * mentionConfidence * marketCapDampening * zScoreMultiplier * crossPlatformMultiplier + eventModifier;

    agg.posts.sort((a, b) => b.score - a.score);

    intermediates.push({
      symbol,
      agg,
      baseWeightedScore,
      velocity, avgSentiment, sentimentTrend, engagementPerMention,
      zScore, sourceCount, contrarianWarning, sentimentSkew,
      detectedEvents, eventModifier,
    });
  }

  // ── Pass 2: Resolve KG boosts (needs cross-coin scores) ──
  const baseScoreMap = new Map<string, number>();
  for (const item of intermediates) {
    baseScoreMap.set(item.symbol, item.baseWeightedScore);
  }

  for (const item of intermediates) {
    const kgCtx = raw.kgContextMap.get(item.symbol) || {
      hasRecommends: false, correlatedHotCount: 0, narrativeAvgScore: null, eventImpacts: [],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const correlatedSymbols: string[] = (kgCtx as any)._correlatedSymbols || [];
    kgCtx.correlatedHotCount = correlatedSymbols.filter(
      s => (baseScoreMap.get(s) || 0) >= KG_BOOST_CONFIG.CORRELATED_HOT_THRESHOLD
    ).length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const narrativePeers: string[] = (kgCtx as any)._narrativePeers || [];
    if (narrativePeers.length > 0) {
      const peerScores = narrativePeers.map(s => baseScoreMap.get(s) || 0).filter(s => s > 0);
      kgCtx.narrativeAvgScore = peerScores.length > 0
        ? peerScores.reduce((a, b) => a + b, 0) / peerScores.length
        : null;
    }

    const { boost: kgBoost, multiplier: kgMultiplier, details: kgDetails } = computeKGBoost(kgCtx);
    const weightedScore = clamp(item.baseWeightedScore * kgMultiplier + kgBoost, 0, 100);

    results.push({
      coin_symbol: item.symbol,
      time_window: window,
      signal_type: signalType,
      mention_count: item.agg.mentions,
      mention_velocity: Math.round(item.velocity * 10000) / 10000,
      avg_sentiment: Math.round(item.avgSentiment * 1000) / 1000,
      sentiment_trend: Math.round(item.sentimentTrend * 1000) / 1000,
      weighted_score: Math.round(weightedScore * 100) / 100,
      engagement_score: Math.round(item.engagementPerMention * 100) / 100,
      signal_label: computeSignalLabel(weightedScore),
      top_posts: item.agg.posts.slice(0, 5),
      z_score: Math.round(item.zScore * 1000) / 1000,
      source_count: item.sourceCount,
      contrarian_warning: item.contrarianWarning,
      sentiment_skew: item.sentimentSkew,
      detected_events: item.detectedEvents.length > 0 ? item.detectedEvents : undefined,
      event_modifier: item.eventModifier !== 0 ? item.eventModifier : undefined,
      kg_boost: kgDetails.length > 0 ? { boost: Math.round(kgBoost * 100) / 100, multiplier: kgMultiplier, details: kgDetails } : undefined,
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
  supabase: SupabaseClient<any>,
  targetSignalType?: SignalType
): Promise<{ generated: number }> {
  let totalGenerated = 0;
  const computedAt = new Date().toISOString();
  const signalTypes: SignalType[] = targetSignalType ? [targetSignalType] : ['fomo', 'fud'];

  // 2개씩 병렬 처리 (DB 부하 분산)
  const windowResults: number[] = [];
  for (let i = 0; i < TIME_WINDOWS.length; i += 2) {
    const batch = TIME_WINDOWS.slice(i, i + 2);
    const batchResults = await Promise.all(batch.map(async (window) => {
      let count = 0;
      try {
        const raw = await fetchWindowData(supabase, window);
        if (!raw) return 0;

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
              count += signals.length;
              console.log(`   📊 [시그널] ${window}/${signalType}: ${signals.length}개 코인`);
            }
          }
        }
      } catch (e) {
        console.error(`❌ [시그널] ${window} 처리 오류:`, e instanceof Error ? e.message : 'unknown');
      }
      return count;
    }));
    windowResults.push(...batchResults);
  }
  totalGenerated = windowResults.reduce((a, b) => a + b, 0);

  return { generated: totalGenerated };
}
