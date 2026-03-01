import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

import { invalidateCacheByPrefix, CACHE_KEYS } from '@/lib/cache';
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

    // Check for query parameters
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const category = searchParams.get('category');
    const skipSummary = searchParams.get('skipSummary') === 'true';

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 크롤링 시작 ${sourceId ? `(소스 ID: ${sourceId})` : category ? `(카테고리: ${category})` : '(전체 소스)'}`);
    console.log(`⏰ 시작 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`${'='.repeat(80)}\n`);

    // Fetch sources: single source, category filter, or all active sources
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true);

    if (sourceId) {
      query = query.eq('id', parseInt(sourceId, 10));
    } else {
      if (category) {
        query = query.eq('config->>category', category);
        console.log(`📂 카테고리 필터 적용: ${category}`);
      }
      query = query.order('priority', { ascending: false });
    }

    const { data: sourcesData, error: sourcesError } = await query;

    if (sourcesError) {
      console.error('❌ [DB 조회 오류] 크롤링 소스 조회 실패:', sourcesError);
      return NextResponse.json(
        { error: 'Failed to fetch crawl sources' },
        { status: 500 }
      );
    }

    const sources = sourcesData as CrawlSource[] | null;

    if (!sources || sources.length === 0) {
      const message = category
        ? `활성화된 크롤링 소스가 없습니다 (카테고리: ${category})`
        : '활성화된 크롤링 소스가 없습니다';
      console.log(`⚠️  [알림] ${message}`);
      return NextResponse.json({
        success: true,
        message: category
          ? `No active crawl sources found for category: ${category}`
          : 'No active crawl sources found',
        results: [],
      });
    }

    console.log(`\n📋 [소스 목록] 총 ${sources.length}개의 활성 소스 발견:`);
    sources.forEach((s, i) => {
      console.log(`   ${i + 1}. 📌 ${s.name}`);
      console.log(`      └─ URL: ${s.base_url}`);
      console.log(`      └─ 타입: ${s.crawler_type || '자동감지'}`);
      console.log(`      └─ 우선순위: ${s.priority || 1}`);
    });
    console.log('');

    const results = [];

    for (let idx = 0; idx < sources.length; idx++) {
      const source = sources[idx];
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`🔄 [${idx + 1}/${sources.length}] "${source.name}" 크롤링 시작...`);
      console.log(`${'─'.repeat(80)}`);

      // Create crawl log entry
      console.log(`📝 크롤링 로그 생성 중...`);
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
        console.error(`❌ [로그 생성 실패] ${source.name}:`, logError);
        continue;
      }
      console.log(`✅ 로그 생성 완료 (ID: ${log.id})`);

      const sourceStartTime = Date.now();

      try {
        // Import and run the appropriate crawler
        console.log(`\n🎯 크롤러 실행 중...`);
        const { runCrawler } = await import('@/lib/crawlers');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crawlResult = await runCrawler(source, supabase as any);

        const sourceDuration = ((Date.now() - sourceStartTime) / 1000).toFixed(2);

        console.log(`\n✅ [크롤링 완료] "${source.name}"`);
        console.log(`   📊 발견: ${crawlResult.found}개`);
        console.log(`   💾 저장: ${crawlResult.new}개`);
        console.log(`   ⏱️  소요시간: ${sourceDuration}초`);

        // Update log with results
        console.log(`📝 크롤링 로그 업데이트 중...`);
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

        console.log(`✅ 로그 업데이트 완료`);

        results.push({
          source: source.name,
          success: true,
          found: crawlResult.found,
          new: crawlResult.new,
        });
      } catch (crawlError) {
        const sourceDuration = ((Date.now() - sourceStartTime) / 1000).toFixed(2);
        console.error(`\n❌ [크롤링 실패] "${source.name}"`);
        console.error(`   ⚠️  오류: ${crawlError instanceof Error ? crawlError.message : 'Unknown error'}`);
        console.error(`   ⏱️  소요시간: ${sourceDuration}초`);

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
    const totalSuccess = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 크롤링 결과 요약`);
    console.log(`${'='.repeat(80)}`);
    console.log(`✅ 성공: ${totalSuccess}개 소스`);
    console.log(`❌ 실패: ${totalFailed}개 소스`);
    console.log(`📰 발견한 콘텐츠: ${totalFound}개`);
    console.log(`💾 새로 저장된 콘텐츠: ${totalNew}개`);
    console.log(`${'='.repeat(80)}\n`);

    // AI 요약은 별도 Cron (/api/summarize/batch, 매일 00:05 UTC)에서 실행
    const summaryResult = { processed: 0, success: 0, failed: 0 };
    console.log(`\nℹ️  AI 요약은 별도 Cron (00:05 UTC)에서 실행됩니다.`);

    // 크롤링 완료 후 articles 캐시 무효화
    console.log(`\n🗑️  캐시 무효화 중...`);
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);
    console.log(`✅ 캐시 무효화 완료`);

    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 전체 크롤링 완료! ${sourceId ? `(소스 ID: ${sourceId})` : ''}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`⏱️  총 소요시간: ${totalDuration}초`);
    console.log(`💾 새로 저장된 콘텐츠: ${totalNew}개`);
    console.log(`🤖 AI 요약 생성: ${summaryResult.success}개`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
      success: true,
      message: sourceId
        ? `Crawled source ${sourceId}`
        : category
          ? `Crawled ${sources.length} sources for category: ${category}`
          : `Crawled ${sources.length} sources`,
      results,
      summarization: {
        processed: summaryResult.processed,
        success: summaryResult.success,
        failed: summaryResult.failed,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[CRAWL RUN ERROR]:', message, stack);
    return NextResponse.json(
      { error: message, detail: stack?.split('\n').slice(0, 3).join(' | ') },
      { status: 500 }
    );
  }
}
