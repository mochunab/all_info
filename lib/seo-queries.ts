import { createServiceClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';

const ARTICLE_LIST_COLUMNS = [
  'id', 'source_id', 'source_name', 'source_url', 'title', 'title_ko',
  'summary', 'summary_tags', 'author',
  'published_at', 'crawled_at', 'priority', 'category', 'is_active', 'slug',
].join(', ');

export type CategoryCount = { name: string; count: number };
export type TagCount = { tag: string; count: number };
export type SourceCount = { name: string; count: number };
export type AuthorCount = { name: string; count: number };

export async function getCategories(): Promise<CategoryCount[]> {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('get_category_counts', {
    p_user_id: masterUserId,
  });

  if (data) return data;

  // Fallback: query categories table + count articles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: categories } = await (supabase as any)
    .from('categories')
    .select('name')
    .eq('user_id', masterUserId)
    .order('id', { ascending: true });

  if (!categories) return [];

  const results: CategoryCount[] = [];
  for (const cat of categories) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('user_id', masterUserId)
      .eq('category', cat.name);
    results.push({ name: cat.name, count: count || 0 });
  }
  return results;
}

export async function getPopularTags(limit = 50): Promise<TagCount[]> {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).rpc('get_popular_tags', {
    p_user_id: masterUserId,
    p_limit: limit,
  });

  if (data) return data;

  // Fallback: fetch articles and count tags in JS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles } = await (supabase as any)
    .from('articles')
    .select('summary_tags')
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .not('summary_tags', 'is', null);

  if (!articles) return [];

  const tagMap = new Map<string, number>();
  for (const a of articles) {
    if (Array.isArray(a.summary_tags)) {
      for (const tag of a.summary_tags) {
        const t = (tag as string).trim();
        if (t) tagMap.set(t, (tagMap.get(t) || 0) + 1);
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getActiveSources(): Promise<SourceCount[]> {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles } = await (supabase as any)
    .from('articles')
    .select('source_name')
    .eq('is_active', true)
    .eq('user_id', masterUserId);

  if (!articles) return [];

  const sourceMap = new Map<string, number>();
  for (const a of articles) {
    const name = a.source_name as string;
    if (name) sourceMap.set(name, (sourceMap.get(name) || 0) + 1);
  }

  return Array.from(sourceMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getArticlesByCategory(category: string, limit = 20) {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS)
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .eq('category', category)
    .order('crawled_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getArticlesByTag(tag: string, limit = 20) {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS)
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .contains('summary_tags', [tag])
    .order('crawled_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getArticlesBySource(sourceName: string, limit = 20) {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS)
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .eq('source_name', sourceName)
    .order('crawled_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getActiveAuthors(limit = 50): Promise<AuthorCount[]> {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: articles } = await (supabase as any)
    .from('articles')
    .select('author')
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .not('author', 'is', null);

  if (!articles) return [];

  const authorMap = new Map<string, number>();
  for (const a of articles) {
    const name = (a.author as string)?.trim();
    if (name) authorMap.set(name, (authorMap.get(name) || 0) + 1);
  }

  return Array.from(authorMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getArticlesByAuthor(authorName: string, limit = 20) {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select(ARTICLE_LIST_COLUMNS)
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .eq('author', authorName)
    .order('crawled_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getArticleBySlug(slug: string) {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select(`${ARTICLE_LIST_COLUMNS}, content_preview`)
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .eq('slug', slug)
    .single();

  return data || null;
}

export async function getArticleSlugs(): Promise<{ slug: string }[]> {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select('slug')
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .not('slug', 'is', null)
    .order('crawled_at', { ascending: false });

  return (data || []).filter((d: { slug: string | null }) => d.slug);
}

export async function getRelatedArticles(category: string, excludeId: string, limit = 5) {
  const supabase = createServiceClient();
  const masterUserId = await getMasterUserId();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('articles')
    .select(`${ARTICLE_LIST_COLUMNS}`)
    .eq('is_active', true)
    .eq('user_id', masterUserId)
    .eq('category', category)
    .neq('id', excludeId)
    .not('slug', 'is', null)
    .order('crawled_at', { ascending: false })
    .limit(limit);

  return data || [];
}
