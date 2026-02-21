import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
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

    // In-Memory cache — 검색 쿼리 없는 요청만 캐시 (검색은 변동성 높음)
    const cacheKey = !search
      ? `${CACHE_KEYS.ARTICLES_PREFIX}p=${page}&l=${limit}&c=${category}&s=${source}`
      : null;

    if (cacheKey) {
      const cached = getCache<ArticleListResponse>(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: {
            'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
            'X-Cache': 'HIT',
          },
        });
      }
    }

    const supabase = await createClient();

    // Build query — content_preview 제외 (목록에서 불필요, 최대 3000자 절약)
    const ARTICLE_LIST_COLUMNS = [
      'id', 'source_id', 'source_name', 'source_url', 'title', 'title_ko',
      'summary', 'summary_tags', 'author',
      'published_at', 'crawled_at', 'priority', 'category', 'is_active',
    ].join(', ');

    let query = supabase
      .from('articles')
      .select(ARTICLE_LIST_COLUMNS, { count: 'exact' })
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

    // 검색 없는 요청만 캐시 저장
    if (cacheKey) {
      setCache(cacheKey, response, CACHE_TTL.ARTICLES);
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': search
          ? 'private, no-cache'
          : 'private, max-age=15, stale-while-revalidate=30',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Articles API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
