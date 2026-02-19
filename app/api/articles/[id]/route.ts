import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

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

    // 소프트 삭제: is_active를 false로 업데이트
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('articles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('[DELETE] Article update error:', error);
      return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[DELETE] Article error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
