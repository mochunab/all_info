import { createServiceClient } from '@/lib/supabase/server';
import type { BlogPost } from '@/types';

export async function getBlogPosts(language = 'ko'): Promise<BlogPost[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .eq('language', language)
    .order('published_at', { ascending: false });

  return (data as BlogPost[]) ?? [];
}

export async function getBlogPost(slug: string, language = 'ko'): Promise<BlogPost | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .eq('language', language)
    .single();

  return data ? (data as BlogPost) : null;
}

export async function getBlogSlugs(): Promise<{ slug: string; language: string }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, language')
    .eq('published', true);

  return (data as { slug: string; language: string }[]) ?? [];
}

export async function getBlogTranslationSlugs(
  translationGroupId: string | null,
): Promise<Record<string, string>> {
  if (!translationGroupId) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, language')
    .eq('translation_group_id', translationGroupId)
    .eq('published', true);

  const map: Record<string, string> = {};
  for (const row of (data as { slug: string; language: string }[]) ?? []) {
    map[row.language] = row.slug;
  }
  return map;
}
