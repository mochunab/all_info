import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BattleResponse, BattlePortfolio, BattleTrade, BattlePosition } from '@/types/crypto';

export async function GET(request: NextRequest) {
  const days = parseInt(new URL(request.url).searchParams.get('days') || '30', 10);
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const [portfolioRes, tradesRes, historyRes, monkeyPosRes, robotPosRes] = await Promise.all([
    supabase
      .from('battle_portfolio')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(2),
    supabase
      .from('battle_trades')
      .select('*')
      .order('traded_at', { ascending: false })
      .limit(20),
    supabase
      .from('battle_portfolio')
      .select('snapshot_date, player, portfolio_value')
      .gte('snapshot_date', cutoff)
      .order('snapshot_date', { ascending: true }),
    supabase
      .from('battle_positions')
      .select('*')
      .eq('player', 'monkey')
      .eq('status', 'open')
      .order('opened_at', { ascending: false }),
    supabase
      .from('battle_positions')
      .select('*')
      .eq('player', 'robot')
      .eq('status', 'open')
      .order('opened_at', { ascending: false }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestPortfolio = (portfolioRes.data || []) as any as BattlePortfolio[];
  const monkeyPortfolio = latestPortfolio.find(p => p.player === 'monkey');
  const robotPortfolio = latestPortfolio.find(p => p.player === 'robot');

  const monkeyCurrent = monkeyPortfolio?.portfolio_value ?? 100;
  const robotCurrent = robotPortfolio?.portfolio_value ?? 100;

  const dates: string[] = [];
  const monkeyValues: number[] = [];
  const robotValues: number[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyData = (historyRes.data || []) as any as Pick<BattlePortfolio, 'snapshot_date' | 'player' | 'portfolio_value'>[];
  const dateSet = new Set<string>();
  for (const h of historyData) dateSet.add(h.snapshot_date);
  const sortedDates = [...dateSet].sort();

  for (const d of sortedDates) {
    dates.push(d);
    const mv = historyData.find(h => h.snapshot_date === d && h.player === 'monkey');
    const rv = historyData.find(h => h.snapshot_date === d && h.player === 'robot');
    monkeyValues.push(mv?.portfolio_value ?? 100);
    robotValues.push(rv?.portfolio_value ?? 100);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTrades = (tradesRes.data || []) as any as BattleTrade[];
  const monkeyTrades = allTrades.filter(t => t.player === 'monkey').slice(0, 10);
  const robotTrades = allTrades.filter(t => t.player === 'robot').slice(0, 10);

  const monkeyWins = monkeyPortfolio?.win_count ?? 0;
  const robotWins = robotPortfolio?.win_count ?? 0;
  const monkeyTotal = monkeyPortfolio?.total_trades ?? 0;
  const robotTotal = robotPortfolio?.total_trades ?? 0;

  const response: BattleResponse = {
    portfolio: {
      monkey: {
        current: monkeyCurrent,
        change_pct: ((monkeyCurrent - 100) / 100) * 100,
        cash: monkeyPortfolio?.cash_balance ?? monkeyCurrent,
        openPositions: monkeyPortfolio?.open_positions ?? 0,
      },
      robot: {
        current: robotCurrent,
        change_pct: ((robotCurrent - 100) / 100) * 100,
        cash: robotPortfolio?.cash_balance ?? robotCurrent,
        openPositions: robotPortfolio?.open_positions ?? 0,
      },
    },
    history: { dates, monkey: monkeyValues, robot: robotValues },
    recentTrades: { monkey: monkeyTrades, robot: robotTrades },
    openPositions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      monkey: (monkeyPosRes.data || []) as any as BattlePosition[],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      robot: (robotPosRes.data || []) as any as BattlePosition[],
    },
    stats: {
      totalTrades: Math.max(monkeyTotal, robotTotal),
      monkeyWins,
      robotWins,
      monkeyWinRate: monkeyTotal > 0 ? (monkeyWins / monkeyTotal) * 100 : 0,
      robotWinRate: robotTotal > 0 ? (robotWins / robotTotal) * 100 : 0,
    },
  };

  return NextResponse.json(response);
}
