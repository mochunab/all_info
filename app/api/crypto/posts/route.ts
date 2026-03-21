export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coin = searchParams.get('coin');
    const subreddit = searchParams.get('subreddit') || searchParams.get('channel');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crypto_posts')
      .select('*', { count: 'exact' })
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (subreddit) {
      query = query.eq('channel', subreddit);
    }

    if (coin) {
      // 코인 멘션이 있는 게시물만 필터
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: mentionPostIds } = await (supabase as any)
        .from('crypto_mentions')
        .select('post_id')
        .eq('coin_symbol', coin.toUpperCase());

      if (mentionPostIds && mentionPostIds.length > 0) {
        const ids = mentionPostIds.map((m: { post_id: string }) => m.post_id);
        query = query.in('id', ids);
      } else {
        return NextResponse.json({ posts: [], total: 0, page, limit });
      }
    }

    const { data: posts, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: posts || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
