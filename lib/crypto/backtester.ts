/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { TIME_WINDOWS } from '@/lib/crypto/config';

const LOOKUP_WINDOWS = ['1h', '6h', '24h', '7d'] as const;

const LOOKUP_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

const PRICE_TOLERANCE_MS = 12 * 60 * 60 * 1000; // 가격 매칭 허용 오차: 12시간 (데이터 밀도 낮을 때 대응, 30분 cron 안정화 후 축소)

type BacktestRow = {
  coin_symbol: string;
  time_window: string;
  signal_label: string;
  weighted_score: number;
  signal_at: string;
  price_at_signal: number;
  price_after: number | null;
  price_change_pct: number | null;
  lookup_window: string;
  hit: boolean | null;
  evaluated_at: string | null;
};

function isBullish(label: string) {
  return label === 'extremely_hot' || label === 'hot';
}

function isBearish(label: string) {
  return label === 'cold' || label === 'cool';
}

function evaluateHit(label: string, changePct: number): boolean {
  if (isBullish(label)) return changePct > 0;
  if (isBearish(label)) return changePct < 0;
  return Math.abs(changePct) < 2; // neutral: 2% 미만 변동이면 적중
}

async function getSymbolToCoingeckoMap(supabase: SupabaseClient<any>) {
  const { data } = await supabase
    .from('crypto_coins')
    .select('symbol, coingecko_id')
    .eq('is_active', true);
  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(row.symbol.toUpperCase(), row.coingecko_id);
  }
  return map;
}

async function findClosestPrice(
  supabase: SupabaseClient<any>,
  coingeckoId: string,
  targetTime: Date
): Promise<number | null> {
  const from = new Date(targetTime.getTime() - PRICE_TOLERANCE_MS).toISOString();
  const to = new Date(targetTime.getTime() + PRICE_TOLERANCE_MS).toISOString();

  const { data } = await supabase
    .from('crypto_prices')
    .select('price_usd, fetched_at')
    .eq('coingecko_id', coingeckoId)
    .gte('fetched_at', from)
    .lte('fetched_at', to)
    .order('fetched_at', { ascending: true })
    .limit(5);

  if (!data?.length) return null;

  let closest = data[0];
  let minDiff = Math.abs(new Date(data[0].fetched_at).getTime() - targetTime.getTime());
  for (const row of data) {
    const diff = Math.abs(new Date(row.fetched_at).getTime() - targetTime.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closest = row;
    }
  }
  return closest.price_usd;
}

export async function runBacktest(
  supabase: SupabaseClient<any>,
  maxSignals = 200
): Promise<{ recorded: number; evaluated: number }> {
  const symbolMap = await getSymbolToCoingeckoMap(supabase);
  if (symbolMap.size === 0) return { recorded: 0, evaluated: 0 };

  // 아직 backtest에 기록되지 않은 시그널 가져오기
  // 최근 7일 시그널만 대상
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: signals } = await supabase
    .from('crypto_signals')
    .select('coin_symbol, time_window, weighted_score, signal_label, computed_at')
    .gte('computed_at', since)
    .order('computed_at', { ascending: false })
    .limit(maxSignals);

  if (!signals?.length) return { recorded: 0, evaluated: 0 };

  // 이미 기록된 시그널 확인 (중복 방지)
  const { data: existing } = await supabase
    .from('crypto_backtest_results')
    .select('coin_symbol, time_window, signal_at, lookup_window')
    .gte('signal_at', since);

  const existingSet = new Set(
    (existing || []).map(
      (r: any) => `${r.coin_symbol}|${r.time_window}|${r.signal_at}|${r.lookup_window}`
    )
  );

  const rows: BacktestRow[] = [];
  let evaluated = 0;

  for (const signal of signals) {
    const coingeckoId = symbolMap.get(signal.coin_symbol.toUpperCase());
    if (!coingeckoId) continue;

    const signalTime = new Date(signal.computed_at);
    const priceAtSignal = await findClosestPrice(supabase, coingeckoId, signalTime);
    if (priceAtSignal === null) continue;

    for (const lw of LOOKUP_WINDOWS) {
      const key = `${signal.coin_symbol}|${signal.time_window}|${signal.computed_at}|${lw}`;
      if (existingSet.has(key)) continue;

      const targetTime = new Date(signalTime.getTime() + LOOKUP_MS[lw]);
      const now = new Date();

      let priceAfter: number | null = null;
      let changePct: number | null = null;
      let hit: boolean | null = null;
      let evaluatedAt: string | null = null;

      if (targetTime <= now) {
        priceAfter = await findClosestPrice(supabase, coingeckoId, targetTime);
        if (priceAfter !== null && priceAtSignal > 0) {
          changePct = ((priceAfter - priceAtSignal) / priceAtSignal) * 100;
          hit = evaluateHit(signal.signal_label, changePct);
          evaluatedAt = now.toISOString();
          evaluated++;
        }
      }

      rows.push({
        coin_symbol: signal.coin_symbol,
        time_window: signal.time_window,
        signal_label: signal.signal_label,
        weighted_score: signal.weighted_score,
        signal_at: signal.computed_at,
        price_at_signal: priceAtSignal,
        price_after: priceAfter,
        price_change_pct: changePct,
        lookup_window: lw,
        hit,
        evaluated_at: evaluatedAt,
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('crypto_backtest_results')
      .upsert(rows, { onConflict: 'coin_symbol,time_window,signal_at,lookup_window' });

    if (error) {
      console.error('[백테스트] upsert 실패:', error.message);
      return { recorded: 0, evaluated: 0 };
    }
  }

  console.log(`[백테스트] ${rows.length}개 기록, ${evaluated}개 평가 완료`);
  return { recorded: rows.length, evaluated };
}

export async function evaluatePending(
  supabase: SupabaseClient<any>
): Promise<{ evaluated: number }> {
  const symbolMap = await getSymbolToCoingeckoMap(supabase);
  const now = new Date();

  const { data: pending } = await supabase
    .from('crypto_backtest_results')
    .select('id, coin_symbol, signal_at, lookup_window, price_at_signal')
    .is('evaluated_at', null)
    .limit(200);

  if (!pending?.length) return { evaluated: 0 };

  let evaluated = 0;

  for (const row of pending) {
    const targetTime = new Date(new Date(row.signal_at).getTime() + LOOKUP_MS[row.lookup_window]);
    if (targetTime > now) continue;

    const coingeckoId = symbolMap.get(row.coin_symbol.toUpperCase());
    if (!coingeckoId) continue;

    const priceAfter = await findClosestPrice(supabase, coingeckoId, targetTime);
    if (priceAfter === null) continue;

    const changePct = ((priceAfter - row.price_at_signal) / row.price_at_signal) * 100;

    const { data: full } = await supabase
      .from('crypto_backtest_results')
      .select('signal_label')
      .eq('id', row.id)
      .single();

    if (!full) continue;

    const hit = evaluateHit(full.signal_label, changePct);

    await supabase
      .from('crypto_backtest_results')
      .update({ price_after: priceAfter, price_change_pct: changePct, hit, evaluated_at: now.toISOString() })
      .eq('id', row.id);

    evaluated++;
  }

  console.log(`[백테스트] ${evaluated}개 미평가 건 평가 완료`);
  return { evaluated };
}
