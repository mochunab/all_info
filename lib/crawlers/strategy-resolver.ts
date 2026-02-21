// 통합 전략 결정 파이프라인
// URL 최적화 → RSS 발견 → CMS → URL 패턴 → SPA → 셀렉터 분석 → 기본값

import * as cheerio from 'cheerio';
import type { CrawlerType, StrategyResolution } from './types';
import { inferCrawlerTypeEnhanced } from './infer-type';
import type { SelectorDetectionResult } from './infer-type';
import { fetchPage, calculateSPAScore, detectByRules } from './auto-detect';
import { optimizeUrl } from './url-optimizer';
import { detectApiEndpoint } from './api-detector';

/**
 * 통합 AI 감지 (타입 + 셀렉터) — detect-crawler-type Edge Function 호출
 */
export async function detectByUnifiedAI(
  html: string,
  url: string
): Promise<{
  type: CrawlerType;
  confidence: number;
  reasoning: string;
  selectorResult: SelectorDetectionResult | null;
} | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[UNIFIED-AI] Supabase credentials not configured');
    return null;
  }

  try {
    // HTML 전처리: head/script/style + aside/nav/sidebar 제거 후 50000자
    // aside/nav 제거로 AI가 사이드바 콘텐츠를 메인으로 오인하는 문제 방지
    const $ = cheerio.load(html);
    $('head, nav, aside, [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"]').remove();
    $('script').filter((_, el) => ($(el).html() || '').length > 200).remove();
    $('style').filter((_, el) => ($(el).html() || '').length > 200).remove();
    // id/class에 sidebar, widget, banner 포함하는 요소 제거
    $('[id*="sidebar"], [id*="side-"], [class*="sidebar"], [class*="side-bar"], [id*="widget"], [class*="widget"], [id*="banner"], [class*="banner"]').remove();

    const cleanedHtml = $.html()
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const truncatedHtml = cleanedHtml.substring(0, 50000);

    console.log(`[UNIFIED-AI] 🤖 Edge Function 호출 중... (HTML ${truncatedHtml.length}자)`);

    const response = await fetch(`${supabaseUrl}/functions/v1/detect-crawler-type`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, html: truncatedHtml }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[UNIFIED-AI] Edge Function error: ${response.status}`, errorText);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.crawlerType) {
      console.warn(`[UNIFIED-AI] ❌ Failed: ${result.error}`);
      return null;
    }

    console.log(`[UNIFIED-AI] ✅ Type: ${result.crawlerType} (${result.confidence})`);
    console.log(`[UNIFIED-AI] 💡 Reasoning: ${result.reasoning}`);

    // 셀렉터 결과 변환
    let selectorResult: SelectorDetectionResult | null = null;
    if (result.selectors && result.selectors.item) {
      // Tailwind 콜론 이스케이프: .word:word- → .word\:word-
      const escape = (s: string | undefined | null): string | undefined => {
        if (!s) return s ?? undefined;
        return s.replace(
          /(\.[a-zA-Z0-9]+):([a-zA-Z][a-zA-Z0-9]*-)/g,
          '$1\\:$2'
        );
      };

      selectorResult = {
        selectors: {
          item: escape(result.selectors.item) ?? result.selectors.item,
          title: escape(result.selectors.title) ?? result.selectors.title,
          link: escape(result.selectors.link) ?? result.selectors.link,
          ...(result.selectors.container ? { container: escape(result.selectors.container) } : {}),
          ...(result.selectors.date ? { date: escape(result.selectors.date) } : {}),
          ...(result.selectors.thumbnail ? { thumbnail: escape(result.selectors.thumbnail) } : {}),
        },
        excludeSelectors: result.excludeSelectors || ['nav', 'header', 'footer'],
        confidence: result.confidence || 0.7,
        method: 'ai',
        reasoning: result.reasoning,
      };

      console.log(`[UNIFIED-AI] 📝 Selectors: item=${selectorResult.selectors.item}, title=${selectorResult.selectors.title}`);

      // Cheerio 기반 후검증: AI 셀렉터가 실제 HTML에서 매칭되는지 확인
      try {
        const $ = cheerio.load(html);
        const fullSelector = selectorResult.selectors.container
          ? `${selectorResult.selectors.container} ${selectorResult.selectors.item}`
          : selectorResult.selectors.item;
        const matchCount = $(fullSelector).length;

        const MIN_ITEMS_FOR_LIST = 3;
        if (matchCount < MIN_ITEMS_FOR_LIST) {
          console.warn(`[UNIFIED-AI] ⚠️  셀렉터 후검증 실패: "${fullSelector}" → ${matchCount}건 매칭 (최소 ${MIN_ITEMS_FOR_LIST}건 필요) — 셀렉터 폐기`);
          selectorResult = null;
        } else {
          console.log(`[UNIFIED-AI] ✅ 셀렉터 후검증 통과: ${matchCount}건 매칭`);
        }
      } catch (validationError) {
        console.warn(`[UNIFIED-AI] ⚠️  셀렉터 후검증 오류 (Cheerio 파싱 실패):`, validationError instanceof Error ? validationError.message : validationError);
        // 검증 불가 시 셀렉터 유지 (보수적 접근)
      }
    }

    return {
      type: result.crawlerType as CrawlerType,
      confidence: result.confidence,
      reasoning: result.reasoning,
      selectorResult,
    };
  } catch (error) {
    console.error('[UNIFIED-AI] Error:', error);
    return null;
  }
}

/**
 * URL을 분석하여 최적의 크롤링 전략 결정
 * - 소스 저장 시 1회 실행
 * - URL 최적화 → RSS 자동 발견 → CMS 감지 → URL 패턴 → SPA → 셀렉터 분석 순서
 */
export async function resolveStrategy(url: string): Promise<StrategyResolution> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 [전략 해석기] 크롤링 타입 자동 감지 시작`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📍 대상 URL: ${url}`);

  try {
    // 0. URL 최적화: 더 나은 크롤링 대상 URL 찾기
    console.log(`\n🎯 [0단계/9단계] URL 최적화 (크롤링 최적 URL 탐색)...`);
    const urlOptimization = await optimizeUrl(url);
    const optimizedUrl = urlOptimization.method !== 'no-change' ? urlOptimization.optimizedUrl : undefined;

    if (optimizedUrl) {
      console.log(`   ✅ URL 최적화 성공!`);
      console.log(`   📍 원본: ${urlOptimization.originalUrl}`);
      console.log(`   📍 최적: ${urlOptimization.optimizedUrl}`);
      console.log(`   💡 사유: ${urlOptimization.reason}`);
      console.log(`   🔧 방법: ${urlOptimization.method}`);

      // 최적화된 URL 사용
      url = urlOptimization.optimizedUrl;
    } else {
      console.log(`   ℹ️  URL 최적화 불필요 (원본 사용)`);
    }

    // 1. HTML 페이지 가져오기 (15초 타임아웃)
    console.log(`\n📥 [1단계/9단계] HTML 페이지 다운로드 시작...`);
    console.log(`   ⏱️  최대 대기시간: 15초`);
    const startFetch = Date.now();
    const html = await fetchPage(url);
    const fetchTime = Date.now() - startFetch;

    if (!html) {
      console.warn(`   ❌ HTML 다운로드 실패 (${fetchTime}ms)`);
      console.warn(`   🔄 URL 패턴 기반 분석으로 폴백`);
      return fallbackToUrlPattern(url);
    }

    const sizeKB = (html.length / 1024).toFixed(1);
    console.log(`   ✅ HTML 다운로드 완료`);
    console.log(`   📊 크기: ${sizeKB}KB (${html.length.toLocaleString()} bytes)`);
    console.log(`   ⏱️  소요시간: ${fetchTime}ms`);

    const $ = cheerio.load(html);

    // 2. RSS 자동 발견 (최고 우선순위)
    console.log(`\n📡 [2단계/9단계] RSS 피드 자동 발견 시도...`);
    const rssUrl = await discoverRSS(url, $);

    if (rssUrl) {
      console.log(`   🔍 RSS URL 후보 발견: ${rssUrl}`);
      console.log(`   🔄 RSS 유효성 검증 중... (최대 3초)`);

      const isValid = await validateRSSFeed(rssUrl);

      if (isValid) {
        console.log(`   ✅ RSS 피드 검증 성공!`);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`✨ [전략 결정] RSS 피드`);
        console.log(`   📊 신뢰도: 95%`);
        console.log(`   🔗 RSS URL: ${rssUrl}`);
        console.log(`   🔄 대체 전략: STATIC → SPA`);
        console.log(`${'='.repeat(80)}\n`);

        return {
          primaryStrategy: 'RSS',
          fallbackStrategies: ['STATIC', 'SPA'],
          rssUrl,
          selectors: null,
          excludeSelectors: undefined,
          pagination: null,
          confidence: 0.95,
          detectionMethod: 'rss-discovery',
          spaDetected: false,
          optimizedUrl,
        };
      } else {
        console.log(`   ❌ RSS 피드 검증 실패`);
        console.log(`   ⏭️  다음 단계로 진행...`);
      }
    } else {
      console.log(`   ⏭️  RSS URL 미발견`);
      console.log(`   ➡️  다음 단계로 진행...`);
    }

    // 2.5. Sitemap 자동 발견 (RSS 없는 사이트 대응)
    console.log(`\n🗺️  [2.5단계/9단계] Sitemap 자동 발견 시도...`);
    const sitemapUrl = await discoverSitemap(url);

    if (sitemapUrl) {
      console.log(`   ✅ Sitemap 발견!`);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✨ [전략 결정] SITEMAP`);
      console.log(`   📊 신뢰도: 90%`);
      console.log(`   🔗 Sitemap URL: ${sitemapUrl}`);
      console.log(`   🔄 대체 전략: STATIC`);
      console.log(`${'='.repeat(80)}\n`);

      return {
        primaryStrategy: 'SITEMAP',
        fallbackStrategies: ['STATIC'],
        rssUrl: sitemapUrl, // rssUrl 필드 재활용 — sources route.ts가 crawl_config.rssUrl에 저장
        selectors: null,
        excludeSelectors: undefined,
        pagination: null,
        confidence: 0.9,
        detectionMethod: 'sitemap-discovery',
        spaDetected: false,
        optimizedUrl,
      };
    } else {
      console.log(`   ⏭️  Sitemap 미발견`);
      console.log(`   ➡️  다음 단계로 진행...`);
    }

    // 3. CMS 감지 (WordPress, Tistory, Ghost, Medium)
    console.log(`[3단계/9단계] 🏗️  CMS 플랫폼 감지 시도...`);
    const cmsResult = detectCMS($);

    if (cmsResult.cms) {
      console.log(`[3단계/9단계] ✅ CMS 감지 성공: ${cmsResult.cms}`);

      // CMS별 RSS 경로 시도
      if (cmsResult.rssPath) {
        const cmsRssUrl = normalizeUrl(cmsResult.rssPath, url);
        console.log(`[3단계/9단계] 🔄 ${cmsResult.cms} RSS 경로 시도: ${cmsRssUrl}`);

        const isValid = await validateRSSFeed(cmsRssUrl);

        if (isValid) {
          console.log(`[3단계/9단계] ✅ ${cmsResult.cms} RSS 검증 성공!`);
          console.log(`[Strategy Resolver] ✨ 전략 결정: RSS (confidence: 0.9)`);
          console.log(`${'='.repeat(60)}\n`);

          return {
            primaryStrategy: 'RSS',
            fallbackStrategies: ['STATIC'],
            rssUrl: cmsRssUrl,
            selectors: null,
            excludeSelectors: undefined,
            pagination: null,
            confidence: 0.9,
            detectionMethod: 'cms-detection',
            spaDetected: false,
            optimizedUrl,
          };
        } else {
          console.log(`[3단계/9단계] ❌ ${cmsResult.cms} RSS 검증 실패 - STATIC 전략 사용`);
        }
      }

      // RSS 없어도 CMS는 정적 크롤링 가능
      console.log(`[Strategy Resolver] ✨ 전략 결정: STATIC (${cmsResult.cms}, confidence: 0.75)`);
      console.log(`${'='.repeat(60)}\n`);

      return {
        primaryStrategy: 'STATIC',
        fallbackStrategies: ['SPA'],
        rssUrl: null,
        selectors: null,
        excludeSelectors: undefined,
        pagination: null,
        confidence: 0.75,
        detectionMethod: 'cms-detection',
        spaDetected: false,
        optimizedUrl,
      };
    } else {
      console.log(`[3단계/9단계] ⏭️  CMS 미감지 - 다음 단계로 진행`);
    }

    // 4. URL 패턴 추론 (inferCrawlerTypeEnhanced)
    console.log(`[4단계/9단계] 🔗 URL 패턴 분석 중...`);
    const urlInference = inferCrawlerTypeEnhanced(url);
    console.log(
      `[4단계/9단계] 📊 URL 패턴 결과: ${urlInference.type} (confidence: ${urlInference.confidence.toFixed(2)})`
    );

    // URL 패턴 신뢰도가 높아도 셀렉터 분석은 계속 진행
    let preliminaryType: CrawlerType | null = null;
    let preliminaryConfidence = 0;
    let preliminaryMethod = 'default';

    if (urlInference.confidence >= 0.85) {
      console.log(`[4단계/9단계] ✅ 높은 신뢰도 - URL 패턴 타입: ${urlInference.type}`);
      console.log(`[4단계/9단계] 🔄 셀렉터 분석 계속 진행...`);
      preliminaryType = urlInference.type;
      preliminaryConfidence = urlInference.confidence;
      preliminaryMethod = 'url-pattern';
    } else {
      console.log(`[4단계/9단계] ⏭️  낮은 신뢰도 (${urlInference.confidence.toFixed(2)}) - 다음 단계로 진행`);
    }

    // 5. SPA 감지 (스코어링 기반)
    console.log(`\n⚡ [5단계/9단계] SPA 페이지 감지`);
    console.log(`   🔍 분석 방식: 프레임워크 패턴, body 텍스트, root div 등`);
    const spaScore = calculateSPAScore($);
    const spaDetected = spaScore >= 0.5;

    const spaPercent = (spaScore * 100).toFixed(0);
    console.log(`   📊 SPA 스코어: ${spaPercent}% (임계값: 50% 이상)`);

    if (spaDetected) {
      console.log(`   ✅ SPA 감지 성공!`);
      console.log(`   🎯 크롤러 타입: SPA`);
      console.log(`   📈 타입 신뢰도: ${spaPercent}%`);

      // SPA로 타입만 결정, 셀렉터 분석은 계속
      if (!preliminaryType) {
        preliminaryType = 'SPA';
        preliminaryConfidence = spaScore;
        preliminaryMethod = 'spa-detection';

        if (spaScore >= 0.85) {
          console.log(`   🔒 높은 신뢰도 - AI 타입 검증 불필요`);
        } else {
          console.log(`   ⚠️  낮은 신뢰도 - AI 타입 검증 예정`);
        }
      }
    } else {
      console.log(`   ⏭️  정적 페이지 (SPA 아님)`);
    }

    // 5.5. 숨겨진 API 엔드포인트 자동 감지 (SPA 감지된 경우만)
    if (spaDetected) {
      console.log(`\n🔌 [5.5단계/9단계] 숨겨진 API 엔드포인트 자동 감지`);
      console.log(`   🔍 Puppeteer 네트워크 가로채기로 XHR/fetch 분석...`);
      console.log(`   ⏱️  최대 대기시간: 30초`);

      try {
        const apiStartTime = Date.now();
        const apiConfig = await detectApiEndpoint(url);
        const apiDuration = Date.now() - apiStartTime;

        if (apiConfig && apiConfig.confidence >= 0.6) {
          console.log(`   ✅ API 엔드포인트 감지 성공! (${apiDuration}ms)`);
          console.log(`   📊 신뢰도: ${(apiConfig.confidence * 100).toFixed(0)}%`);
          console.log(`   🔗 엔드포인트: ${apiConfig.endpoint}`);
          console.log(`   📋 items 경로: ${apiConfig.responseMapping.items}`);
          console.log(`   💡 근거: ${apiConfig.reasoning}`);

          console.log(`\n${'='.repeat(80)}`);
          console.log(`✨ [전략 결정] API - 네트워크 인터셉션 자동 감지`);
          console.log(`   📊 신뢰도: ${(apiConfig.confidence * 100).toFixed(0)}%`);
          console.log(`   🔌 엔드포인트: ${apiConfig.endpoint}`);
          console.log(`   🔄 대체 전략: SPA → STATIC`);
          console.log(`${'='.repeat(80)}\n`);

          return {
            primaryStrategy: 'API',
            fallbackStrategies: ['SPA', 'STATIC'],
            rssUrl: null,
            selectors: null,
            excludeSelectors: undefined,
            pagination: null,
            confidence: apiConfig.confidence,
            detectionMethod: 'api-detection',
            spaDetected: true,
            optimizedUrl,
            apiConfig,
          };
        } else {
          console.log(`   ⚠️  API 미감지 또는 낮은 신뢰도 (${apiDuration}ms)`);
          console.log(`   ➡️  SPA 전략 유지, 다음 단계로 진행`);
        }
      } catch (apiError) {
        console.warn(`   ❌ API 감지 오류:`, apiError instanceof Error ? apiError.message : apiError);
        console.log(`   ➡️  SPA 전략 유지, 다음 단계로 진행`);
      }
    }

    // 6. Rule-based 셀렉터 분석 — 비활성화 (코드 보존)
    // detectByRules()는 auto-detect.ts에 보존됨. resolveStrategyV2에서는 여전히 사용.

    // 7 + 8. 통합 AI 감지 (타입 + 셀렉터) — 단일 Edge Function 호출
    const needsAIVerification = !preliminaryType || preliminaryConfidence < 0.85;

    // 시맨틱 빠른 경로: <article> 태그 3개 이상 + 타입 확정 → AI 건너뛰기
    let selectorResult: SelectorDetectionResult | null = null;
    const articleTagCount = (html.match(/<article[\s>]/gi) || []).length;
    if (articleTagCount >= 3 && preliminaryType && preliminaryConfidence >= 0.85) {
      console.log(`\n⚡ [7+8단계/9단계] 시맨틱 빠른 경로 — <article> ${articleTagCount}개, 타입 확정 (${preliminaryType})`);
      selectorResult = {
        selectors: {
          container: 'main, [role="main"], body',
          item: 'article',
          title: 'h1, h2, h3, .title, .headline',
          link: 'a',
        },
        excludeSelectors: ['nav', 'header', 'footer', 'aside'],
        confidence: 0.8,
        method: 'semantic',
      };
    }

    // 시맨틱 빠른 경로 미사용 시 통합 AI 호출
    let aiDetectedSPA = false; // AI가 낮은 confidence라도 SPA 감지 시 플래그 (Stage 8.5용)
    if (!selectorResult || selectorResult.confidence < 0.6) {
      console.log(`\n🤖 [7+8단계/9단계] 통합 AI 감지 (타입 + 셀렉터) — 단일 Edge Function`);
      if (!needsAIVerification) {
        console.log(`   ✅ 타입 확정됨 (${preliminaryType}, ${(preliminaryConfidence * 100).toFixed(0)}%) — 셀렉터 위주 탐지`);
      }
      console.log(`   🔧 모델: GPT-5-nano (통합 감지)`);

      const aiStart = Date.now();
      const unifiedResult = await detectByUnifiedAI(html, url);
      console.log(`   ⏱️  통합 AI 완료: ${Date.now() - aiStart}ms`);

      // AI가 SPA로 판단했으면 플래그 + 타입 세팅 (confidence 무관)
      // IGN 같은 SPA 셸은 정적 HTML이 거의 비어 AI confidence가 낮지만 SPA는 확실
      if (unifiedResult?.type === 'SPA') {
        aiDetectedSPA = true;
        if (!preliminaryType) {
          preliminaryType = 'SPA';
          preliminaryConfidence = Math.max(preliminaryConfidence, 0.5);
          preliminaryMethod = 'ai-type-detection';
        }
      }

      // AI 타입 결과 처리
      const aiTypeResult = unifiedResult && unifiedResult.confidence >= 0.6
        ? { type: unifiedResult.type, confidence: unifiedResult.confidence, reasoning: unifiedResult.reasoning }
        : null;

      // AI 셀렉터 결과 처리
      if (unifiedResult?.selectorResult && unifiedResult.selectorResult.confidence >= 0.5) {
        selectorResult = unifiedResult.selectorResult;
      }

      // AI 타입 결과 처리
      if (aiTypeResult && aiTypeResult.confidence >= 0.6) {
        const aiConfidencePercent = (aiTypeResult.confidence * 100).toFixed(0);
        console.log(`   ✅ AI 타입: ${aiTypeResult.type} (${aiConfidencePercent}%) — ${aiTypeResult.reasoning}`);

        if (aiTypeResult.confidence > preliminaryConfidence) {
          if (preliminaryType && preliminaryType !== aiTypeResult.type) {
            console.log(`   🔄 타입 변경: ${preliminaryType} → ${aiTypeResult.type}`);
          }
          preliminaryType = aiTypeResult.type;
          preliminaryConfidence = aiTypeResult.confidence;
          preliminaryMethod = 'ai-type-detection';
        } else {
          console.log(`   ℹ️  기존 타입(${preliminaryType}) 유지 — 신뢰도 더 높음`);
        }
      } else if (needsAIVerification) {
        console.log(`   ❌ AI 타입 감지 실패 (신뢰도 낮음)`);
      }
    }

    // 7.5. 숨겨진 API 엔드포인트 자동 감지 (step 5.5 미실행 + SPA 확정된 경우)
    // step 5.5는 calculateSPAScore >= 0.5일 때만 실행 — 정적 HTML에 SPA 마커 없는 사이트는 여기서 재시도
    if (!spaDetected && (preliminaryType === 'SPA' || aiDetectedSPA)) {
      console.log(`\n🔌 [7.5단계/9단계] 숨겨진 API 엔드포인트 자동 감지 (AI SPA 확정 후 재시도)`);
      console.log(`   🔍 Puppeteer 네트워크 가로채기로 XHR/fetch 분석...`);
      console.log(`   ⏱️  최대 대기시간: 30초`);

      try {
        const apiStartTime = Date.now();
        const apiConfig = await detectApiEndpoint(url);
        const apiDuration = Date.now() - apiStartTime;

        if (apiConfig && apiConfig.confidence >= 0.6) {
          console.log(`   ✅ API 엔드포인트 감지 성공! (${apiDuration}ms)`);
          console.log(`   📊 신뢰도: ${(apiConfig.confidence * 100).toFixed(0)}%`);
          console.log(`   🔗 엔드포인트: ${apiConfig.endpoint}`);
          console.log(`   📋 items 경로: ${apiConfig.responseMapping.items}`);
          console.log(`   💡 근거: ${apiConfig.reasoning}`);

          console.log(`\n${'='.repeat(80)}`);
          console.log(`✨ [전략 결정] API - 네트워크 인터셉션 자동 감지`);
          console.log(`   📊 신뢰도: ${(apiConfig.confidence * 100).toFixed(0)}%`);
          console.log(`   🔌 엔드포인트: ${apiConfig.endpoint}`);
          console.log(`   🔄 대체 전략: SPA → STATIC`);
          console.log(`${'='.repeat(80)}\n`);

          return {
            primaryStrategy: 'API',
            fallbackStrategies: ['SPA', 'STATIC'],
            rssUrl: null,
            selectors: null,
            excludeSelectors: undefined,
            pagination: null,
            confidence: apiConfig.confidence,
            detectionMethod: 'api-detection',
            spaDetected: true,
            optimizedUrl,
            apiConfig,
          };
        } else {
          console.log(`   ⚠️  API 미감지 또는 낮은 신뢰도 (${apiDuration}ms)`);
          console.log(`   ➡️  SPA 전략 유지, 다음 단계로 진행`);
        }
      } catch (apiError) {
        console.warn(`   ❌ API 감지 오류:`, apiError instanceof Error ? apiError.message : apiError);
        console.log(`   ➡️  SPA 전략 유지, 다음 단계로 진행`);
      }
    }

    // 8.5. SPA 페이지 셀렉터 재감지 (정적 HTML 신뢰도 낮을 때 Puppeteer 렌더링 HTML 사용)
    // SPA 페이지는 JS로 목록을 로드하므로 정적 HTML에 아티클 목록이 없을 수 있음
    // aiDetectedSPA: AI가 낮은 confidence(< 0.6)로 SPA 감지 시에도 Puppeteer 재감지 트리거
    const isSpaPage = spaDetected || preliminaryType === 'SPA' || aiDetectedSPA;
    if (isSpaPage && (!selectorResult || selectorResult.confidence < 0.5)) {
      console.log(`\n🎭 [8.5단계/9단계] SPA 렌더링 HTML로 셀렉터 재감지 시도...`);
      console.log(`   💡 이유: 정적 HTML에 JS 로드 기사 목록 없음 (신뢰도: ${((selectorResult?.confidence || 0) * 100).toFixed(0)}%)`);
      try {
        const { getRenderedHTML } = await import('./strategies/spa');
        const renderedHtml = await getRenderedHTML(url);
        if (renderedHtml) {
          const renderedUnified = await detectByUnifiedAI(renderedHtml, url);
          const renderedResult = renderedUnified?.selectorResult;
          console.log(`   📊 재감지 신뢰도: ${((renderedResult?.confidence || 0) * 100).toFixed(0)}%`);
          if (renderedResult && renderedResult.confidence > (selectorResult?.confidence || 0)) {
            console.log(`   ✅ 재감지 성공 — Puppeteer 렌더링 HTML 셀렉터 채택`);
            selectorResult = renderedResult;
          } else {
            console.log(`   ℹ️  기존 결과 유지 (재감지 신뢰도가 더 낮음)`);
          }

          // Rule-based 폴백 (AI 재감지 실패 시)
          if (!selectorResult || selectorResult.confidence < 0.5) {
            console.log(`   🔄 Rule-based 폴백 시도 (AI 재감지 실패)...`);
            const rendered$ = cheerio.load(renderedHtml);
            const ruleResult = detectByRules(rendered$, url);
            if (ruleResult && ruleResult.score >= 0.5) {
              console.log(`   ✅ Rule-based 폴백 성공! (${ruleResult.count}개 아이템, score: ${ruleResult.score.toFixed(2)})`);
              selectorResult = {
                selectors: {
                  container: ruleResult.container,
                  item: ruleResult.item,
                  title: ruleResult.title,
                  link: ruleResult.link,
                  ...(ruleResult.date && { date: ruleResult.date }),
                  ...(ruleResult.thumbnail && { thumbnail: ruleResult.thumbnail }),
                },
                excludeSelectors: ['nav', 'header', 'footer', 'aside'],
                confidence: ruleResult.score,
                method: 'fallback' as const,
                reasoning: `Rule-based detection on Puppeteer HTML (${ruleResult.count} items, score: ${ruleResult.score.toFixed(2)})`,
              };
            } else {
              console.log(`   ℹ️  Rule-based 폴백도 실패 (score: ${(ruleResult?.score || 0).toFixed(2)})`);
            }
          }
        } else {
          console.log(`   ⚠️  렌더링 HTML 수신 실패`);
        }
      } catch (spaError) {
        console.warn(`   ⚠️  SPA 렌더링 HTML 재감지 실패:`, spaError instanceof Error ? spaError.message : spaError);
      }
    }

    // 8. AI 셀렉터 결과 처리 (통합 AI 감지에서 이미 완료됨)
    if (selectorResult && selectorResult.confidence >= 0.6) {
      const confidencePercent = (selectorResult.confidence * 100).toFixed(0);
      console.log(`\n🔍 [8단계/9단계] AI 셀렉터 결과 (병렬 완료)`);
      console.log(`   ✅ 탐지 성공! 신뢰도: ${confidencePercent}%, 방법: ${selectorResult.method}`);
      console.log(`   💡 근거: ${selectorResult.reasoning || 'N/A'}`);
      console.log(`\n   📝 탐지된 CSS 셀렉터:`);
      console.log(`      • container: ${selectorResult.selectors.container || 'N/A'}`);
      console.log(`      • item: ${selectorResult.selectors.item}`);
      console.log(`      • title: ${selectorResult.selectors.title}`);
      console.log(`      • link: ${selectorResult.selectors.link}`);
      if (selectorResult.selectors.date) console.log(`      • date: ${selectorResult.selectors.date}`);
      if (selectorResult.selectors.thumbnail) console.log(`      • thumbnail: ${selectorResult.selectors.thumbnail}`);
      if (selectorResult.excludeSelectors?.length) {
        console.log(`\n   🚫 제외 셀렉터:`);
        selectorResult.excludeSelectors.forEach(sel => console.log(`      • ${sel}`));
      }

      const finalType = preliminaryType || 'STATIC';
      const finalConfidence = preliminaryType ? preliminaryConfidence : selectorResult.confidence;
      const finalMethod = (preliminaryType ? preliminaryMethod : 'ai-content-detection') as StrategyResolution['detectionMethod'];

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✨ [전략 결정] ${finalType} — ${selectorResult.method} 기반 셀렉터`);
      console.log(`   📊 신뢰도: ${(finalConfidence * 100).toFixed(0)}%`);
      console.log(`   🔄 대체 전략: ${getDefaultFallbacks(finalType).join(' → ')}`);
      console.log(`${'='.repeat(80)}\n`);

      return {
        primaryStrategy: finalType,
        fallbackStrategies: getDefaultFallbacks(finalType),
        rssUrl: null,
        selectors: selectorResult.selectors,
        excludeSelectors: selectorResult.excludeSelectors,
        pagination: null,
        confidence: finalConfidence,
        detectionMethod: finalMethod,
        spaDetected: finalType === 'SPA',
        optimizedUrl,
      };
    } else {
      console.log(`\n🔍 [8단계/9단계] AI 셀렉터 탐지 실패 또는 낮은 신뢰도`);
    }

    // 9. 모두 실패 시: preliminaryType 또는 URL 패턴 사용
    const finalType = preliminaryType || urlInference.type;
    const finalConfidence = preliminaryType ? preliminaryConfidence : Math.max(urlInference.confidence, 0.3);
    const finalMethod = (preliminaryType ? preliminaryMethod : 'default') as StrategyResolution['detectionMethod'];

    console.log(`\n⚠️  [알림] 셀렉터 분석 실패 - 타입만 결정`);
    console.log(`   🔄 ${finalMethod === 'default' ? 'URL 패턴' : finalMethod} 기본값 사용`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✨ [전략 결정] ${finalType} - ${finalMethod === 'default' ? 'URL 패턴 (기본값)' : finalMethod}`);
    console.log(`   📊 신뢰도: ${(finalConfidence * 100).toFixed(0)}%`);
    console.log(`   ⚠️  셀렉터: 미탐지 (크롤링 시 DEFAULT_SELECTORS 사용)`);
    console.log(`   🔄 대체 전략: ${getDefaultFallbacks(finalType).join(' → ')}`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`\n🔍 [FINAL RETURN] optimizedUrl = ${optimizedUrl}`);

    return {
      primaryStrategy: finalType,
      fallbackStrategies: getDefaultFallbacks(finalType),
      rssUrl: null,
      selectors: null, // rule-based 셀렉터 폴백 비활성화 — 크롤링 시 DEFAULT_SELECTORS 사용
      excludeSelectors: undefined,
      pagination: null,
      confidence: finalConfidence,
      detectionMethod: finalMethod,
      spaDetected: finalType === 'SPA',
      optimizedUrl,
    };
  } catch (error) {
    console.error(`[Strategy Resolver] ❌ 오류 발생:`, error);
    console.log(`[Strategy Resolver] 🔄 URL 패턴 폴백 사용`);
    console.log(`${'='.repeat(60)}\n`);
    return fallbackToUrlPattern(url);
  }
}

/**
 * RSS 피드 자동 발견
 * - HTML <link rel="alternate"> 태그
 * - 일반 경로 (/feed, /rss, /feed.xml 등)
 */
async function discoverRSS(url: string, $: cheerio.CheerioAPI): Promise<string | null> {
  // 1. HTML <link> 태그 확인
  const rssLink = $(
    'link[type="application/rss+xml"], link[type="application/atom+xml"]'
  ).first();

  if (rssLink.length > 0) {
    const href = rssLink.attr('href');
    if (href) {
      return normalizeUrl(href, url);
    }
  }

  // 2. 일반 RSS 경로 후보 - 병렬 검증 (직렬 6회 최대 18s → 병렬 최대 3s)
  const commonRssPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];
  const candidates = commonRssPaths.map(path => normalizeUrl(path, url));

  const results = await Promise.all(
    candidates.map(async (rssUrl) => ({
      rssUrl,
      isValid: await validateRSSFeed(rssUrl),
    }))
  );

  // commonRssPaths 우선순위 순서 유지 (첫 번째 유효한 것 반환)
  const validResult = results.find(r => r.isValid);
  return validResult ? validResult.rssUrl : null;
}

/**
 * URL 패턴으로 기사 URL 여부를 스코어링
 * - 경로 깊이, 숫자 세그먼트, 날짜 패턴, 긴 슬러그 등을 종합 판단
 * - score >= 1 → 기사 URL로 판정
 */
function scoreUrlArticleLikelihood(url: string): number {
  let score = 0;
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);

    // 경로 깊이 >= 3 → 기사일 가능성 높음
    if (segments.length >= 3) score += 1;

    // 경로 깊이 <= 1 → 홈/섹션 페이지
    if (segments.length <= 1) score -= 2;

    // 숫자 세그먼트 존재 (기사 ID)
    if (segments.some(s => /^\d+$/.test(s))) score += 1;

    // 날짜 패턴 (YYYY/MM 또는 YYYY-MM)
    if (/\/\d{4}\/\d{1,2}(\/|$)/.test(pathname) || /\/\d{4}-\d{2}/.test(pathname)) score += 1;

    // 긴 슬러그 세그먼트 (>20자, 하이픈 포함)
    if (segments.some(s => s.length > 20 && s.includes('-'))) score += 1;
  } catch {
    return 0;
  }
  return score;
}

/**
 * Sitemap XML 스니펫에서 URL 품질을 검증
 * - <loc> URL을 최대 30개 샘플링하여 기사 URL 비율 검사
 * - 기사 URL 비율 >= 30% → true (유효한 기사 sitemap)
 */
function isArticleSitemap(xmlSnippet: string): boolean {
  const locMatches = xmlSnippet.match(/<loc>(.*?)<\/loc>/g);
  if (!locMatches || locMatches.length === 0) return false;

  // 최대 30개 샘플링
  const urls = locMatches.slice(0, 30).map(m => {
    const match = m.match(/<loc>(.*?)<\/loc>/);
    return match ? match[1] : '';
  }).filter(Boolean);

  if (urls.length === 0) return false;

  const articleCount = urls.filter(u => scoreUrlArticleLikelihood(u) >= 1).length;
  const ratio = articleCount / urls.length;

  console.log(`   📊 Sitemap URL 품질 검사: ${urls.length}개 샘플 중 기사 URL ${articleCount}개 (${(ratio * 100).toFixed(0)}%)`);

  return ratio >= 0.3;
}

/**
 * Sitemap 자동 발견
 * - /sitemap.xml, /sitemap_index.xml 경로 시도
 * - XML 응답에 <urlset> 또는 <sitemapindex> 포함 여부로 유효성 판단
 * - <urlset>인 경우 URL 품질 검증 (기사 URL 비율 >= 30%)
 */
async function discoverSitemap(url: string): Promise<string | null> {
  const origin = (() => {
    try { return new URL(url).origin; } catch { return null; }
  })();
  if (!origin) return null;

  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  // 병렬 검증 (직렬 2회 최대 10s → 병렬 최대 5s)
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(candidate, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/xml,text/xml,*/*' },
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || '';
        const isXml = contentType.includes('xml') || candidate.endsWith('.xml');
        if (!isXml) return null;

        // 첫 16KB 읽어서 sitemap 태그 확인 + URL 품질 검증
        const reader = response.body?.getReader();
        if (!reader) return null;

        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        const MAX_BYTES = 16384; // 16KB

        while (totalLength < MAX_BYTES) {
          const { value, done } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          totalLength += value.length;
        }
        reader.cancel();

        if (totalLength === 0) return null;
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        const text = new TextDecoder().decode(merged.slice(0, MAX_BYTES));

        // <sitemapindex>는 서브 sitemap 목록 → 기존 scoreSitemapUrl이 필터링하므로 그대로 통과
        if (text.includes('<sitemapindex')) return candidate;

        // <urlset>은 직접 URL 목록 → 기사 URL 비율 검증
        if (text.includes('<urlset')) {
          if (isArticleSitemap(text)) {
            return candidate;
          }
          console.log(`   ⚠️  Sitemap 거부 (기사 URL 비율 부족): ${candidate}`);
          return null;
        }

        return null;
      } catch {
        return null;
      }
    })
  );

  return results.find(r => r !== null) ?? null;
}

/**
 * RSS 피드 유효성 검증
 * - 첫 2KB만 fetch하여 <rss>, <feed>, <channel> 태그 확인
 */
async function validateRSSFeed(rssUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(rssUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    // Content-Type 확인
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
      return false;
    }

    // 첫 2KB만 읽기
    const reader = response.body?.getReader();
    if (!reader) return false;

    const { value } = await reader.read();
    reader.releaseLock();

    if (!value) return false;

    const text = new TextDecoder().decode(value.slice(0, 2048));

    // RSS/Atom 태그 존재 확인
    return /<rss|<feed|<channel/i.test(text);
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * CMS 감지 (WordPress, Tistory, Ghost, Medium)
 */
function detectCMS($: cheerio.CheerioAPI): { cms: string | null; rssPath: string | null } {
  // WordPress
  const wpGenerator = $('meta[name="generator"]').attr('content') || '';
  if (/wordpress/i.test(wpGenerator)) {
    return { cms: 'WordPress', rssPath: '/feed' };
  }

  // wp-content 링크 존재 확인
  const wpContentLinks = $('link[href*="wp-content"], script[src*="wp-content"]');
  if (wpContentLinks.length > 0) {
    return { cms: 'WordPress', rssPath: '/feed' };
  }

  // Tistory
  const tistoryScripts = $('script[src*="tistory"]');
  if (tistoryScripts.length > 0) {
    return { cms: 'Tistory', rssPath: '/rss' };
  }

  // Ghost
  const ghostGenerator = $('meta[name="generator"]').attr('content') || '';
  if (/ghost/i.test(ghostGenerator)) {
    return { cms: 'Ghost', rssPath: '/rss' };
  }

  // Medium
  const mediumMeta = $('meta[property="al:android:package"]').attr('content') || '';
  if (mediumMeta.includes('com.medium.reader')) {
    return { cms: 'Medium', rssPath: '/feed' };
  }

  return { cms: null, rssPath: null };
}

/**
 * 상대 URL을 절대 URL로 정규화
 */
function normalizeUrl(href: string, baseUrl: string): string {
  try {
    if (href.startsWith('http')) {
      return href;
    }
    if (href.startsWith('//')) {
      return `https:${href}`;
    }

    const base = new URL(baseUrl);
    const resolved = new URL(href, base.origin);
    return resolved.toString();
  } catch {
    return href;
  }
}

/**
 * 크롤러 타입별 기본 폴백 전략
 * FIRECRAWL은 제거됨 (Hallucination 위험으로 폐기)
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
      return []; // STATIC은 폴백 없음 (마지막 수단)
    case 'PLATFORM_NAVER':
    case 'PLATFORM_KAKAO':
    case 'NEWSLETTER':
      return ['STATIC'];
    case 'API':
      return ['STATIC'];
    case 'FIRECRAWL':
      return ['STATIC']; // FIRECRAWL은 폐기 예정이지만 레거시 호환성
    default:
      return ['STATIC'];
  }
}

/**
 * fetch 실패 시 URL 패턴만으로 추론
 */
function fallbackToUrlPattern(url: string): StrategyResolution {
  const urlInference = inferCrawlerTypeEnhanced(url);

  return {
    primaryStrategy: urlInference.type,
    fallbackStrategies: getDefaultFallbacks(urlInference.type),
    rssUrl: null,
    selectors: null,
    excludeSelectors: undefined,
    pagination: null,
    confidence: urlInference.confidence,
    detectionMethod: 'url-pattern',
    spaDetected: urlInference.type === 'SPA',
    optimizedUrl: undefined, // Fallback 경로에서는 최적화 불가
  };
}

/**
 * 비용 최적화 전략 해석기 (Firecrawl 하이브리드)
 *
 * 기존 9단계 파이프라인을 3단계로 축소하여 비용 절감:
 * 1. RSS 자동 발견 (무료, Cheerio)
 * 2. Rule-based 분석 (무료, 기존 detectByRules)
 *    - confidence >= 0.7 → STATIC 즉시 리턴
 * 3. Firecrawl 검증 (1 credit, 불확실할 때만)
 *
 * 비용: 대부분 소스는 0 credit (RSS 또는 Rule-based), 복잡한 소스만 1 credit
 */
export async function resolveStrategyV2(url: string): Promise<StrategyResolution> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 [전략 해석기 V2] 비용 최적화 모드 (Firecrawl 하이브리드)`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📍 대상 URL: ${url}`);

  try {
    // Step 1: HTML 페이지 가져오기
    console.log(`\n📥 [1/3단계] HTML 페이지 다운로드...`);
    const startFetch = Date.now();
    const html = await fetchPage(url);
    const fetchTime = Date.now() - startFetch;

    if (!html) {
      console.warn(`   ❌ HTML 다운로드 실패 (${fetchTime}ms)`);
      console.warn(`   🔄 STATIC 기본값으로 폴백`);
      return {
        primaryStrategy: 'STATIC',
        fallbackStrategies: [],
        rssUrl: null,
        selectors: null,
        pagination: null,
        confidence: 0.5,
        detectionMethod: 'default',
        spaDetected: false,
      };
    }

    console.log(`   ✅ HTML 다운로드 완료 (${(html.length / 1024).toFixed(1)}KB, ${fetchTime}ms)`);
    const $ = cheerio.load(html);

    // Step 2: RSS 자동 발견 (무료, 최고 우선순위)
    console.log(`\n📡 [2/3단계] RSS 피드 자동 발견 (무료)...`);
    const rssUrl = await discoverRSS(url, $);

    if (rssUrl) {
      console.log(`   🔍 RSS URL 후보: ${rssUrl}`);
      const isValid = await validateRSSFeed(rssUrl);

      if (isValid) {
        console.log(`   ✅ RSS 피드 검증 성공!`);
        console.log(`\n${'='.repeat(80)}`);
        console.log(`✨ [전략 결정] RSS (무료, 0 credit)`);
        console.log(`   📊 신뢰도: 95%`);
        console.log(`   💰 비용: 0 credit`);
        console.log(`${'='.repeat(80)}\n`);

        return {
          primaryStrategy: 'RSS',
          fallbackStrategies: ['FIRECRAWL', 'STATIC'],
          rssUrl,
          selectors: null,
          pagination: null,
          confidence: 0.95,
          detectionMethod: 'rss-discovery',
          spaDetected: false,
        };
      }
    }

    // Step 3: Rule-based 셀렉터 분석 (무료)
    console.log(`\n🎯 [3/3단계] Rule-based 셀렉터 분석 (무료)...`);
    const ruleResult = detectByRules($, url);

    if (ruleResult && ruleResult.score >= 0.7) {
      const confidencePercent = (ruleResult.score * 100).toFixed(0);
      console.log(`   ✅ 셀렉터 분석 성공!`);
      console.log(`   📊 신뢰도: ${confidencePercent}% (임계값: 70% 이상)`);
      console.log(`   📰 탐지된 아이템: ${ruleResult.count}개`);

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✨ [전략 결정] STATIC - Rule-based (무료, 0 credit)`);
      console.log(`   📊 신뢰도: ${confidencePercent}%`);
      console.log(`   💰 비용: 0 credit`);
      console.log(`   🔧 셀렉터: Rule-based 자동 탐지`);
      console.log(`${'='.repeat(80)}\n`);

      return {
        primaryStrategy: 'STATIC',
        fallbackStrategies: ['FIRECRAWL'],
        rssUrl: null,
        selectors: {
          container: ruleResult.container,
          item: ruleResult.item,
          title: ruleResult.title,
          link: ruleResult.link,
          ...(ruleResult.date && { date: ruleResult.date }),
          ...(ruleResult.thumbnail && { thumbnail: ruleResult.thumbnail }),
        },
        pagination: null,
        confidence: ruleResult.score,
        detectionMethod: 'rule-analysis',
        spaDetected: false,
      };
    }

    // Step 4: Firecrawl 검증 (1 credit, 불확실할 때만)
    console.log(`\n🤖 [3/3단계 - 폴백] Firecrawl 검증 시도... (1 credit)`);
    console.log(`   ⚠️  Rule-based 신뢰도 낮음 (${((ruleResult?.score || 0) * 100).toFixed(0)}%)`);
    console.log(`   💡 Firecrawl API로 아티클 목록 추출 테스트`);

    try {
      const { scrapeAndExtract } = await import('./firecrawl-client');

      const ARTICLE_LIST_SCHEMA = {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                url: { type: 'string' },
              },
              required: ['title', 'url'],
            },
          },
        },
        required: ['articles'],
      };

      const result = await scrapeAndExtract(
        url,
        ARTICLE_LIST_SCHEMA,
        '이 페이지에서 아티클/포스트 목록을 추출하세요. 네비게이션 메뉴는 제외하세요.'
      );

      if (result.articles && result.articles.length >= 2) {
        console.log(`   ✅ Firecrawl 검증 성공! (${result.articles.length}개 아티클 추출)`);

        console.log(`\n${'='.repeat(80)}`);
        console.log(`✨ [전략 결정] FIRECRAWL (1 credit)`);
        console.log(`   📊 신뢰도: 85%`);
        console.log(`   💰 비용: 1 credit (소스 저장 1회)`);
        console.log(`   🔄 크롤링 비용: 1 credit/일 (리스트만, 본문 무료)`);
        console.log(`${'='.repeat(80)}\n`);

        return {
          primaryStrategy: 'FIRECRAWL',
          fallbackStrategies: ['STATIC'],
          rssUrl: null,
          selectors: null,
          pagination: null,
          confidence: 0.85,
          detectionMethod: 'firecrawl',
          spaDetected: false,
        };
      }
    } catch (error) {
      console.warn(`   ❌ Firecrawl 검증 실패:`, error);
    }

    // Step 5: 모두 실패 시 STATIC 기본값 (하이브리드 자동 복구가 대체)
    console.log(`\n⚠️  [알림] 모든 분석 실패 - STATIC 기본값 사용`);
    console.log(`   💡 크롤링 실행 시 하이브리드 자동 복구가 재시도합니다`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✨ [전략 결정] STATIC (기본값)`);
    console.log(`   📊 신뢰도: 50%`);
    console.log(`   💡 자동 복구: 크롤링 실패 시 8단계 파이프라인 재실행`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      primaryStrategy: 'STATIC',
      fallbackStrategies: [],
      rssUrl: null,
      selectors: null,
      pagination: null,
      confidence: 0.5,
      detectionMethod: 'default',
      spaDetected: false,
    };
  } catch (error) {
    console.error(`[Strategy Resolver V2] ❌ 오류 발생:`, error);
    return {
      primaryStrategy: 'STATIC',
      fallbackStrategies: [],
      rssUrl: null,
      selectors: null,
      pagination: null,
      confidence: 0.5,
      detectionMethod: 'error',
      spaDetected: false,
    };
  }
}
