'use client';

import type { CryptoSignal } from '@/types/crypto';

type SignalTimelineProps = {
  signals: CryptoSignal[];
  onSelect?: (symbol: string) => void;
};

const LABEL_EMOJI: Record<string, string> = {
  strong_buy: '🟢',
  buy: '🟩',
  neutral: '🟡',
  sell: '🟧',
  strong_sell: '🔴',
};

export default function SignalTimeline({ signals, onSelect }: SignalTimelineProps) {
  if (signals.length === 0) {
    return (
      <div className="text-center text-sm text-[var(--text-tertiary)] py-8">
        시그널 데이터가 없습니다
      </div>
    );
  }

  const trending = signals
    .filter((s) => s.mention_velocity > 0.5 && s.weighted_score >= 50)
    .sort((a, b) => b.mention_velocity - a.mention_velocity)
    .slice(0, 10);

  const displaySignals = trending.length > 0 ? trending : signals.slice(0, 10);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] px-1">
        {trending.length > 0 ? '🔥 Trending' : '📊 Top Signals'}
      </h3>
      <div className="space-y-1">
        {displaySignals.map((signal) => (
          <button
            key={`${signal.coin_symbol}-${signal.time_window}`}
            onClick={() => onSelect?.(signal.coin_symbol)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-left"
          >
            <span className="text-sm">{LABEL_EMOJI[signal.signal_label] || '⚪'}</span>
            <span className="text-sm font-medium text-[var(--text-primary)] min-w-[60px]">
              {signal.coin_symbol}
            </span>
            <span className="text-xs text-[var(--text-tertiary)] flex-1">
              {signal.weighted_score.toFixed(0)}점
            </span>
            {signal.mention_velocity > 0 && (
              <span className="text-xs text-green-500">
                +{(signal.mention_velocity * 100).toFixed(0)}%
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
