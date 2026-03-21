export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const LABELS = ['extremely_hot', 'hot', 'warm', 'cool', 'cold'] as const;

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get('coin');
  const lookupWindow = searchParams.get('lookup_window') || '24h';
  const signalType = searchParams.get('signal_type') || 'fomo';
  const mode = searchParams.get('mode');

  let query = supabase
    .from('crypto_backtest_results')
    .select('signal_label, lookup_window, price_change_pct, hit, evaluated_at, coin_symbol, weighted_score, signal_at')
    .eq('lookup_window', lookupWindow)
    .eq('signal_type', signalType)
    .not('evaluated_at', 'is', null)
    .order('signal_at', { ascending: false });

  if (coin) {
    query = query.eq('coin_symbol', coin.toUpperCase());
  }

  if (mode === 'trend') {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    query = query.gte('signal_at', sixtyDaysAgo.toISOString());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await query.limit(mode === 'trend' ? 5000 : 1000) as { data: any[] | null; error: any };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.length) {
    if (mode === 'trend') {
      return NextResponse.json({ trendData: [], distributionData: [], cumulativeData: [] });
    }
    return NextResponse.json({
      summary: [],
      totalEvaluated: 0,
      lookupWindow,
      recentResults: [],
    });
  }

  if (mode === 'trend') {
    return NextResponse.json(buildTrendResponse(data));
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTrendResponse(data: any[]) {
  type DayLabel = { total: number; hits: number };
  const dailyMap = new Map<string, Map<string, DayLabel>>();

  for (const row of data) {
    const date = row.signal_at.slice(0, 10);
    if (!dailyMap.has(date)) dailyMap.set(date, new Map());
    const dayLabels = dailyMap.get(date)!;
    const stats = dayLabels.get(row.signal_label) || { total: 0, hits: 0 };
    stats.total++;
    if (row.hit) stats.hits++;
    dayLabels.set(row.signal_label, stats);
  }

  const sortedDates = [...dailyMap.keys()].sort();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendData: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const distributionData: any[] = [];

  let cumTotal = 0;
  let cumHits = 0;
  const cumulativeData: { date: string; hit_rate: number; total: number }[] = [];

  for (const date of sortedDates) {
    const dayLabels = dailyMap.get(date)!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trendPoint: any = { date };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const distPoint: any = { date };

    for (const label of LABELS) {
      const stats = dayLabels.get(label);
      if (stats && stats.total >= 1) {
        trendPoint[label] = Math.round((stats.hits / stats.total) * 1000) / 10;
      }
      distPoint[label] = stats?.total || 0;
      if (stats) {
        cumTotal += stats.total;
        cumHits += stats.hits;
      }
    }

    trendData.push(trendPoint);
    distributionData.push(distPoint);
    cumulativeData.push({
      date,
      hit_rate: cumTotal > 0 ? Math.round((cumHits / cumTotal) * 1000) / 10 : 0,
      total: cumTotal,
    });
  }

  return { trendData, distributionData, cumulativeData };
}
