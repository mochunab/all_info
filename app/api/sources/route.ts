import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { inferCrawlerType } from '@/lib/crawlers/infer-type';
import { analyzePageStructure } from '@/lib/crawlers/auto-detect';
import type { AnalysisResult } from '@/lib/crawlers/auto-detect';
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
    const analysisResults: { url: string; method: string; confidence: number; crawlerType: string; spaDetected: boolean }[] = [];

    // 모든 URL에 대해 분석 실행 (SPA 감지는 항상 필요)
    const analysisMap = new Map<string, AnalysisResult>();
    const allUrls = sources.filter((s: { url?: string }) => s.url).map((s: { url: string }) => s.url);
    const urlsToAnalyze = allUrls;

    if (urlsToAnalyze.length > 0) {
      const analyses = await Promise.allSettled(
        urlsToAnalyze.map((url: string) => analyzePageStructure(url))
      );

      urlsToAnalyze.forEach((url: string, i: number) => {
        const result = analyses[i];
        if (result.status === 'fulfilled') {
          analysisMap.set(url, result.value);
        }
      });
    }

    for (const source of sources) {
      const { url, name, category } = source;

      if (!url) continue;

      const analysis = analysisMap.get(url);

      // Check if source already exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('crawl_sources')
        .select('id, config, crawler_type')
        .eq('base_url', url)
        .single();

      if (existing) {
        // Update existing source — selectors가 없으면 분석 결과 적용
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingConfig = (existing.config as Record<string, unknown>) || {};
        const hasSelectors = existingConfig.selectors && typeof existingConfig.selectors === 'object';

        const updatedConfig = {
          ...existingConfig,
          category,
          // selectors가 없고 분석 성공 시 적용
          ...(!hasSelectors && analysis?.selectors && { selectors: analysis.selectors }),
          ...(!hasSelectors && analysis?.pagination && { pagination: analysis.pagination }),
        };

        // SPA 감지 시 crawler_type 업데이트
        const crawlerTypeUpdate = analysis?.spaDetected && existing.crawler_type === 'STATIC'
          ? { crawler_type: 'SPA' as const }
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

        if (analysis) {
          analysisResults.push({
            url,
            method: analysis.method,
            confidence: analysis.confidence,
            crawlerType: crawlerTypeUpdate.crawler_type || existing.crawler_type,
            spaDetected: analysis.spaDetected,
          });
        }
      } else {
        // Insert new source with auto-detected crawler type + selectors
        const detectedType = inferCrawlerType(url);
        const crawlerType = analysis?.spaDetected ? 'SPA' : detectedType;

        console.log(`[SOURCES] New source: ${url} -> crawler_type: ${crawlerType} (analysis: ${analysis?.method || 'none'}, confidence: ${analysis?.confidence || 0})`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('crawl_sources')
          .insert({
            name: name || extractDomainName(url),
            base_url: url,
            crawler_type: crawlerType,
            config: {
              category,
              ...(analysis?.selectors && { selectors: analysis.selectors }),
              ...(analysis?.pagination && { pagination: analysis.pagination }),
            },
            is_active: true,
            priority: 1,
          })
          .select()
          .single();

        if (!error && data) {
          results.push(data);
        }

        if (analysis) {
          analysisResults.push({
            url,
            method: analysis.method,
            confidence: analysis.confidence,
            crawlerType,
            spaDetected: analysis.spaDetected,
          });
        }
      }
    }

    // 변경 후 캐시 무효화
    invalidateCache(CACHE_KEYS.SOURCES);

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
