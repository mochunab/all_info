'use client';

import { useState, useCallback, useEffect } from 'react';
import { t } from '@/lib/i18n';
import type { BacktestResponse } from '@/types/crypto';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

const LOOKUP_OPTIONS = ['1h', '6h', '24h', '7d'] as const;

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

export default function BacktestReport({ language }: { language: Language }) {
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [lookupWindow, setLookupWindow] = useState<string>('24h');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(async (lw: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crypto/backtest?lookup_window=${lw}`);
      const json = await res.json();
      setData(json);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData(lookupWindow);
  }, [open, lookupWindow, fetchData]);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <span className={`transform transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {t(language, 'crypto.backtest')}
        {data?.totalEvaluated ? (
          <span className="text-xs text-[var(--text-tertiary)] ml-1">({data.totalEvaluated})</span>
        ) : null}
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '800px' : '0', opacity: open ? 1 : 0 }}
      >
        <div className="mt-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex gap-1 mb-4">
            {LOOKUP_OPTIONS.map((lw) => (
              <button
                key={lw}
                onClick={() => setLookupWindow(lw)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  lookupWindow === lw
                    ? 'bg-blue-500/20 text-blue-400 font-medium'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
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
              {/* 라벨별 적중률 */}
              <div className="space-y-3 mb-5">
                {data.summary.map((s) => (
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

              {/* 코인별 */}
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

              {/* 최근 결과 */}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
