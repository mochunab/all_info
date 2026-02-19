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

/**
 * 소스 config 업데이트 (자동 복구용)
 */
async function updateSourceConfig(
  sourceId: number,
  newConfig: {
    crawlerType: CrawlerType;
    selectors?: Record<string, unknown>;
    rssUrl?: string;
    confidence?: number;
    detectionMethod?: string;
  }
): Promise<void> {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase = createServiceClient();

    const updates: {
      crawler_type: string;
      config?: Record<string, unknown>;
      crawl_url?: string;
    } = {
      crawler_type: newConfig.crawlerType,
    };

    // config 병합 (기존 설정 유지하면서 새 설정 추가)
    if (newConfig.selectors || newConfig.confidence || newConfig.detectionMethod) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: currentSource } = await (supabase as any)
        .from('crawl_sources')
        .select('config')
        .eq('id', sourceId)
        .single();

      const currentConfig = currentSource?.config || {};

      updates.config = {
        ...currentConfig,
        ...(newConfig.selectors && { selectors: newConfig.selectors }),
        _detection: {
          method: newConfig.detectionMethod || 'auto-recovery',
          confidence: newConfig.confidence || 0.5,
          timestamp: new Date().toISOString(),
          reason: 'Auto-recovery after quality validation failure',
        },
      };
    }

    // RSS URL이 있으면 crawl_url 업데이트
    if (newConfig.rssUrl) {
      updates.crawl_url = newConfig.rssUrl;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('crawl_sources')
      .update(updates)
      .eq('id', sourceId);

    if (error) {
      console.error('[AUTO-RECOVERY] Failed to update source config:', error);
    } else {
      console.log(`[AUTO-RECOVERY] ✅ Updated source config (ID: ${sourceId})`);
      console.log(`   📊 New crawler_type: ${newConfig.crawlerType}`);
      console.log(`   📊 Confidence: ${newConfig.confidence?.toFixed(2) || 'N/A'}`);
    }
  } catch (error) {
    console.error('[AUTO-RECOVERY] Error updating source config:', error);
  }
}

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
 * FIRECRAWL 제거 - 범용 전략만 사용 (하이브리드 자동 복구가 대체)
 */
function getDefaultFallbacks(primaryType: CrawlerType): CrawlerType[] {
  switch (primaryType) {
    case 'RSS':
      return ['STATIC'];
    case 'SPA':
      return ['STATIC'];
    case 'STATIC':
      return [];
    case 'FIRECRAWL':
      return ['STATIC'];
    case 'API':
      return ['STATIC'];
    case 'PLATFORM_NAVER':
    case 'PLATFORM_KAKAO':
    case 'NEWSLETTER':
      return ['STATIC'];
    default:
      return ['STATIC'];
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

  console.log(`\n📋 [전략 체인] ${strategyChain.join(' → ')}`);

  // 3. 체인 순회 (각 전략 30초 타임아웃)
  for (let i = 0; i < strategyChain.length; i++) {
    const strategyType = strategyChain[i];
    const isFallback = i > 0;

    console.log(
      `\n${isFallback ? '🔄 [대체 전략]' : '🎯 [주 전략]'} ${strategyType} 실행 중... (${i + 1}/${strategyChain.length})`
    );

    try {
      // 전략 가져오기
      console.log(`   ⚙️  전략 로드 중...`);
      const strategy = getStrategy(strategyType);
      console.log(`   ✅ 전략 로드 완료`);

      // 타임아웃 설정 (30초)
      const timeoutPromise = new Promise<RawContentItem[]>((_, reject) =>
        setTimeout(() => reject(new Error('전략 타임아웃 (30초)')), 30000)
      );

      const crawlPromise = strategy.crawlList(source);

      console.log(`   🔍 콘텐츠 목록 크롤링 중... (최대 30초)`);
      // 목록 크롤링 (타임아웃 적용)
      const rawItemsAll = await Promise.race([crawlPromise, timeoutPromise]);

      // 최신 5개만 유지 (사이트 당 제한)
      const rawItems = rawItemsAll.slice(0, 5);

      console.log(`   ✅ 크롤링 완료: ${rawItemsAll.length}개 발견 → 최신 ${rawItems.length}개 선택`);

      // 4. 품질 검증
      console.log(`   🔍 품질 검증 중...`);
      const validation = validateCrawlResults(rawItems);

      if (!validation.passed) {
        console.warn(
          `   ⚠️  품질 검증 실패: ${validation.reason}`
        );
        if (validation.stats) {
          console.warn(`   📊 통계: 전체 ${validation.stats.total}개, 유효 ${validation.stats.valid}개, 쓰레기 비율 ${(validation.stats.garbageRatio * 100).toFixed(1)}%`);
        }

        // 마지막 전략이면 자동 복구 시도 (하이브리드 전략)
        if (i === strategyChain.length - 1 && validation.stats && validation.stats.garbageRatio > 0.5) {
          console.log(`\n🔄 [자동 복구] 품질 검증 실패 - 8단계 파이프라인 재분석 시도...`);

          try {
            const { resolveStrategy } = await import('./strategy-resolver');
            const newStrategy = await resolveStrategy(source.base_url);

            // 새 전략이 더 높은 신뢰도면 적용
            if (newStrategy.confidence > 0.6) {
              console.log(`   ✅ 새 전략 발견: ${newStrategy.primaryStrategy} (confidence: ${(newStrategy.confidence * 100).toFixed(0)}%)`);
              console.log(`   💾 Config 업데이트 중...`);

              // Config 업데이트
              await updateSourceConfig(source.id, {
                crawlerType: newStrategy.primaryStrategy,
                selectors: (newStrategy.selectors as unknown) as Record<string, unknown> | undefined,
                rssUrl: newStrategy.rssUrl || undefined,
                confidence: newStrategy.confidence,
                detectionMethod: newStrategy.detectionMethod,
              });

              // 새 전략으로 재크롤링
              console.log(`   🔄 새 전략으로 재크롤링 시도...`);
              const recoveryStrategy = getStrategy(newStrategy.primaryStrategy);

              const updatedSource: CrawlSource = {
                ...source,
                crawler_type: newStrategy.primaryStrategy,
                config: {
                  ...source.config,
                  selectors: newStrategy.selectors || source.config?.selectors,
                  _detection: {
                    method: newStrategy.detectionMethod,
                    confidence: newStrategy.confidence,
                    timestamp: new Date().toISOString(),
                  },
                },
                ...(newStrategy.rssUrl && { crawl_url: newStrategy.rssUrl }),
              };

              const recoveryItems = await recoveryStrategy.crawlList(updatedSource);
              const recoveryValidation = validateCrawlResults(recoveryItems.slice(0, 5));

              if (recoveryValidation.passed) {
                console.log(`   ✅ 자동 복구 성공! (${recoveryItems.length}개 발견)`);

                // 본문 크롤링 (기존 로직과 동일)
                const articles: CrawledArticle[] = [];
                for (let idx = 0; idx < Math.min(recoveryItems.length, 5); idx++) {
                  const item = recoveryItems[idx];
                  if (!item.content && recoveryStrategy.crawlContent) {
                    try {
                      const result = await recoveryStrategy.crawlContent(item.link, config.content_selectors);
                      if (typeof result === 'string') {
                        item.content = result;
                      } else {
                        item.content = result.content;
                        if (!item.thumbnail && result.thumbnail) {
                          item.thumbnail = result.thumbnail;
                        }
                      }
                    } catch (error) {
                      console.error(`   ❌ 본문 추출 실패: ${item.link}`, error instanceof Error ? error.message : error);
                    }
                    await new Promise((resolve) => setTimeout(resolve, config.crawl_config?.delay || 500));
                  }
                  articles.push(convertToArticle(item, source, config.category));
                }

                const filtered = filterGarbageArticles(articles, source.name);
                console.log(`   ✅ 자동 복구 최종 결과: ${filtered.length}개 아티클`);
                return filtered;
              } else {
                console.warn(`   ⚠️  자동 복구 실패: 새 전략도 품질 검증 실패`);
              }
            } else {
              console.warn(`   ⚠️  자동 복구 실패: 낮은 신뢰도 (${(newStrategy.confidence * 100).toFixed(0)}%)`);
            }
          } catch (error) {
            console.error(`   ❌ 자동 복구 오류:`, error instanceof Error ? error.message : error);
          }
        }

        // 자동 복구 실패 또는 마지막 전략이면 빈 배열 반환
        if (i === strategyChain.length - 1) {
          console.error(`   ❌ 모든 전략 실패 - "${source.name}" 크롤링 중단`);
          return [];
        }

        console.log(`   🔄 다음 전략 시도 중...`);
        // 다음 전략 시도
        continue;
      }

      console.log(`   ✅ 품질 검증 통과`);
      if (validation.stats) {
        console.log(`   📊 통계: 전체 ${validation.stats.total}개, 유효 ${validation.stats.valid}개, 중복제거 ${validation.stats.uniqueTitles}개`);
      }

      // 5. 본문 크롤링
      console.log(`\n   📄 본문 추출 시작... (${rawItems.length}개)`);
      const articles: CrawledArticle[] = [];
      let contentFetchCount = 0;

      for (let idx = 0; idx < rawItems.length; idx++) {
        const item = rawItems[idx];
        if (!item.content && strategy.crawlContent) {
          try {
            console.log(`      [${idx + 1}/${rawItems.length}] "${item.title.substring(0, 40)}..." 본문 추출 중...`);
            const result = await strategy.crawlContent(item.link, config.content_selectors);

            if (typeof result === 'string') {
              item.content = result;
            } else {
              item.content = result.content;
              if (!item.thumbnail && result.thumbnail) {
                item.thumbnail = result.thumbnail;
              }
            }
            contentFetchCount++;
            console.log(`      ✅ 본문 추출 완료 (${item.content.length}자)`);
          } catch (error) {
            console.error(`      ❌ 본문 추출 실패: ${item.link}`, error instanceof Error ? error.message : error);
          }

          await new Promise((resolve) => setTimeout(resolve, config.crawl_config?.delay || 500));
        }

        articles.push(convertToArticle(item, source, config.category));
      }

      console.log(`   ✅ 본문 추출 완료: ${contentFetchCount}/${rawItems.length}개 성공`);

      // 6. 쓰레기 필터 적용
      console.log(`   🗑️  품질 필터링 중...`);
      const filtered = filterGarbageArticles(articles, source.name);
      const filteredCount = articles.length - filtered.length;
      if (filteredCount > 0) {
        console.log(`   🗑️  필터링 제거: ${filteredCount}개`);
      }

      console.log(`\n   ✅ ${strategyType} 전략 성공: 최종 ${filtered.length}개 아티클`);
      return filtered;
    } catch (error) {
      console.error(`   ❌ ${strategyType} 전략 오류:`, error instanceof Error ? error.message : error);

      // 마지막 전략이면 빈 배열 반환
      if (i === strategyChain.length - 1) {
        console.error(`   ❌ 모든 전략 소진 - "${source.name}" 크롤링 실패`);
        return [];
      }

      console.log(`   🔄 다음 전략 시도 중...`);
      // 다음 전략 시도
      continue;
    }
  }

  // 모든 전략 실패
  console.error(`❌ 크롤링 실패 - "${source.name}": 모든 전략 실패`);
  return [];
}

/**
 * 크롤러 선택 (전략 패턴 우선, 레거시 폴백)
 */
function getCrawler(source: CrawlSource): (source: CrawlSource) => Promise<CrawledArticle[]> {
  // 1. URL 기반으로 최적 전략 추론
  const inferred = inferCrawlerType(source.base_url);
  console.log(`🔍 자동 감지된 전략: ${inferred} (URL 기반)`);

  // 2. 새 전략 패턴 사용 (추론된 타입 or crawler_type이 유효한 경우)
  if (isValidCrawlerType(inferred)) {
    console.log(`✅ 전략 패턴 사용: ${inferred}`);
    return crawlWithStrategy;
  }

  // 3. crawler_type이 명시적으로 유효한 경우
  if (source.crawler_type && isValidCrawlerType(source.crawler_type)) {
    console.log(`✅ 전략 패턴 사용: ${source.crawler_type} (설정됨)`);
    return crawlWithStrategy;
  }

  // 4. 레거시 폴백 (사이트별 크롤러)
  if (LEGACY_CRAWLER_REGISTRY[source.name]) {
    console.log(`🔄 레거시 크롤러 사용: ${source.name}`);
    return LEGACY_CRAWLER_REGISTRY[source.name];
  }

  // 5. 기본값: 전략 패턴
  console.log(`✅ 기본 전략 패턴 사용`);
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

  for (let idx = 0; idx < articles.length; idx++) {
    const article = articles[idx];
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
        console.log(`   ⏭️  [${idx + 1}/${articles.length}] 건너뜀 (중복): "${article.title.substring(0, 40)}..."`);
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
        console.error(`   ❌ [${idx + 1}/${articles.length}] 저장 실패: ${article.title}`, error);
      } else {
        saved++;
        console.log(`   ✅ [${idx + 1}/${articles.length}] 저장 완료: "${article.title.substring(0, 40)}..."`);
      }
    } catch (error) {
      console.error(`   ❌ [${idx + 1}/${articles.length}] 오류:`, error);
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

  // crawl_url이 있으면 우선 사용 (URL 최적화 결과)
  const effectiveUrl = source.crawl_url || source.base_url;
  const effectiveSource: CrawlSource = {
    ...source,
    base_url: effectiveUrl, // 크롤링 시 최적화된 URL 사용
  };

  try {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🎯 크롤링 대상: ${source.name}`);
    if (source.crawl_url && source.crawl_url !== source.base_url) {
      console.log(`   📍 원본 URL: ${source.base_url}`);
      console.log(`   ✨ 크롤링 URL: ${source.crawl_url}`);
    } else {
      console.log(`   📍 URL: ${source.base_url}`);
    }
    console.log(`   🔧 타입: ${source.crawler_type || '자동감지'}`);
    console.log(`   ⏰ 시작: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    if (options?.dryRun) console.log(`   🧪 모드: 테스트 (DB 저장 안함)`);
    console.log(`${'─'.repeat(80)}`);

    // 크롤러 선택 및 실행
    const crawler = getCrawler(effectiveSource);
    console.log(`\n🤖 크롤러: ${crawler.name || '전략 기반'}`);

    // 크롤링 실행
    console.log(`🔍 아티클 수집 중...`);
    const articlesAll = await crawler(effectiveSource);

    // 최신 5개만 유지 (사이트 당 제한)
    const articles = articlesAll.slice(0, 5);

    result.found = articles.length;
    console.log(`\n📊 수집 결과: ${articlesAll.length}개 발견 → 최신 ${articles.length}개 선택`);

    if (articles.length === 0) {
      console.log(`⚠️  아티클을 찾을 수 없습니다 - ${source.name}`);
      return result;
    }

    // 본문 미리보기 가져오기 (레거시 크롤러용)
    console.log(`\n📄 본문 미리보기 추출 중...`);
    let previewCount = 0;
    for (let idx = 0; idx < articles.length; idx++) {
      const article = articles[idx];
      if (!article.content_preview) {
        try {
          console.log(`   [${idx + 1}/${articles.length}] "${article.title.substring(0, 40)}..." 추출 중...`);
          const content = await fetchArticleContent(article.source_url);
          if (content) {
            article.content_preview = content.substring(0, 3000);
            previewCount++;
            console.log(`   ✅ 추출 완료 (${content.length}자)`);
          }
        } catch (error) {
          if (options?.verbose) {
            console.error(`   ❌ 추출 실패: ${article.title}`, error);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (previewCount > 0) {
      console.log(`✅ 본문 미리보기 추출 완료: ${previewCount}개`);
    }

    // DB 저장 (dry-run이 아닌 경우)
    if (!options?.dryRun) {
      console.log(`\n💾 DB 저장 중... (${articles.length}개)`);
      const { saved, skipped } = await saveArticles(articles, supabase);
      result.new = saved;

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ 크롤링 완료: ${source.name}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`⏱️  소요시간: ${duration}초`);
      console.log(`📊 발견: ${result.found}개`);
      console.log(`💾 저장: ${result.new}개`);
      console.log(`⏭️  건너뜀: ${skipped}개 (중복)`);
      console.log(`${'='.repeat(80)}\n`);
    } else {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🧪 테스트 완료: ${source.name}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`⏱️  소요시간: ${duration}초`);
      console.log(`📊 저장 예정: ${result.found}개`);
      if (options?.verbose) {
        console.log('\n📰 아티클 목록:');
        articles.forEach((a, i) => {
          console.log(`  ${i + 1}. ${a.title}`);
          console.log(`     🔗 URL: ${a.source_url}`);
          console.log(`     📅 날짜: ${a.published_at || 'N/A'}`);
        });
      }
      console.log(`${'='.repeat(80)}\n`);
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
