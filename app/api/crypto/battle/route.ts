import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { BattleResponse, BattlePortfolio, BattleTrade, BattlePosition } from '@/types/crypto';

const STARTING_BALANCE = 100;

function calcCashFromTrades(trades: { action: string; trade_size: number; pnl: number | null }[]): number {
  let cash = STARTING_BALANCE;
  for (const tr of trades) {
    if (tr.action === 'buy') {
      cash -= tr.trade_size;
    } else if (tr.action === 'sell') {
      cash += tr.trade_size + (tr.pnl ?? 0);
    }
  }
  return Math.max(0, cash);
}

export async function GET(request: NextRequest) {
  const days = parseInt(new URL(request.url).searchParams.get('days') || '30', 10);
  const supabase = await createServiceClient();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // 청산은 crawl 파이프라인(executeBattle)에서만 실행 — GET에 side-effect 금지 (race condition 방지)

  // 1. 현재 가격 조회
  const { data: priceRows } = await supabase
    .from('crypto_prices')
    .select('price_usd, crypto_coins!inner(symbol)')
    .order('fetched_at', { ascending: false });

  const priceMap = new Map<string, number>();
  for (const row of priceRows || []) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const symbol = (row as any).crypto_coins?.symbol;
    if (symbol && !priceMap.has(symbol)) priceMap.set(symbol, (row as any).price_usd);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  // 3. 포지션/포트폴리오/거래 데이터 조회 (lazy 평가 후이므로 최신 상태)
  const [portfolioRes, monkeyRecentTrades, robotRecentTrades, historyRes, monkeyPosRes, robotPosRes, monkeyTradesAll, robotTradesAll] = await Promise.all([
    supabase
      .from('battle_portfolio')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(2),
    supabase
      .from('battle_trades')
      .select('*')
      .eq('player', 'monkey')
      .order('traded_at', { ascending: false })
      .limit(10),
    supabase
      .from('battle_trades')
      .select('*')
      .eq('player', 'robot')
      .order('traded_at', { ascending: false })
      .limit(10),
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
    supabase
      .from('battle_trades')
      .select('action, trade_size, pnl')
      .eq('player', 'monkey'),
    supabase
      .from('battle_trades')
      .select('action, trade_size, pnl')
      .eq('player', 'robot'),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestPortfolio = (portfolioRes.data || []) as any as BattlePortfolio[];
  const monkeyPortfolio = latestPortfolio.find(p => p.player === 'monkey');
  const robotPortfolio = latestPortfolio.find(p => p.player === 'robot');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monkeyPositions = (monkeyPosRes.data || []) as any as BattlePosition[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const robotPositions = (robotPosRes.data || []) as any as BattlePosition[];

  // 4. 거래 내역 기반 현금 + 실시간 포트폴리오 가치
  const monkeyCash = calcCashFromTrades((monkeyTradesAll.data || []) as { action: string; trade_size: number; pnl: number | null }[]);
  const robotCash = calcCashFromTrades((robotTradesAll.data || []) as { action: string; trade_size: number; pnl: number | null }[]);

  function calcRealTimeValue(positions: BattlePosition[], cash: number): number {
    let value = cash;
    for (const pos of positions) {
      const price = priceMap.get(pos.coin_symbol);
      if (price) {
        value += pos.remaining_size * (price / pos.entry_price);
      } else {
        value += pos.remaining_size;
      }
    }
    return value;
  }

  const monkeyCurrent = calcRealTimeValue(monkeyPositions, monkeyCash);
  const robotCurrent = calcRealTimeValue(robotPositions, robotCash);

  // 5. 히스토리
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const historyData = (historyRes.data || []) as any as Pick<BattlePortfolio, 'snapshot_date' | 'player' | 'portfolio_value'>[];
  const dateSet = new Set<string>();
  for (const h of historyData) dateSet.add(h.snapshot_date);
  const sortedDates = [...dateSet].sort();

  const dates: string[] = [];
  const monkeyValues: number[] = [];
  const robotValues: number[] = [];
  for (const d of sortedDates) {
    dates.push(d);
    monkeyValues.push(historyData.find(h => h.snapshot_date === d && h.player === 'monkey')?.portfolio_value ?? 100);
    robotValues.push(historyData.find(h => h.snapshot_date === d && h.player === 'robot')?.portfolio_value ?? 100);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monkeyRecent = (monkeyRecentTrades.data || []) as any as BattleTrade[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const robotRecent = (robotRecentTrades.data || []) as any as BattleTrade[];

  // 거래 기반 승률 계산 (스냅샷 의존 제거)
  const monkeyAllSells = (monkeyTradesAll.data || []).filter((t: { action: string }) => t.action === 'sell');
  const robotAllSells = (robotTradesAll.data || []).filter((t: { action: string }) => t.action === 'sell');
  const monkeyTotal = monkeyAllSells.length;
  const robotTotal = robotAllSells.length;
  const monkeyWins = monkeyAllSells.filter((t: { pnl: number | null }) => (t.pnl ?? 0) > 0).length;
  const robotWins = robotAllSells.filter((t: { pnl: number | null }) => (t.pnl ?? 0) > 0).length;

  const prices: Record<string, number> = {};
  for (const [symbol, price] of priceMap) prices[symbol] = price;

  const response: BattleResponse = {
    portfolio: {
      monkey: {
        current: Math.round(monkeyCurrent * 100) / 100,
        change_pct: Math.round((monkeyCurrent - 100) * 100) / 100,
        cash: Math.round(monkeyCash * 100) / 100,
        openPositions: monkeyPositions.length,
      },
      robot: {
        current: Math.round(robotCurrent * 100) / 100,
        change_pct: Math.round((robotCurrent - 100) * 100) / 100,
        cash: Math.round(robotCash * 100) / 100,
        openPositions: robotPositions.length,
      },
    },
    history: { dates, monkey: monkeyValues, robot: robotValues },
    recentTrades: {
      monkey: monkeyRecent,
      robot: robotRecent,
    },
    openPositions: { monkey: monkeyPositions, robot: robotPositions },
    stats: {
      totalTrades: Math.max(monkeyTotal, robotTotal),
      monkeyWins,
      robotWins,
      monkeyWinRate: monkeyTotal > 0 ? (monkeyWins / monkeyTotal) * 100 : 0,
      robotWinRate: robotTotal > 0 ? (robotWins / robotTotal) * 100 : 0,
    },
    prices,
  };

  return NextResponse.json(response);
}
