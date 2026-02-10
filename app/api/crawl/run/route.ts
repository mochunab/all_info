import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processPendingSummaries } from '@/lib/ai/batch-summarizer';
import type { CrawlSource } from '@/types';

// Verify cron secret for scheduled runs
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  return handleCrawlRun(request);
}

export async function POST(request: NextRequest) {
  return handleCrawlRun(request);
}

async function handleCrawlRun(request: NextRequest) {
  const runStartTime = Date.now();

  try {
    // Verify authorization
    if (!verifyCronSecret(request)) {
      console.log('[AUTH] Unauthorized request - invalid or missing cron secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    // Check for sourceId query parameter (pg_cron per-source mode)
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const skipSummary = searchParams.get('skipSummary') === 'true';

    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# CRAWL RUN STARTED ${sourceId ? `(sourceId: ${sourceId})` : '(all sources)'}`);
    console.log(`# Time: ${new Date().toISOString()}`);
    console.log(`${'#'.repeat(70)}\n`);

    // Fetch sources: single source or all active sources
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true);

    if (sourceId) {
      query = query.eq('id', parseInt(sourceId, 10));
    } else {
      query = query.order('priority', { ascending: false });
    }

    const { data: sourcesData, error: sourcesError } = await query;

    if (sourcesError) {
      console.error('[SOURCES] Error fetching sources:', sourcesError);
      return NextResponse.json(
        { error: 'Failed to fetch crawl sources' },
        { status: 500 }
      );
    }

    const sources = sourcesData as CrawlSource[] | null;

    if (!sources || sources.length === 0) {
      console.log('[SOURCES] No active crawl sources found in database');
      return NextResponse.json({
        success: true,
        message: 'No active crawl sources found',
        results: [],
      });
    }

    console.log(`[SOURCES] Found ${sources.length} active sources:`);
    sources.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${s.base_url})`);
    });

    const results = [];

    for (const source of sources) {
      // Create crawl log entry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: log, error: logError } = await (supabase as any)
        .from('crawl_logs')
        .insert({
          source_id: source.id,
          status: 'running',
        })
        .select()
        .single();

      if (logError) {
        console.error(`Error creating log for ${source.name}:`, logError);
        continue;
      }

      try {
        // Import and run the appropriate crawler
        const { runCrawler } = await import('@/lib/crawlers');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crawlResult = await runCrawler(source, supabase as any);

        // Update log with results
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

        // Update source last_crawled_at
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
        console.error(`Crawl error for ${source.name}:`, crawlError);

        // Update log with error
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

    // Summary of crawl results
    const totalFound = results.reduce((sum, r) => sum + (r.found || 0), 0);
    const totalNew = results.reduce((sum, r) => sum + (r.new || 0), 0);
    const totalFailed = results.filter(r => !r.success).length;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[CRAWL SUMMARY]`);
    console.log(`Total sources: ${sources.length}`);
    console.log(`Total articles found: ${totalFound}`);
    console.log(`Total new articles saved: ${totalNew}`);
    console.log(`Failed sources: ${totalFailed}`);
    console.log(`${'='.repeat(60)}\n`);

    // After crawling, process pending summaries (skip if per-source mode with skipSummary)
    let summaryResult = { processed: 0, success: 0, failed: 0 };
    if (!skipSummary) {
      console.log('[SUMMARIZE] Starting batch summarization...');
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      summaryResult = await processPendingSummaries(supabase as any, 30, supabaseKey);
      console.log(`[SUMMARIZE] Complete: ${summaryResult.success}/${summaryResult.processed} successful`);
    } else {
      console.log('[SUMMARIZE] Skipped (skipSummary=true, will run separately)');
    }

    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
    console.log(`\n${'#'.repeat(70)}`);
    console.log(`# CRAWL RUN COMPLETE ${sourceId ? `(sourceId: ${sourceId})` : ''}`);
    console.log(`# Duration: ${totalDuration}s`);
    console.log(`# New articles: ${totalNew}`);
    console.log(`${'#'.repeat(70)}\n`);

    return NextResponse.json({
      success: true,
      message: sourceId ? `Crawled source ${sourceId}` : `Crawled ${sources.length} sources`,
      results,
      summarization: {
        processed: summaryResult.processed,
        success: summaryResult.success,
        failed: summaryResult.failed,
      },
    });
  } catch (error) {
    console.error('[CRAWL RUN ERROR]:', error);
    console.error('[CRAWL RUN ERROR] Stack:', error instanceof Error ? error.stack : 'N/A');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
