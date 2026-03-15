import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchWithTimeout, DEFAULT_HEADERS } from '@/lib/crawlers/base';
import { extractContent } from '@/lib/crawlers/content-extractor';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { articleIds } = await req.json();

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({ error: 'articleIds 필수' }, { status: 400 });
    }

    if (articleIds.length > 5) {
      return NextResponse.json({ error: '최대 5개까지 가능' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articles, error: artErr } = await (supabase as any)
      .from('articles')
      .select('id, source_url, source_id, content_preview')
      .in('id', articleIds);

    if (artErr || !articles?.length) {
      return NextResponse.json({ error: '기사를 찾을 수 없습니다' }, { status: 404 });
    }

    const sourceIds = [...new Set(articles.map((a: { source_id: string }) => a.source_id))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sources } = await (supabase as any)
      .from('crawl_sources')
      .select('id, config, crawler_type')
      .in('id', sourceIds);

    const sourceMap = new Map(
      (sources || []).map((s: { id: string; config: Record<string, unknown>; crawler_type: string }) => [s.id, s])
    );

    const results: Record<string, string> = {};

    await Promise.all(
      articles.map(async (article: { id: string; source_url: string; source_id: string; content_preview: string | null }) => {
        try {
          const source = sourceMap.get(article.source_id) as { config: Record<string, unknown>; crawler_type: string } | undefined;
          const contentSelectors = source?.config?.content_selectors as { content?: string; removeSelectors?: string[] } | undefined;

          const res = await fetchWithTimeout(article.source_url, { headers: DEFAULT_HEADERS }, 10000);
          if (!res.ok) {
            results[article.id] = article.content_preview || '';
            return;
          }

          const html = await res.text();
          const content = await extractContent(html, article.source_url, contentSelectors || undefined);

          results[article.id] = content || article.content_preview || '';
        } catch {
          results[article.id] = article.content_preview || '';
        }
      })
    );

    return NextResponse.json({ contents: results });
  } catch (err) {
    console.error('[fetch-content] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `본문 추출 실패: ${message}` }, { status: 500 });
  }
}
