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

    // 모든 URL에 대해 통합 전략 해석 실행 (9단계 파이프라인)
    const resolutionMap = new Map<
      string,
      Awaited<ReturnType<typeof resolveStrategy>>
    >();
    const allUrls = sources
      .filter((s: { url?: string }) => s.url)
      .map((s: { url: string }) => s.url);

    if (allUrls.length > 0) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🚀 [소스 저장] ${allUrls.length}개 URL 크롤링 타입 자동 분석 시작 (9단계 파이프라인)`);
      console.log(`${'='.repeat(80)}\n`);

      const resolutions = await Promise.allSettled(
        allUrls.map((url: string, index: number) => {
          console.log(`📍 [${index + 1}/${allUrls.length}] 분석 대기 중: ${url}`);
          return resolveStrategy(url);
        })
      );

      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📊 분석 결과 요약`);
      console.log(`${'─'.repeat(80)}`);

      allUrls.forEach((url: string, i: number) => {
        const result = resolutions[i];
        if (result.status === 'fulfilled') {
          resolutionMap.set(url, result.value);
          const method = result.value.detectionMethod;
          const confidence = (result.value.confidence * 100).toFixed(0);
          const methodLabel = {
            'domain-override': '🔧 도메인 오버라이드',
            'rss-discovery': '📡 RSS 자동 발견',
            'cms-detection': '🏗️  CMS 감지',
            'url-pattern': '🔗 URL 패턴',
            'rule-analysis': '🎯 Rule-based',
            'ai-type-detection': '🤖 AI 타입',
            'ai-selector-detection': '🤖 AI 셀렉터',
            'ai-content-detection': '🤖 AI 콘텐츠',
            'spa-detection': '⚡ SPA 감지',
            'api-detection': '🔌 API 자동 감지',
            'auto-recovery': '🔄 자동 복구',
            'firecrawl': '🔥 Firecrawl API',
            'default': '⚙️  기본값',
            'error': '❌ 오류'
          }[method] || method;

          console.log(`✅ [${i + 1}/${allUrls.length}] ${result.value.primaryStrategy}`);
          console.log(`   └─ 방법: ${methodLabel}`);
          console.log(`   └─ 신뢰도: ${confidence}%`);
        } else {
          console.error(`❌ [${i + 1}/${allUrls.length}] 분석 실패`);
          console.error(`   └─ URL: ${url}`);
          console.error(`   └─ 오류: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
        }
      });

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🎉 ${allUrls.length}개 소스 분석 완료`);
      console.log(`${'='.repeat(80)}\n`);
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`💾 [DB 저장] 소스 정보 저장 시작...`);
    console.log(`${'─'.repeat(80)}\n`);

    for (let idx = 0; idx < sources.length; idx++) {
      const source = sources[idx];
      const { url, name, category, crawlerType: userCrawlerType } = source;

      if (!url) continue;

      console.log(`📌 [${idx + 1}/${sources.length}] 처리 중: ${url}`);

      const resolution = resolutionMap.get(url);

      // URL 최적화 결과 적용
      const crawlUrl = resolution?.optimizedUrl && resolution.optimizedUrl !== url
        ? resolution.optimizedUrl
        : null;

      if (crawlUrl) {
        console.log(`   🔄 URL 최적화됨: ${url}`);
        console.log(`   ✨ 최적화된 URL: ${crawlUrl}`);
      }

      // Check if source already exists (base_url로만 검색)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('crawl_sources')
        .select('id, config, crawler_type, base_url, crawl_url')
        .eq('base_url', url)
        .single();

      if (existing) {
        console.log(`   🔄 기존 소스 업데이트 모드`);
        // Update existing source — selectors가 없으면 해석 결과 적용
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingConfig = (existing.config as Record<string, unknown>) || {};
        const hasSelectors =
          existingConfig.selectors && typeof existingConfig.selectors === 'object';

        console.log(`   📋 기존 설정 확인:`);
        console.log(`      • 기존 크롤러 타입: ${existing.crawler_type || 'N/A'}`);
        console.log(`      • 기존 셀렉터: ${hasSelectors ? '있음' : '없음'}`);

        const updatedConfig = {
          ...existingConfig,
          category,
          // selectors가 없고 해석 성공 시 적용
          ...(!hasSelectors && resolution?.selectors && { selectors: resolution.selectors }),
          ...(!hasSelectors && resolution?.excludeSelectors && { excludeSelectors: resolution.excludeSelectors }),
          ...(!hasSelectors &&
            resolution?.pagination && { pagination: resolution.pagination }),
          ...(resolution?.apiConfig && {
            crawl_config: resolution.apiConfig,
          }),
          ...(!resolution?.apiConfig && resolution?.rssUrl && {
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
        let finalCrawlerType = existing.crawler_type;
        if (userCrawlerType && userCrawlerType !== 'AUTO') {
          finalCrawlerType = userCrawlerType;
          console.log(`   ✅ 크롤러 타입: ${userCrawlerType} (사용자 지정)`);
        } else if (resolution) {
          finalCrawlerType = resolution.primaryStrategy;
          const confidence = (resolution.confidence * 100).toFixed(0);
          console.log(`   ✅ 크롤러 타입: ${resolution.primaryStrategy} (자동 감지, 신뢰도 ${confidence}%)`);
        } else {
          console.log(`   ⚙️  크롤러 타입: ${existing.crawler_type} (기존 유지)`);
        }

        const crawlerTypeUpdate = finalCrawlerType ? { crawler_type: finalCrawlerType } : {};

        // crawl_url 업데이트 (최적화된 URL이 있으면 저장)
        const crawlUrlUpdate = crawlUrl !== existing.crawl_url ? { crawl_url: crawlUrl } : {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .update({
            name: name || extractDomainName(url),
            ...crawlUrlUpdate,
            config: updatedConfig,
            ...crawlerTypeUpdate,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error && data) {
          results.push(data);
          console.log(`   ✅ 업데이트 완료\n`);
        } else {
          console.error(`   ❌ 업데이트 실패:`, error);
        }

        if (resolution) {
          analysisResults.push({
            url,
            method: resolution.detectionMethod,
            confidence: resolution.confidence,
            crawlerType: finalCrawlerType,
            spaDetected: resolution.spaDetected,
            ...(resolution.rssUrl && { rssUrl: resolution.rssUrl }),
          });
        }
      } else {
        console.log(`   ✨ 신규 소스 생성 모드`);
        // Insert new source with resolved strategy
        let crawlerType = 'SPA';
        if (userCrawlerType && userCrawlerType !== 'AUTO') {
          crawlerType = userCrawlerType;
          console.log(`   ✅ 크롤러 타입: ${userCrawlerType} (사용자 지정)`);
        } else if (resolution) {
          crawlerType = resolution.primaryStrategy;
          const confidence = (resolution.confidence * 100).toFixed(0);
          const methodLabel = {
            'domain-override': '도메인 오버라이드',
            'rss-discovery': 'RSS 자동 발견',
            'cms-detection': 'CMS 감지',
            'url-pattern': 'URL 패턴',
            'rule-analysis': 'Rule-based',
            'ai-type-detection': 'AI 타입',
            'ai-selector-detection': 'AI 셀렉터',
            'ai-content-detection': 'AI 콘텐츠',
            'spa-detection': 'SPA 감지',
            'api-detection': 'API 자동 감지',
            'auto-recovery': '자동 복구',
            'firecrawl': 'Firecrawl API',
            'default': '기본값',
            'error': '오류'
          }[resolution.detectionMethod] || resolution.detectionMethod;

          console.log(`   ✅ 크롤러 타입: ${crawlerType} (자동 감지)`);
          console.log(`   📊 감지 방법: ${methodLabel}`);
          console.log(`   📈 신뢰도: ${confidence}%`);
        } else {
          console.log(`   ⚙️  크롤러 타입: SPA (기본값)`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .insert({
            name: name || extractDomainName(url),
            base_url: url, // 사용자 입력 원본 URL
            crawl_url: crawlUrl, // 최적화된 URL (NULL 가능)
            crawler_type: crawlerType,
            config: {
              category,
              ...(resolution?.selectors && { selectors: resolution.selectors }),
              ...(resolution?.excludeSelectors && { excludeSelectors: resolution.excludeSelectors }),
              ...(resolution?.pagination && { pagination: resolution.pagination }),
              ...(resolution?.apiConfig && {
                crawl_config: resolution.apiConfig,
              }),
              ...(!resolution?.apiConfig && resolution?.rssUrl && {
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
          console.log(`   ✅ 저장 완료\n`);
        } else {
          console.error(`   ❌ 저장 실패:`, error);
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
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 소스 저장 완료 요약`);
    console.log(`${'='.repeat(80)}`);
    console.log(`💾 총 저장: ${results.length}개 소스`);

    if (analysisResults.length > 0) {
      console.log(`\n🔍 자동 분석 통계:`);
      const methodCount: Record<string, number> = {};
      const typeCount: Record<string, number> = {};

      analysisResults.forEach((result) => {
        methodCount[result.method] = (methodCount[result.method] || 0) + 1;
        typeCount[result.crawlerType] = (typeCount[result.crawlerType] || 0) + 1;
      });

      console.log(`\n📋 감지 방법별 분포:`);
      const methodLabels: Record<string, string> = {
        'rss-discovery': '📡 RSS 자동 발견',
        'cms-detection': '🏗️  CMS 감지',
        'url-pattern': '🔗 URL 패턴',
        'rule-analysis': '🎯 Rule-based',
        'ai-type-detection': '🤖 AI 타입',
        'ai-selector-detection': '🤖 AI 셀렉터',
        'api-detection': '🔌 API 자동 감지',
        'firecrawl': '🔥 Firecrawl API',
        'default': '⚙️  기본값',
        'error': '❌ 오류'
      };
      Object.entries(methodCount).forEach(([method, count]) => {
        const label = methodLabels[method] || method;
        console.log(`   ${label}: ${count}개`);
      });

      console.log(`\n🔧 크롤러 타입별 분포:`);
      Object.entries(typeCount).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}개`);
      });

      const avgConfidence =
        analysisResults.reduce((sum, r) => sum + r.confidence, 0) / analysisResults.length;
      const avgConfidencePercent = (avgConfidence * 100).toFixed(1);
      console.log(`\n📈 평균 신뢰도: ${avgConfidencePercent}%`);
    }

    console.log(`${'='.repeat(80)}\n`);

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
