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
