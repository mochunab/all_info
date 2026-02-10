import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { inferCrawlerType } from '@/lib/crawlers/infer-type';
import { verifySameOrigin, verifyCronAuth } from '@/lib/auth';

// GET /api/sources - Get all crawl sources
export async function GET() {
  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('crawl_sources')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching sources:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sources: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[GET /api/sources] Error:', message, stack);
    return NextResponse.json(
      { error: message, detail: stack?.split('\n').slice(0, 3).join(' | ') },
      { status: 500 }
    );
  }
}

// POST /api/sources - Add new crawl sources (requires auth)
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
    const { sources, deleteIds } = body;

    if (!sources || !Array.isArray(sources)) {
      return NextResponse.json(
        { error: 'Invalid sources data' },
        { status: 400 }
      );
    }

    // 삭제 요청된 소스 처리
    if (deleteIds && Array.isArray(deleteIds) && deleteIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('crawl_sources')
        .delete()
        .in('id', deleteIds);

      if (deleteError) {
        console.error('Error deleting sources:', deleteError);
      } else {
        console.log(`[SOURCES] Deleted ${deleteIds.length} sources: ${deleteIds.join(', ')}`);
      }
    }

    const results = [];

    for (const source of sources) {
      const { url, name, category } = source;

      if (!url) continue;

      // Check if source already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('crawl_sources')
        .select('id, config')
        .eq('base_url', url)
        .single();

      if (existing) {
        // Update existing source (merge config to preserve selectors, pagination, etc.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingConfig = (existing.config as Record<string, unknown>) || {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .update({
            name: name || extractDomainName(url),
            config: { ...existingConfig, category },
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }
      } else {
        // Insert new source with auto-detected crawler type
        const detectedType = inferCrawlerType(url);
        console.log(`[SOURCES] New source: ${url} -> crawler_type: ${detectedType}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .insert({
            name: name || extractDomainName(url),
            base_url: url,
            crawler_type: detectedType,
            config: { category },
            is_active: true,
            priority: 1,
          })
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }
      }
    }

    return NextResponse.json({
      success: true,
      sources: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[POST /api/sources] Error:', message, stack);
    return NextResponse.json(
      { error: message, detail: stack?.split('\n').slice(0, 3).join(' | ') },
      { status: 500 }
    );
  }
}

function extractDomainName(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return url;
  }
}
