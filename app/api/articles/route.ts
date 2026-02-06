import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ArticleListResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const source = searchParams.get('source') || '';

    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('crawled_at', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,content_preview.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (source) {
      query = query.eq('source_name', source);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) {
      console.error('Error fetching articles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch articles' },
        { status: 500 }
      );
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    const response: ArticleListResponse = {
      articles: articles || [],
      total,
      page,
      limit,
      hasMore,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Articles API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
