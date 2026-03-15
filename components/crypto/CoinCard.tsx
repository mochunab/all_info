'use client';

import type { CryptoSignal } from '@/types/crypto';
import { t } from '@/lib/i18n';
import SentimentGauge from './SentimentGauge';

type CoinCardProps = {
  signal: CryptoSignal;
  onClick?: (symbol: string) => void;
  language?: 'ko' | 'en' | 'vi' | 'zh' | 'ja';
};

const SIGNAL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  strong_buy: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Strong Buy' },
  buy: { bg: 'bg-green-500/10', text: 'text-green-500', label: 'Buy' },
  neutral: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', label: 'Neutral' },
  sell: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Sell' },
  strong_sell: { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Strong Sell' },
};

export default function CoinCard({ signal, onClick, language = 'ko' }: CoinCardProps) {
  const badge = SIGNAL_COLORS[signal.signal_label] || SIGNAL_COLORS.neutral;
  const velocitySign = signal.mention_velocity > 0 ? '+' : '';
  const velocityPercent = (signal.mention_velocity * 100).toFixed(0);

  return (
    <button
      onClick={() => onClick?.(signal.coin_symbol)}
      className="w-full text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            {signal.coin_symbol}
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            {t(language, 'crypto.mentions').replace('{count}', String(signal.mention_count))}
            {signal.mention_velocity !== 0 && (
              <span className={signal.mention_velocity > 0 ? 'text-green-500' : 'text-red-400'}>
                {' '}({velocitySign}{velocityPercent}%)
              </span>
            )}
          </p>
        </div>
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>

      <div className="mb-3">
        <SentimentGauge score={signal.avg_sentiment} size="sm" />
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{t(language, 'crypto.score')}: {signal.weighted_score.toFixed(0)}/100</span>
        <span>Engagement: {signal.engagement_score.toFixed(0)}</span>
      </div>
    </button>
  );
}
