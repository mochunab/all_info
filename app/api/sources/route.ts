import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolveStrategy } from '@/lib/crawlers/strategy-resolver';
import { verifySameOrigin, verifyCronAuth } from '@/lib/auth';
import { getCache, setCache, invalidateCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
import { getMasterUserId } from '@/lib/user';

// GET /api/sources - Get all crawl sources (In-Memory cached)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userIdParam = searchParams.get('user_id') || '';
    const effectiveUserId = userIdParam || await getMasterUserId();

    const cacheKey = `${CACHE_KEYS.SOURCES}:${effectiveUserId}`;

    // Layer 1: In-Memory cache
    const cached = getCache<{ sources: unknown[] }>(cacheKey);
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
      .eq('user_id', effectiveUserId)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching sources:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const body = { sources: data || [] };
    setCache(cacheKey, body, CACHE_TTL.SOURCES);

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

    // 로그인된 유저 확인
    const authClient = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (authClient as any).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
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

    // 삭제 요청된 소스 처리 (scoped to user)
    if (deleteIds && Array.isArray(deleteIds) && deleteIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('crawl_sources')
        .delete()
        .eq('user_id', user.id)
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

    // 1단계: 기존 소스 일괄 조회 (N개 개별 SELECT → 1개 배치 SELECT)
    const allUrls = sources
      .filter((s: { url?: string }) => s.url)
      .map((s: { url: string }) => s.url.trim());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingSourcesData } = await (supabase as any)
      .from('crawl_sources')
      .select('id, config, crawler_type, base_url, crawl_url')
      .eq('user_id', user.id)
      .in('base_url', allUrls);

    type ExistingSource = {
      id: number;
      config: Record<string, unknown>;
      crawler_type: string;
      base_url: string;
      crawl_url: string | null;
    };
    const existingMap = new Map<string, ExistingSource>(
      (existingSourcesData || []).map((s: ExistingSource) => [s.base_url, s])
    );

    // 2단계: 분석이 필요한 URL만 필터링
    // - 신규 소스 (DB에 없음)
    // - 크롤러 타입이 AUTO이거나 미지정인 소스 (재분석 요청)
    const urlsNeedingAnalysis = sources
      .filter((s: { url?: string; crawlerType?: string }) =>
        s.url && (
          !existingMap.has(s.url.trim()) ||
          !s.crawlerType ||
          s.crawlerType === 'AUTO'
        )
      )
      .map((s: { url: string }) => s.url.trim());

    // 3단계: 필요한 URL만 전략 해석 실행 (9단계 파이프라인)
    const resolutionMap = new Map<
      string,
      Awaited<ReturnType<typeof resolveStrategy>>
    >();

    if (urlsNeedingAnalysis.length > 0) {
      const skippedCount = allUrls.length - urlsNeedingAnalysis.length;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🚀 [소스 저장] ${urlsNeedingAnalysis.length}개 URL 크롤링 타입 자동 분석 시작 (9단계 파이프라인)`);
      if (skippedCount > 0) {
        console.log(`⏭️  ${skippedCount}개 기존 소스 분석 스킵 (크롤러 타입 이미 지정됨)`);
      }
      console.log(`${'='.repeat(80)}\n`);

      const resolutions = await Promise.allSettled(
        urlsNeedingAnalysis.map((url: string, index: number) => {
          console.log(`📍 [${index + 1}/${urlsNeedingAnalysis.length}] 분석 대기 중: ${url}`);
          return resolveStrategy(url);
        })
      );

      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📊 분석 결과 요약`);
      console.log(`${'─'.repeat(80)}`);

      urlsNeedingAnalysis.forEach((url: string, i: number) => {
        const result = resolutions[i];
        if (result.status === 'fulfilled') {
          resolutionMap.set(url, result.value);
          const method = result.value.detectionMethod;
          const confidence = (result.value.confidence * 100).toFixed(0);
          const methodLabel = {
            'domain-override': '🔧 도메인 오버라이드',
            'rss-discovery': '📡 RSS 자동 발견',
            'sitemap-discovery': '🗺️ Sitemap 자동 발견',
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

          console.log(`✅ [${i + 1}/${urlsNeedingAnalysis.length}] ${result.value.primaryStrategy}`);
          console.log(`   └─ 방법: ${methodLabel}`);
          console.log(`   └─ 신뢰도: ${confidence}%`);
        } else {
          console.error(`❌ [${i + 1}/${urlsNeedingAnalysis.length}] 분석 실패`);
          console.error(`   └─ URL: ${url}`);
          console.error(`   └─ 오류: ${result.reason instanceof Error ? result.reason.message : result.reason}`);
        }
      });

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🎉 ${urlsNeedingAnalysis.length}개 소스 분석 완료`);
      console.log(`${'='.repeat(80)}\n`);
    }

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`💾 [DB 저장] 소스 정보 저장 시작...`);
    console.log(`${'─'.repeat(80)}\n`);

    // 소스를 스킵/업데이트/신규로 분류 (DB 호출 전 사전 처리)
    type UpdateTask = {
      idx: number;
      url: string;
      existing: ExistingSource;
      resolution: Awaited<ReturnType<typeof resolveStrategy>> | undefined;
      newName: string;
      finalCrawlerType: string;
      crawlUrl: string | null;
      updatedConfig: Record<string, unknown>;
      crawlUrlChanged: boolean;
    };
    type InsertTask = {
      idx: number;
      url: string;
      resolution: Awaited<ReturnType<typeof resolveStrategy>> | undefined;
      newName: string;
      crawlerType: string;
      crawlUrl: string | null;
    };

    const skipped: { id: number; base_url: string }[] = [];
    const updateTasks: UpdateTask[] = [];
    const insertTasks: InsertTask[] = [];

    for (let idx = 0; idx < sources.length; idx++) {
      const source = sources[idx];
      const { url, name, category, crawlerType: userCrawlerType } = source;
      if (!url) continue;

      const resolution = resolutionMap.get(url);
      const crawlUrl = resolution?.optimizedUrl && resolution.optimizedUrl !== url
        ? resolution.optimizedUrl
        : null;
      const existing = existingMap.get(url) || null;

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingConfig = (existing.config as Record<string, unknown>) || {};
        const hasSelectors =
          existingConfig.selectors && typeof existingConfig.selectors === 'object';

        const updatedConfig = {
          ...existingConfig,
          category,
          ...(!hasSelectors && resolution?.selectors && { selectors: resolution.selectors }),
          ...(!hasSelectors && resolution?.excludeSelectors && { excludeSelectors: resolution.excludeSelectors }),
          ...(!hasSelectors && resolution?.pagination && { pagination: resolution.pagination }),
          ...(resolution?.apiConfig && { crawl_config: resolution.apiConfig }),
          ...(!resolution?.apiConfig && resolution?.rssUrl && { crawl_config: { rssUrl: resolution.rssUrl } }),
          ...(resolution && {
            _detection: {
              method: resolution.detectionMethod,
              confidence: resolution.confidence,
              fallbackStrategies: resolution.fallbackStrategies,
            },
          }),
        };

        let finalCrawlerType = existing.crawler_type;
        if (userCrawlerType && userCrawlerType !== 'AUTO') {
          finalCrawlerType = userCrawlerType;
        } else if (resolution) {
          finalCrawlerType = resolution.primaryStrategy;
        }

        const newCrawlUrl = crawlUrl !== existing.crawl_url ? crawlUrl : existing.crawl_url;
        const crawlerTypeChanged = finalCrawlerType !== existing.crawler_type;
        const crawlUrlChanged = newCrawlUrl !== existing.crawl_url;
        const configChanged = JSON.stringify(updatedConfig) !== JSON.stringify(existingConfig);
        const hasChanges = crawlerTypeChanged || crawlUrlChanged || configChanged;

        if (!hasChanges && !resolution) {
          skipped.push({ id: existing.id, base_url: url });
        } else {
          updateTasks.push({
            idx, url, existing, resolution,
            newName: name || extractDomainName(url),
            finalCrawlerType, crawlUrl: newCrawlUrl,
            updatedConfig, crawlUrlChanged,
          });
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
        let crawlerType = 'SPA';
        if (userCrawlerType && userCrawlerType !== 'AUTO') {
          crawlerType = userCrawlerType;
        } else if (resolution) {
          crawlerType = resolution.primaryStrategy;
        }

        insertTasks.push({
          idx, url, resolution,
          newName: name || extractDomainName(url),
          crawlerType, crawlUrl,
        });

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

    // 스킵 로그
    if (skipped.length > 0) {
      console.log(`⏭️  ${skipped.length}개 변경 없음 (DB 스킵): ${skipped.map(s => s.base_url).slice(0, 3).join(', ')}${skipped.length > 3 ? ` 외 ${skipped.length - 3}개` : ''}\n`);
    }

    // DB 작업 병렬 실행 (UPDATE + INSERT 동시)
    const dbOperations = [
      ...updateTasks.map(async (task) => {
        const { url, existing, resolution, newName, finalCrawlerType, updatedConfig, crawlUrlChanged } = task;
        const crawlUrl = task.crawlUrl;

        if (crawlUrl && crawlUrl !== existing.crawl_url) {
          console.log(`   🔄 [업데이트] ${url} → URL 최적화됨: ${crawlUrl}`);
        }

        const crawlerTypeUpdate = finalCrawlerType ? { crawler_type: finalCrawlerType } : {};
        const crawlUrlUpdate = crawlUrlChanged ? { crawl_url: crawlUrl } : {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .update({
            name: newName,
            ...crawlUrlUpdate,
            config: updatedConfig,
            ...crawlerTypeUpdate,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error && data) {
          if (resolution) {
            const confidence = (resolution.confidence * 100).toFixed(0);
            console.log(`   ✅ [업데이트] ${url} → ${finalCrawlerType} (자동 감지, 신뢰도 ${confidence}%)`);
          } else {
            console.log(`   ✅ [업데이트] ${url}`);
          }
          return data;
        } else {
          console.error(`   ❌ [업데이트 실패] ${url}:`, error);
          return null;
        }
      }),
      ...insertTasks.map(async (task) => {
        const { url, resolution, newName, crawlerType, crawlUrl } = task;

        const methodLabel = resolution ? ({
          'domain-override': '도메인 오버라이드',
          'rss-discovery': 'RSS 자동 발견',
          'sitemap-discovery': 'Sitemap 자동 발견',
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
        }[resolution.detectionMethod] || resolution.detectionMethod) : null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .insert({
            name: newName,
            base_url: url,
            crawl_url: crawlUrl,
            crawler_type: crawlerType,
            config: {
              category: sources.find((s: { url: string }) => s.url === url)?.category,
              ...(resolution?.selectors && { selectors: resolution.selectors }),
              ...(resolution?.excludeSelectors && { excludeSelectors: resolution.excludeSelectors }),
              ...(resolution?.pagination && { pagination: resolution.pagination }),
              ...(resolution?.apiConfig && { crawl_config: resolution.apiConfig }),
              ...(!resolution?.apiConfig && resolution?.rssUrl && { crawl_config: { rssUrl: resolution.rssUrl } }),
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
            user_id: user.id,
          })
          .select()
          .single();

        if (!error && data) {
          if (resolution) {
            const confidence = (resolution.confidence * 100).toFixed(0);
            console.log(`   ✅ [신규] ${url} → ${crawlerType} (${methodLabel}, 신뢰도 ${confidence}%)`);
          } else {
            console.log(`   ✅ [신규] ${url} → ${crawlerType}`);
          }
          return data;
        } else {
          console.error(`   ❌ [신규 실패] ${url}:`, error);
          return null;
        }
      }),
    ];

    const dbResults = await Promise.allSettled(dbOperations);
    for (const entry of dbResults) {
      if (entry.status === 'fulfilled' && entry.value) {
        results.push(entry.value);
      }
    }
    // 스킵된 소스도 results에 포함
    for (const s of skipped) {
      results.push({ id: s.id, base_url: s.base_url, skipped: true });
    }

    // 변경 후 캐시 무효화
    invalidateCache(`${CACHE_KEYS.SOURCES}:${user.id}`);

    // Next.js 캐시 무효화 (Server Component 페이지 재렌더링)
    revalidatePath('/sources/add');

    // 요약 로그
    const skippedCount = results.filter((r: Record<string, unknown>) => r.skipped).length;
    const savedCount = results.length - skippedCount;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 소스 저장 완료 요약`);
    console.log(`${'='.repeat(80)}`);
    console.log(`💾 총 처리: ${results.length}개 소스 (저장: ${savedCount}개, 스킵: ${skippedCount}개)`);

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
