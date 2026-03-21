import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { TrendingExplainResponse, CryptoSource } from '@/types/crypto';
import { SIGNAL_WEIGHTS, TIME_WINDOW_MS, NARRATIVE_CLUSTERS } from '@/lib/crypto/config';
import {
  normalizeVelocity,
  normalizeSentiment,
  normalizeEngagement,
  normalizeFomo,
  computeMentionConfidence,
} from '@/lib/crypto/score-utils';

type PostRow = {
  id: string; source: string; title: string; score: number;
  channel: string; permalink: string | null; upvotes: number;
  num_comments: number; num_awards: number;
};
type SentimentRow = {
  post_id: string; sentiment_score: number; sentiment_label: string;
  fomo_score: number; fud_score: number; reasoning: string | null;
  key_phrases: string[];
};
type MentionRow = { mention_count: number };
type EntityRow = { name: string; entity_type: string };
type PriceRow = { price_usd: number; price_change_pct_24h: number | null; volume_24h: number | null; coingecko_id: string };

export async function GET(req: NextRequest) {
  const coin = req.nextUrl.searchParams.get('coin');
  const window = req.nextUrl.searchParams.get('window') || '24h';
  const signalType = req.nextUrl.searchParams.get('signal_type') || 'fomo';

  if (!coin) {
    return NextResponse.json({ error: 'coin parameter required' }, { status: 400 });
  }

  const windowMs = TIME_WINDOW_MS[window];
  if (!windowMs) {
    return NextResponse.json({ error: 'invalid window' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: signalRow } = await supabase
    .from('crypto_signals')
    .select('computed_at')
    .eq('coin_symbol', coin)
    .eq('time_window', window)
    .eq('signal_type', signalType)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computedAt = (signalRow as any)?.computed_at;
  const anchor = computedAt ? new Date(computedAt) : new Date();
  const windowStart = new Date(anchor.getTime() - windowMs);
  const prevWindowStart = new Date(windowStart.getTime() - windowMs);

  // 1. Current window mentions → post_ids
  const { data: mentionsData } = await supabase
    .from('crypto_mentions')
    .select('post_id, mention_count')
    .eq('coin_symbol', coin)
    .gte('created_at', windowStart.toISOString())
    .lte('created_at', anchor.toISOString());

  const mentions = mentionsData || [];

  if (mentions.length === 0) {
    return NextResponse.json({ error: 'no data for this coin/window' }, { status: 404 });
  }

  const postIds = [...new Set(mentions.map((m: { post_id: string }) => m.post_id))];
  const totalMentions = mentions.reduce((a: number, m: { mention_count: number }) => a + m.mention_count, 0);

  // 2. Parallel queries
  const [postsRes, sentimentsRes, prevMentionsRes, entitiesRes, priceRes] = await Promise.all([
    supabase
      .from('crypto_posts')
      .select('id, source, title, score, channel, permalink, upvotes, num_comments, num_awards')
      .in('id', postIds),
    supabase
      .from('crypto_sentiments')
      .select('post_id, sentiment_score, sentiment_label, fomo_score, fud_score, reasoning, key_phrases')
      .in('post_id', postIds),
    supabase
      .from('crypto_mentions')
      .select('mention_count')
      .eq('coin_symbol', coin)
      .gte('created_at', prevWindowStart.toISOString())
      .lt('created_at', windowStart.toISOString()),
    supabase
      .from('crypto_entities')
      .select('name, entity_type')
      .or(`entity_type.eq.narrative,entity_type.eq.event`)
      .order('mention_count', { ascending: false })
      .limit(20),
    supabase
      .from('crypto_prices')
      .select('price_usd, price_change_pct_24h, volume_24h, coingecko_id')
      .order('fetched_at', { ascending: false })
      .limit(200),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = (postsRes.data || []) as any as PostRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sentiments = (sentimentsRes.data || []) as any as SentimentRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevMentions = (prevMentionsRes.data || []) as any as MentionRow[];

  const sentMap = new Map<string, (typeof sentiments)[0]>();
  for (const s of sentiments) sentMap.set(s.post_id, s);

  // 3. Score breakdown
  const prevCount = prevMentions.reduce((a: number, m: { mention_count: number }) => a + m.mention_count, 0);
  const velocity = prevCount > 0 ? (totalMentions - prevCount) / prevCount : 0;

  const sentScores = sentiments.map(s => s.sentiment_score);
  const avgSentiment = sentScores.length > 0 ? sentScores.reduce((a, b) => a + b, 0) / sentScores.length : 0;

  const fomoScores = sentiments.map(s => s.fomo_score || 0);
  const avgFomo = fomoScores.length > 0 ? fomoScores.reduce((a, b) => a + b, 0) / fomoScores.length : 0;

  const totalEngagement = posts.reduce((a, p) => a + (p.upvotes || 0) + (p.num_comments || 0) * 2 + (p.num_awards || 0) * 5, 0);
  const engPerMention = totalMentions > 0 ? totalEngagement / totalMentions : 0;

  const velNorm = normalizeVelocity(velocity);
  const sentNorm = normalizeSentiment(avgSentiment);
  const engNorm = normalizeEngagement(engPerMention);
  const fomoNorm = normalizeFomo(avgFomo);
  const mentionConfidence = computeMentionConfidence(totalMentions);

  const rawScore =
    velNorm * SIGNAL_WEIGHTS.MENTION_VELOCITY +
    sentNorm * SIGNAL_WEIGHTS.AVG_SENTIMENT +
    50 * SIGNAL_WEIGHTS.SENTIMENT_TREND +
    engNorm * SIGNAL_WEIGHTS.ENGAGEMENT +
    fomoNorm * SIGNAL_WEIGHTS.FOMO_AVG;

  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore * mentionConfidence)) * 100) / 100;

  // 4. Post sentiments (top 5 by score)
  const postSentiments = posts
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(p => {
      const s = sentMap.get(p.id);
      return {
        title: p.title,
        channel: p.channel,
        source: (p.source || 'reddit') as CryptoSource,
        permalink: p.permalink,
        score: p.score,
        sentiment_label: s?.sentiment_label || 'neutral',
        fomo_score: s?.fomo_score || 0,
        fud_score: s?.fud_score || 0,
        reasoning: s?.reasoning || null,
        key_phrases: s?.key_phrases || [],
      };
    });

  // 5. Source breakdown
  const sourceAgg = new Map<string, { count: number; sentTotal: number }>();
  for (const p of posts) {
    const src = p.source || 'reddit';
    const s = sentMap.get(p.id);
    const existing = sourceAgg.get(src) || { count: 0, sentTotal: 0 };
    existing.count++;
    existing.sentTotal += s?.sentiment_score || 0;
    sourceAgg.set(src, existing);
  }
  const sourceBreakdown = [...sourceAgg.entries()].map(([source, v]) => ({
    source,
    count: v.count,
    avg_sentiment: v.count > 0 ? Math.round((v.sentTotal / v.count) * 1000) / 1000 : 0,
  }));

  // 6. Key phrases aggregation (top 15)
  const phraseCount = new Map<string, number>();
  for (const s of sentiments) {
    for (const phrase of s.key_phrases || []) {
      const lower = phrase.toLowerCase();
      phraseCount.set(lower, (phraseCount.get(lower) || 0) + 1);
    }
  }
  const topPhrases = [...phraseCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([phrase, count]) => ({ phrase, count }));

  // 7. Narratives & events — coin-specific via relations
  const narratives: { name: string }[] = [];
  const events: { name: string }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities = (entitiesRes.data || []) as any as EntityRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coinEntityData } = await supabase
    .from('crypto_entities')
    .select('id')
    .eq('entity_type', 'coin')
    .eq('symbol', coin)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coinEntityRow = coinEntityData as any as { id: string } | null;

  if (coinEntityRow) {
    const { data: coinRels } = await supabase
      .from('crypto_relations')
      .select('source_entity_id, target_entity_id, relation_type')
      .or(`source_entity_id.eq.${coinEntityRow.id},target_entity_id.eq.${coinEntityRow.id}`)
      .in('relation_type', ['part_of', 'impacts'])
      .gt('weight', 0);

    type RelRow = { source_entity_id: string; target_entity_id: string; relation_type: string };
    const relatedEntityIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (coinRels || []) as any as RelRow[]) {
      relatedEntityIds.add(r.source_entity_id === coinEntityRow.id ? r.target_entity_id : r.source_entity_id);
    }

    for (const e of entities) {
      if (e.entity_type === 'narrative' && narratives.length < 5) {
        narratives.push({ name: e.name });
      }
      if (e.entity_type === 'event' && events.length < 5) {
        events.push({ name: e.name });
      }
    }
  }

  // Hardcoded fallback for narratives
  if (narratives.length === 0) {
    const matchingClusters = NARRATIVE_CLUSTERS.filter(c => c.coins.includes(coin));
    for (const cluster of matchingClusters) {
      narratives.push({ name: cluster.name });
    }
  }

  // 8. Price (match by coin symbol via crypto_coins join)
  let price: TrendingExplainResponse['price'] = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceData = (priceRes.data || []) as any as PriceRow[];
  if (priceData.length > 0) {
    const { data: coinData } = await supabase
      .from('crypto_coins')
      .select('coingecko_id')
      .eq('symbol', coin)
      .limit(1)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coinRow = coinData as any as { coingecko_id: string } | null;
    if (coinRow) {
      const priceRow = priceData.find(p => p.coingecko_id === coinRow.coingecko_id);
      if (priceRow) {
        price = {
          price_usd: priceRow.price_usd,
          price_change_pct_24h: priceRow.price_change_pct_24h,
          volume_24h: priceRow.volume_24h,
        };
      }
    }
  }

  const response: TrendingExplainResponse = {
    coin_symbol: coin,
    score_breakdown: {
      velocity: { normalized: Math.round(velNorm * 100) / 100, weight: 0.25 },
      sentiment: { normalized: Math.round(sentNorm * 100) / 100, weight: 0.30 },
      engagement: { normalized: Math.round(engNorm * 100) / 100, weight: 0.20 },
      fomo: { normalized: Math.round(fomoNorm * 100) / 100, weight: 0.10 },
      mention_confidence: Math.round(mentionConfidence * 100) / 100,
      final_score: finalScore,
    },
    post_sentiments: postSentiments,
    source_breakdown: sourceBreakdown,
    top_phrases: topPhrases,
    narratives,
    events,
    price,
  };

  return NextResponse.json(response);
}
