import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';
import { getCache, setCache } from '@/lib/cache';
import HomeFeed from '@/components/HomeFeed';
import type { Article } from '@/types';

export const metadata: Metadata = {
  title: '홈피드',
};

const ARTICLE_LIST_COLUMNS = [
  'id', 'source_id', 'source_name', 'source_url', 'title', 'title_ko',
  'summary', 'summary_tags', 'author',
  'published_at', 'crawled_at', 'priority', 'category', 'is_active',
].join(', ');

const HOME_CACHE_KEY = 'ssr:home';
const HOME_CACHE_TTL = 30_000;

type HomeCache = {
  categories: string[];
  articles: Article[];
  total: number;
};

export default async function Home() {
  const cached = getCache<HomeCache>(HOME_CACHE_KEY);
  if (cached) {
    return (
      <HomeFeed
        initialArticles={cached.articles}
        initialCategories={cached.categories}
        initialTotal={cached.total}
        initialHasMore={12 < cached.total}
      />
    );
  }

  const masterUserId = await getMasterUserId();
  const supabase = await createClient();

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('name, display_order')
    .eq('user_id', masterUserId)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name');

  const categoryNames = categoriesData?.map((c: { name: string }) => c.name) || [];
  const defaultCategory = categoryNames[0] || '';

  let query = supabase
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS, { count: 'exact' })
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .order('crawled_at', { ascending: false })
    .range(0, 11);

  if (defaultCategory) {
    query = query.eq('category', defaultCategory);
  }

  const { data: articles, count } = await query;
  const total = count || 0;

  setCache(HOME_CACHE_KEY, {
    categories: categoryNames,
    articles: articles || [],
    total,
  }, HOME_CACHE_TTL);

  return (
    <HomeFeed
      initialArticles={articles || []}
      initialCategories={categoryNames}
      initialTotal={total}
      initialHasMore={12 < total}
    />
  );
}
