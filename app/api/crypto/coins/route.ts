import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const entityType = searchParams.get('type') || 'coin';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crypto_entities')
      .select('*')
      .eq('entity_type', entityType)
      .order('mention_count', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`name.ilike.%${search}%,symbol.ilike.%${search}%`);
    }

    const { data: entities, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!entities || entities.length === 0) {
      return NextResponse.json({ entities: [], relations: [] });
    }

    // 선택된 엔티티의 관계 조회
    const entityIds = entities.map((e: { id: string }) => e.id);

    const { data: relations } = await (supabase as any)
      .from('crypto_relations')
      .select(`
        *,
        source_entity:crypto_entities!source_entity_id (id, entity_type, name, symbol),
        target_entity:crypto_entities!target_entity_id (id, entity_type, name, symbol)
      `)
      .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`)
      .limit(200);

    // 최신 시그널 조회 (코인 엔티티인 경우)
    let signals = null;
    if (entityType === 'coin') {
      const symbols = entities
        .map((e: { symbol: string | null }) => e.symbol)
        .filter(Boolean);

      if (symbols.length > 0) {
        const { data: signalData } = await (supabase as any)
          .from('crypto_signals')
          .select('*')
          .in('coin_symbol', symbols)
          .eq('time_window', '24h')
          .order('computed_at', { ascending: false })
          .limit(symbols.length);

        signals = signalData;
      }
    }

    return NextResponse.json({
      entities: entities || [],
      relations: relations || [],
      signals: signals || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
