import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runCrawler } from '@/lib/crawlers';
import { processPendingSummaries } from '@/lib/ai/batch-summarizer';
import type { CrawlSource } from '@/types';

export async function POST() {
  const runStartTime = Date.now();

  try {
    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sourcesData, error: sourcesError } = await (supabase as any)
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (sourcesError) {
      console.error('[TRIGGER] Error fetching sources:', sourcesError);
      return NextResponse.json(
        { error: 'Failed to fetch crawl sources' },
        { status: 500 }
      );
    }

    const sources = sourcesData as CrawlSource[] | null;

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active crawl sources found',
        results: [],
      });
    }

    console.log(`[TRIGGER] Starting crawl for ${sources.length} sources`);

    const results = [];

    for (const source of sources) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: log, error: logError } = await (supabase as any)
        .from('crawl_logs')
        .insert({ source_id: source.id, status: 'running' })
        .select()
        .single();

      if (logError) {
        console.error(`[TRIGGER] Log error for ${source.name}:`, logError);
        continue;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crawlResult = await runCrawler(source, supabase as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('crawl_logs')
          .update({
            status: 'completed',
            finished_at: new Date().toISOString(),
            articles_found: crawlResult.found,
            articles_new: crawlResult.new,
          })
          .eq('id', log.id);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('crawl_sources')
          .update({ last_crawled_at: new Date().toISOString() })
          .eq('id', source.id);

        results.push({
          source: source.name,
          success: true,
          found: crawlResult.found,
          new: crawlResult.new,
        });
      } catch (crawlError) {
        console.error(`[TRIGGER] Crawl error for ${source.name}:`, crawlError);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('crawl_logs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: crawlError instanceof Error ? crawlError.message : 'Unknown error',
          })
          .eq('id', log.id);

        results.push({
          source: source.name,
          success: false,
          error: crawlError instanceof Error ? crawlError.message : 'Unknown error',
        });
      }
    }

    // 배치 요약 실행
    console.log('[TRIGGER] Starting batch summarization...');
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryResult = await processPendingSummaries(supabase as any, 30, supabaseKey);

    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
    console.log(`[TRIGGER] Complete in ${totalDuration}s`);

    return NextResponse.json({
      success: true,
      results,
      summarization: {
        processed: summaryResult.processed,
        success: summaryResult.success,
        failed: summaryResult.failed,
      },
    });
  } catch (error) {
    console.error('[TRIGGER] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger crawl' },
      { status: 500 }
    );
  }
}
