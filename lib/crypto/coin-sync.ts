/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { COIN_LIST } from '@/lib/crypto/config';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

type CoinGeckoListItem = {
  id: string;
  symbol: string;
  name: string;
};

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) {
    h['x-cg-demo-key'] = process.env.COINGECKO_API_KEY;
  }
  return h;
}

export async function syncCoinList(
  supabase: SupabaseClient<any>
): Promise<{ synced: number }> {
  const res = await fetch(`${COINGECKO_BASE}/coins/list`, {
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`CoinGecko /coins/list failed: ${res.status}`);
  const allCoins: CoinGeckoListItem[] = await res.json();

  const symbolMap = new Map<string, CoinGeckoListItem[]>();
  for (const c of allCoins) {
    const key = c.symbol.toUpperCase();
    if (!symbolMap.has(key)) symbolMap.set(key, []);
    symbolMap.get(key)!.push(c);
  }

  const rows = [];
  for (const coin of COIN_LIST) {
    const candidates = symbolMap.get(coin.symbol.toUpperCase());
    if (!candidates) continue;
    const exact = candidates.find(
      (c) => c.name.toLowerCase() === coin.name.toLowerCase()
    );
    const best = exact || candidates[0];
    rows.push({
      coingecko_id: best.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      is_active: true,
    });
  }

  const { error } = await supabase
    .from('crypto_coins')
    .upsert(rows, { onConflict: 'coingecko_id', ignoreDuplicates: false });

  if (error) throw new Error(`crypto_coins upsert failed: ${error.message}`);

  console.log(`[코인싱크] ${rows.length}개 동기화 완료`);
  return { synced: rows.length };
}
