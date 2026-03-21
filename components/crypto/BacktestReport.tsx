'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';
import type { BacktestResponse } from '@/types/crypto';
import BacktestTrendCharts from '@/components/crypto/BacktestTrendCharts';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

const LOOKUP_OPTIONS = ['1h', '6h', '24h', '7d'] as const;
const MD3_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

const LABEL_COLORS: Record<string, string> = {
  extremely_hot: 'text-red-400',
  hot: 'text-orange-400',
  warm: 'text-yellow-400',
  cool: 'text-blue-400',
  cold: 'text-blue-300',
};

const LABEL_DISPLAY: Record<string, string> = {
  extremely_hot: '🔥 Extremely Hot',
  hot: '🟠 Hot',
  warm: '🟡 Warm',
  cool: '🔵 Cool',
  cold: '❄️ Cold',
};

const LABEL_ORDER: Record<string, number> = {
  extremely_hot: 0,
  hot: 1,
  warm: 2,
  cool: 3,
  cold: 4,
};

function WinRateBar({ rate }: { rate: number }) {
  const color = rate >= 60 ? 'bg-emerald-500' : rate >= 45 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
      <span className="text-xs font-mono w-12 text-right">{rate}%</span>
    </div>
  );
}

export default function BacktestReport({ language, signalType = 'fomo' }: { language: Language; signalType?: string }) {
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [lookupWindow, setLookupWindow] = useState<string>('24h');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      const observer = new ResizeObserver(([entry]) => {
        setContentHeight(entry.contentRect.height);
      });
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
    setContentHeight(0);
  }, [isOpen]);

  const fetchData = useCallback(async (lw: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crypto/backtest?lookup_window=${lw}&signal_type=${signalType}`);
      const json = await res.json();
      setData(json);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [signalType]);

  useEffect(() => {
    if (isOpen) fetchData(lookupWindow);
  }, [isOpen, lookupWindow, signalType, fetchData]);

  return (
    <div className="mb-3">
      <div className="border border-[var(--border)] rounded-xl bg-[var(--bg-primary)] overflow-hidden">
        {/* Accordion Header */}
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-300"
              style={{
                transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transitionTimingFunction: MD3_EASING,
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {t(language, 'crypto.backtest')}
            </h2>
            {data?.totalEvaluated ? (
              <span className="text-[11px] text-[var(--text-tertiary)]">({data.totalEvaluated})</span>
            ) : null}
          </div>
          {!isOpen && (
            <span className="text-[11px] text-[var(--text-tertiary)]">
              {t(language, 'crypto.backtest.desc')}
            </span>
          )}
        </button>

        {/* Accordion Content */}
        <div
          className="overflow-hidden transition-all duration-300"
          style={{
            maxHeight: isOpen ? `${contentHeight + 16}px` : '0px',
            opacity: isOpen ? 1 : 0,
            transitionTimingFunction: MD3_EASING,
          }}
        >
          <div ref={contentRef} className="px-4 pb-4 pt-2 max-h-[60vh] overflow-y-auto">
            {/* Lookup Window Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {LOOKUP_OPTIONS.map((lw) => (
                <button
                  key={lw}
                  onClick={() => setLookupWindow(lw)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    lookupWindow === lw
                      ? 'bg-[var(--accent)] text-white shadow-sm shadow-blue-500/15'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  {lw} {t(language, 'crypto.backtest.after')}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-6 text-[var(--text-tertiary)] text-sm">Loading...</div>
            ) : !data?.summary?.length ? (
              <div className="text-center py-6 text-[var(--text-tertiary)] text-sm">
                {t(language, 'crypto.backtest.noData')}
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
                    <span className="w-20">{t(language, 'crypto.backtest.label')}</span>
                    <span className="flex-1 text-center">{t(language, 'crypto.backtest.winRate')}</span>
                    <span className="w-12 text-right" />
                    <span className="w-16 text-right">{t(language, 'crypto.backtest.avgReturn')}</span>
                    <span className="w-8 text-right">{t(language, 'crypto.backtest.total')}</span>
                  </div>
                  {[...data.summary].sort((a, b) => (LABEL_ORDER[a.signal_label] ?? 99) - (LABEL_ORDER[b.signal_label] ?? 99)).map((s) => (
                    <div key={s.signal_label} className="flex items-center gap-3">
                      <span className={`text-xs font-mono w-20 ${LABEL_COLORS[s.signal_label] || 'text-[var(--text-secondary)]'}`}>
                        {LABEL_DISPLAY[s.signal_label] || s.signal_label}
                      </span>
                      <WinRateBar rate={s.win_rate} />
                      <span className={`text-xs font-mono w-16 text-right ${s.avg_return >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.avg_return >= 0 ? '+' : ''}{s.avg_return}%
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)] w-8 text-right">{s.total}</span>
                    </div>
                  ))}
                </div>

                {data.coinSummary && data.coinSummary.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-3 mb-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {data.coinSummary.slice(0, 9).map((c) => (
                        <div key={c.coin_symbol} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-tertiary)]">
                          <span className="font-medium text-[var(--text-primary)]">{c.coin_symbol}</span>
                          <span className={c.win_rate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                            {c.win_rate}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.recentResults?.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-3">
                    <p className="text-xs text-[var(--text-tertiary)] mb-2">{t(language, 'crypto.backtest.recent')}</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {data.recentResults.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full ${r.hit ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="font-mono text-[var(--text-primary)] w-12">{r.coin_symbol}</span>
                          <span className={`w-16 ${LABEL_COLORS[r.signal_label] || ''}`}>
                            {LABEL_DISPLAY[r.signal_label] || r.signal_label}
                          </span>
                          <span className={`font-mono ${r.price_change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {r.price_change_pct >= 0 ? '+' : ''}{r.price_change_pct.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <BacktestTrendCharts
                  language={language}
                  lookupWindow={lookupWindow}
                  signalType={signalType}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
