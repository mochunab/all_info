import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';
import { invalidateCacheByPrefix, CACHE_KEYS } from '@/lib/cache';
import type { CrawlSource } from '@/types';

export const maxDuration = 300;

const SPA_CRAWLER_TYPES = new Set(['SPA']);

type CrawlResultEntry = {
  source: string;
  success: boolean;
  found?: number;
  new?: number;
  error?: string;
};

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

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
    if (!verifyCronSecret(request)) {
      console.log('[AUTH] Unauthorized request - invalid or missing cron secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();
    const masterUserId = await getMasterUserId();

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const category = searchParams.get('category');

    console.log(`\n${'='.repeat(80)}`);
    console.log(`🚀 크롤링 시작 ${sourceId ? `(소스 ID: ${sourceId})` : category ? `(카테고리: ${category})` : '(master 소스)'}`);
    console.log(`⏰ 시작 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`👤 master user: ${masterUserId}`);
    console.log(`${'='.repeat(80)}\n`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true)
      .eq('user_id', masterUserId);

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
        message,
        results: [],
      });
    }

    const { runCrawler } = await import('@/lib/crawlers');
    const { processPendingSummaries } = await import('@/lib/ai/batch-summarizer');

    const parallelSources = sources.filter(s => !SPA_CRAWLER_TYPES.has(s.crawler_type ?? ''));
    const serialSources = sources.filter(s => SPA_CRAWLER_TYPES.has(s.crawler_type ?? ''));

    console.log(`\n📋 [소스 목록] 총 ${sources.length}개 (병렬 ${parallelSources.length}개, 직렬 ${serialSources.length}개)`);
    sources.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} (${s.crawler_type || 'AUTO'}) — ${s.base_url}`);
    });

    const results: CrawlResultEntry[] = [];

    const runSourceCrawl = async (source: CrawlSource): Promise<void> => {
      const crawlStartTime = Date.now();

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📌 [시작] ${source.name} (${source.crawler_type || 'AUTO'})`);
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

        if (crawlResult.skipped) {
          console.log(`⏭️  [SKIP] ${source.name} — 변경 없음 (${elapsed}초)`);
        } else {
          console.log(`✅ [완료] ${source.name} — ${elapsed}초, 신규 ${crawlResult.new}개`);
        }

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

    if (parallelSources.length > 0) {
      console.log(`\n📡 [병렬 처리 시작] ${parallelSources.length}개`);
      await runWithConcurrency(parallelSources, 5, runSourceCrawl);
      console.log(`📡 [병렬 처리 완료]`);
    }

    if (serialSources.length > 0) {
      console.log(`\n🔄 [직렬 처리 시작] ${serialSources.length}개 SPA 소스`);
      for (const source of serialSources) {
        await runSourceCrawl(source);
      }
      console.log(`🔄 [직렬 처리 완료]`);
    }

    // AI 배치 요약 — 크롤링 직후 실행
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🤖 [AI 요약] 배치 요약 시작...`);
    console.log(`${'='.repeat(80)}`);
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summaryResult = await processPendingSummaries(supabase as any, 30, supabaseKey);
    console.log(`✅ [AI 요약] ${summaryResult.success}/${summaryResult.processed}개 완료\n`);

    invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);

    // IndexNow: 새 콘텐츠가 있으면 검색엔진에 알림
    const totalNew = results.reduce((sum, r) => sum + (r.new || 0), 0);
    if (totalNew > 0) {
      try {
        const { submitToIndexNow } = await import('@/lib/indexnow');
        const submitted = await submitToIndexNow(['/', '/landing']);
        console.log(`🔔 IndexNow ${submitted ? '제출 완료' : '제출 실패 (키 미설정?)'}`);
      } catch { /* IndexNow 실패는 무시 */ }
    }

    const totalDuration = ((Date.now() - runStartTime) / 1000).toFixed(1);
    const totalFound = results.reduce((sum, r) => sum + (r.found || 0), 0);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`${'='.repeat(80)}`);
    console.log(`🎉 [전체 완료] ${totalDuration}초`);
    console.log(`   소스: ${sources.length}개 (성공 ${successCount}, 실패 ${failCount})`);
    console.log(`   아티클: ${totalFound}개 발견 → ${totalNew}개 저장`);
    console.log(`   AI 요약: ${summaryResult.success}/${summaryResult.processed}개`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
      success: true,
      message: sourceId
        ? `Crawled source ${sourceId}`
        : `Crawled ${sources.length} master sources`,
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
