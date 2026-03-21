'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { t } from '@/lib/i18n';
import type { BacktestTrendResponse } from '@/types/crypto';

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';
type Tab = 'trend' | 'distribution' | 'cumulative';

const LABEL_COLORS: Record<string, string> = {
  extremely_hot: '#f87171',
  hot: '#fb923c',
  warm: '#facc15',
  cool: '#60a5fa',
  cold: '#93c5fd',
};

const LABEL_NAMES: Record<string, string> = {
  extremely_hot: 'Extremely Hot',
  hot: 'Hot',
  warm: 'Warm',
  cool: 'Cool',
  cold: 'Cold',
};

const LABELS = ['extremely_hot', 'hot', 'warm', 'cool', 'cold'] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDate(label: any) {
  const s = String(label);
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pctFormatter(value: any) {
  return [`${value}%`];
}

export default function BacktestTrendCharts({
  language,
  lookupWindow,
  signalType,
}: {
  language: Language;
  lookupWindow: string;
  signalType: string;
}) {
  const [data, setData] = useState<BacktestTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('trend');

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/crypto/backtest?mode=trend&lookup_window=${lookupWindow}&signal_type=${signalType}`
      );
      const json = await res.json();
      setData(json);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [lookupWindow, signalType]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  if (loading) {
    return <div className="text-center py-4 text-[var(--text-tertiary)] text-xs">Loading...</div>;
  }

  const hasEnoughData = data && data.trendData.length >= 3;

  if (!hasEnoughData) {
    return (
      <div className="text-center py-4 text-[var(--text-tertiary)] text-xs">
        {t(language, 'crypto.backtest.needMoreData')}
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'trend', label: t(language, 'crypto.backtest.trend') },
    { key: 'distribution', label: t(language, 'crypto.backtest.distribution') },
    { key: 'cumulative', label: t(language, 'crypto.backtest.cumulative') },
  ];

  return (
    <div className="border-t border-[var(--border)] pt-3">
      <div className="flex gap-1 mb-3">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              tab === tb.key
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div className="h-[200px]">
        {tab === 'trend' && <TrendLineChart data={data.trendData} />}
        {tab === 'distribution' && <DistributionBarChart data={data.distributionData} />}
        {tab === 'cumulative' && <CumulativeAreaChart data={data.cumulativeData} />}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrendLineChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} unit="%" />
        <Tooltip
          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
          labelFormatter={formatDate}
          formatter={pctFormatter}
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        {LABELS.map((label) => (
          <Line
            key={label}
            type="monotone"
            dataKey={label}
            name={LABEL_NAMES[label]}
            stroke={LABEL_COLORS[label]}
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DistributionBarChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
          labelFormatter={formatDate}
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        {LABELS.map((label) => (
          <Bar
            key={label}
            dataKey={label}
            name={LABEL_NAMES[label]}
            fill={LABEL_COLORS[label]}
            stackId="stack"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function CumulativeAreaChart({ data }: { data: { date: string; hit_rate: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} unit="%" domain={[0, 100]} />
        <Tooltip
          contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
          labelFormatter={formatDate}
          formatter={pctFormatter}
        />
        <Area
          type="monotone"
          dataKey="hit_rate"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.15}
          strokeWidth={2}
          name="Hit Rate"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
