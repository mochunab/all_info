'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { BattleResponse, BattleTrade, BattlePosition } from '@/types/crypto';
import { t } from '@/lib/i18n';
import monkeyAnimData from '@/public/lottie/monkey.json';
import robotAnimData from '@/public/lottie/robot.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
const RechartsLine = dynamic(
  () => import('recharts').then(mod => {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } = mod;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Chart = ({ data }: { data: any[] }) => (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => [`$${Number(value).toFixed(2)}`, name === 'monkey' ? '🐵' : '🤖']}
          />
          <Line type="monotone" dataKey="monkey" stroke="#F59E0B" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="robot" stroke="#2563EB" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
    Chart.displayName = 'BattleChart';
    return Chart;
  }),
  { ssr: false }
);

type Language = 'ko' | 'en' | 'vi' | 'zh' | 'ja';
type Tab = 'score' | 'trend' | 'trades' | 'positions';

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export default function MonkeyVsRobot({ language }: { language: Language }) {
  const [data, setData] = useState<BattleResponse | null>(null);
  const [tab, setTab] = useState<Tab>('score');
  const [loading, setLoading] = useState(true);
  const [historyDays, setHistoryDays] = useState(30);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/crypto/battle?days=${historyDays}`);
      const json = await res.json();
      setData(json);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [historyDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="mb-6 rounded-xl p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
        {t(language, 'crypto.loading')}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mb-6 rounded-xl p-8 text-center text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
        {t(language, 'crypto.battle.noData')}
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'score', label: t(language, 'crypto.battle.tab.score') },
    { key: 'positions', label: t(language, 'crypto.battle.tab.positions') },
    { key: 'trend', label: t(language, 'crypto.battle.tab.trend') },
    { key: 'trades', label: t(language, 'crypto.battle.tab.trades') },
  ];

  const chartData = data.history.dates.map((d, i) => ({
    date: d,
    monkey: data.history.monkey[i],
    robot: data.history.robot[i],
  }));

  const monkeyLeads = data.portfolio.monkey.current >= data.portfolio.robot.current;

  return (
    <div
      className="relative mb-6 rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -left-20 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.07]" style={{ backgroundColor: '#F59E0B' }} />
        <div className="absolute -bottom-20 -right-20 w-[300px] h-[300px] rounded-full blur-3xl opacity-[0.07]" style={{ backgroundColor: '#2563EB' }} />
      </div>

      <div className="relative px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {t(language, 'crypto.battle.title')}
        </h3>
        <div className="flex gap-1 p-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          {tabs.map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className="px-4 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer"
              style={{
                backgroundColor: tab === tb.key ? 'var(--bg-primary)' : 'transparent',
                color: tab === tb.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: tab === tb.key ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative p-5">
        {tab === 'score' && <ScoreTab data={data} language={language} monkeyLeads={monkeyLeads} />}
        {tab === 'positions' && <PositionsTab data={data} language={language} />}
        {tab === 'trend' && (
          <div>
            <div className="flex gap-2 mb-4">
              {[30, 0].map(d => (
                <button
                  key={d}
                  onClick={() => setHistoryDays(d || 9999)}
                  className="px-3 py-1 text-xs rounded-full cursor-pointer"
                  style={{
                    backgroundColor: historyDays === (d || 9999) ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: historyDays === (d || 9999) ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {d === 0 ? t(language, 'crypto.battle.portfolio') : `${d}D`}
                </button>
              ))}
            </div>
            <RechartsLine data={chartData} />
          </div>
        )}
        {tab === 'trades' && <TradesTab data={data} language={language} />}
      </div>
    </div>
  );
}

function ScoreTab({ data, language, monkeyLeads }: { data: BattleResponse; language: Language; monkeyLeads: boolean }) {
  const { portfolio, stats } = data;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-0">
      <PlayerScore
        animData={monkeyAnimData}
        name={t(language, 'crypto.battle.monkey')}
        portfolio={portfolio.monkey}
        winRate={stats.monkeyWinRate}
        leads={monkeyLeads}
        color="#F59E0B"
        trophySide="right"
        language={language}
      />
      <div className="flex flex-col items-center justify-center px-4 sm:px-8 pt-6">
        <div className="text-3xl sm:text-4xl font-bold select-none" style={{ background: 'linear-gradient(180deg, #F59E0B, #2563EB)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          VS
        </div>
        <div className="mt-4 text-xs tabular-nums text-center" style={{ color: 'var(--text-tertiary)' }}>
          {stats.totalTrades} {t(language, 'crypto.battle.trades')}
        </div>
      </div>
      <PlayerScore
        animData={robotAnimData}
        name={t(language, 'crypto.battle.robot')}
        portfolio={portfolio.robot}
        winRate={stats.robotWinRate}
        leads={!monkeyLeads}
        color="#2563EB"
        trophySide="left"
        language={language}
        animScale={1.25}
      />
    </div>
  );
}

function PlayerScore({
  animData, name, portfolio, winRate, leads, color, trophySide, language, animScale = 1,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animData: any;
  name: string;
  portfolio: BattleResponse['portfolio']['monkey'];
  winRate: number;
  leads: boolean;
  color: string;
  trophySide: 'left' | 'right';
  language: Language;
  animScale?: number;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl p-3 mx-auto overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)', boxShadow: 'var(--shadow-sm)' }}>
          <Lottie animationData={animData} loop autoplay style={{ width: '100%', height: '100%', transform: `scale(${animScale})` }} />
        </div>
        {leads && (
          <div className={`absolute -top-2 ${trophySide === 'right' ? '-right-2' : '-left-2'} flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full text-white`} style={{ backgroundColor: color, boxShadow: 'var(--shadow-md)' }}>
            <TrophyIcon className="w-3 h-3" />
          </div>
        )}
      </div>
      <span className="mt-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{name}</span>
      <div className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        ${portfolio.current.toFixed(2)}
      </div>
      <PnlBadge value={portfolio.change_pct} />
      <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {t(language, 'crypto.battle.winRate')}: {winRate.toFixed(0)}%
      </div>
      <div className="mt-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        💰 ${portfolio.cash.toFixed(2)} · 📊 {portfolio.openPositions}{t(language, 'crypto.battle.openPos')}
      </div>
    </div>
  );
}

function PositionsTab({ data, language }: { data: BattleResponse; language: Language }) {
  const { openPositions } = data;
  const hasPositions = openPositions.monkey.length > 0 || openPositions.robot.length > 0;

  if (!hasPositions) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t(language, 'crypto.battle.noPositions')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
          🐵 {t(language, 'crypto.battle.monkey')} ({openPositions.monkey.length})
        </div>
        <div className="space-y-2">
          {openPositions.monkey.map(pos => <PositionRow key={pos.id} pos={pos} language={language} />)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
          🤖 {t(language, 'crypto.battle.robot')} ({openPositions.robot.length})
        </div>
        <div className="space-y-2">
          {openPositions.robot.map(pos => <PositionRow key={pos.id} pos={pos} language={language} />)}
        </div>
      </div>
    </div>
  );
}

function PositionRow({ pos, language }: { pos: BattlePosition; language: Language }) {
  const holdUntil = pos.hold_until ? new Date(pos.hold_until) : null;
  const timeLeft = holdUntil ? Math.max(0, (holdUntil.getTime() - Date.now()) / 3600_000) : null;
  const tpLabel = pos.take_profit_stage > 0 ? `TP${pos.take_profit_stage}` : null;

  return (
    <div className="p-2.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{pos.coin_symbol}</span>
        <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          ${pos.remaining_size.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ color: 'var(--text-tertiary)' }}>
          @ ${pos.entry_price < 1 ? pos.entry_price.toFixed(6) : pos.entry_price.toFixed(2)}
        </span>
        {pos.stop_loss_price && (
          <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
            SL ${pos.stop_loss_price < 1 ? pos.stop_loss_price.toFixed(6) : pos.stop_loss_price.toFixed(2)}
          </span>
        )}
        {tpLabel && (
          <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#DCFCE7', color: '#047857' }}>
            {tpLabel}
          </span>
        )}
        {timeLeft != null && (
          <span style={{ color: 'var(--text-tertiary)' }}>
            ⏱ {timeLeft < 1 ? `${Math.round(timeLeft * 60)}m` : `${timeLeft.toFixed(0)}h`} {t(language, 'crypto.battle.left')}
          </span>
        )}
      </div>
    </div>
  );
}

function TradesTab({ data, language }: { data: BattleResponse; language: Language }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{t(language, 'crypto.battle.monkey')}</div>
        <div className="space-y-2">
          {data.recentTrades.monkey.map(tr => <TradeRow key={tr.id} trade={tr} language={language} />)}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{t(language, 'crypto.battle.robot')}</div>
        <div className="space-y-2">
          {data.recentTrades.robot.map(tr => <TradeRow key={tr.id} trade={tr} language={language} />)}
        </div>
      </div>
    </div>
  );
}

function PnlBadge({ value }: { value: number }) {
  return (
    <span
      className="mt-1 text-xs font-medium px-3 py-1 rounded-full tabular-nums"
      style={{
        backgroundColor: value >= 0 ? '#DCFCE7' : '#FEE2E2',
        color: value >= 0 ? '#047857' : '#DC2626',
      }}
    >
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function TradeRow({ trade, language }: { trade: BattleTrade; language: Language }) {
  const isBuy = trade.action === 'buy';
  const settled = trade.pnl != null && trade.action === 'sell';
  const reasonLabel = trade.reason && trade.reason !== 'entry'
    ? ` · ${trade.reason.replace(/_/g, ' ')}`
    : '';

  return (
    <div className="flex items-center gap-2 text-xs p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: isBuy ? '#DCFCE7' : '#FEE2E2', color: isBuy ? '#047857' : '#DC2626' }}>
        {t(language, isBuy ? 'crypto.battle.buy' : 'crypto.battle.sell')}
      </span>
      <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{trade.coin_symbol}</span>
      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        {trade.traded_at ? new Date(trade.traded_at).toLocaleDateString() : trade.trade_date}
        {reasonLabel}
      </span>
      <span className="ml-auto font-bold tabular-nums" style={{ color: settled ? (trade.pnl! >= 0 ? '#047857' : '#DC2626') : 'var(--text-tertiary)' }}>
        {settled ? `${trade.pnl! >= 0 ? '+' : ''}$${trade.pnl!.toFixed(2)}` : `$${trade.trade_size.toFixed(2)}`}
      </span>
    </div>
  );
}
