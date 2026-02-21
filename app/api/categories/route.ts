import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifySameOrigin, verifyCronAuth } from '@/lib/auth';
import { getCache, setCache, invalidateCache, invalidateCacheByPrefix, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

type CategoryResponse = {
  categories: { id: number; name: string; is_default: boolean }[];
};

const defaultCategoryResponse: CategoryResponse = {
  categories: [],
};

// GET /api/categories - Get all categories (In-Memory cached)
export async function GET() {
  try {
    // Layer 1: In-Memory cache
    const cached = getCache<CategoryResponse>(CACHE_KEYS.CATEGORIES);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      });
    }

    const supabase = await createClient();

    // Try to fetch from categories table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name');

    if (error) {
      console.log('Categories table not found, using defaults');
      return NextResponse.json(defaultCategoryResponse);
    }

    if (!data || data.length === 0) {
      return NextResponse.json(defaultCategoryResponse);
    }

    const body: CategoryResponse = { categories: data };
    setCache(CACHE_KEYS.CATEGORIES, body, CACHE_TTL.CATEGORIES);

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    return NextResponse.json(defaultCategoryResponse);
  }
}

// DELETE /api/categories - Delete a category and its sources (requires auth)
export async function DELETE(request: NextRequest) {
  try {
    if (!verifySameOrigin(request) && !verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // 1. Delete all articles with this category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedArticles, error: artDeleteError } = await (supabase as any)
      .from('articles')
      .delete()
      .eq('category', trimmedName)
      .select('id');

    const deletedArticleCount = deletedArticles?.length || 0;
    if (artDeleteError) {
      console.error('Error deleting articles for category:', artDeleteError);
    }

    // 2. Delete all crawl_sources with this category in config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sourcesToDelete } = await (supabase as any)
      .from('crawl_sources')
      .select('id')
      .eq('config->>category', trimmedName);

    let deletedSourceCount = 0;
    if (sourcesToDelete && sourcesToDelete.length > 0) {
      const ids = sourcesToDelete.map((s: { id: number }) => s.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: srcDeleteError } = await (supabase as any)
        .from('crawl_sources')
        .delete()
        .in('id', ids);

      if (srcDeleteError) {
        console.error('Error deleting sources for category:', srcDeleteError);
      } else {
        deletedSourceCount = ids.length;
      }
    }

    // 3. Delete the category itself
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: catDeleteError } = await (supabase as any)
      .from('categories')
      .delete()
      .eq('name', trimmedName);

    if (catDeleteError) {
      console.error('Error deleting category:', catDeleteError);
      return NextResponse.json({ error: catDeleteError.message }, { status: 500 });
    }

    console.log(`[CATEGORIES] Deleted category "${trimmedName}" with ${deletedSourceCount} sources, ${deletedArticleCount} articles`);

    // 캐시 무효화
    invalidateCache(CACHE_KEYS.CATEGORIES);
    invalidateCache(CACHE_KEYS.SOURCES);
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);

    return NextResponse.json({
      success: true,
      deletedCategory: trimmedName,
      deletedSourceCount,
    });
  } catch (error) {
    console.error('Error in DELETE /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/categories - Add a new category (requires auth)
export async function POST(request: NextRequest) {
  try {
    // Require same-origin (browser) or cron auth (server)
    if (!verifySameOrigin(request) && !verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Category name cannot be empty' },
        { status: 400 }
      );
    }

    // Check if category already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('categories')
      .select('id')
      .eq('name', trimmedName)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Category already exists' },
        { status: 409 }
      );
    }

    // Get max display_order
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: maxOrderData } = await (supabase as any)
      .from('categories')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = maxOrderData?.display_order ? maxOrderData.display_order + 1 : 1;

    // Insert new category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('categories')
      .insert({
        name: trimmedName,
        is_default: false,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 캐시 무효화
    invalidateCache(CACHE_KEYS.CATEGORIES);

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/categories - Reorder categories (requires auth)
export async function PUT(request: NextRequest) {
  try {
    if (!verifySameOrigin(request) && !verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { categories } = body;

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Categories must be an array' },
        { status: 400 }
      );
    }

    // Update display_order for each category
    const updates = categories.map((cat: { id: number; name: string }, index: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (supabase as any)
        .from('categories')
        .update({ display_order: index + 1 })
        .eq('id', cat.id);
    });

    await Promise.all(updates);

    console.log(`[CATEGORIES] Reordered ${categories.length} categories`);

    // 캐시 무효화
    invalidateCache(CACHE_KEYS.CATEGORIES);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
