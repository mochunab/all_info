/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const MARKETS_PER_PAGE = 250;
const RATE_LIMIT_MS = 2000;

type CoinGeckoMarketItem = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
};

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) {
    h['x-cg-demo-key'] = process.env.COINGECKO_API_KEY;
  }
  return h;
}

export async function fetchAndStorePrices(
  supabase: SupabaseClient<any>
): Promise<{ fetched: number; stored: number }> {
  const { data: coins, error: coinsErr } = await supabase
    .from('crypto_coins')
    .select('coingecko_id')
    .eq('is_active', true);

  if (coinsErr || !coins?.length) return { fetched: 0, stored: 0 };

  const coingeckoIds = coins.map((c: any) => c.coingecko_id);
  const fetchedAt = new Date().toISOString();
  let totalFetched = 0;

  const chunks: string[][] = [];
  for (let i = 0; i < coingeckoIds.length; i += MARKETS_PER_PAGE) {
    chunks.push(coingeckoIds.slice(i, i + MARKETS_PER_PAGE));
  }

  const allPriceRows: any[] = [];
  const coinUpdates: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const ids = chunks[i].join(',');
    const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${ids}&per_page=${MARKETS_PER_PAGE}&sparkline=false`;

    const res = await fetch(url, { headers: buildHeaders() });
    if (!res.ok) {
      console.warn(`[가격] CoinGecko markets fetch failed: ${res.status}`);
      continue;
    }

    const items: CoinGeckoMarketItem[] = await res.json();
    totalFetched += items.length;

    for (const item of items) {
      coinUpdates.push({
        coingecko_id: item.id,
        image_url: item.image,
        market_cap_rank: item.market_cap_rank,
      });

      if (item.current_price == null) continue;

      allPriceRows.push({
        coingecko_id: item.id,
        price_usd: item.current_price,
        market_cap: item.market_cap,
        volume_24h: item.total_volume,
        price_change_24h: item.price_change_24h,
        price_change_pct_24h: item.price_change_percentage_24h,
        circulating_supply: item.circulating_supply,
        fetched_at: fetchedAt,
      });
    }

    if (chunks.length > 1 && i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  if (coinUpdates.length > 0) {
    await supabase
      .from('crypto_coins')
      .upsert(coinUpdates, { onConflict: 'coingecko_id', ignoreDuplicates: false });
  }

  if (allPriceRows.length > 0) {
    const { error } = await supabase.from('crypto_prices').insert(allPriceRows);
    if (error) {
      console.error('[가격] crypto_prices insert failed:', error.message);
      return { fetched: totalFetched, stored: 0 };
    }
  }

  console.log(`[가격] ${allPriceRows.length}개 코인 가격 저장 완료`);
  return { fetched: totalFetched, stored: allPriceRows.length };
}
