const DEX_BASE = 'https://api.dexscreener.com';
const FETCH_TIMEOUT = 10_000;
const SEARCH_CONCURRENCY = 5;
const SEARCH_DELAY_MS = 250;

// CEX 중심 대형 코인 — DEX 거래량이 비대표적이라 오탐 유발
const DEX_EXCLUDE = new Set([
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT',
  'MATIC', 'LINK', 'ATOM', 'LTC', 'FIL', 'NEAR', 'APT',
  'ARB', 'OP', 'SUI', 'SEI', 'INJ', 'TIA',
]);

export type OnchainEvent = {
  type: 'volume_spike' | 'liquidity_drain' | 'sell_pressure' | 'token_boosted';
  modifier: number;
  detail: string;
};

export type DexPairSummary = {
  symbol: string;
  volumeH1: number;
  volumeH6: number;
  volumeH24: number;
  liquidityUsd: number;
  txnsBuys24: number;
  txnsSells24: number;
};

const ONCHAIN_MODIFIERS = {
  VOLUME_SPIKE: 7,
  LIQUIDITY_DRAIN: -12,
  SELL_PRESSURE: -5,
  TOKEN_BOOSTED: -3,
  VOLUME_SPIKE_THRESHOLD: 5,
  LIQUIDITY_DRAIN_THRESHOLD: 0.5,
  SELL_PRESSURE_RATIO: 3,
  MIN_LIQUIDITY_USD: 1_000,
} as const;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BoostItem = { tokenAddress: string; chainId: string; amount: number; url?: string };
type BoostResponse = BoostItem[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DexSearchResponse = { pairs?: any[] };

async function fetchBoostedAddresses(): Promise<Set<string>> {
  const data = await fetchJson<BoostResponse>(`${DEX_BASE}/token-boosts/latest/v1`);
  if (!data) return new Set();
  return new Set(data.map(item => item.tokenAddress.toLowerCase()));
}

async function searchSymbol(symbol: string): Promise<(DexPairSummary & { tokenAddress: string }) | null> {
  const data = await fetchJson<DexSearchResponse>(
    `${DEX_BASE}/latest/dex/search?q=${encodeURIComponent(symbol)}`
  );
  if (!data?.pairs?.length) return null;

  const sorted = data.pairs
    .filter((p: { baseToken?: { symbol?: string }; liquidity?: { usd?: number } }) =>
      p.baseToken?.symbol?.toUpperCase() === symbol.toUpperCase()
      && (p.liquidity?.usd ?? 0) > ONCHAIN_MODIFIERS.MIN_LIQUIDITY_USD
    )
    .sort((a: { liquidity?: { usd?: number } }, b: { liquidity?: { usd?: number } }) =>
      (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    );

  const pair = sorted[0];
  if (!pair) return null;

  return {
    symbol: symbol.toUpperCase(),
    tokenAddress: (pair.baseToken?.address ?? '').toLowerCase(),
    volumeH1: pair.volume?.h1 ?? 0,
    volumeH6: pair.volume?.h6 ?? 0,
    volumeH24: pair.volume?.h24 ?? 0,
    liquidityUsd: pair.liquidity?.usd ?? 0,
    txnsBuys24: pair.txns?.h24?.buys ?? 0,
    txnsSells24: pair.txns?.h24?.sells ?? 0,
  };
}

function computeEvents(
  pair: DexPairSummary & { tokenAddress: string },
  boostedAddresses: Set<string>
): OnchainEvent[] {
  const events: OnchainEvent[] = [];

  const avgH6PerHour = pair.volumeH6 / 6;
  if (avgH6PerHour > 0 && pair.volumeH1 > avgH6PerHour * ONCHAIN_MODIFIERS.VOLUME_SPIKE_THRESHOLD) {
    const ratio = Math.round(pair.volumeH1 / avgH6PerHour);
    events.push({
      type: 'volume_spike',
      modifier: ONCHAIN_MODIFIERS.VOLUME_SPIKE,
      detail: `h1 vol ${ratio}x vs h6 avg`,
    });
  }

  if (pair.volumeH24 > 0 && pair.liquidityUsd < pair.volumeH24 * ONCHAIN_MODIFIERS.LIQUIDITY_DRAIN_THRESHOLD) {
    events.push({
      type: 'liquidity_drain',
      modifier: ONCHAIN_MODIFIERS.LIQUIDITY_DRAIN,
      detail: `liq $${Math.round(pair.liquidityUsd)} < 50% of 24h vol`,
    });
  }

  if (pair.txnsBuys24 > 0 && pair.txnsSells24 / pair.txnsBuys24 > ONCHAIN_MODIFIERS.SELL_PRESSURE_RATIO) {
    const ratio = (pair.txnsSells24 / pair.txnsBuys24).toFixed(1);
    events.push({
      type: 'sell_pressure',
      modifier: ONCHAIN_MODIFIERS.SELL_PRESSURE,
      detail: `sell/buy ratio ${ratio}x`,
    });
  }

  if (boostedAddresses.has(pair.tokenAddress)) {
    events.push({
      type: 'token_boosted',
      modifier: ONCHAIN_MODIFIERS.TOKEN_BOOSTED,
      detail: 'DexScreener promoted token',
    });
  }

  return events;
}

export async function fetchOnchainSignals(
  symbols: string[]
): Promise<Map<string, OnchainEvent[]>> {
  const result = new Map<string, OnchainEvent[]>();
  if (symbols.length === 0) return result;

  const filtered = symbols.filter(s => !DEX_EXCLUDE.has(s));
  if (filtered.length === 0) return result;

  console.log(`[DexScreener] ${filtered.length}개 코인 온체인 시그널 조회 (${symbols.length - filtered.length}개 제외)`);

  const boostedAddresses = await fetchBoostedAddresses();

  const queue = [...filtered];
  let fetched = 0;
  let failed = 0;

  while (queue.length > 0) {
    const batch = queue.splice(0, SEARCH_CONCURRENCY);
    const pairs = await Promise.all(batch.map(s => searchSymbol(s)));

    for (let i = 0; i < batch.length; i++) {
      const symbol = batch[i];
      const pair = pairs[i];
      if (pair) {
        const events = computeEvents(pair, boostedAddresses);
        if (events.length > 0) {
          result.set(symbol, events);
        }
        fetched++;
      } else {
        failed++;
      }
    }

    if (queue.length > 0) await sleep(SEARCH_DELAY_MS);
  }

  const eventCount = [...result.values()].reduce((sum, e) => sum + e.length, 0);
  console.log(`[DexScreener] 완료: ${fetched}개 조회, ${failed}개 실패, ${eventCount}개 이벤트 감지`);

  return result;
}
