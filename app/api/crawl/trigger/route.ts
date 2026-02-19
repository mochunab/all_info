import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { invalidateCacheByPrefix, CACHE_KEYS } from '@/lib/cache';
import type { CrawlSource } from '@/types';

export async function POST(request: NextRequest) {
  const runStartTime = Date.now();

  try {
    // 요청 body에서 category 파라미터 추출
    let category: string | undefined;
    try {
      const body = await request.json();
      category = body.category;
    } catch {
      // body가 없거나 JSON 파싱 실패 시 무시
    }

    const supabase = createServiceClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // 특정 카테고리가 지정된 경우 config->>'category' 필터 적용
    if (category) {
      query = query.eq('config->>category', category);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📂 [크롤링 필터] 카테고리 필터 적용: "${category}"`);
      console.log(`${'='.repeat(80)}\n`);
    }

    const { data: sourcesData, error: sourcesError } = await query;

    if (sourcesError) {
      console.error(`\n❌ [크롤링 오류] 소스 목록 조회 실패:`, sourcesError);
      return NextResponse.json(
        { error: 'Failed to fetch crawl sources' },
        { status: 500 }
      );
    }

    const sources = sourcesData as CrawlSource[] | null;

    if (!sources || sources.length === 0) {
      console.log(`\n⚠️  [크롤링 알림] 활성화된 소스가 없습니다${category ? ` (카테고리: ${category})` : ''}\n`);
      return NextResponse.json({
        success: true,
        message: category
          ? `No active crawl sources found for category: ${category}`
          : 'No active crawl sources found',
        results: [],
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 [크롤링 시작] 총 ${sources.length}개 소스${category ? ` (카테고리: ${category})` : ''}`);
    console.log(`${'='.repeat(80)}`);

    // 동적 import로 Puppeteer 번들 포함 방지 (Vercel Serverless 호환)
    const { runCrawler } = await import('@/lib/crawlers');
    const { processPendingSummaries } = await import('@/lib/ai/batch-summarizer');

    const results = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const sourceNum = i + 1;

      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📌 [${sourceNum}/${sources.length}] 크롤링 대상: ${source.name}`);
      console.log(`   📍 URL: ${source.base_url}`);
      console.log(`   🔧 타입: ${source.crawler_type || 'AUTO'}`);
      console.log(`   ⏰ 시작: ${new Date().toLocaleString('ko-KR')}`);
      console.log(`${'─'.repeat(80)}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: log, error: logError } = await (supabase as any)
        .from('crawl_logs')
        .insert({ source_id: source.id, status: 'running' })
        .select()
        .single();

      if (logError) {
        console.error(`\n❌ [로그 오류] ${source.name} 크롤링 로그 생성 실패:`, logError);
        continue;
      }

      const crawlStartTime = Date.now();
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crawlResult = await runCrawler(source, supabase as any);
        const crawlDuration = ((Date.now() - crawlStartTime) / 1000).toFixed(2);

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

        console.log(`\n${'='.repeat(80)}`);
        console.log(`✅ 크롤링 완료: ${source.name}`);
        console.log(`${'='.repeat(80)}`);
        console.log(`⏱️  소요시간: ${crawlDuration}초`);
        console.log(`📊 발견: ${crawlResult.found}개`);
        console.log(`💾 저장: ${crawlResult.new}개`);
        console.log(`⏭️  건너뜀: ${crawlResult.found - crawlResult.new}개 (중복)`);
        console.log(`${'='.repeat(80)}\n`);

        results.push({
          source: source.name,
          success: true,
          found: crawlResult.found,
          new: crawlResult.new,
        });
      } catch (crawlError) {
        const crawlDuration = ((Date.now() - crawlStartTime) / 1000).toFixed(2);
        const errorMessage = crawlError instanceof Error ? crawlError.message : 'Unknown error';

        console.error(`\n${'='.repeat(80)}`);
        console.error(`❌ 크롤링 실패: ${source.name}`);
        console.error(`${'='.repeat(80)}`);
        console.error(`⏱️  소요시간: ${crawlDuration}초`);
        console.error(`💥 오류: ${errorMessage}`);
        console.error(`${'='.repeat(80)}\n`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('crawl_logs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq('id', log.id);

        results.push({
          source: source.name,
          success: false,
          error: errorMessage,
        });
      }
    }

    // 배치 요약 실행
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 [AI 요약] 배치 요약 시작...`);
    console.log(`${'='.repeat(80)}`);
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryResult = await processPendingSummaries(supabase as any, 30, supabaseKey);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ [AI 요약] 배치 요약 완료`);
    console.log(`${'='.repeat(80)}`);
    console.log(`📊 처리: ${summaryResult.processed}개`);
    console.log(`✅ 성공: ${summaryResult.success}개`);
    console.log(`❌ 실패: ${summaryResult.failed}개`);
    console.log(`${'='.repeat(80)}\n`);

    // 크롤링 완료 후 articles 캐시 무효화
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);

    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(2);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalFound = results.reduce((sum, r) => sum + (r.found || 0), 0);
    const totalNew = results.reduce((sum, r) => sum + (r.new || 0), 0);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 [크롤링 전체 완료]`);
    console.log(`${'='.repeat(80)}`);
    console.log(`⏱️  총 소요시간: ${totalDuration}초`);
    console.log(`📊 소스: ${sources.length}개 (성공: ${successCount}, 실패: ${failCount})`);
    console.log(`📰 아티클: ${totalFound}개 발견 → ${totalNew}개 신규 저장`);
    console.log(`🤖 AI 요약: ${summaryResult.success}/${summaryResult.processed}개 완료`);
    console.log(`${'='.repeat(80)}\n`);

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[TRIGGER] Error:', message, stack);
    return NextResponse.json(
      { error: message, detail: stack?.split('\n').slice(0, 3).join(' | ') },
      { status: 500 }
    );
  }
}
