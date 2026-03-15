'use client';

import type { TimeWindow } from '@/types/crypto';

type TimeWindowSelectorProps = {
  selected: TimeWindow;
  onChange: (window: TimeWindow) => void;
};

const WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '6h', label: '6시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
];

export default function TimeWindowSelector({ selected, onChange }: TimeWindowSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => onChange(w.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selected === w.value
              ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
