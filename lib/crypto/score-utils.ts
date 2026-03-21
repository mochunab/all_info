import type { SignalLabel } from '@/types/crypto';
import {
  MIN_MENTION_CONFIDENCE,
  MARKET_CAP_DAMPENING,
  ZSCORE_SPIKE_THRESHOLD,
  ZSCORE_MAX_BOOST,
  CROSS_PLATFORM_MULTIPLIERS,
  CONTRARIAN_THRESHOLD,
  EVENT_TYPE_PATTERNS,
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

// 시가총액 순위 기반 감쇠 — rank 낮을수록(대형) 강하게 감쇠
// rank 1(BTC) → 0.3, rank 10 → 0.43, rank 50 → 0.74, rank 100 → 0.87, rank 200+ → 1.0
export function normalizeSentimentTrend(trend: number): number {
  return clamp((trend + 1) * 50, 0, 100);
}

export function computeMarketCapDampening(marketCapRank: number | null): number {
  if (!marketCapRank || marketCapRank <= 0) return 1.0;
  const { MAX_RANK, MIN_FACTOR } = MARKET_CAP_DAMPENING;
  const logRatio = Math.log10(marketCapRank) / Math.log10(MAX_RANK);
  return clamp(MIN_FACTOR + (1 - MIN_FACTOR) * logRatio, MIN_FACTOR, 1.0);
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
