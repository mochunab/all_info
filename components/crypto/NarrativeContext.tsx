'use client';

import type { TrendingExplainResponse } from '@/types/crypto';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type Props = {
  narratives: TrendingExplainResponse['narratives'];
  events: TrendingExplainResponse['events'];
  language: Language;
};

export default function NarrativeContext({ narratives, events, language }: Props) {
  if (narratives.length === 0 && events.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
        {t(language, 'crypto.biggerPicture')}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {narratives.map(n => (
          <span
            key={n.name}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {n.name}
          </span>
        ))}
        {events.map(e => (
          <span
            key={e.name}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/10 text-rose-500 text-[10px]"
          >
            <span className="w-1.5 h-1.5 rounded-sm bg-rose-500" />
            {e.name}
          </span>
        ))}
      </div>
    </div>
  );
}
