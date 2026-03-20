'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  sources: TrendingExplainResponse['source_breakdown'];
  language: Language;
};

const SOURCE_COLORS: Record<string, string> = {
  reddit: 'bg-orange-500',
  telegram: 'bg-blue-500',
  threads: 'bg-purple-500',
};

export default function SourceBreakdown({ sources, language }: Props) {
  if (sources.length === 0) return null;

  const total = sources.reduce((a, s) => a + s.count, 0);

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
        {t(language, 'crypto.whereDiscussed')}
      </h3>
      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden flex">
        {sources.map(s => (
          <div
            key={s.source}
            className={`${SOURCE_COLORS[s.source] || 'bg-gray-400'} transition-all`}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {sources.map(s => {
          const sentColor = s.avg_sentiment > 0.3
            ? 'text-emerald-400'
            : s.avg_sentiment < -0.3
              ? 'text-red-400'
              : 'text-[var(--text-tertiary)]';
          return (
            <div key={s.source} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${SOURCE_COLORS[s.source] || 'bg-gray-400'}`} />
              <span className="text-[10px] text-[var(--text-secondary)] capitalize">{s.source}</span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{s.count}</span>
              <span className={`text-[9px] ${sentColor}`}>
                {s.avg_sentiment > 0 ? '+' : ''}{s.avg_sentiment.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
