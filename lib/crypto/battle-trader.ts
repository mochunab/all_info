import type { SupabaseClient } from '@supabase/supabase-js';
import type { BattlePlayer, BattlePosition, BattleCloseReason } from '@/types/crypto';

// ── 상수 ──

const STARTING_BALANCE = 100;

const ROBOT = {
  MAX_POSITIONS: 3,
  POSITION_SIZE_PCT: 0.25,
  MIN_CASH_PCT: 0.30,
  STOP_LOSS_PCT: 0.08,
  TP1_PCT: 0.24,
  TP1_CLOSE_RATIO: 1 / 3,
  TP2_PCT: 0.50,
  TP2_CLOSE_RATIO: 1 / 3,
  MIN_WEIGHTED_SCORE: 50,
  MIN_MENTION_COUNT: 3,
  MIN_CONFIDENCE: 65,
  VELOCITY_BONUS_THRESHOLD: 1.0,
  SENTIMENT_BONUS_THRESHOLD: 0.3,
  FOMO_BONUS_THRESHOLD: 0.5,
  SIGNAL_REVERSAL_LABELS: ['sell', 'strong_sell'] as string[],
  SENTIMENT_DROP_THRESHOLD: -0.4,
  VELOCITY_DEAD_THRESHOLD: 0.2,
} as const;

const MONKEY = {
  MAX_POSITIONS: 5,
  ENTRY_CHANCE: 0.5,
  MIN_SIZE_PCT: 0.05,
  MAX_SIZE_PCT: 0.15,
  MIN_HOLD_HOURS: 1,
  MAX_HOLD_HOURS: 168, // 7 days
} as const;

// ── 메인 함수 ──

export async function executeBattle(supabase: SupabaseClient) {
  const coins = await getTradableCoins(supabase);
  if (coins.length === 0) {
    console.log('[배틀] 거래 가능 코인 없음');
    return { evaluated: false };
  }

  const prices = await getCurrentPrices(supabase, coins.map(c => c.symbol));
  if (prices.size === 0) {
    console.log('[배틀] 가격 데이터 없음');
    return { evaluated: false };
  }

  const tradableSymbols = coins.map(c => c.symbol).filter(s => prices.has(s));

  const monkeyResult = await runPlayer(supabase, 'monkey', tradableSymbols, prices);
  const robotResult = await runPlayer(supabase, 'robot', tradableSymbols, prices);

  await updateDailyPortfolioSnapshot(supabase, prices);

  console.log(`[배틀] monkey: closed=${monkeyResult.closed} opened=${monkeyResult.opened} | robot: closed=${robotResult.closed} opened=${robotResult.opened}`);
  return { evaluated: true, monkey: monkeyResult, robot: robotResult };
}

// ── 플레이어별 실행 ──

async function runPlayer(
  supabase: SupabaseClient,
  player: BattlePlayer,
  tradableSymbols: string[],
  prices: Map<string, number>,
) {
  let closed = 0;
  let opened = 0;

  // 1. 오픈 포지션 평가 + 청산
  const openPositions = await getOpenPositions(supabase, player);
  for (const pos of openPositions) {
    const currentPrice = prices.get(pos.coin_symbol);
    if (!currentPrice) continue;

    const closeResult = player === 'monkey'
      ? evaluateMonkeyExit(pos)
      : await evaluateRobotExit(supabase, pos, currentPrice);

    if (closeResult) {
      await closePosition(supabase, pos, currentPrice, closeResult.reason, closeResult.closeAll);
      if (closeResult.closeAll || pos.remaining_size <= 0) closed++;
    }
  }

  // 2. 신규 진입
  const currentOpen = await countOpenPositions(supabase, player);
  const maxPositions = player === 'monkey' ? MONKEY.MAX_POSITIONS : ROBOT.MAX_POSITIONS;

  if (currentOpen < maxPositions) {
    const entry = player === 'monkey'
      ? evaluateMonkeyEntry(tradableSymbols, prices)
      : await evaluateRobotEntry(supabase, tradableSymbols, prices);

    if (entry) {
      const cash = await getCashBalance(supabase, player);
      if (cash >= entry.size) {
        await openPosition(supabase, player, entry, prices.get(entry.coin)!);
        opened++;
      }
    }
  }

  return { closed, opened };
}

// ── 원숭이 전략 ──

function evaluateMonkeyEntry(
  symbols: string[],
  prices: Map<string, number>,
): { coin: string; size: number; holdHours: number } | null {
  if (Math.random() > MONKEY.ENTRY_CHANCE) return null;

  const coin = pickRandom(symbols);
  if (!prices.has(coin)) return null;

  const sizePct = MONKEY.MIN_SIZE_PCT + Math.random() * (MONKEY.MAX_SIZE_PCT - MONKEY.MIN_SIZE_PCT);
  const holdHours = MONKEY.MIN_HOLD_HOURS + Math.random() * (MONKEY.MAX_HOLD_HOURS - MONKEY.MIN_HOLD_HOURS);

  return { coin, size: sizePct * STARTING_BALANCE, holdHours };
}

function evaluateMonkeyExit(pos: BattlePosition): { reason: BattleCloseReason; closeAll: boolean } | null {
  if (pos.hold_until && new Date(pos.hold_until) <= new Date()) {
    return { reason: 'hold_expired', closeAll: true };
  }
  return null;
}

// ── 로봇 전략 ──

async function evaluateRobotEntry(
  supabase: SupabaseClient,
  symbols: string[],
  prices: Map<string, number>,
): Promise<{ coin: string; size: number; signal: Record<string, unknown> } | null> {
  const cash = await getCashBalance(supabase, 'robot');
  const portfolioValue = await getPortfolioValue(supabase, 'robot', prices);
  const minCash = portfolioValue * ROBOT.MIN_CASH_PCT;
  const positionSize = portfolioValue * ROBOT.POSITION_SIZE_PCT;

  if (cash - positionSize < minCash) return null;

  const { data: signals } = await supabase
    .from('crypto_signals')
    .select('coin_symbol, signal_label, weighted_score, mention_count, avg_sentiment, mention_velocity')
    .eq('time_window', '1h')
    .in('signal_label', ['strong_buy', 'buy', 'neutral'])
    .gte('weighted_score', ROBOT.MIN_WEIGHTED_SCORE)
    .gte('mention_count', ROBOT.MIN_MENTION_COUNT)
    .order('weighted_score', { ascending: false });

  if (!signals || signals.length === 0) return null;

  const openPositions = await getOpenPositions(supabase, 'robot');
  const openSymbols = new Set(openPositions.map(p => p.coin_symbol));

  for (const sig of signals) {
    if (!prices.has(sig.coin_symbol)) continue;
    if (!symbols.includes(sig.coin_symbol)) continue;
    if (openSymbols.has(sig.coin_symbol)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fomo = (sig as any).fomo_avg ?? 0;
    let confidence = 60;
    if (sig.mention_velocity > ROBOT.VELOCITY_BONUS_THRESHOLD) confidence += 20;
    if (sig.avg_sentiment > ROBOT.SENTIMENT_BONUS_THRESHOLD) confidence += 15;
    if (fomo > ROBOT.FOMO_BONUS_THRESHOLD) confidence += 10;

    if (confidence < ROBOT.MIN_CONFIDENCE) continue;

    return {
      coin: sig.coin_symbol,
      size: positionSize,
      signal: {
        signal_label: sig.signal_label,
        weighted_score: sig.weighted_score,
        avg_sentiment: sig.avg_sentiment,
        mention_velocity: sig.mention_velocity,
        fomo_avg: fomo,
        confidence,
      },
    };
  }

  return null;
}

async function evaluateRobotExit(
  supabase: SupabaseClient,
  pos: BattlePosition,
  currentPrice: number,
): Promise<{ reason: BattleCloseReason; closeAll: boolean } | null> {
  const pnlPct = (currentPrice - pos.entry_price) / pos.entry_price;

  // 손절 -8%
  if (pnlPct <= -ROBOT.STOP_LOSS_PCT) {
    return { reason: 'stop_loss', closeAll: true };
  }

  // TP1 이후 손절 라인 = 진입가 (본전 보장)
  if (pos.take_profit_stage >= 1 && currentPrice <= pos.entry_price) {
    return { reason: 'stop_loss', closeAll: true };
  }

  // TP1: +24% → 1/3 청산
  if (pos.take_profit_stage === 0 && pnlPct >= ROBOT.TP1_PCT) {
    return { reason: 'take_profit_1', closeAll: false };
  }

  // TP2: +50% → 1/3 청산
  if (pos.take_profit_stage === 1 && pnlPct >= ROBOT.TP2_PCT) {
    return { reason: 'take_profit_2', closeAll: false };
  }

  // 시그널 반전 체크
  const { data: currentSignal } = await supabase
    .from('crypto_signals')
    .select('signal_label, avg_sentiment, mention_velocity')
    .eq('coin_symbol', pos.coin_symbol)
    .eq('time_window', '1h')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  if (currentSignal) {
    if (ROBOT.SIGNAL_REVERSAL_LABELS.includes(currentSignal.signal_label)) {
      return { reason: 'signal_reversal', closeAll: true };
    }

    const entrySentiment = pos.signal_snapshot?.avg_sentiment ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sentimentDrop = currentSignal.avg_sentiment - (entrySentiment as any as number);
    if (sentimentDrop <= ROBOT.SENTIMENT_DROP_THRESHOLD) {
      return { reason: 'sentiment_drop', closeAll: true };
    }

    if (currentSignal.mention_velocity < ROBOT.VELOCITY_DEAD_THRESHOLD) {
      return { reason: 'velocity_dead', closeAll: true };
    }
  }

  return null;
}

// ── DB 헬퍼 ──

async function getOpenPositions(supabase: SupabaseClient, player: BattlePlayer): Promise<BattlePosition[]> {
  const { data } = await supabase
    .from('battle_positions')
    .select('*')
    .eq('player', player)
    .eq('status', 'open')
    .order('opened_at', { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []) as any as BattlePosition[];
}

async function countOpenPositions(supabase: SupabaseClient, player: BattlePlayer): Promise<number> {
  const { count } = await supabase
    .from('battle_positions')
    .select('id', { count: 'exact', head: true })
    .eq('player', player)
    .eq('status', 'open');
  return count ?? 0;
}

async function openPosition(
  supabase: SupabaseClient,
  player: BattlePlayer,
  entry: { coin: string; size: number; holdHours?: number; signal?: Record<string, unknown> },
  entryPrice: number,
) {
  const holdUntil = entry.holdHours
    ? new Date(Date.now() + entry.holdHours * 3600_000).toISOString()
    : null;

  const stopLoss = player === 'robot'
    ? entryPrice * (1 - ROBOT.STOP_LOSS_PCT)
    : null;

  const { data: position } = await supabase
    .from('battle_positions')
    .insert({
      player,
      coin_symbol: entry.coin,
      entry_price: entryPrice,
      initial_size: entry.size,
      remaining_size: entry.size,
      stop_loss_price: stopLoss,
      signal_snapshot: entry.signal ?? null,
      hold_until: holdUntil,
    })
    .select('id')
    .single();

  if (position) {
    await supabase.from('battle_trades').insert({
      trade_date: new Date().toISOString().slice(0, 10),
      player,
      coin_symbol: entry.coin,
      action: 'buy',
      entry_price: entryPrice,
      trade_size: entry.size,
      position_id: position.id,
      reason: 'entry',
      traded_at: new Date().toISOString(),
      signal_label: entry.signal?.signal_label ?? null,
      weighted_score: entry.signal?.weighted_score ?? null,
    });
  }

  console.log(`[배틀] ${player} BUY ${entry.coin} @ $${entryPrice.toFixed(4)} size=$${entry.size.toFixed(2)}${holdUntil ? ` hold_until=${holdUntil}` : ''}`);
}

async function closePosition(
  supabase: SupabaseClient,
  pos: BattlePosition,
  currentPrice: number,
  reason: BattleCloseReason,
  closeAll: boolean,
) {
  let closeSize: number;

  if (closeAll) {
    closeSize = pos.remaining_size;
  } else if (reason === 'take_profit_1') {
    closeSize = pos.initial_size * ROBOT.TP1_CLOSE_RATIO;
    closeSize = Math.min(closeSize, pos.remaining_size);
  } else if (reason === 'take_profit_2') {
    closeSize = pos.initial_size * ROBOT.TP2_CLOSE_RATIO;
    closeSize = Math.min(closeSize, pos.remaining_size);
  } else {
    closeSize = pos.remaining_size;
  }

  const pnl = closeSize * ((currentPrice - pos.entry_price) / pos.entry_price);
  const newRemaining = pos.remaining_size - closeSize;
  const newRealized = pos.realized_pnl + pnl;
  const isClosed = newRemaining <= 0.01;

  const newStage = reason === 'take_profit_1' ? 1
    : reason === 'take_profit_2' ? 2
    : pos.take_profit_stage;

  // TP1 이후 손절 라인을 진입가로 이동 (stop_loss_price 업데이트)
  const newStopLoss = newStage >= 1 && !isClosed ? pos.entry_price : pos.stop_loss_price;

  await supabase
    .from('battle_positions')
    .update({
      remaining_size: isClosed ? 0 : newRemaining,
      realized_pnl: newRealized,
      take_profit_stage: newStage,
      stop_loss_price: newStopLoss,
      status: isClosed ? 'closed' : 'open',
      close_reason: isClosed ? reason : pos.close_reason,
      closed_at: isClosed ? new Date().toISOString() : null,
    })
    .eq('id', pos.id);

  await supabase.from('battle_trades').insert({
    trade_date: new Date().toISOString().slice(0, 10),
    player: pos.player,
    coin_symbol: pos.coin_symbol,
    action: 'sell',
    entry_price: currentPrice,
    trade_size: closeSize,
    price_at_close: currentPrice,
    pnl,
    position_id: pos.id,
    reason,
    traded_at: new Date().toISOString(),
  });

  const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
  console.log(`[배틀] ${pos.player} SELL ${pos.coin_symbol} @ $${currentPrice.toFixed(4)} size=$${closeSize.toFixed(2)} pnl=${pnlStr} reason=${reason}${isClosed ? ' [CLOSED]' : ''}`);
}

// ── 포트폴리오 ──

async function getCashBalance(supabase: SupabaseClient, player: BattlePlayer): Promise<number> {
  const { data: latest } = await supabase
    .from('battle_portfolio')
    .select('cash_balance, portfolio_value')
    .eq('player', player)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (latest?.cash_balance != null) return latest.cash_balance;

  // 레거시 또는 첫 실행: portfolio_value에서 오픈 포지션 크기 차감
  const portfolioValue = latest?.portfolio_value ?? STARTING_BALANCE;
  const openPositions = await getOpenPositions(supabase, player);
  const investedAmount = openPositions.reduce((sum, p) => sum + p.remaining_size, 0);
  return Math.max(0, portfolioValue - investedAmount);
}

async function getPortfolioValue(
  supabase: SupabaseClient,
  player: BattlePlayer,
  prices: Map<string, number>,
): Promise<number> {
  const cash = await getCashBalance(supabase, player);
  const openPositions = await getOpenPositions(supabase, player);

  let unrealizedPnl = 0;
  let investedAmount = 0;
  for (const pos of openPositions) {
    const currentPrice = prices.get(pos.coin_symbol);
    if (!currentPrice) {
      investedAmount += pos.remaining_size;
      continue;
    }
    const posValue = pos.remaining_size * (currentPrice / pos.entry_price);
    investedAmount += pos.remaining_size;
    unrealizedPnl += posValue - pos.remaining_size;
  }

  return cash + investedAmount + unrealizedPnl;
}

async function updateDailyPortfolioSnapshot(supabase: SupabaseClient, prices: Map<string, number>) {
  const today = new Date().toISOString().slice(0, 10);

  for (const player of ['monkey', 'robot'] as const) {
    const portfolioValue = await getPortfolioValue(supabase, player, prices);
    const cash = await getCashBalance(supabase, player);
    const openCount = await countOpenPositions(supabase, player);

    const { count: totalTrades } = await supabase
      .from('battle_trades')
      .select('id', { count: 'exact', head: true })
      .eq('player', player);

    const { count: winCount } = await supabase
      .from('battle_trades')
      .select('id', { count: 'exact', head: true })
      .eq('player', player)
      .eq('action', 'sell')
      .gt('pnl', 0);

    await supabase
      .from('battle_portfolio')
      .upsert({
        snapshot_date: today,
        player,
        portfolio_value: portfolioValue,
        total_trades: totalTrades ?? 0,
        win_count: winCount ?? 0,
        cash_balance: cash,
        open_positions: openCount,
      }, { onConflict: 'snapshot_date,player' });
  }
}

// ── Lazy 평가 (API 호출 시 가격 기반 청산 즉시 실행) ──

function evaluateRobotPriceExit(
  pos: BattlePosition,
  currentPrice: number,
): { reason: BattleCloseReason; closeAll: boolean } | null {
  const pnlPct = (currentPrice - pos.entry_price) / pos.entry_price;

  if (pnlPct <= -ROBOT.STOP_LOSS_PCT) return { reason: 'stop_loss', closeAll: true };
  if (pos.take_profit_stage >= 1 && currentPrice <= pos.entry_price) return { reason: 'stop_loss', closeAll: true };
  if (pos.take_profit_stage === 0 && pnlPct >= ROBOT.TP1_PCT) return { reason: 'take_profit_1', closeAll: false };
  if (pos.take_profit_stage === 1 && pnlPct >= ROBOT.TP2_PCT) return { reason: 'take_profit_2', closeAll: false };

  return null;
}

export async function lazyEvaluateExits(supabase: SupabaseClient): Promise<number> {
  const coins = await getTradableCoins(supabase);
  const prices = await getCurrentPrices(supabase, coins.map(c => c.symbol));
  if (prices.size === 0) return 0;

  let closed = 0;
  for (const player of ['monkey', 'robot'] as const) {
    const positions = await getOpenPositions(supabase, player);
    for (const pos of positions) {
      const currentPrice = prices.get(pos.coin_symbol);
      if (!currentPrice) continue;

      const result = player === 'monkey'
        ? evaluateMonkeyExit(pos)
        : evaluateRobotPriceExit(pos, currentPrice);

      if (result) {
        await closePosition(supabase, pos, currentPrice, result.reason, result.closeAll);
        closed++;
      }
    }
  }
  return closed;
}

// ── 유틸 ──

async function getTradableCoins(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('crypto_coins')
    .select('symbol')
    .eq('is_active', true);
  return data || [];
}

async function getCurrentPrices(supabase: SupabaseClient, symbols: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data } = await supabase
    .from('crypto_prices')
    .select('coingecko_id, price_usd, crypto_coins!inner(symbol)')
    .order('fetched_at', { ascending: false });

  if (!data) return map;

  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const symbol = (row as any).crypto_coins?.symbol;
    if (symbol && symbols.includes(symbol) && !map.has(symbol)) {
      map.set(symbol, row.price_usd);
    }
  }
  return map;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
