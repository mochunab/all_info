import type { SignalLabel } from '@/types/crypto';
import {
  MIN_MENTION_CONFIDENCE,
  MARKET_CAP_DAMPENING,
  ZSCORE_SPIKE_THRESHOLD,
  ZSCORE_MAX_BOOST,
  CROSS_PLATFORM_MULTIPLIERS,
  CONTRARIAN_THRESHOLD,
  EVENT_TYPE_PATTERNS,
  KG_BOOST,
} from '@/lib/crypto/config';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeVelocity(velocity: number): number {
  return clamp((velocity + 1) * 50, 0, 100);
}

export function normalizeSentiment(avgSentiment: number): number {
  return clamp((avgSentiment + 1) * 50, 0, 100);
}

export function normalizeEngagement(engPerMention: number): number {
  return clamp(Math.log10(engPerMention + 1) * 25, 0, 100);
}

export function normalizeFomo(avgFomo: number): number {
  return clamp(avgFomo * 100, 0, 100);
}

export function normalizeSentimentForFud(avg: number): number {
  return clamp(Math.abs(Math.min(avg, 0)) * 100, 0, 100);
}

export function normalizeFud(avgFud: number): number {
  return clamp(avgFud * 100, 0, 100);
}

export function computeSignalLabel(score: number): SignalLabel {
  if (score >= 80) return 'extremely_hot';
  if (score >= 60) return 'hot';
  if (score >= 40) return 'warm';
  if (score >= 20) return 'cool';
  return 'cold';
}

export function computeMentionConfidence(mentions: number): number {
  return clamp(mentions / MIN_MENTION_CONFIDENCE, 0, 1);
}

export function normalizeSentimentTrend(trend: number): number {
  return clamp((trend + 1) * 50, 0, 100);
}

// 시총 USD 기반 감쇠 — 시총 클수록 강하게 감쇠
// $50M 이하 → 1.0, $1B → 0.28, $10B → 0.19, $250B → 0.14, $1.3T → 0.12
// fallback: market_cap 없으면 rank 기반
export function computeMarketCapDampening(
  marketCapRank: number | null,
  marketCapUsd?: number | null,
): number {
  const { REFERENCE_CAP_USD, MIN_FACTOR, POWER, MAX_RANK, RANK_MIN_FACTOR } = MARKET_CAP_DAMPENING;

  if (marketCapUsd && marketCapUsd > 0) {
    if (marketCapUsd <= REFERENCE_CAP_USD) return 1.0;
    return clamp(Math.pow(REFERENCE_CAP_USD / marketCapUsd, POWER), MIN_FACTOR, 1.0);
  }

  // fallback: rank 기반
  if (!marketCapRank || marketCapRank <= 0) return 1.0;
  const logRatio = Math.log10(marketCapRank) / Math.log10(MAX_RANK);
  return clamp(RANK_MIN_FACTOR + (1 - RANK_MIN_FACTOR) * logRatio, RANK_MIN_FACTOR, 1.0);
}

// ── Signal Scoring V2 ──

export function computeZScore(current: number, history: number[]): number {
  if (history.length < 3) return 0;
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((sum, v) => sum + (v - mean) ** 2, 0) / history.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (current - mean) / std;
}

export function computeZScoreMultiplier(zScore: number): number {
  if (zScore <= ZSCORE_SPIKE_THRESHOLD) return 1.0;
  const boost = 1.0 + (zScore - ZSCORE_SPIKE_THRESHOLD) * 0.25;
  return Math.min(boost, ZSCORE_MAX_BOOST);
}

export function computeCrossPlatformMultiplier(sourceCount: number): number {
  if (sourceCount <= 1) return CROSS_PLATFORM_MULTIPLIERS.SINGLE;
  if (sourceCount === 2) return CROSS_PLATFORM_MULTIPLIERS.DUAL;
  return CROSS_PLATFORM_MULTIPLIERS.MULTI;
}

export function computeContrarianWarning(
  sentiments: number[]
): { warning: 'potential_reversal' | 'potential_bounce' | null; skew: number } {
  if (sentiments.length < 5) return { warning: null, skew: 50 };
  const bullish = sentiments.filter(s => s > 0).length;
  const ratio = bullish / sentiments.length;
  const skew = Math.round(ratio * 100);
  if (ratio > CONTRARIAN_THRESHOLD) return { warning: 'potential_reversal', skew };
  if (ratio < 1 - CONTRARIAN_THRESHOLD) return { warning: 'potential_bounce', skew };
  return { warning: null, skew };
}

export function computeEventModifier(
  allKeyPhrases: string[][]
): { modifier: number; events: string[] } {
  let total = 0;
  const detected: string[] = [];
  for (const phrases of allKeyPhrases) {
    for (const phrase of phrases) {
      const lower = phrase.toLowerCase();
      for (const [eventType, config] of Object.entries(EVENT_TYPE_PATTERNS)) {
        if (detected.includes(eventType)) continue;
        if (config.keywords.some(kw => lower.includes(kw))) {
          total += config.modifier;
          detected.push(eventType);
        }
      }
    }
  }
  return { modifier: clamp(total, -30, 25), events: detected };
}

// ── Knowledge Graph Boost ──

export type KGContext = {
  recommendsStrength: number; // 0~1: max(influencer_confidence × relation_weight)
  correlatedWeights: number[]; // relation weights for hot correlated coins
  entityConfidence: number; // 0.3~1.0: coin entity confidence
  narrativeAvgScore: number | null;
  eventImpacts: ('positive' | 'negative' | 'neutral')[];
};

export function computeKGBoost(ctx: KGContext): { boost: number; multiplier: number; details: string[] } {
  let boost = 0;
  let multiplier = 1.0;
  const details: string[] = [];

  // 1. Influencer recommends — strength-weighted multiplier
  if (ctx.recommendsStrength > 0) {
    multiplier = 1.0 + KG_BOOST.INFLUENCER_RECOMMENDS_MAX * clamp(ctx.recommendsStrength, 0, 1);
    details.push(`influencer_recommends(${ctx.recommendsStrength.toFixed(2)})`);
  }

  // 2. Correlated coins — weight-proportional boost (weight/CAP × max per coin)
  const cap = KG_BOOST.CORRELATED_WEIGHT_CAP;
  for (const w of ctx.correlatedWeights.slice(0, 3)) {
    boost += KG_BOOST.CORRELATED_HOT_BOOST * clamp(w / cap, 0, 1);
  }
  if (ctx.correlatedWeights.length > 0) {
    details.push(`correlated_hot×${Math.min(ctx.correlatedWeights.length, 3)}(w)`);
  }

  // 3. Narrative momentum — bidirectional continuous scale
  // avg 100 → +4, avg 75 → +2, avg 50 → 0, avg 25 → -2, avg 0 → -4
  if (ctx.narrativeAvgScore !== null) {
    const maxBoost = KG_BOOST.NARRATIVE_MOMENTUM_MAX_BOOST;
    boost += ((ctx.narrativeAvgScore - 50) / 50) * maxBoost;
    details.push(`narrative_momentum(${ctx.narrativeAvgScore.toFixed(0)})`);
  }

  // 4. Event impacts
  for (const impact of ctx.eventImpacts) {
    if (impact === 'positive') boost += KG_BOOST.EVENT_IMPACT_POSITIVE;
    else if (impact === 'negative') boost += KG_BOOST.EVENT_IMPACT_NEGATIVE;
  }
  if (ctx.eventImpacts.length > 0) details.push(`event_impacts×${ctx.eventImpacts.length}`);

  boost = clamp(boost, -KG_BOOST.MAX_TOTAL_BOOST, KG_BOOST.MAX_TOTAL_BOOST);

  // 5. Entity confidence modifier — scale total boost
  const confidence = clamp(ctx.entityConfidence, 0.3, 1.0);
  boost *= confidence;
  if (confidence < 1.0) details.push(`entity_conf(${confidence.toFixed(2)})`);

  return { boost, multiplier, details };
}
