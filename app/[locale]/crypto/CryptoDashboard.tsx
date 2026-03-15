'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CryptoSignal, TimeWindow } from '@/types/crypto';
import CoinCard from '@/components/crypto/CoinCard';
import SignalTimeline from '@/components/crypto/SignalTimeline';
import CoinDetail from '@/components/crypto/CoinDetail';
import TimeWindowSelector from '@/components/crypto/TimeWindowSelector';

type CryptoDashboardProps = {
  initialSignals: CryptoSignal[];
};

export default function CryptoDashboard({ initialSignals }: CryptoDashboardProps) {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">밈코인 예측기</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Reddit 커뮤니티 센티먼트 기반 시그널
          </p>
        </div>
        <TimeWindowSelector selected={timeWindow} onChange={handleWindowChange} />
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="코인 검색 (예: DOGE, PEPE)"
          className="w-full max-w-md px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="text-center py-12 text-[var(--text-tertiary)]">시그널 로딩 중...</div>
          ) : filteredSignals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--text-tertiary)]">
                {search ? `"${search}"에 대한 시그널이 없습니다` : '시그널 데이터가 없습니다'}
              </p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                크롤링이 실행되면 데이터가 표시됩니다
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSignals.map((signal) => (
                <CoinCard
                  key={`${signal.coin_symbol}-${signal.time_window}`}
                  signal={signal}
                  onClick={setSelectedCoin}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
            <SignalTimeline signals={signals} onSelect={setSelectedCoin} />
          </div>
        </aside>
      </div>

      {/* Coin Detail Modal */}
      {selectedCoin && (
        <CoinDetail
          symbol={selectedCoin}
          onClose={() => setSelectedCoin(null)}
        />
      )}
    </div>
  );
}
