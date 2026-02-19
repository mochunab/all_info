import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { invalidateCacheByPrefix, CACHE_KEYS } from '@/lib/cache';
import type { CrawlSource } from '@/types';

export const maxDuration = 300;

// Puppeteer를 사용하는 타입 — 공유 브라우저 인스턴스 보호를 위해 직렬 처리
const SPA_CRAWLER_TYPES = new Set(['SPA']);

type CrawlResultEntry = {
  source: string;
  success: boolean;
  found?: number;
  new?: number;
  error?: string;
};

/**
 * 워커 풀 기반 제한 병렬 실행
 * - queue를 shared하는 N개의 워커가 순서대로 꺼내 처리
 * - JS 단일 스레드로 queue.shift()는 race condition 없음
 */
async function runWithConcurrency(
  items: CrawlSource[],
  concurrency: number,
  fn: (source: CrawlSource) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (queue.length > 0) {
        const source = queue.shift();
        if (source) await fn(source);
      }
    }
  );
  await Promise.all(workers);
}

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

    // 동적 import로 Puppeteer 번들 포함 방지 (Vercel Serverless 호환)
    const { runCrawler } = await import('@/lib/crawlers');
    const { processPendingSummaries } = await import('@/lib/ai/batch-summarizer');

    // 타입 기반 분리
    // SPA → 직렬 (Puppeteer 공유 인스턴스 보호)
    // 나머지 → 병렬 (RSS/STATIC/SITEMAP/NEWSLETTER/PLATFORM_*/API)
    const parallelSources = sources.filter(s => !SPA_CRAWLER_TYPES.has(s.crawler_type ?? ''));
    const serialSources = sources.filter(s => SPA_CRAWLER_TYPES.has(s.crawler_type ?? ''));

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 [크롤링 시작] 총 ${sources.length}개 소스${category ? ` (카테고리: ${category})` : ''}`);
    console.log(`   📡 병렬 처리: ${parallelSources.length}개 (최대 5개 동시)`);
    console.log(`   🔄 직렬 처리: ${serialSources.length}개 (SPA/Puppeteer)`);
    console.log(`${'='.repeat(80)}`);

    const results: CrawlResultEntry[] = [];

    // 소스 1개 크롤링 실행 (log 생성/갱신 포함)
    const runSourceCrawl = async (source: CrawlSource): Promise<void> => {
      const crawlStartTime = Date.now();

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📌 [시작] ${source.name} (${source.crawler_type || 'AUTO'})`);
      console.log(`   📍 ${source.base_url}`);
      console.log(`${'─'.repeat(60)}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: log, error: logError } = await (supabase as any)
        .from('crawl_logs')
        .insert({ source_id: source.id, status: 'running' })
        .select()
        .single();

      if (logError) {
        console.error(`❌ [로그 오류] ${source.name}:`, logError);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const crawlResult = await runCrawler(source, supabase as any);
        const elapsed = ((Date.now() - crawlStartTime) / 1000).toFixed(1);

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

        console.log(`✅ [완료] ${source.name} — ${elapsed}초, 신규 ${crawlResult.new}개`);

        results.push({
          source: source.name,
          success: true,
          found: crawlResult.found,
          new: crawlResult.new,
        });
      } catch (crawlError) {
        const elapsed = ((Date.now() - crawlStartTime) / 1000).toFixed(1);
        const errorMessage = crawlError instanceof Error ? crawlError.message : 'Unknown error';

        console.error(`❌ [실패] ${source.name} — ${elapsed}초: ${errorMessage}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('crawl_logs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: errorMessage,
          })
          .eq('id', log.id);

        results.push({ source: source.name, success: false, error: errorMessage });
      }
    };

    // 1단계: 병렬 처리 (RSS/STATIC/SITEMAP/NEWSLETTER/PLATFORM_*/API) — 최대 5개 동시
    if (parallelSources.length > 0) {
      console.log(`\n📡 [병렬 처리 시작] ${parallelSources.length}개`);
      await runWithConcurrency(parallelSources, 5, runSourceCrawl);
      console.log(`📡 [병렬 처리 완료]`);
    }

    // 2단계: 직렬 처리 (SPA — Puppeteer 공유 인스턴스 보호)
    if (serialSources.length > 0) {
      console.log(`\n🔄 [직렬 처리 시작] ${serialSources.length}개 SPA 소스`);
      for (const source of serialSources) {
        await runSourceCrawl(source);
      }
      console.log(`🔄 [직렬 처리 완료]`);
    }

    // AI 배치 요약
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 [AI 요약] 배치 요약 시작...`);
    console.log(`${'='.repeat(80)}`);
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryResult = await processPendingSummaries(supabase as any, 30, supabaseKey);
    console.log(`✅ [AI 요약] ${summaryResult.success}/${summaryResult.processed}개 완료\n`);

    // 캐시 무효화
    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);

    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(1);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalFound = results.reduce((sum, r) => sum + (r.found || 0), 0);
    const totalNew = results.reduce((sum, r) => sum + (r.new || 0), 0);

    console.log(`${'='.repeat(80)}`);
    console.log(`🎉 [전체 완료] ${totalDuration}초`);
    console.log(`   소스: ${sources.length}개 (성공 ${successCount}, 실패 ${failCount})`);
    console.log(`   아티클: ${totalFound}개 발견 → ${totalNew}개 저장`);
    console.log(`   AI 요약: ${summaryResult.success}/${summaryResult.processed}개`);
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
