import { createServiceClient } from '@/lib/supabase/server';
import type { BlogPost } from '@/types';

export async function getBlogPosts(): Promise<BlogPost[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .order('published_at', { ascending: false });

  return (data as BlogPost[]) ?? [];
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  return data ? (data as BlogPost) : null;
}

export async function getBlogSlugs(): Promise<{ slug: string }[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  const { data } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('published', true);

  return (data as { slug: string }[]) ?? [];
}
