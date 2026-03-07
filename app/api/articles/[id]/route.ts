import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { invalidateCacheByPrefix, CACHE_KEYS } from '@/lib/cache';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// DELETE /api/articles/:id - 아티클 삭제 (is_active=false로 소프트 삭제)
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase as any)
      .from('articles')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      console.error('[DELETE] Article delete error:', error);
      return NextResponse.json({ error: `Failed to delete article: ${error.message}` }, { status: 500 });
    }

    if (count === 0) {
      console.error('[DELETE] Article not found:', id);
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    console.log(`[DELETE] Article permanently deleted: ${id}`);

    // 아티클 목록 캐시 무효화
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[DELETE] Article error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
