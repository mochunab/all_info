'use client';

import { useState, useEffect, useCallback } from 'react';
import { t } from '@/lib/i18n';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type TimelineEvent = {
  id: string;
  name: string;
  timestamp: string;
  mentions: number;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  coins: string[];
  source: string;
};

type Props = {
  coin?: string;
  language: Language;
  onCoinClick?: (symbol: string) => void;
};

const IMPACT_STYLES = {
  positive: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: '+' },
  negative: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-600', label: '-' },
  neutral: { dot: 'bg-neutral-400', bg: 'bg-neutral-400/10', text: 'text-neutral-500', label: '~' },
} as const;

export default function EventTimeline({ coin, language, onCoinClick }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: '30', limit: '20' });
      if (coin) params.set('coin', coin);
      const res = await fetch(`/api/crypto/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [coin]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return (
      <div className="text-center py-4 text-xs text-[var(--text-tertiary)]">
        {t(language, 'crypto.loading')}
      </div>
    );
  }

  if (events.length === 0) return null;

  const dateLocale = language === 'ko' ? 'ko-KR' : language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-CN' : language === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <div>
      <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
        {t(language, 'crypto.eventTimeline')}
      </h3>
      <div className="relative pl-4 space-y-3">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-[var(--border)]" />

        {events.map((evt) => {
          const style = IMPACT_STYLES[evt.impact] || IMPACT_STYLES.neutral;
          return (
            <div key={evt.id} className="relative flex gap-3">
              <div className={`relative z-10 mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${style.dot} ring-2 ring-[var(--bg-primary)]`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                    {evt.name}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} font-medium shrink-0`}>
                    {style.label} {evt.impact}
                  </span>
                  {evt.source === 'llm' && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 shrink-0">AI</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {new Date(evt.timestamp).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}
                  </span>
                  {evt.coins.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {evt.coins.slice(0, 5).map((c) => (
                        <button
                          key={c}
                          onClick={() => onCoinClick?.(c)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          {c}
                        </button>
                      ))}
                      {evt.coins.length > 5 && (
                        <span className="text-[9px] text-[var(--text-tertiary)]">+{evt.coins.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
