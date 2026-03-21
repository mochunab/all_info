export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin');
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const supabase = await createClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: eventEntities } = await sb
      .from('crypto_entities')
      .select('id, name, metadata, mention_count, last_seen_at, created_at')
      .eq('entity_type', 'event')
      .gte('last_seen_at', since)
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    if (!eventEntities?.length) {
      return NextResponse.json({ events: [] });
    }

    const entityIds = eventEntities.map((e: { id: string }) => e.id);

    const { data: relations } = await sb
      .from('crypto_relations')
      .select('source_entity_id, target_entity_id, relation_type, context')
      .in('source_entity_id', entityIds)
      .eq('relation_type', 'impacts');

    const targetIds = [...new Set((relations || []).map((r: { target_entity_id: string }) => r.target_entity_id))];
    const { data: coinEntities } = targetIds.length > 0
      ? await sb
          .from('crypto_entities')
          .select('id, name, symbol')
          .in('id', targetIds)
          .eq('entity_type', 'coin')
      : { data: [] };

    const coinMap = new Map<string, { name: string; symbol: string }>();
    for (const c of coinEntities || []) {
      coinMap.set(c.id, { name: c.name, symbol: c.symbol });
    }

    const eventRelMap = new Map<string, { coins: string[]; impact: string }>();
    for (const r of relations || []) {
      const coinInfo = coinMap.get(r.target_entity_id);
      if (!coinInfo) continue;
      if (!eventRelMap.has(r.source_entity_id)) {
        eventRelMap.set(r.source_entity_id, { coins: [], impact: 'neutral' });
      }
      const entry = eventRelMap.get(r.source_entity_id)!;
      entry.coins.push(coinInfo.symbol);
      const ctx = r.context || '';
      if (ctx.includes('positive')) entry.impact = 'positive';
      else if (ctx.includes('negative')) entry.impact = 'negative';
    }

    const events = eventEntities
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => {
        const meta = e.metadata || {};
        const relInfo = eventRelMap.get(e.id);
        const affectedCoins = relInfo?.coins || meta.affected_coins || [];

        if (coin && !affectedCoins.includes(coin)) return null;

        return {
          id: e.id,
          name: e.name,
          timestamp: e.last_seen_at,
          mentions: e.mention_count,
          impact: relInfo?.impact || meta.impact || 'neutral',
          confidence: meta.confidence ?? 0.5,
          coins: affectedCoins,
          source: meta.source || 'keyword',
        };
      })
      .filter(Boolean);

    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
