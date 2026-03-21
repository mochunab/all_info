export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const cacheKey = `${CACHE_KEYS.CRYPTO_PRICES}:${coin || 'all'}:${limit}`;
    const cached = getCache<{ prices: unknown[]; fetched_at: string | null }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: latestRow } = await (supabase as any)
      .from('crypto_prices')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crypto_prices')
      .select('*, crypto_coins!inner(symbol, name, image_url, market_cap_rank)')
      .order('market_cap', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (latestRow) {
      query = query.eq('fetched_at', latestRow.fetched_at);
    }

    if (coin) {
      query = query.eq('crypto_coins.symbol', coin.toUpperCase());
    }

    const { data: prices, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = {
      prices: prices || [],
      fetched_at: latestRow?.fetched_at || null,
    };
    setCache(cacheKey, result, CACHE_TTL.CRYPTO_PRICES);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
