'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  breakdown: TrendingExplainResponse['score_breakdown'];
  language: Language;
};

function strengthLabel(value: number, language: Language): string {
  if (value >= 66) return t(language, 'crypto.strong');
  if (value >= 33) return t(language, 'crypto.moderate');
  return t(language, 'crypto.weak');
}

const BARS = [
  { key: 'velocity' as const, labelKey: 'crypto.buzzSpeed', color: 'bg-blue-500' },
  { key: 'sentiment' as const, labelKey: 'crypto.communityMood', color: 'bg-emerald-500' },
  { key: 'engagement' as const, labelKey: 'crypto.engagement', color: 'bg-purple-500' },
  { key: 'fomo' as const, labelKey: 'crypto.hypeLevel', color: 'bg-orange-500' },
] as const;

export default function ScoreBreakdown({ breakdown, language }: Props) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
        {t(language, 'crypto.scoreBreakdown')}
      </h3>
      <div className="space-y-2.5">
        {BARS.map(({ key, labelKey, color }) => {
          const val = breakdown[key].normalized;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {t(language, labelKey)}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  {strengthLabel(val, language)}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(2, val)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {breakdown.mention_confidence < 1 && (
        <p className="mt-2.5 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded-md px-2 py-1.5">
          {t(language, 'crypto.mentionConfidenceLow')}
        </p>
      )}
    </div>
  );
}
