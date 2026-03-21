import type { SupabaseClient } from '@supabase/supabase-js';
import type { BattlePlayer, BattlePosition, BattleCloseReason } from '@/types/crypto';

// ── 상수 ──

const STARTING_BALANCE = 100;

const ROBOT = {
  MAX_POSITIONS: 5,
  MIN_CASH_PCT: 0.20,
  STOP_LOSS_PCT: 0.10,
  TP1_PCT: 0.20,
  TP1_CLOSE_RATIO: 1 / 3,
  TP2_PCT: 0.40,
  TP2_CLOSE_RATIO: 1 / 3,
  TRAILING_STOP_PCT: 0.15,
  MIN_WEIGHTED_SCORE: 30,
  MIN_MENTION_COUNT: 3,
  MIN_CONFIDENCE: 55,
  VELOCITY_BONUS_THRESHOLD: 0.5,
  SENTIMENT_BONUS_THRESHOLD: 0.2,
  FOMO_BONUS_THRESHOLD: 0.3,
  EVENT_BONUS_THRESHOLD: 10,
  SIGNAL_TIME_WINDOWS: ['24h', '6h', '1h'] as string[],
  SIGNAL_REVERSAL_LABELS: ['cold'] as string[],
  SENTIMENT_DROP_THRESHOLD: -0.5,
  VELOCITY_DEAD_THRESHOLD: 0.05,
  // 시그널 강도별 포지션 크기
  SIZE_BY_LABEL: { extremely_hot: 0.18, hot: 0.12, warm: 0.08 } as Record<string, number>,
  // 크로스 윈도우: 1h hot + 24h cold → 단기 펌프, 사이즈 축소
  CROSS_WINDOW_PENALTY: 0.5,
} as const;

const MONKEY = {
  MAX_POSITIONS: 5,
  ENTRY_CHANCE: 0.65,
  MIN_SIZE_PCT: 0.05,
  MAX_SIZE_PCT: 0.30,
  MIN_HOLD_HOURS: 0.25, // 15분
  MAX_HOLD_HOURS: 24,
  PANIC_SELL_THRESHOLD: -0.08,
  PANIC_SELL_CHANCE: 0.4,
  EUPHORIA_THRESHOLD: 0.15,
  EUPHORIA_SELL_CHANCE: 0.5,
  ALLOW_DOUBLE_DOWN: true,
  DOUBLE_DOWN_THRESHOLD: -0.05,
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
      ? evaluateMonkeyExit(pos, currentPrice)
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
    const currentPositions = player === 'monkey' ? await getOpenPositions(supabase, player) : [];
    const entry = player === 'monkey'
      ? evaluateMonkeyEntry(tradableSymbols, prices, currentPositions)
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
  openPositions: BattlePosition[],
): { coin: string; size: number; holdHours: number } | null {
  if (Math.random() > MONKEY.ENTRY_CHANCE) return null;

  const coin = pickRandom(symbols);
  if (!prices.has(coin)) return null;

  // 물타기 체크: 이미 보유 중인 코인이면 -5% 이하일 때만 허용
  const existingPos = openPositions.find(p => p.coin_symbol === coin);
  if (existingPos) {
    if (!MONKEY.ALLOW_DOUBLE_DOWN) return null;
    const currentPrice = prices.get(coin)!;
    const pnlPct = (currentPrice - existingPos.entry_price) / existingPos.entry_price;
    if (pnlPct > MONKEY.DOUBLE_DOWN_THRESHOLD) return null;
  }

  const sizePct = MONKEY.MIN_SIZE_PCT + Math.random() * (MONKEY.MAX_SIZE_PCT - MONKEY.MIN_SIZE_PCT);

  // 지수 분포: 단타(15분) 확률 높고, 장기(24시간) 확률 낮음
  const lambda = 3;
  const expRandom = -Math.log(1 - Math.random()) / lambda;
  const normalized = Math.min(expRandom / lambda, 1);
  const holdHours = MONKEY.MIN_HOLD_HOURS + normalized * (MONKEY.MAX_HOLD_HOURS - MONKEY.MIN_HOLD_HOURS);

  return { coin, size: sizePct * STARTING_BALANCE, holdHours };
}

function evaluateMonkeyExit(
  pos: BattlePosition,
  currentPrice?: number,
): { reason: BattleCloseReason; closeAll: boolean } | null {
  if (pos.hold_until && new Date(pos.hold_until) <= new Date()) {
    return { reason: 'hold_expired', closeAll: true };
  }

  if (currentPrice) {
    const pnlPct = (currentPrice - pos.entry_price) / pos.entry_price;

    // 패닉셀: -8% 이하에서 40% 확률로 공포에 질려 던짐
    if (pnlPct <= MONKEY.PANIC_SELL_THRESHOLD && Math.random() < MONKEY.PANIC_SELL_CHANCE) {
      return { reason: 'panic_sell', closeAll: true };
    }

    // 환호 익절: +15% 이상에서 50% 확률로 신나서 익절
    if (pnlPct >= MONKEY.EUPHORIA_THRESHOLD && Math.random() < MONKEY.EUPHORIA_SELL_CHANCE) {
      return { reason: 'euphoria_sell', closeAll: true };
    }
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

  type SignalRow = {
    coin_symbol: string; signal_label: string; weighted_score: number;
    mention_count: number; avg_sentiment: number; mention_velocity: number;
    signal_type: string | null; contrarian_warning: string | null;
    event_modifier: number | null; fomo_avg: number | null;
  };

  let signals: SignalRow[] = [];
  let usedWindow = '';
  for (const tw of ROBOT.SIGNAL_TIME_WINDOWS) {
    const { data } = await supabase
      .from('crypto_signals')
      .select('coin_symbol, signal_label, weighted_score, mention_count, avg_sentiment, mention_velocity, signal_type, contrarian_warning, event_modifier, fomo_avg')
      .eq('time_window', tw)
      .eq('signal_type', 'fomo') // FUD 시그널 제외 — FOMO만 진입
      .in('signal_label', ['extremely_hot', 'hot', 'warm'])
      .gte('weighted_score', ROBOT.MIN_WEIGHTED_SCORE)
      .gte('mention_count', ROBOT.MIN_MENTION_COUNT)
      .order('weighted_score', { ascending: false });

    if (data && data.length > 0) {
      signals = data as SignalRow[];
      usedWindow = tw;
      break;
    }
  }

  if (signals.length === 0) return null;

  // 크로스 윈도우 비교: 사용된 윈도우가 1h/6h면 24h 시그널도 조회
  let longTermSignals: Map<string, SignalRow> | null = null;
  if (usedWindow !== '24h') {
    const { data: ltData } = await supabase
      .from('crypto_signals')
      .select('coin_symbol, signal_label, weighted_score, mention_count, avg_sentiment, mention_velocity, signal_type, contrarian_warning, event_modifier, fomo_avg')
      .eq('time_window', '24h')
      .eq('signal_type', 'fomo')
      .in('coin_symbol', signals.map(s => s.coin_symbol));

    if (ltData && ltData.length > 0) {
      longTermSignals = new Map();
      for (const s of ltData as SignalRow[]) {
        longTermSignals.set(s.coin_symbol, s);
      }
    }
  }

  const openPositions = await getOpenPositions(supabase, 'robot');
  const openSymbols = new Set(openPositions.map(p => p.coin_symbol));

  for (const sig of signals) {
    if (!prices.has(sig.coin_symbol)) continue;
    if (!symbols.includes(sig.coin_symbol)) continue;
    if (openSymbols.has(sig.coin_symbol)) continue;

    // contrarian_warning → potential_reversal이면 진입 회피
    if (sig.contrarian_warning === 'potential_reversal') continue;

    const fomo = sig.fomo_avg ?? 0;
    let confidence = 50;
    if (sig.weighted_score >= 50) confidence += 15;
    if (sig.mention_velocity > ROBOT.VELOCITY_BONUS_THRESHOLD) confidence += 15;
    if (sig.avg_sentiment > ROBOT.SENTIMENT_BONUS_THRESHOLD) confidence += 10;
    if (fomo > ROBOT.FOMO_BONUS_THRESHOLD) confidence += 10;
    // 이벤트 보너스: exchange_listing(+15) 등 강한 이벤트
    if ((sig.event_modifier ?? 0) >= ROBOT.EVENT_BONUS_THRESHOLD) confidence += 10;

    if (confidence < ROBOT.MIN_CONFIDENCE) continue;

    // 시그널 강도별 포지션 크기
    const baseSizePct = ROBOT.SIZE_BY_LABEL[sig.signal_label] ?? 0.12;
    let sizePct = baseSizePct;

    // 크로스 윈도우 체크: 단기 hot인데 장기 cold/cool → 단기 펌프 의심, 사이즈 축소
    const ltSig = longTermSignals?.get(sig.coin_symbol);
    const isShortTermPump = ltSig && ['cold', 'cool'].includes(ltSig.signal_label);
    if (isShortTermPump) sizePct *= ROBOT.CROSS_WINDOW_PENALTY;

    const positionSize = portfolioValue * sizePct;
    if (cash - positionSize < minCash) continue;

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
        signal_type: sig.signal_type,
        contrarian_warning: sig.contrarian_warning,
        event_modifier: sig.event_modifier,
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

  // peak_price 갱신
  if (currentPrice > (pos.peak_price ?? pos.entry_price)) {
    await supabase
      .from('battle_positions')
      .update({ peak_price: currentPrice })
      .eq('id', pos.id);
    pos.peak_price = currentPrice;
  }

  // 손절 -10%
  if (pnlPct <= -ROBOT.STOP_LOSS_PCT) {
    return { reason: 'stop_loss', closeAll: true };
  }

  // TP1 이후 손절 라인 = 진입가 (본전 보장)
  if (pos.take_profit_stage >= 1 && currentPrice <= pos.entry_price) {
    return { reason: 'stop_loss', closeAll: true };
  }

  // TP1: +20% → 1/3 청산
  if (pos.take_profit_stage === 0 && pnlPct >= ROBOT.TP1_PCT) {
    return { reason: 'take_profit_1', closeAll: false };
  }

  // TP2: +40% → 1/3 청산
  if (pos.take_profit_stage === 1 && pnlPct >= ROBOT.TP2_PCT) {
    return { reason: 'take_profit_2', closeAll: false };
  }

  // 트레일링 스탑: TP2 이후 고점 대비 -15% 하락 시 잔량 전부 청산
  if (pos.take_profit_stage >= 2 && pos.peak_price) {
    const dropFromPeak = (currentPrice - pos.peak_price) / pos.peak_price;
    if (dropFromPeak <= -ROBOT.TRAILING_STOP_PCT) {
      return { reason: 'trailing_stop', closeAll: true };
    }
  }

  // 시그널 체크 (24h FOMO + FUD 모두 조회)
  const { data: currentSignals } = await supabase
    .from('crypto_signals')
    .select('signal_label, avg_sentiment, mention_velocity, signal_type, contrarian_warning')
    .eq('coin_symbol', pos.coin_symbol)
    .eq('time_window', '24h')
    .order('computed_at', { ascending: false })
    .limit(2);

  if (currentSignals && currentSignals.length > 0) {
    const fomoSignal = currentSignals.find(s => s.signal_type === 'fomo') ?? currentSignals[0];
    const fudSignal = currentSignals.find(s => s.signal_type === 'fud');

    // FOMO 시그널 반전
    if (ROBOT.SIGNAL_REVERSAL_LABELS.includes(fomoSignal.signal_label)) {
      return { reason: 'signal_reversal', closeAll: true };
    }

    // contrarian_warning: potential_reversal → 과열 경고, 보유 중이면 익절
    if (fomoSignal.contrarian_warning === 'potential_reversal' && pnlPct > 0) {
      return { reason: 'contrarian_exit', closeAll: true };
    }

    const entrySentiment = pos.signal_snapshot?.avg_sentiment ?? 0;
    const sentimentDrop = fomoSignal.avg_sentiment - entrySentiment;
    if (sentimentDrop <= ROBOT.SENTIMENT_DROP_THRESHOLD) {
      return { reason: 'sentiment_drop', closeAll: true };
    }

    if (fomoSignal.mention_velocity < ROBOT.VELOCITY_DEAD_THRESHOLD) {
      return { reason: 'velocity_dead', closeAll: true };
    }

    // FUD 급증: FUD 시그널이 hot 이상이면 위험 — 청산
    if (fudSignal && ['extremely_hot', 'hot'].includes(fudSignal.signal_label)) {
      return { reason: 'fud_surge', closeAll: true };
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
      peak_price: entryPrice,
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
  if (pos.status === 'closed' || pos.remaining_size <= 0.01) return;

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

  const newStopLoss = newStage >= 1 && !isClosed ? pos.entry_price : pos.stop_loss_price;

  // Atomic: status='open' 조건으로 업데이트 — 이미 closed면 0건 반환
  const { data: updated } = await supabase
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
    .eq('id', pos.id)
    .gt('remaining_size', 0.01)
    .select('id');

  // 업데이트 0건 = 이미 다른 호출이 청산함 → trade insert 스킵
  if (!updated || updated.length === 0) {
    console.log(`[배틀] SKIP close — ${pos.player} ${pos.coin_symbol} already closed (atomic)`);
    return;
  }

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
  const { data: trades } = await supabase
    .from('battle_trades')
    .select('action, trade_size, pnl')
    .eq('player', player);

  let cash = STARTING_BALANCE;
  for (const tr of trades || []) {
    if (tr.action === 'buy') {
      cash -= tr.trade_size;
    } else if (tr.action === 'sell') {
      cash += tr.trade_size + (tr.pnl ?? 0);
    }
  }
  return Math.max(0, cash);
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
      .eq('player', player)
      .eq('action', 'sell');

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
): { reason: BattleCloseReason; closeAll: boolean; updatePeak?: boolean } | null {
  const pnlPct = (currentPrice - pos.entry_price) / pos.entry_price;

  if (pnlPct <= -ROBOT.STOP_LOSS_PCT) return { reason: 'stop_loss', closeAll: true };
  if (pos.take_profit_stage >= 1 && currentPrice <= pos.entry_price) return { reason: 'stop_loss', closeAll: true };
  if (pos.take_profit_stage === 0 && pnlPct >= ROBOT.TP1_PCT) return { reason: 'take_profit_1', closeAll: false };
  if (pos.take_profit_stage === 1 && pnlPct >= ROBOT.TP2_PCT) return { reason: 'take_profit_2', closeAll: false };

  // 트레일링 스탑 (lazy 평가에서도 작동)
  if (pos.take_profit_stage >= 2 && pos.peak_price) {
    const dropFromPeak = (currentPrice - pos.peak_price) / pos.peak_price;
    if (dropFromPeak <= -ROBOT.TRAILING_STOP_PCT) return { reason: 'trailing_stop', closeAll: true };
  }

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

      // 로봇 peak_price 갱신 (lazy 평가에서도)
      if (player === 'robot' && currentPrice > (pos.peak_price ?? pos.entry_price)) {
        await supabase.from('battle_positions').update({ peak_price: currentPrice }).eq('id', pos.id);
        pos.peak_price = currentPrice;
      }

      const result = player === 'monkey'
        ? evaluateMonkeyExit(pos, currentPrice)
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
