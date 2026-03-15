import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getCache, setCache } from '@/lib/cache';
import MyFeedClient from '@/app/[locale]/my-feed/MyFeedClient';
import type { Article } from '@/types';

export const metadata: Metadata = {
  title: '마이피드',
};

const ARTICLE_LIST_COLUMNS = [
  'id', 'source_id', 'source_name', 'source_url', 'title', 'title_ko',
  'summary', 'summary_tags', 'author',
  'published_at', 'crawled_at', 'priority', 'category', 'is_active',
].join(', ');

const MY_CACHE_TTL = 30_000;

type MyFeedCache = {
  categories: string[];
  articles: Article[];
  total: number;
};

export default async function MyFeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <MyFeedClient authenticated={false} userId="" initialArticles={[]} initialCategories={[]} initialTotal={0} initialHasMore={false} />;
  }

  const cacheKey = `ssr:my-feed:${user.id}`;
  const cached = getCache<MyFeedCache>(cacheKey);
  if (cached) {
    return (
      <MyFeedClient
        authenticated
        userId={user.id}
        initialArticles={cached.articles}
        initialCategories={cached.categories}
        initialTotal={cached.total}
        initialHasMore={12 < cached.total}
      />
    );
  }

  const categoriesResult = await supabase
    .from('categories')
    .select('name, display_order')
    .eq('user_id', user.id)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('name');

  const categoryNames = categoriesResult.data?.map((c: { name: string }) => c.name) || [];
  const defaultCategory = categoryNames[0] || '';

  let articlesQuery = supabase
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS, { count: 'exact' })
    .eq('is_active', true)
    .eq('user_id', user.id)
    .order('crawled_at', { ascending: false })
    .range(0, 11);

  if (defaultCategory) {
    articlesQuery = articlesQuery.eq('category', defaultCategory);
  }

  const { data: articles, count } = await articlesQuery;
  const total = count || 0;

  setCache(cacheKey, {
    categories: categoryNames,
    articles: articles || [],
    total,
  }, MY_CACHE_TTL);

  return (
    <MyFeedClient
      authenticated
      userId={user.id}
      initialArticles={articles || []}
      initialCategories={categoryNames}
      initialTotal={total}
      initialHasMore={12 < total}
    />
  );
}
