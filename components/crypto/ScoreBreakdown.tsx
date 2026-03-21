'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  breakdown: TrendingExplainResponse['score_breakdown'];
  kgBoost?: TrendingExplainResponse['kg_boost'];
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

const KG_DETAIL_LABELS: Record<string, Record<Language, string>> = {
  influencer_recommends: { ko: '인플루언서 추천', en: 'Influencer Recommends', vi: 'Influencer đề xuất', zh: '大V推荐', ja: 'インフルエンサー推薦' },
  correlated_hot: { ko: '연관 코인 상승', en: 'Correlated Coin Hot', vi: 'Coin liên quan nóng', zh: '关联币热门', ja: '相関コイン上昇' },
  narrative_momentum: { ko: '내러티브 모멘텀', en: 'Narrative Momentum', vi: 'Đà tường thuật', zh: '叙事动量', ja: 'ナラティブ勢い' },
  event_impacts: { ko: '이벤트 영향', en: 'Event Impact', vi: 'Tác động sự kiện', zh: '事件影响', ja: 'イベント影響' },
};

function kgDetailLabel(detail: string, language: Language): string {
  const base = detail.replace(/×\d+$/, '');
  return KG_DETAIL_LABELS[base]?.[language] || detail;
}

export default function ScoreBreakdown({ breakdown, kgBoost, language }: Props) {
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
      {kgBoost && kgBoost.details.length > 0 && (
        <div className="mt-3 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2 bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {t(language, 'crypto.kgBoost')}
            </span>
            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-500">
              {kgBoost.multiplier > 1 ? `×${kgBoost.multiplier}` : ''}
              {kgBoost.boost > 0 ? ` +${kgBoost.boost}` : kgBoost.boost < 0 ? ` ${kgBoost.boost}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {kgBoost.details.map((d) => (
              <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                {kgDetailLabel(d, language)}
              </span>
            ))}
          </div>
        </div>
      )}
      {breakdown.mention_confidence < 1 && (
        <p className="mt-2.5 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded-md px-2 py-1.5">
          {t(language, 'crypto.mentionConfidenceLow')}
        </p>
      )}
    </div>
  );
}
