'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  posts: TrendingExplainResponse['post_sentiments'];
  language: Language;
};

const SENTIMENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  bullish: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Bullish' },
  bearish: { bg: 'bg-red-500/10', text: 'text-red-500', label: 'Bearish' },
  neutral: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Neutral' },
};

const SOURCE_ICON: Record<string, string> = {
  reddit: 'R',
  telegram: 'T',
  threads: '@',
};

export default function AiReasoningQuotes({ posts, language }: Props) {
  const withReasoning = posts.filter(p => p.reasoning).slice(0, 3);
  if (withReasoning.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
        {t(language, 'crypto.aiSays')}
      </h3>
      <div className="space-y-2.5">
        {withReasoning.map((post, i) => {
          const style = SENTIMENT_STYLES[post.sentiment_label] || SENTIMENT_STYLES.neutral;
          return (
            <div
              key={i}
              className="border-l-2 border-[var(--accent)] pl-3 py-1.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-4 h-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[9px] font-bold text-[var(--text-tertiary)]">
                  {SOURCE_ICON[post.source] || '?'}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] truncate max-w-[120px]">
                  {post.channel}
                </span>
                <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {post.reasoning}
              </p>
              {(post.fomo_score > 0.6 || post.fud_score > 0.6) && (
                <div className="flex gap-2 mt-1">
                  {post.fomo_score > 0.6 && (
                    <span className="text-[9px] text-orange-400">FOMO {Math.round(post.fomo_score * 100)}%</span>
                  )}
                  {post.fud_score > 0.6 && (
                    <span className="text-[9px] text-red-400">FUD {Math.round(post.fud_score * 100)}%</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
