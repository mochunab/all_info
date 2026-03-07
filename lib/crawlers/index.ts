// 범용 크롤러 메인 모듈
// 전략 패턴 기반 크롤링 시스템

import { createHash } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { CrawlSource } from '@/types';
import type { CrawlerType, CrawlResult, CrawledArticle, RawContentItem } from './types';
import { parseConfig } from './types';
import { getStrategy, inferCrawlerType, closeBrowser, isValidCrawlerType } from './strategies';
import { parseDateToISO } from './date-parser';
import { generateSourceId } from '@/lib/utils';
import { filterGarbageArticles, getQualityStats } from './quality-filter';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { checkRobotsTxt } from './robots-checker';
import { generateArticleSlug } from '@/lib/article-slug';


async function fetchContentParallel(
  items: RawContentItem[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strategy: { crawlContent?: (url: string, config?: any) => Promise<string> },
  contentSelectors?: unknown,
  delay = 500,
): Promise<void> {
  if (!strategy.crawlContent) return;
  const CONCURRENCY = 2;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (item) => {
      if (item.content) return;
      try {
        item.content = await strategy.crawlContent!(item.link, contentSelectors);
      } catch (error) {
        console.error(`   ❌ 본문 추출 실패: ${item.link}`, error instanceof Error ? error.message : error);
      }
    }));
    if (i + CONCURRENCY < items.length) {
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function computeUrlHash(urls: string[]): string {
  const sorted = [...urls].sort();
  return createHash('sha256').update(sorted.join('|')).digest('hex').substring(0, 16);
}


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
    case 'SITEMAP':
      return ['STATIC'];
    case 'SPA':
      return ['STATIC'];
    case 'STATIC':
      return ['SPA'];
    case 'FIRECRAWL':
      return ['STATIC'];
    case 'API':
      return ['STATIC'];
    case 'PLATFORM_NAVER':
    case 'PLATFORM_KAKAO':
    case 'NEWSLETTER':
      return ['SPA'];
    default:
      return ['STATIC'];
  }
}

/**
 * 전략 패턴 기반 크롤링 실행 (폴백 체인 + 품질 검증)
 */
async function crawlWithStrategy(source: CrawlSource): Promise<CrawledArticle[]> {
  const config = parseConfig(source);
  const htmlCache = new Map<string, string>();

  // 1. Primary 전략 결정
  const inferred = inferCrawlerType(source.base_url);
  const isLegacyType = source.crawler_type === 'static' || source.crawler_type === 'dynamic';
  const primaryType = isLegacyType
    ? inferred
    : ((source.crawler_type as CrawlerType) || inferred);

  // 1.5. 사전 셀렉터 감지: STATIC/SPA 소스에 셀렉터 없으면 AI 자동 감지
  if ((primaryType === 'STATIC' || primaryType === 'SPA') && !config.selectors) {
    console.log(`\n🔍 [사전 감지] ${primaryType} 소스에 셀렉터 없음 — 자동 감지 시도...`);
    try {
      const { fetchPage, detectByRules } = await import('./auto-detect');
      const { detectByUnifiedAI } = await import('./strategy-resolver');
      const cheerioLib = await import('cheerio');

      let html: string | null = null;
      if (primaryType === 'SPA') {
        const { getRenderedHTML } = await import('./strategies/spa');
        html = await getRenderedHTML(source.base_url);
      } else {
        html = (await fetchPage(source.base_url)).html;
      }
      if (html) {
        htmlCache.set(source.base_url, html);
        // 1차: AI 통합 감지 (Edge Function)
        console.log(`   🤖 [1차] AI 통합 감지 시도...`);
        const aiResult = await detectByUnifiedAI(html, source.base_url);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let detectedSelectors: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let detectedExclude: any = null;
        let detectionMethod = 'ai-selector-detection';
        let detectionConfidence = 0;

        if (aiResult?.selectorResult) {
          detectedSelectors = aiResult.selectorResult.selectors;
          detectedExclude = aiResult.selectorResult.excludeSelectors;
          detectionConfidence = aiResult.confidence;
        }

        // 2차: AI 실패 시 Rule-based 감지 (nav/aside 제거 후 테이블/리스트/반복 구조 분석)
        if (!detectedSelectors) {
          console.log(`   🎯 [2차] Rule-based 셀렉터 분석 시도...`);
          const $ = cheerioLib.load(html);
          const ruleResult = detectByRules($, source.base_url);

          if (ruleResult && ruleResult.score >= 0.5) {
            console.log(`   ✅ Rule-based 감지 성공! (score: ${ruleResult.score.toFixed(2)}, ${ruleResult.count}개 매칭)`);
            detectedSelectors = {
              container: ruleResult.container,
              item: ruleResult.item,
              title: ruleResult.title,
              link: ruleResult.link,
              ...(ruleResult.date && { date: ruleResult.date }),
              ...(ruleResult.thumbnail && { thumbnail: ruleResult.thumbnail }),
            };
            detectedExclude = ['nav', 'header', 'footer', 'aside'];
            detectionMethod = 'rule-analysis';
            detectionConfidence = ruleResult.score;
          }
        }

        if (detectedSelectors) {
          console.log(`   ✅ 셀렉터 감지 성공! (방법: ${detectionMethod})`);
          console.log(`      • container: ${detectedSelectors.container || 'N/A'}`);
          console.log(`      • item: ${detectedSelectors.item}`);
          console.log(`      • title: ${detectedSelectors.title}`);
          console.log(`      • link: ${detectedSelectors.link}`);

          // in-memory source config 업데이트 (이번 크롤링에 즉시 반영)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (source as any).config = {
            ...source.config,
            selectors: detectedSelectors,
            excludeSelectors: detectedExclude,
          };
          config.selectors = detectedSelectors;
          config.excludeSelectors = detectedExclude;

          // DB config 업데이트 (향후 크롤링에 반영)
          await updateSourceConfig(source.id, {
            crawlerType: primaryType,
            selectors: detectedSelectors as unknown as Record<string, unknown>,
            confidence: detectionConfidence,
            detectionMethod,
          });
        } else {
          console.log(`   ⚠️  모든 감지 실패 — DEFAULT_SELECTORS 사용`);
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  사전 감지 오류:`, error instanceof Error ? error.message : error);
    }
  }

  // 2. Fallback 체인 구성
  const fallbacks = getDefaultFallbacks(primaryType);
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
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<RawContentItem[]>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('전략 타임아웃 (30초)')), 30000);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cachedHtml = htmlCache.get(source.base_url);
      if (cachedHtml) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (source as any)._cachedHtml = cachedHtml;
      }

      const crawlPromise = strategy.crawlList(source);

      console.log(`   🔍 콘텐츠 목록 크롤링 중... (최대 30초)`);
      // 목록 크롤링 (타임아웃 적용)
      let rawItemsAll: RawContentItem[];
      try {
        rawItemsAll = await Promise.race([crawlPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutId!);
      }

      // 최신 3개만 유지 (사이트 당 제한)
      const rawItems = rawItemsAll.slice(0, 3);

      console.log(`   ✅ 크롤링 완료: ${rawItemsAll.length}개 발견 → 최신 ${rawItems.length}개 선택`);

      // URL 해시 기반 변경 감지
      if (rawItems.length > 0) {
        const urlHash = computeUrlHash(rawItems.map(item => item.link));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastHash = (source.config as any)?._last_url_hash as string | undefined;

        if (lastHash && urlHash === lastHash) {
          console.log(`⏭️  [SKIP] 변경 없음 — 아티클 URL 동일`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (source.config as any)._computed_url_hash = urlHash;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (source.config as any)._skipped = true;
          return [];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (source.config as any)._computed_url_hash = urlHash;
      }

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

        // 0건이면 fallback 전략 시도 허용 (RSS URL 무효화 시 STATIC 폴백 가능)

        // 마지막 전략이면 자동 복구 시도 (하이브리드 전략)
        if (i === strategyChain.length - 1 && (
          (validation.stats && validation.stats.garbageRatio > 0.5) ||
          validation.reason === 'No items found' ||
          validation.reason?.startsWith('Insufficient valid items')
        )) {
          // [1순위] resolveStrategy 파이프라인 재분석 (저렴: rule-based)
          console.log(`\n🔄 [자동 복구] 품질 검증 실패 - 파이프라인 재분석 시도...`);

          try {
            const { resolveStrategy } = await import('./strategy-resolver');
            const newStrategy = await resolveStrategy(source.base_url, {
              cachedHtml: htmlCache.get(source.base_url),
            });

            if (newStrategy.confidence > 0.6) {
              console.log(`   ✅ 새 전략 발견: ${newStrategy.primaryStrategy} (confidence: ${(newStrategy.confidence * 100).toFixed(0)}%)`);
              console.log(`   💾 Config 업데이트 중...`);

              await updateSourceConfig(source.id, {
                crawlerType: newStrategy.primaryStrategy,
                selectors: (newStrategy.selectors as unknown) as Record<string, unknown> | undefined,
                rssUrl: newStrategy.rssUrl || undefined,
                confidence: newStrategy.confidence,
                detectionMethod: newStrategy.detectionMethod,
              });

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
              const recoveryValidation = validateCrawlResults(recoveryItems.slice(0, 3));

              if (recoveryValidation.passed) {
                console.log(`   ✅ 자동 복구 성공! (${recoveryItems.length}개 발견)`);

                const recoverySlice = recoveryItems.slice(0, 3);
                await fetchContentParallel(recoverySlice, recoveryStrategy, config.content_selectors, config.crawl_config?.delay || 500);
                const articles = recoverySlice.map(item => convertToArticle(item, source, config.category));
                const filtered = filterGarbageArticles(articles, source.name);
                console.log(`   ✅ 자동 복구 최종 결과: ${filtered.length}개 아티클`);
                return filtered;
              } else {
                console.warn(`   ⚠️  자동 복구 실패: 새 전략도 품질 검증 실패`);
              }
            } else {
              console.warn(`   ⚠️  자동 복구 실패: 낮은 신뢰도 (${(newStrategy.confidence * 100).toFixed(0)}%)`);
            }

            // Cheerio 기반 재감지 실패 → SPA 기본 셀렉터로 시도
            const cheerioTypes = ['STATIC', 'PLATFORM_KAKAO', 'PLATFORM_NAVER', 'NEWSLETTER', 'SITEMAP'];
            if (cheerioTypes.includes(newStrategy.primaryStrategy)) {
              console.log(`\n🔄 [SPA 폴백] Cheerio 전략 복구 실패 → SPA 기본 셀렉터로 시도...`);
              const spaRecovery = getStrategy('SPA');
              const spaSource: CrawlSource = {
                ...source,
                crawler_type: 'SPA' as CrawlerType,
                config: { category: source.config?.category },
              };

              const spaItems = await spaRecovery.crawlList(spaSource);
              if (spaItems.length > 0) {
                console.log(`   ✅ SPA 폴백 성공! (${spaItems.length}개 발견)`);

                await updateSourceConfig(source.id, {
                  crawlerType: 'SPA',
                  confidence: 0.5,
                  detectionMethod: 'spa-fallback-recovery',
                });

                const spaSlice = spaItems.slice(0, 3);
                await fetchContentParallel(spaSlice, spaRecovery, config.content_selectors, config.crawl_config?.delay || 500);
                const articles = spaSlice.map(item => convertToArticle(item, source, config.category));
                const filtered = filterGarbageArticles(articles, source.name);
                console.log(`   ✅ SPA 폴백 최종 결과: ${filtered.length}개 아티클`);
                return filtered;
              } else {
                console.warn(`   ⚠️  SPA 폴백도 실패: 0건`);
              }
            }
          } catch (error) {
            console.error(`   ❌ 자동 복구 오류:`, error instanceof Error ? error.message : error);
          }

          // [2순위] LLM 직접 추출 (비쌈: Gemini API, 최후 수단)
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const originalBaseUrl = (source.config as any)?._original_base_url as string | undefined;
            const llmTargetUrl = (originalBaseUrl && originalBaseUrl !== source.base_url) ? originalBaseUrl : source.base_url;

            console.log(`\n🤖 [LLM 추출] 셀렉터 우회 — LLM 직접 아티클 추출 시도...`);
            if (llmTargetUrl !== source.base_url) {
              console.log(`   📍 원본 URL 사용: ${llmTargetUrl} (crawl_url: ${source.base_url})`);
            }
            const { fetchPage } = await import('./auto-detect');
            const { preprocessHtmlForExtraction } = await import('./html-preprocessor');
            const { extractArticlesViaLLM } = await import('@/lib/ai/article-extractor');

            let llmHtml: string | null = htmlCache.get(llmTargetUrl) || null;
            if (!llmHtml) {
              if (primaryType === 'SPA') {
                const { getRenderedHTML } = await import('./strategies/spa');
                llmHtml = await getRenderedHTML(llmTargetUrl);
              } else {
                llmHtml = (await fetchPage(llmTargetUrl)).html;
              }
              if (llmHtml) htmlCache.set(llmTargetUrl, llmHtml);
            }
            if (llmHtml) {
              const preprocessed = preprocessHtmlForExtraction(llmHtml);
              const origin = new URL(llmTargetUrl).origin;
              const llmItems = await extractArticlesViaLLM(preprocessed, origin);

              if (llmItems.length >= 2) {
                console.log(`   ✅ LLM 추출 성공: ${llmItems.length}건 — 본문 추출 진행...`);

                const llmStrategy = getStrategy(primaryType === 'SPA' ? 'SPA' : 'STATIC');
                const llmSlice = llmItems.slice(0, 3);
                await fetchContentParallel(llmSlice, llmStrategy, config.content_selectors, config.crawl_config?.delay || 500);
                const llmArticles = llmSlice.map(item => convertToArticle(item, source, config.category));

                const llmFiltered = filterGarbageArticles(llmArticles, source.name);
                if (llmFiltered.length >= 2) {
                  console.log(`   ✅ LLM 추출 최종 결과: ${llmFiltered.length}개 아티클`);

                  await updateSourceConfig(source.id, {
                    crawlerType: primaryType,
                    confidence: 0.4,
                    detectionMethod: 'llm-extraction-fallback',
                  });

                  return llmFiltered;
                }
                console.warn(`   ⚠️  LLM 추출 후 품질 필터링 결과 부족: ${llmFiltered.length}건`);
              } else {
                console.warn(`   ⚠️  LLM 추출 결과 부족: ${llmItems.length}건`);
              }
            }
          } catch (llmError) {
            console.warn(`   ⚠️  LLM 추출 오류:`, llmError instanceof Error ? llmError.message : llmError);
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

      // 5. 사전 중복 체크 + 본문 크롤링
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const knownIds = new Set((source.config as any)?._known_source_ids as string[] || []);
      const newItems = knownIds.size > 0
        ? rawItems.filter(item => !knownIds.has(generateSourceId(item.link)))
        : rawItems;

      if (newItems.length === 0 && knownIds.size > 0) {
        console.log(`⏭️  [SKIP] 모든 아티클이 DB에 존재 — 본문 추출 스킵`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (source.config as any)._skipped = true;
        return [];
      }

      if (newItems.length < rawItems.length) {
        console.log(`   ⚡ 사전 중복 제거: ${rawItems.length}개 → ${newItems.length}개만 본문 추출`);
      }

      console.log(`\n   📄 본문 추출 시작... (${newItems.length}개, 병렬 2)`);
      await fetchContentParallel(newItems, strategy, config.content_selectors, config.crawl_config?.delay || 500);
      const contentFetchCount = newItems.filter(item => item.content).length;
      const articles = newItems.map(item => convertToArticle(item, source, config.category));
      console.log(`   ✅ 본문 추출 완료: ${contentFetchCount}/${newItems.length}개 성공`);

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
 * 크롤러 선택
 */
function getCrawler(source: CrawlSource): (source: CrawlSource) => Promise<CrawledArticle[]> {
  if (source.crawler_type && isValidCrawlerType(source.crawler_type)) {
    console.log(`✅ 전략 패턴 사용: ${source.crawler_type}`);
  } else {
    const inferred = inferCrawlerType(source.base_url);
    console.log(`🔍 자동 감지된 전략: ${inferred} (URL 기반)`);
  }
  return crawlWithStrategy;
}

/**
 * 아티클 저장
 */
/**
 * 제목 정규화 — 교차 소스 중복 감지용
 * 출판사 접미사 제거, 말줄임 정리, 공백 통합
 */
function normalizeTitle(title: string): string {
  return title
    .replace(/\s*[|｜\-–—]\s*[^|｜\-–—]*$/, '')
    .replace(/[…]+|\.{3,}$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeLikePattern(str: string): string {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function saveArticles(
  articles: CrawledArticle[],
  supabase: SupabaseClient<Database>,
  userId?: string
): Promise<{ saved: number; skipped: number; updated: number }> {
  let saved = 0;
  let skipped = 0;
  let updated = 0;

  try {
    // 1단계: 배치 source_id 중복 체크
    const sourceIds = articles.map(a => a.source_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingBySource } = await (supabase as any)
      .from('articles')
      .select('id, category, source_id')
      .in('source_id', sourceIds);

    type ExistingArticle = { id: string; category: string; source_id: string };
    const existingMap = new Map<string, ExistingArticle>(
      (existingBySource || []).map((e: ExistingArticle) => [e.source_id, e])
    );

    // 2단계: 기존 아티클 카테고리 업데이트 + 신규 아티클 필터링
    const newArticles: CrawledArticle[] = [];

    for (let idx = 0; idx < articles.length; idx++) {
      const article = articles[idx];
      const existing = existingMap.get(article.source_id);

      if (existing) {
        const safeCategory = article.category?.substring(0, 50);
        if (safeCategory && existing.category !== safeCategory) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('articles')
            .update({ category: safeCategory })
            .eq('id', existing.id);
          updated++;
          console.log(`   🔄 [${idx + 1}/${articles.length}] 카테고리 업데이트: "${article.title.substring(0, 40)}..." → ${safeCategory}`);
        } else {
          console.log(`   ⏭️  [${idx + 1}/${articles.length}] 건너뜀 (중복): "${article.title.substring(0, 40)}..."`);
        }
        skipped++;
        continue;
      }

      // 교차 소스 제목 중복 확인 (source_id 중복이 아닌 경우만)
      const normalized = normalizeTitle(article.title);
      if (normalized.length >= 10) {
        const prefix = escapeLikePattern(normalized.substring(0, Math.min(normalized.length, 40)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: titleMatches } = await (supabase as any)
          .from('articles')
          .select('id, title')
          .ilike('title', `${prefix}%`)
          .limit(5);

        if (titleMatches?.some((m: { title: string }) => normalizeTitle(m.title) === normalized)) {
          console.log(`   ⏭️  [${idx + 1}/${articles.length}] 건너뜀 (제목 중복): "${article.title.substring(0, 40)}..."`);
          skipped++;
          continue;
        }
      }

      newArticles.push(article);
    }

    // 3단계: 신규 아티클 배치 INSERT
    if (newArticles.length > 0) {
      const insertData = newArticles.map(article => {
        const tempId = crypto.randomUUID();
        const slug = generateArticleSlug(article.title, tempId);
        return {
          source_id: article.source_id,
          source_name: article.source_name?.substring(0, 100),
          source_url: article.source_url,
          title: article.title,
          content_preview: article.content_preview,
          summary: article.summary,
          author: article.author?.substring(0, 100),
          published_at: article.published_at,
          category: article.category?.substring(0, 50),
          slug,
          ...(userId && { user_id: userId }),
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('articles').insert(insertData);

      if (error) {
        console.error(`   ❌ 배치 저장 실패:`, error);
      } else {
        saved = newArticles.length;
        for (const article of newArticles) {
          console.log(`   ✅ 저장 완료: "${article.title.substring(0, 40)}..."`);
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ saveArticles 오류:`, error);
  }

  return { saved, skipped, updated };
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
    base_url: effectiveUrl,
    config: {
      ...source.config,
      _original_base_url: source.base_url,
    },
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

    // robots.txt 체크 (비활성화 — 추후 재활성화 예정)
    // const isAllowed = await checkRobotsTxt(effectiveUrl);
    // if (!isAllowed) {
    //   console.log(`🚫 robots.txt에 의해 크롤링 거부됨: ${effectiveUrl}`);
    //   return result;
    // }

    // 크롤러 선택 및 실행
    const crawler = getCrawler(effectiveSource);
    console.log(`\n🤖 크롤러: ${crawler.name || '전략 기반'}`);

    // 사전 중복 체크용 기존 아티클 source_id 조회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceUserId = (source as any).user_id as string | undefined;
    if (sourceUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: knownArticles } = await (supabase as any)
        .from('articles')
        .select('source_id')
        .eq('user_id', sourceUserId)
        .eq('source_name', source.name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (effectiveSource.config as any)._known_source_ids =
        knownArticles?.map((a: { source_id: string }) => a.source_id) || [];
    }

    // 크롤링 실행
    console.log(`🔍 아티클 수집 중...`);
    const articlesAll = await crawler(effectiveSource);

    // 최신 3개만 유지 (사이트 당 제한)
    const articles = articlesAll.slice(0, 3);

    result.found = articles.length;
    console.log(`\n📊 수집 결과: ${articlesAll.length}개 발견 → 최신 ${articles.length}개 선택`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wasSkipped = (effectiveSource.config as any)?._skipped === true;
    result.skipped = wasSkipped;

    if (articles.length === 0) {
      if (wasSkipped) {
        console.log(`⏭️  [SKIP] "${source.name}" — 변경 없음, 크롤링 스킵`);
      } else {
        console.log(`⚠️  아티클을 찾을 수 없습니다 - ${source.name}`);
      }
    } else {
      // Puppeteer 브라우저 정리
      await closeBrowser();

      // DB 저장 (dry-run이 아닌 경우)
      if (!options?.dryRun) {
        console.log(`\n💾 DB 저장 중... (${articles.length}개)`);
        const { saved, skipped, updated } = await saveArticles(articles, supabase, sourceUserId);
        result.new = saved;

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`✅ 크롤링 완료: ${source.name}`);
        console.log(`${'='.repeat(80)}`);
        console.log(`⏱️  소요시간: ${duration}초`);
        console.log(`📊 발견: ${result.found}개`);
        console.log(`💾 저장: ${result.new}개`);
        if (updated > 0) console.log(`🔄 카테고리 업데이트: ${updated}개`);
        console.log(`⏭️  건너뜀: ${skipped - updated}개 (중복)`);
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
    }

    // URL 해시 DB 업데이트 (변경 감지용, 스킵 시에도 저장)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const computedHash = (effectiveSource.config as any)?._computed_url_hash;
    if (computedHash && !options?.dryRun) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: current } = await (supabase as any)
        .from('crawl_sources')
        .select('config')
        .eq('id', source.id)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('crawl_sources')
        .update({
          config: { ...(current?.config || {}), _last_url_hash: computedHash }
        })
        .eq('id', source.id);
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

