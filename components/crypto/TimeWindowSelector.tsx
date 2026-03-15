'use client';

import type { TimeWindow } from '@/types/crypto';
import { t } from '@/lib/i18n';

type TimeWindowSelectorProps = {
  selected: TimeWindow;
  onChange: (window: TimeWindow) => void;
  language?: 'ko' | 'en' | 'vi' | 'zh' | 'ja';
};

const WINDOW_KEYS: TimeWindow[] = ['1h', '6h', '24h', '7d'];

export default function TimeWindowSelector({ selected, onChange, language = 'ko' }: TimeWindowSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg">
      {WINDOW_KEYS.map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selected === w
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {t(language, `crypto.window.${w}`)}
        </button>
      ))}
    </div>
  );
}
