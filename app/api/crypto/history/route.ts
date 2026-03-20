import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin')?.toUpperCase();
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 30);

    if (!coin) {
      return NextResponse.json({ error: 'coin parameter required' }, { status: 400 });
    }

    const supabase = await createClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const [mentionsRes, sentimentsRes] = await Promise.all([
      sb
        .from('crypto_mentions')
        .select('coin_symbol, mention_count, created_at, post_id')
        .eq('coin_symbol', coin)
        .gte('created_at', since)
        .order('created_at', { ascending: true }),
      sb
        .from('crypto_sentiments')
        .select('post_id, sentiment_score, fomo_score')
        .gte('created_at', since),
    ]);

    const postSentimentMap = new Map<string, { sentiment_score: number; fomo_score: number }>();
    for (const s of sentimentsRes.data || []) {
      postSentimentMap.set(s.post_id, { sentiment_score: s.sentiment_score, fomo_score: s.fomo_score || 0 });
    }

    const BUCKET_MS = 6 * 60 * 60 * 1000;
    const buckets = new Map<number, { mentions: number; sentiments: number[]; fomos: number[] }>();

    for (const m of (mentionsRes.data || []) as { coin_symbol: string; mention_count: number; created_at: string; post_id: string }[]) {
      const ts = Math.floor(new Date(m.created_at).getTime() / BUCKET_MS) * BUCKET_MS;
      if (!buckets.has(ts)) buckets.set(ts, { mentions: 0, sentiments: [], fomos: [] });
      const b = buckets.get(ts)!;
      b.mentions += m.mention_count;

      const s = postSentimentMap.get(m.post_id);
      if (s) {
        b.sentiments.push(s.sentiment_score);
        b.fomos.push(s.fomo_score);
      }
    }

    const timeline = [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, b]) => ({
        timestamp: new Date(ts).toISOString(),
        mentions: b.mentions,
        avg_sentiment: b.sentiments.length > 0
          ? Math.round((b.sentiments.reduce((a, c) => a + c, 0) / b.sentiments.length) * 1000) / 1000
          : null,
        avg_fomo: b.fomos.length > 0
          ? Math.round((b.fomos.reduce((a, c) => a + c, 0) / b.fomos.length) * 1000) / 1000
          : null,
      }));

    return NextResponse.json({ coin, days, timeline });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
