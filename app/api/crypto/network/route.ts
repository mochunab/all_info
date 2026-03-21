export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin');
    const window = searchParams.get('window') || '24h';
    const signalType = searchParams.get('signal_type') || 'fomo';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: entities } = await sb
      .from('crypto_entities')
      .select('id, entity_type, name, symbol, mention_count, metadata')
      .in('entity_type', ['coin', 'influencer', 'narrative', 'event'])
      .order('mention_count', { ascending: false })
      .limit(limit);

    if (!entities?.length) {
      return NextResponse.json({ nodes: [], links: [], keywords: [] });
    }

    const entityIds = entities.map((e: { id: string }) => e.id);

    const { data: relations } = await sb
      .from('crypto_relations')
      .select('source_entity_id, target_entity_id, relation_type, weight')
      .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`)
      .gt('weight', 0)
      .limit(300);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coinSymbols = entities.filter((e: any) => e.entity_type === 'coin').map((e: any) => e.symbol).filter(Boolean);

    const { data: signals } = await sb
      .from('crypto_signals')
      .select('coin_symbol, avg_sentiment, weighted_score, signal_label, mention_velocity')
      .in('coin_symbol', coinSymbols.length > 0 ? coinSymbols : ['__none__'])
      .eq('time_window', window)
      .eq('signal_type', signalType)
      .order('computed_at', { ascending: false })
      .limit(coinSymbols.length || 1);

    let keywords: { word: string; count: number }[] = [];

    if (coin) {
      const { data: mentionPosts } = await sb
        .from('crypto_mentions')
        .select('post_id')
        .eq('coin_symbol', coin)
        .order('created_at', { ascending: false })
        .limit(50);

      if (mentionPosts?.length) {
        const postIds = mentionPosts.map((m: { post_id: string }) => m.post_id);

        const { data: sentiments } = await sb
          .from('crypto_sentiments')
          .select('key_phrases')
          .in('post_id', postIds);

        if (sentiments?.length) {
          const phraseCount = new Map<string, number>();
          for (const s of sentiments) {
            if (!s.key_phrases) continue;
            for (const phrase of s.key_phrases) {
              const p = phrase.toLowerCase().trim();
              if (p.length < 2) continue;
              phraseCount.set(p, (phraseCount.get(p) || 0) + 1);
            }
          }
          keywords = [...phraseCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 40)
            .map(([word, count]) => ({ word, count }));
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signalMap = new Map((signals || []).map((s: any) => [s.coin_symbol, s]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = entities.map((e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = e.symbol ? signalMap.get(e.symbol) as any : null;
      const meta = e.metadata || {};
      return {
        id: e.id,
        name: e.symbol || e.name,
        fullName: e.name,
        type: e.entity_type,
        mentions: e.mention_count,
        sentiment: sig?.avg_sentiment ?? 0,
        score: sig?.weighted_score ?? 0,
        label: sig?.signal_label ?? 'neutral',
        velocity: sig?.mention_velocity ?? 0,
        confidence: meta.confidence ?? 1.0,
      };
    });

    const entityIdSet = new Set(entityIds);
    const links = (relations || [])
      .filter((r: { source_entity_id: string; target_entity_id: string }) =>
        entityIdSet.has(r.source_entity_id) && entityIdSet.has(r.target_entity_id)
      )
      .map((r: { source_entity_id: string; target_entity_id: string; relation_type: string; weight: number }) => ({
        source: r.source_entity_id,
        target: r.target_entity_id,
        type: r.relation_type,
        weight: r.weight,
      }));

    return NextResponse.json({ nodes, links, keywords });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
