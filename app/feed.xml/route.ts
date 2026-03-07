import { createServiceClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const masterUserId = await getMasterUserId();
  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: articles }, { data: blogPosts }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('articles')
      .select('id, title_ko, source_url, summary, published_at, crawled_at, category')
      .eq('is_active', true)
      .eq('user_id', masterUserId)
      .order('crawled_at', { ascending: false })
      .limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('blog_posts')
      .select('slug, title, description, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .limit(10),
  ]);

  type RssArticle = {
    id: string;
    title_ko: string | null;
    source_url: string;
    summary: string | null;
    published_at: string | null;
    crawled_at: string;
    category: string | null;
  };

  type RssBlogPost = {
    slug: string;
    title: string;
    description: string;
    published_at: string | null;
  };

  const articleItems = ((articles || []) as RssArticle[]).map((a) => {
    const title = a.title_ko || 'Untitled';
    const pubDate = a.published_at
      ? new Date(a.published_at).toUTCString()
      : new Date(a.crawled_at).toUTCString();

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(a.source_url)}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <pubDate>${pubDate}</pubDate>${a.summary ? `
      <description>${escapeXml(a.summary)}</description>` : ''}${a.category ? `
      <category>${escapeXml(a.category)}</category>` : ''}
    </item>`;
  });

  const blogItems = ((blogPosts || []) as RssBlogPost[]).map((p) => {
    const pubDate = p.published_at
      ? new Date(p.published_at).toUTCString()
      : new Date().toUTCString();

    return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>https://aca-info.com/blog/${escapeXml(p.slug)}</link>
      <guid isPermaLink="true">https://aca-info.com/blog/${escapeXml(p.slug)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.description)}</description>
      <category>블로그</category>
    </item>`;
  });

  const allItems = [...blogItems, ...articleItems];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>아카인포 - 나만의 면접 치트키</title>
    <link>https://aca-info.com</link>
    <description>면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!</description>
    <language>ko</language>
    <atom:link href="https://aca-info.com/feed.xml" rel="self" type="application/rss+xml"/>
${allItems.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'max-age=3600, s-maxage=3600',
    },
  });
}
