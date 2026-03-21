export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { verifySameOrigin, verifyCronAuth } from '@/lib/auth';
import { getCache, setCache, invalidateCache, invalidateCacheByPrefix, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
import { getMasterUserId } from '@/lib/user';

type CategoryResponse = {
  categories: { id: number; name: string; is_default: boolean; translations?: Record<string, string> }[];
};

const DEEPL_TARGET_LANGS: Record<string, string> = {
  en: 'EN',
  vi: 'VI',
  zh: 'ZH',
  ja: 'JA',
};

async function translateCategoryName(name: string): Promise<Record<string, string>> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) return {};

  try {
    const results = await Promise.allSettled(
      Object.entries(DEEPL_TARGET_LANGS).map(async ([lang, deeplLang]) => {
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: [name], target_lang: deeplLang, source_lang: 'KO' }),
        });
        if (!response.ok) throw new Error(`DeepL ${response.status}`);
        const data = await response.json();
        return { lang, text: data.translations[0].text };
      })
    );

    const translations: Record<string, string> = {};
    for (const result of results) {
      if (result.status === 'fulfilled') {
        translations[result.value.lang] = result.value.text;
      }
    }
    return translations;
  } catch (error) {
    console.error('[CATEGORIES] Translation failed:', error);
    return {};
  }
}

const defaultCategoryResponse: CategoryResponse = {
  categories: [],
};

// GET /api/categories - Get all categories (In-Memory cached)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdParam = searchParams.get('user_id') || '';
    const effectiveUserId = userIdParam || await getMasterUserId();

    const cacheKey = `${CACHE_KEYS.CATEGORIES}:${effectiveUserId}`;

    // Layer 1: In-Memory cache
    const cached = getCache<CategoryResponse>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      });
    }

    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('categories')
      .select('*')
      .eq('user_id', effectiveUserId)
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
    setCache(cacheKey, body, CACHE_TTL.CATEGORIES);

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

    const authClient = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (authClient as any).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
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

    // 1. Delete all articles with this category (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deletedArticles, error: artDeleteError } = await (supabase as any)
      .from('articles')
      .delete()
      .eq('category', trimmedName)
      .eq('user_id', user.id)
      .select('id');

    const deletedArticleCount = deletedArticles?.length || 0;
    if (artDeleteError) {
      console.error('Error deleting articles for category:', artDeleteError);
    }

    // 2. Delete all crawl_sources with this category in config (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sourcesToDelete } = await (supabase as any)
      .from('crawl_sources')
      .select('id')
      .eq('config->>category', trimmedName)
      .eq('user_id', user.id);

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

    // 3. Delete the category itself (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: catDeleteError } = await (supabase as any)
      .from('categories')
      .delete()
      .eq('name', trimmedName)
      .eq('user_id', user.id);

    if (catDeleteError) {
      console.error('Error deleting category:', catDeleteError);
      return NextResponse.json({ error: catDeleteError.message }, { status: 500 });
    }

    console.log(`[CATEGORIES] Deleted category "${trimmedName}" with ${deletedSourceCount} sources, ${deletedArticleCount} articles`);

    // 캐시 무효화
    invalidateCacheByPrefix(CACHE_KEYS.CATEGORIES);
    invalidateCacheByPrefix(CACHE_KEYS.SOURCES);
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);
    revalidatePath('/sources/add');

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

    // 로그인된 유저 확인
    const authClient = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (authClient as any).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
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

    // Check if category already exists for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('categories')
      .select('id')
      .eq('name', trimmedName)
      .eq('user_id', user.id)
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
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Translate category name via DeepL (non-blocking for category creation)
    translateCategoryName(trimmedName).then(async (translations) => {
      if (Object.keys(translations).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('categories')
          .update({ translations })
          .eq('id', data.id);
        invalidateCacheByPrefix(CACHE_KEYS.CATEGORIES);
        console.log(`[CATEGORIES] Translated "${trimmedName}":`, translations);
      }
    }).catch(() => {});

    // 캐시 무효화
    invalidateCacheByPrefix(CACHE_KEYS.CATEGORIES);
    invalidateCache(CACHE_KEYS.SSR_HOME);
    revalidatePath('/sources/add');

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/categories - Rename a category (requires auth)
export async function PATCH(request: NextRequest) {
  try {
    if (!verifySameOrigin(request) && !verifyCronAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authClient = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (authClient as any).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const body = await request.json();
    const { oldName, newName } = body;

    if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
      return NextResponse.json(
        { error: 'oldName and newName are required' },
        { status: 400 }
      );
    }

    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();

    if (!trimmedNew) {
      return NextResponse.json(
        { error: 'New category name cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedOld === trimmedNew) {
      return NextResponse.json({ success: true });
    }

    // 중복 확인 (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('categories')
      .select('id')
      .eq('name', trimmedNew)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Category name already exists' },
        { status: 409 }
      );
    }

    // 1. categories 테이블 이름 변경 (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: catError } = await (supabase as any)
      .from('categories')
      .update({ name: trimmedNew })
      .eq('name', trimmedOld)
      .eq('user_id', user.id);

    if (catError) {
      console.error('Error renaming category:', catError);
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }

    // 2. articles.category 일괄 변경 (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('articles')
      .update({ category: trimmedNew })
      .eq('category', trimmedOld)
      .eq('user_id', user.id);

    // 3. crawl_sources.config 내 category 변경 (scoped to user)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sources } = await (supabase as any)
      .from('crawl_sources')
      .select('id, config')
      .eq('config->>category', trimmedOld)
      .eq('user_id', user.id);

    if (sources && sources.length > 0) {
      await Promise.all(
        sources.map((s: { id: number; config: Record<string, unknown> }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('crawl_sources')
            .update({ config: { ...s.config, category: trimmedNew } })
            .eq('id', s.id)
        )
      );
    }

    console.log(`[CATEGORIES] Renamed "${trimmedOld}" → "${trimmedNew}" (${sources?.length || 0} sources updated)`);

    // Translate new category name via DeepL (non-blocking)
    translateCategoryName(trimmedNew).then(async (translations) => {
      if (Object.keys(translations).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('categories')
          .update({ translations })
          .eq('name', trimmedNew)
          .eq('user_id', user.id);
        invalidateCacheByPrefix(CACHE_KEYS.CATEGORIES);
        console.log(`[CATEGORIES] Translated renamed "${trimmedNew}":`, translations);
      }
    }).catch(() => {});

    // 캐시 무효화
    invalidateCacheByPrefix(CACHE_KEYS.CATEGORIES);
    invalidateCacheByPrefix(CACHE_KEYS.SOURCES);
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);
    revalidatePath('/sources/add');

    return NextResponse.json({ success: true, oldName: trimmedOld, newName: trimmedNew });
  } catch (error) {
    console.error('Error in PATCH /api/categories:', error);
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
    invalidateCacheByPrefix(CACHE_KEYS.CATEGORIES);
    invalidateCache(CACHE_KEYS.SSR_HOME);
    revalidatePath('/sources/add');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT /api/categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
