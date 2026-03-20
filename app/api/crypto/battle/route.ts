import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { lazyEvaluateExits } from '@/lib/crypto/battle-trader';
import type { BattleResponse, BattlePortfolio, BattleTrade, BattlePosition } from '@/types/crypto';

export async function GET(request: NextRequest) {
  const days = parseInt(new URL(request.url).searchParams.get('days') || '30', 10);
  const supabase = await createServiceClient();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // 1. 가격 기반 청산 즉시 실행 (손절/익절/보유 만료)
  await lazyEvaluateExits(supabase);

  // 2. 현재 가격 조회
  const { data: priceRows } = await supabase
    .from('crypto_prices')
    .select('price_usd, crypto_coins!inner(symbol)')
    .order('fetched_at', { ascending: false });

  const priceMap = new Map<string, number>();
  for (const row of priceRows || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const symbol = (row as any).crypto_coins?.symbol;
    if (symbol && !priceMap.has(symbol)) priceMap.set(symbol, row.price_usd);
  }

  // 3. 포지션/포트폴리오/거래 데이터 조회 (lazy 평가 후이므로 최신 상태)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monkeyPositions = (monkeyPosRes.data || []) as any as BattlePosition[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const robotPositions = (robotPosRes.data || []) as any as BattlePosition[];

  // 4. 실시간 포트폴리오 가치 = 현금 + Σ(포지션 × 현재가격/진입가격)
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

  const monkeyCash = monkeyPortfolio?.cash_balance
    ?? (monkeyPortfolio?.portfolio_value ?? 100) - monkeyPositions.reduce((s, p) => s + p.remaining_size, 0);
  const robotCash = robotPortfolio?.cash_balance
    ?? (robotPortfolio?.portfolio_value ?? 100) - robotPositions.reduce((s, p) => s + p.remaining_size, 0);

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
  const allTrades = (tradesRes.data || []) as any as BattleTrade[];

  const monkeyWins = monkeyPortfolio?.win_count ?? 0;
  const robotWins = robotPortfolio?.win_count ?? 0;
  const monkeyTotal = monkeyPortfolio?.total_trades ?? 0;
  const robotTotal = robotPortfolio?.total_trades ?? 0;

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
      monkey: allTrades.filter(t => t.player === 'monkey').slice(0, 10),
      robot: allTrades.filter(t => t.player === 'robot').slice(0, 10),
    },
    openPositions: { monkey: monkeyPositions, robot: robotPositions },
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
