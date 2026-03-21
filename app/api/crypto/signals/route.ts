export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const window = searchParams.get('window') || '24h';
    const coin = searchParams.get('coin');
    const signalType = searchParams.get('signal_type') || 'fomo';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crypto_signals')
      .select('*')
      .eq('time_window', window)
      .eq('signal_type', signalType)
      .order('weighted_score', { ascending: false })
      .limit(limit);

    if (coin) {
      query = query.eq('coin_symbol', coin.toUpperCase());
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: latestRow } = await (supabase as any)
      .from('crypto_signals')
      .select('computed_at')
      .eq('time_window', window)
      .eq('signal_type', signalType)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (latestRow) {
      query = query.eq('computed_at', latestRow.computed_at);
    }

    const { data: signals, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      signals: signals || [],
      computed_at: latestRow?.computed_at || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
