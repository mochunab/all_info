import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveStrategy } from '@/lib/crawlers/strategy-resolver';
import { verifySameOrigin, verifyCronAuth } from '@/lib/auth';
import { getCache, setCache, invalidateCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

// GET /api/sources - Get all crawl sources (In-Memory cached)
export async function GET() {
  try {
    // Layer 1: In-Memory cache
    const cached = getCache<{ sources: unknown[] }>(CACHE_KEYS.SOURCES);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          'X-Cache': 'HIT',
        },
      });
    }

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

    const body = { sources: data || [] };
    setCache(CACHE_KEYS.SOURCES, body, CACHE_TTL.SOURCES);

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'X-Cache': 'MISS',
      },
    });
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
    const analysisResults: {
      url: string;
      method: string;
      confidence: number;
      crawlerType: string;
      spaDetected: boolean;
      rssUrl?: string;
    }[] = [];

    // 모든 URL에 대해 통합 전략 해석 실행
    const resolutionMap = new Map<
      string,
      Awaited<ReturnType<typeof resolveStrategy>>
    >();
    const allUrls = sources
      .filter((s: { url?: string }) => s.url)
      .map((s: { url: string }) => s.url);

    if (allUrls.length > 0) {
      console.log(`\n[POST /api/sources] 🚀 ${allUrls.length}개 소스 분석 시작...`);

      const resolutions = await Promise.allSettled(
        allUrls.map((url: string, index: number) => {
          console.log(`[POST /api/sources] 📍 [${index + 1}/${allUrls.length}] 분석 중: ${url}`);
          return resolveStrategy(url);
        })
      );

      allUrls.forEach((url: string, i: number) => {
        const result = resolutions[i];
        if (result.status === 'fulfilled') {
          resolutionMap.set(url, result.value);
          console.log(
            `[POST /api/sources] ✅ [${i + 1}/${allUrls.length}] 완료: ${result.value.primaryStrategy} (${result.value.detectionMethod})`
          );
        } else {
          console.error(
            `[POST /api/sources] ❌ [${i + 1}/${allUrls.length}] 실패: ${url}`,
            result.reason
          );
        }
      });

      console.log(`[POST /api/sources] 🎉 ${allUrls.length}개 소스 분석 완료\n`);
    }

    for (const source of sources) {
      const { url, name, category, crawlerType: userCrawlerType } = source;

      if (!url) continue;

      const resolution = resolutionMap.get(url);

      // Check if source already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('crawl_sources')
        .select('id, config, crawler_type')
        .eq('base_url', url)
        .single();

      if (existing) {
        // Update existing source — selectors가 없으면 해석 결과 적용
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingConfig = (existing.config as Record<string, unknown>) || {};
        const hasSelectors =
          existingConfig.selectors && typeof existingConfig.selectors === 'object';

        const updatedConfig = {
          ...existingConfig,
          category,
          // selectors가 없고 해석 성공 시 적용
          ...(!hasSelectors && resolution?.selectors && { selectors: resolution.selectors }),
          ...(!hasSelectors &&
            resolution?.pagination && { pagination: resolution.pagination }),
          ...(resolution?.rssUrl && {
            crawl_config: { rssUrl: resolution.rssUrl },
          }),
          // 전략 해석 메타데이터 추가
          ...(resolution && {
            _detection: {
              method: resolution.detectionMethod,
              confidence: resolution.confidence,
              fallbackStrategies: resolution.fallbackStrategies,
            },
          }),
        };

        // 사용자가 선택한 crawlerType 우선 (단, 'AUTO'면 무시하고 자동 해석 사용)
        const crawlerTypeUpdate = userCrawlerType && userCrawlerType !== 'AUTO'
          ? { crawler_type: userCrawlerType }
          : resolution
          ? { crawler_type: resolution.primaryStrategy }
          : {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .update({
            name: name || extractDomainName(url),
            config: updatedConfig,
            ...crawlerTypeUpdate,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }

        if (resolution) {
          analysisResults.push({
            url,
            method: resolution.detectionMethod,
            confidence: resolution.confidence,
            crawlerType: resolution.primaryStrategy,
            spaDetected: resolution.spaDetected,
            ...(resolution.rssUrl && { rssUrl: resolution.rssUrl }),
          });
        }
      } else {
        // Insert new source with resolved strategy
        console.log(`\n🔍 [SOURCES DEBUG] URL: ${url}`);
        console.log(`🔍 [SOURCES DEBUG] resolution 존재? ${!!resolution}`);
        console.log(`🔍 [SOURCES DEBUG] resolution?.primaryStrategy: ${resolution?.primaryStrategy}`);
        console.log(`🔍 [SOURCES DEBUG] resolution?.detectionMethod: ${resolution?.detectionMethod}`);
        console.log(`🔍 [SOURCES DEBUG] resolution?.confidence: ${resolution?.confidence}`);
        console.log(`🔍 [SOURCES DEBUG] userCrawlerType: ${userCrawlerType}`);

        // 사용자가 선택한 crawlerType 우선 (단, 'AUTO'면 무시), 없으면 해석 결과, 그것도 없으면 SPA
        const crawlerType = (userCrawlerType && userCrawlerType !== 'AUTO' ? userCrawlerType : null)
          || resolution?.primaryStrategy
          || 'SPA';

        console.log(
          `[SOURCES] New source: ${url} -> crawler_type: ${crawlerType} (user: ${userCrawlerType || 'none'}, method: ${resolution?.detectionMethod || 'none'}, confidence: ${resolution?.confidence || 0})`
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .insert({
            name: name || extractDomainName(url),
            base_url: url,
            crawler_type: crawlerType,
            config: {
              category,
              ...(resolution?.selectors && { selectors: resolution.selectors }),
              ...(resolution?.pagination && { pagination: resolution.pagination }),
              ...(resolution?.rssUrl && {
                crawl_config: { rssUrl: resolution.rssUrl },
              }),
              // 전략 해석 메타데이터
              ...(resolution && {
                _detection: {
                  method: resolution.detectionMethod,
                  confidence: resolution.confidence,
                  fallbackStrategies: resolution.fallbackStrategies,
                },
              }),
            },
            is_active: true,
            priority: 1,
          })
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }

        if (resolution) {
          analysisResults.push({
            url,
            method: resolution.detectionMethod,
            confidence: resolution.confidence,
            crawlerType,
            spaDetected: resolution.spaDetected,
            ...(resolution.rssUrl && { rssUrl: resolution.rssUrl }),
          });
        }
      }
    }

    // 변경 후 캐시 무효화
    invalidateCache(CACHE_KEYS.SOURCES);

    // Next.js 캐시 무효화 (Server Component 페이지 재렌더링)
    revalidatePath('/sources/add');

    // 요약 로그
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[POST /api/sources] 📊 소스 저장 완료 요약`);
    console.log(`${'='.repeat(60)}`);
    console.log(`총 소스: ${results.length}개`);

    if (analysisResults.length > 0) {
      console.log(`\n분석 결과:`);
      const methodCount: Record<string, number> = {};
      const typeCount: Record<string, number> = {};

      analysisResults.forEach((result) => {
        methodCount[result.method] = (methodCount[result.method] || 0) + 1;
        typeCount[result.crawlerType] = (typeCount[result.crawlerType] || 0) + 1;
      });

      console.log(`감지 방법별:`);
      Object.entries(methodCount).forEach(([method, count]) => {
        console.log(`  - ${method}: ${count}개`);
      });

      console.log(`\n크롤러 타입별:`);
      Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}개`);
      });

      const avgConfidence =
        analysisResults.reduce((sum, r) => sum + r.confidence, 0) / analysisResults.length;
      console.log(`\n평균 신뢰도: ${(avgConfidence * 100).toFixed(1)}%`);
    }

    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      sources: results,
      analysis: analysisResults,
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
