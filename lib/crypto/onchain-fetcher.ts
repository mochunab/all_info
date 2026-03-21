import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any>;

type WhaleAddress = {
  address: string;
  owner: string;
  owner_type: string;
};

type WhaleTransaction = {
  blockchain: string;
  symbol: string;
  id: string;
  transaction_type: string;
  hash: string;
  from: WhaleAddress;
  to: WhaleAddress;
  timestamp: number;
  amount: number;
  amount_usd: number;
  transaction_count: number;
};

type WhaleAlertResponse = {
  result: 'success' | 'error';
  cursor: string;
  count: number;
  transactions: WhaleTransaction[];
};

export type OnchainSignal = {
  coin_symbol: string;
  direction: 'exchange_inflow' | 'exchange_outflow' | 'exchange_transfer' | 'unknown_transfer';
  amount_usd: number;
  from_owner: string;
  to_owner: string;
  blockchain: string;
  tx_hash: string;
  timestamp: number;
};

const SYMBOL_MAP: Record<string, string> = {
  btc: 'BTC', eth: 'ETH', sol: 'SOL', usdt: 'USDT', usdc: 'USDC',
  xrp: 'XRP', doge: 'DOGE', ada: 'ADA', bnb: 'BNB', trx: 'TRX',
  matic: 'MATIC', avax: 'AVAX', dot: 'DOT', link: 'LINK', shib: 'SHIB',
  ltc: 'LTC', uni: 'UNI', atom: 'ATOM', near: 'NEAR', apt: 'APT',
};

function classifyDirection(from: WhaleAddress, to: WhaleAddress): OnchainSignal['direction'] {
  const fromExchange = from.owner_type === 'exchange';
  const toExchange = to.owner_type === 'exchange';
  if (fromExchange && toExchange) return 'exchange_transfer';
  if (toExchange) return 'exchange_inflow';
  if (fromExchange) return 'exchange_outflow';
  return 'unknown_transfer';
}

export async function fetchWhaleTransactions(sinceMinutes = 35): Promise<OnchainSignal[]> {
  const apiKey = process.env.WHALE_ALERT_API_KEY;
  if (!apiKey) {
    console.log('   ⏭️  WHALE_ALERT_API_KEY 없음 — 온체인 스킵');
    return [];
  }

  const start = Math.floor((Date.now() - sinceMinutes * 60 * 1000) / 1000);
  const url = `https://api.whale-alert.io/v1/transactions?api_key=${apiKey}&start=${start}&min_value=500000&limit=100`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`   ⚠️  Whale Alert ${res.status}: ${res.statusText}`);
      return [];
    }

    const data: WhaleAlertResponse = await res.json();
    if (data.result !== 'success' || !data.transactions) return [];

    const signals: OnchainSignal[] = [];
    for (const tx of data.transactions) {
      const symbol = SYMBOL_MAP[tx.symbol.toLowerCase()];
      if (!symbol) continue;
      if (tx.transaction_type !== 'transfer') continue;

      signals.push({
        coin_symbol: symbol,
        direction: classifyDirection(tx.from, tx.to),
        amount_usd: tx.amount_usd,
        from_owner: tx.from.owner || 'unknown',
        to_owner: tx.to.owner || 'unknown',
        blockchain: tx.blockchain,
        tx_hash: tx.hash,
        timestamp: tx.timestamp,
      });
    }

    console.log(`   🐋 Whale Alert: ${signals.length}건 감지 (${data.count}건 중 매칭)`);
    return signals;
  } catch (err) {
    console.warn('   ⚠️  Whale Alert fetch 실패:', err instanceof Error ? err.message : err);
    return [];
  }
}

export function aggregateWhaleSignals(signals: OnchainSignal[]): Map<string, { score: number; events: string[] }> {
  const coinMap = new Map<string, { inflow: number; outflow: number; events: string[] }>();

  for (const s of signals) {
    if (!coinMap.has(s.coin_symbol)) {
      coinMap.set(s.coin_symbol, { inflow: 0, outflow: 0, events: [] });
    }
    const agg = coinMap.get(s.coin_symbol)!;

    const label = `${s.from_owner}→${s.to_owner} $${(s.amount_usd / 1e6).toFixed(1)}M`;

    if (s.direction === 'exchange_inflow') {
      agg.inflow += s.amount_usd;
      agg.events.push(`whale_sell: ${label}`);
    } else if (s.direction === 'exchange_outflow') {
      agg.outflow += s.amount_usd;
      agg.events.push(`whale_buy: ${label}`);
    }
  }

  const result = new Map<string, { score: number; events: string[] }>();
  for (const [symbol, agg] of coinMap) {
    // Net flow: outflow > inflow = bullish, inflow > outflow = bearish
    const netFlow = agg.outflow - agg.inflow;
    const magnitude = Math.abs(netFlow);

    let score = 0;
    if (magnitude > 50_000_000) score = netFlow > 0 ? 15 : -15;
    else if (magnitude > 10_000_000) score = netFlow > 0 ? 10 : -10;
    else if (magnitude > 1_000_000) score = netFlow > 0 ? 5 : -5;

    if (score !== 0 || agg.events.length > 0) {
      result.set(symbol, { score, events: agg.events });
    }
  }

  return result;
}

export async function storeWhaleEvents(supabase: SB, signals: OnchainSignal[]): Promise<number> {
  if (signals.length === 0) return 0;

  const rows = signals
    .filter(s => s.direction === 'exchange_inflow' || s.direction === 'exchange_outflow')
    .map(s => ({
      source: 'onchain' as const,
      source_id: `whale_${s.tx_hash}_${s.coin_symbol}`,
      title: `🐋 ${s.coin_symbol} ${s.direction === 'exchange_inflow' ? '→거래소(매도압력)' : '←거래소(축적)'} $${(s.amount_usd / 1e6).toFixed(1)}M`,
      body: `${s.from_owner} → ${s.to_owner} | ${s.blockchain} | ${s.amount_usd.toLocaleString()} USD`,
      author: 'whale_alert',
      channel: s.blockchain,
      score: Math.round(s.amount_usd / 100000),
      upvotes: 0,
      num_comments: 0,
      posted_at: new Date(s.timestamp * 1000).toISOString(),
    }));

  const { error, data } = await supabase
    .from('crypto_posts')
    .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.warn('   ⚠️  Whale 이벤트 저장 실패:', error.message);
    return 0;
  }

  return data?.length || 0;
}
