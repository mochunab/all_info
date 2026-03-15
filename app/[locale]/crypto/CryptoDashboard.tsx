'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CryptoSignal, TimeWindow } from '@/types/crypto';
import { t } from '@/lib/i18n';
import CoinCard from '@/components/crypto/CoinCard';
import SignalTimeline from '@/components/crypto/SignalTimeline';
import SignalNetwork from '@/components/crypto/SignalNetwork';
import CoinDetail from '@/components/crypto/CoinDetail';
import TimeWindowSelector from '@/components/crypto/TimeWindowSelector';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';

type CryptoDashboardProps = {
  initialSignals: CryptoSignal[];
  language: Language;
};

export default function CryptoDashboard({ initialSignals, language }: CryptoDashboardProps) {
  const [signals, setSignals] = useState<CryptoSignal[]>(initialSignals);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
  const [search, setSearch] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSignals = useCallback(async (window: TimeWindow) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crypto/signals?window=${window}&limit=100`);
      const data = await res.json();
      setSignals(data.signals || []);
    } catch (error) {
      console.error('Failed to fetch signals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timeWindow !== '24h') {
      fetchSignals(timeWindow);
    }
  }, [timeWindow, fetchSignals]);

  const handleWindowChange = useCallback((window: TimeWindow) => {
    setTimeWindow(window);
  }, []);

  const filteredSignals = search
    ? signals.filter((s) => s.coin_symbol.toLowerCase().includes(search.toLowerCase()))
    : signals;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t(language, 'crypto.title')}</h1>
          <p className="text-sm text-[var(--text-tertiary)]">{t(language, 'crypto.subtitle')}</p>
        </div>
        <TimeWindowSelector selected={timeWindow} onChange={handleWindowChange} />
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(language, 'crypto.search')}
          className="w-full max-w-md px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      <SignalNetwork signals={signals} onCoinSelect={setSelectedCoin} language={language} />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12 text-[var(--text-tertiary)]">{t(language, 'crypto.loading')}</div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--text-tertiary)]">
                {search ? `"${search}" — ${t(language, 'crypto.noSignals')}` : t(language, 'crypto.noSignals')}
              </p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">{t(language, 'crypto.noSignalsHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSignals.map((signal) => (
                <CoinCard
                  key={`${signal.coin_symbol}-${signal.time_window}`}
                  signal={signal}
                  onClick={setSelectedCoin}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
            <SignalTimeline signals={signals} onSelect={setSelectedCoin} language={language} />
          </div>
        </aside>
      </div>

      {selectedCoin && (
        <CoinDetail symbol={selectedCoin} onClose={() => setSelectedCoin(null)} language={language} />
      )}
    </div>
  );
}
