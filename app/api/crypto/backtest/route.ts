import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get('coin');
  const lookupWindow = searchParams.get('lookup_window') || '24h';

  // 집계: 라벨별 적중률
  let query = supabase
    .from('crypto_backtest_results')
    .select('signal_label, lookup_window, price_change_pct, hit, evaluated_at, coin_symbol, weighted_score, signal_at')
    .eq('lookup_window', lookupWindow)
    .not('evaluated_at', 'is', null)
    .order('signal_at', { ascending: false });

  if (coin) {
    query = query.eq('coin_symbol', coin.toUpperCase());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await query.limit(1000) as { data: any[] | null; error: any };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    return NextResponse.json({
      summary: [],
      totalEvaluated: 0,
      lookupWindow,
      recentResults: [],
    });
  }

  // 라벨별 집계
  const labelStats = new Map<string, { total: number; wins: number; totalReturn: number }>();

  for (const row of data) {
    const stats = labelStats.get(row.signal_label) || { total: 0, wins: 0, totalReturn: 0 };
    stats.total++;
    if (row.hit) stats.wins++;
    stats.totalReturn += row.price_change_pct || 0;
    labelStats.set(row.signal_label, stats);
  }

  const summary = Array.from(labelStats.entries()).map(([label, stats]) => ({
    signal_label: label,
    total: stats.total,
    wins: stats.wins,
    win_rate: Math.round((stats.wins / stats.total) * 1000) / 10,
    avg_return: Math.round((stats.totalReturn / stats.total) * 100) / 100,
  }));

  // 코인별 집계
  const coinStats = new Map<string, { total: number; wins: number; totalReturn: number }>();
  for (const row of data) {
    const stats = coinStats.get(row.coin_symbol) || { total: 0, wins: 0, totalReturn: 0 };
    stats.total++;
    if (row.hit) stats.wins++;
    stats.totalReturn += row.price_change_pct || 0;
    coinStats.set(row.coin_symbol, stats);
  }

  const coinSummary = Array.from(coinStats.entries())
    .map(([symbol, stats]) => ({
      coin_symbol: symbol,
      total: stats.total,
      wins: stats.wins,
      win_rate: Math.round((stats.wins / stats.total) * 1000) / 10,
      avg_return: Math.round((stats.totalReturn / stats.total) * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  const recentResults = data.slice(0, 20).map((r) => ({
    coin_symbol: r.coin_symbol,
    signal_label: r.signal_label,
    weighted_score: r.weighted_score,
    price_change_pct: r.price_change_pct,
    hit: r.hit,
    signal_at: r.signal_at,
  }));

  return NextResponse.json({
    summary,
    coinSummary,
    totalEvaluated: data.length,
    lookupWindow,
    recentResults,
  });
}
