'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  phrases: TrendingExplainResponse['top_phrases'];
  language: Language;
};

export default function PhraseCloud({ phrases, language }: Props) {
  if (phrases.length === 0) return null;

  const maxCount = Math.max(...phrases.map(p => p.count), 1);

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
        {t(language, 'crypto.whatTheySay')}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {phrases.map(({ phrase, count }) => {
          const ratio = count / maxCount;
          const sizeClass = ratio > 0.6 ? 'px-2.5 py-1' : ratio > 0.3 ? 'px-2 py-0.5' : 'px-1.5 py-0.5';
          const textSize = ratio > 0.6 ? '12px' : ratio > 0.3 ? '11px' : '10px';
          const opacity = 0.5 + ratio * 0.5;
          return (
            <span
              key={phrase}
              className={`inline-block rounded-full bg-[var(--accent)]/10 text-[var(--accent)] ${sizeClass} transition-opacity hover:opacity-100`}
              style={{ fontSize: textSize, opacity }}
              title={`${count}x`}
            >
              {phrase}
            </span>
          );
        })}
      </div>
    </div>
  );
}
