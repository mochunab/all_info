import type { SignalLabel } from '@/types/crypto';
import { MIN_MENTION_CONFIDENCE } from '@/lib/crypto/config';

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

export function computeSignalLabel(score: number): SignalLabel {
  if (score >= 80) return 'strong_buy';
  if (score >= 60) return 'buy';
  if (score >= 40) return 'neutral';
  if (score >= 20) return 'sell';
  return 'strong_sell';
}

export function computeMentionConfidence(mentions: number): number {
  return clamp(mentions / MIN_MENTION_CONFIDENCE, 0, 1);
}
