// 범용 크롤러 메인 모듈
// 전략 패턴 기반 크롤링 시스템

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { CrawlSource } from '@/types';
import type { CrawlerType, CrawlResult, CrawledArticle, RawContentItem } from './types';
import { parseConfig } from './types';
import { getStrategy, inferCrawlerType, closeBrowser, isValidCrawlerType } from './strategies';
import { parseDateToISO } from './date-parser';
import { generateSourceId } from '@/lib/utils';
import { filterGarbageArticles, getQualityStats } from './quality-filter';

// Legacy imports for backward compatibility
import { crawlWithCheerio, fetchArticleContent } from './cheerio-crawler';
import { crawlWithPlaywright } from './playwright-crawler';

// Site-specific crawlers (레거시)
import { crawlIconsumer } from './sites/iconsumer';
import { crawlBrunch } from './sites/brunch';
import { crawlWiseapp } from './sites/wiseapp';
import { crawlOpenads } from './sites/openads';
import { crawlRetailtalk } from './sites/retailtalk';
import { crawlStonebc } from './sites/stonebc';
import { crawlBuybrand } from './sites/buybrand';

// Legacy crawler registry
const LEGACY_CRAWLER_REGISTRY: Record<string, (source: CrawlSource) => Promise<CrawledArticle[]>> = {
  '아이컨슈머': crawlIconsumer,
  '브런치-모비인사이드': crawlBrunch,
  '브런치-스타트업': crawlBrunch,
  '브런치-트렌드미디엄': crawlBrunch,
  '와이즈앱': crawlWiseapp,
  '오픈애즈': crawlOpenads,
  '리테일톡': crawlRetailtalk,
  '스톤브릿지': crawlStonebc,
  '바이브랜드': crawlBuybrand,
};

/**
 * RawContentItem을 CrawledArticle로 변환
 */
function convertToArticle(
  item: RawContentItem,
  source: CrawlSource,
  category?: string
): CrawledArticle {
  return {
    source_id: generateSourceId(item.link),
    source_name: source.name,
    source_url: item.link,
    title: item.title,
    thumbnail_url: item.thumbnail || undefined,
    content_preview: item.content,
    author: item.author || undefined,
    published_at: parseDateToISO(item.dateStr),
    category: category || parseConfig(source).category,
  };
}

/**
 * 크롤링 결과 품질 검증
 */
type ValidationResult = {
  passed: boolean;
  reason?: string;
  stats?: {
    total: number;
    valid: number;
    garbageRatio: number;
    uniqueTitles: number;
    uniqueUrls: number;
  };
};

function validateCrawlResults(items: RawContentItem[]): ValidationResult {
  // 0건 → 실패
  if (items.length === 0) {
    return { passed: false, reason: 'No items found' };
  }

  // 품질 통계 계산
  const qualityStats = getQualityStats(items);

  // 쓰레기 비율 > 50% → 실패
  if (qualityStats.garbageRatio > 0.5) {
    return {
      passed: false,
      reason: `High garbage ratio: ${(qualityStats.garbageRatio * 100).toFixed(1)}%`,
      stats: {
        total: qualityStats.total,
        valid: qualityStats.valid,
        garbageRatio: qualityStats.garbageRatio,
        uniqueTitles: 0,
        uniqueUrls: 0,
      },
    };
  }

  // 유효 아이템 < 2건 → 실패
  if (qualityStats.valid < 2) {
    return {
      passed: false,
      reason: `Insufficient valid items: ${qualityStats.valid}`,
      stats: {
        total: qualityStats.total,
        valid: qualityStats.valid,
        garbageRatio: qualityStats.garbageRatio,
        uniqueTitles: 0,
        uniqueUrls: 0,
      },
    };
  }

  // 제목 다양성 검사
  const titles = items.map((item) => item.title.toLowerCase().trim());
  const uniqueTitles = new Set(titles).size;
  const titleDiversity = uniqueTitles / items.length;

  if (titleDiversity < 0.5) {
    return {
      passed: false,
      reason: `Low title diversity: ${(titleDiversity * 100).toFixed(1)}%`,
      stats: {
        total: qualityStats.total,
        valid: qualityStats.valid,
        garbageRatio: qualityStats.garbageRatio,
        uniqueTitles,
        uniqueUrls: 0,
      },
    };
  }

  // URL 다양성 검사
  const urls = items.map((item) => item.link.toLowerCase().trim());
  const uniqueUrls = new Set(urls).size;
  const urlDiversity = uniqueUrls / items.length;

  if (urlDiversity < 0.5) {
    return {
      passed: false,
      reason: `Low URL diversity: ${(urlDiversity * 100).toFixed(1)}%`,
      stats: {
        total: qualityStats.total,
        valid: qualityStats.valid,
        garbageRatio: qualityStats.garbageRatio,
        uniqueTitles,
        uniqueUrls,
      },
    };
  }

  // 모든 검증 통과
  return {
    passed: true,
    stats: {
      total: qualityStats.total,
      valid: qualityStats.valid,
      garbageRatio: qualityStats.garbageRatio,
      uniqueTitles,
      uniqueUrls,
    },
  };
}

/**
 * 크롤러 타입별 기본 폴백 체인
 */
function getDefaultFallbacks(primaryType: CrawlerType): CrawlerType[] {
  switch (primaryType) {
    case 'RSS':
      return ['STATIC', 'SPA'];
    case 'SPA':
      return ['STATIC'];
    case 'STATIC':
      return ['SPA'];
    case 'PLATFORM_NAVER':
    case 'PLATFORM_KAKAO':
    case 'NEWSLETTER':
      return ['STATIC', 'SPA'];
    case 'API':
      return ['STATIC'];
    default:
      return ['SPA'];
  }
}

/**
 * 전략 패턴 기반 크롤링 실행 (폴백 체인 + 품질 검증)
 */
async function crawlWithStrategy(source: CrawlSource): Promise<CrawledArticle[]> {
  const config = parseConfig(source);

  // 1. Primary 전략 결정
  const inferred = inferCrawlerType(source.base_url);
  const isLegacyType = source.crawler_type === 'static' || source.crawler_type === 'dynamic';
  const primaryType = isLegacyType
    ? inferred
    : ((source.crawler_type as CrawlerType) || inferred);

  // 2. Fallback 체인 구성
  const fallbacks = config._detection?.fallbackStrategies || getDefaultFallbacks(primaryType);
  const strategyChain = [primaryType, ...fallbacks].filter(
    (type, index, arr) => arr.indexOf(type) === index
  ); // 중복 제거

  console.log(`[CRAWL] Strategy chain: ${strategyChain.join(' → ')}`);

  // 3. 체인 순회 (각 전략 30초 타임아웃)
  for (let i = 0; i < strategyChain.length; i++) {
    const strategyType = strategyChain[i];
    const isFallback = i > 0;

    console.log(
      `[CRAWL] ${isFallback ? 'Fallback' : 'Primary'} strategy: ${strategyType} (${i + 1}/${strategyChain.length})`
    );

    try {
      // 전략 가져오기
      const strategy = getStrategy(strategyType);

      // 타임아웃 설정 (30초)
      const timeoutPromise = new Promise<RawContentItem[]>((_, reject) =>
        setTimeout(() => reject(new Error('Strategy timeout (30s)')), 30000)
      );

      const crawlPromise = strategy.crawlList(source);

      // 목록 크롤링 (타임아웃 적용)
      const rawItems = await Promise.race([crawlPromise, timeoutPromise]);

      console.log(`[CRAWL] ${strategyType} found ${rawItems.length} items`);

      // 4. 품질 검증
      const validation = validateCrawlResults(rawItems);

      if (!validation.passed) {
        console.warn(
          `[CRAWL] ${strategyType} validation failed: ${validation.reason}`,
          validation.stats
        );

        // 마지막 전략이면 빈 배열 반환
        if (i === strategyChain.length - 1) {
          console.error(`[CRAWL] All strategies failed for ${source.name}`);
          return [];
        }

        // 다음 전략 시도
        continue;
      }

      console.log(`[CRAWL] ${strategyType} validation passed`, validation.stats);

      // 5. 본문 크롤링
      const articles: CrawledArticle[] = [];

      for (const item of rawItems) {
        if (!item.content && strategy.crawlContent) {
          try {
            const result = await strategy.crawlContent(item.link, config.content_selectors);

            if (typeof result === 'string') {
              item.content = result;
            } else {
              item.content = result.content;
              if (!item.thumbnail && result.thumbnail) {
                item.thumbnail = result.thumbnail;
              }
            }
          } catch (error) {
            console.error(`[CRAWL] Content fetch error for ${item.link}:`, error);
          }

          await new Promise((resolve) => setTimeout(resolve, config.crawl_config?.delay || 500));
        }

        articles.push(convertToArticle(item, source, config.category));
      }

      // 6. 쓰레기 필터 적용
      const filtered = filterGarbageArticles(articles, source.name);

      console.log(`[CRAWL] ${strategyType} success: ${filtered.length} valid articles`);
      return filtered;
    } catch (error) {
      console.error(`[CRAWL] ${strategyType} error:`, error);

      // 마지막 전략이면 빈 배열 반환
      if (i === strategyChain.length - 1) {
        console.error(`[CRAWL] All strategies failed for ${source.name}`);
        return [];
      }

      // 다음 전략 시도
      continue;
    }
  }

  // 모든 전략 실패
  console.error(`[CRAWL] All strategies exhausted for ${source.name}`);
  return [];
}

/**
 * 크롤러 선택 (전략 패턴 우선, 레거시 폴백)
 */
function getCrawler(source: CrawlSource): (source: CrawlSource) => Promise<CrawledArticle[]> {
  // 1. URL 기반으로 최적 전략 추론
  const inferred = inferCrawlerType(source.base_url);
  console.log(`[CRAWL] Inferred strategy: ${inferred} (from URL)`);

  // 2. 새 전략 패턴 사용 (추론된 타입 or crawler_type이 유효한 경우)
  if (isValidCrawlerType(inferred)) {
    return crawlWithStrategy;
  }

  // 3. crawler_type이 명시적으로 유효한 경우
  if (source.crawler_type && isValidCrawlerType(source.crawler_type)) {
    return crawlWithStrategy;
  }

  // 4. 레거시 폴백 (사이트별 크롤러)
  if (LEGACY_CRAWLER_REGISTRY[source.name]) {
    console.log(`[CRAWL] Falling back to legacy crawler for: ${source.name}`);
    return LEGACY_CRAWLER_REGISTRY[source.name];
  }

  // 5. 기본값: 전략 패턴
  return crawlWithStrategy;
}

/**
 * 아티클 저장
 */
export async function saveArticles(
  articles: CrawledArticle[],
  supabase: SupabaseClient<Database>
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      // source_id 기준 중복 확인
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('articles')
        .select('id')
        .eq('source_id', article.source_id)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // 새 아티클 저장
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('articles').insert({
        source_id: article.source_id,
        source_name: article.source_name,
        source_url: article.source_url,
        title: article.title,
        thumbnail_url: article.thumbnail_url,
        content_preview: article.content_preview,
        summary: article.summary,
        author: article.author,
        published_at: article.published_at,
        category: article.category,
      });

      if (error) {
        console.error(`[SAVE] Error saving ${article.title}:`, error);
      } else {
        saved++;
        console.log(`[SAVE] Saved: ${article.title.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error(`[SAVE] Error:`, error);
    }
  }

  return { saved, skipped };
}

/**
 * 단일 소스 크롤링 실행
 */
export async function runCrawler(
  source: CrawlSource,
  supabase: SupabaseClient<Database>,
  options?: { dryRun?: boolean; verbose?: boolean }
): Promise<CrawlResult> {
  const result: CrawlResult = {
    found: 0,
    new: 0,
    errors: [],
  };

  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[CRAWL START] ${source.name}`);
    console.log(`URL: ${source.base_url}`);
    console.log(`Type: ${source.crawler_type || 'auto'}`);
    console.log(`Time: ${new Date().toISOString()}`);
    if (options?.dryRun) console.log(`Mode: DRY RUN (no DB writes)`);
    console.log(`${'='.repeat(60)}\n`);

    // 크롤러 선택 및 실행
    const crawler = getCrawler(source);
    console.log(`[CRAWL] Crawler: ${crawler.name || 'strategy-based'}`);

    // 크롤링 실행
    console.log(`[CRAWL] Fetching articles...`);
    const articles = await crawler(source);
    result.found = articles.length;
    console.log(`[CRAWL] Found ${articles.length} articles`);

    if (articles.length === 0) {
      console.log(`[CRAWL] No articles found for ${source.name}`);
      return result;
    }

    // 본문 미리보기 가져오기 (레거시 크롤러용)
    for (const article of articles) {
      if (!article.content_preview) {
        try {
          const content = await fetchArticleContent(article.source_url);
          if (content) {
            article.content_preview = content.substring(0, 3000);
          }
        } catch (error) {
          if (options?.verbose) {
            console.error(`[CRAWL] Content fetch error for ${article.title}:`, error);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // DB 저장 (dry-run이 아닌 경우)
    if (!options?.dryRun) {
      console.log(`[CRAWL] Saving ${articles.length} articles...`);
      const { saved, skipped } = await saveArticles(articles, supabase);
      result.new = saved;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[CRAWL COMPLETE] ${source.name}`);
      console.log(`Duration: ${duration}s`);
      console.log(`Found: ${result.found} | Saved: ${result.new} | Skipped: ${skipped}`);
      console.log(`${'='.repeat(60)}\n`);
    } else {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[DRY RUN COMPLETE] ${source.name}`);
      console.log(`Duration: ${duration}s`);
      console.log(`Would save: ${result.found} articles`);
      if (options?.verbose) {
        console.log('\nArticles:');
        articles.forEach((a, i) => {
          console.log(`  ${i + 1}. ${a.title}`);
          console.log(`     URL: ${a.source_url}`);
          console.log(`     Date: ${a.published_at || 'N/A'}`);
        });
      }
      console.log(`${'='.repeat(60)}\n`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    console.error(`[CRAWL ERROR] ${source.name}:`, error);
    if (options?.verbose && error instanceof Error) {
      console.error(`[CRAWL ERROR] Stack:`, error.stack);
    }
  }

  return result;
}

/**
 * 모든 활성 소스 크롤링 실행
 */
export async function runAllCrawlers(
  supabase: SupabaseClient<Database>,
  options?: { dryRun?: boolean; verbose?: boolean }
): Promise<{ source: string; result: CrawlResult }[]> {
  const results: { source: string; result: CrawlResult }[] = [];

  try {
    // 활성 소스 목록 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sourcesData, error } = await (supabase as any)
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error || !sourcesData) {
      console.error('[CRAWL] Failed to fetch crawl sources:', error);
      return results;
    }

    const sources = sourcesData as CrawlSource[];
    console.log(`[CRAWL] Found ${sources.length} active sources\n`);

    for (const source of sources) {
      const result = await runCrawler(source, supabase, options);
      results.push({ source: source.name, result });

      // last_crawled_at 업데이트 (dry-run이 아닌 경우)
      if (!options?.dryRun) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('crawl_sources')
          .update({ last_crawled_at: new Date().toISOString() })
          .eq('id', source.id);
      }

      // 소스 간 딜레이
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // 브라우저 정리 (SPA 크롤러 사용 시)
    await closeBrowser();
  } catch (error) {
    console.error('[CRAWL] Fatal error:', error);
    await closeBrowser();
  }

  // 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('[CRAWL SUMMARY]');
  console.log(`${'='.repeat(60)}`);

  let totalFound = 0;
  let totalNew = 0;
  let totalErrors = 0;

  for (const { source, result } of results) {
    totalFound += result.found;
    totalNew += result.new;
    totalErrors += result.errors.length;
    const status = result.errors.length > 0 ? '❌' : result.new > 0 ? '✅' : '⚪';
    console.log(`${status} ${source}: ${result.found} found, ${result.new} new`);
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`Total: ${totalFound} found, ${totalNew} new, ${totalErrors} errors`);
  console.log(`${'='.repeat(60)}\n`);

  return results;
}

/**
 * 특정 소스 ID로 크롤링 실행
 */
export async function runCrawlerById(
  sourceId: string,
  supabase: SupabaseClient<Database>,
  options?: { dryRun?: boolean; verbose?: boolean }
): Promise<CrawlResult | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: source, error } = await (supabase as any)
    .from('crawl_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (error || !source) {
    console.error(`[CRAWL] Source not found: ${sourceId}`);
    return null;
  }

  return runCrawler(source as CrawlSource, supabase, options);
}

// Export types
export type { CrawlerType, CrawlResult, CrawledArticle, RawContentItem };

// Export strategies
export { getStrategy, inferCrawlerType, isValidCrawlerType, closeBrowser };

// Export legacy crawlers for backward compatibility
export {
  crawlIconsumer,
  crawlBrunch,
  crawlWiseapp,
  crawlOpenads,
  crawlRetailtalk,
  crawlStonebc,
  crawlBuybrand,
  crawlWithCheerio,
  crawlWithPlaywright,
  fetchArticleContent,
};
