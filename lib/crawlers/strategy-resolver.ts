// 통합 전략 결정 파이프라인
// RSS 발견 → CMS → URL 패턴 → SPA → 셀렉터 분석 → 기본값

import * as cheerio from 'cheerio';
import type { CrawlerType, StrategyResolution } from './types';
import { inferCrawlerTypeEnhanced } from './infer-type';
import { fetchPage, calculateSPAScore, detectByRules, detectByAI, detectCrawlerTypeByAI } from './auto-detect';

/**
 * URL을 분석하여 최적의 크롤링 전략 결정
 * - 소스 저장 시 1회 실행
 * - RSS 자동 발견 → CMS 감지 → URL 패턴 → SPA → 셀렉터 분석 순서
 */
export async function resolveStrategy(url: string): Promise<StrategyResolution> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Strategy Resolver] 🔍 분석 시작: ${url}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. HTML 페이지 가져오기 (15초 타임아웃)
    console.log(`[Step 1/7] 📥 HTML 페이지 가져오는 중...`);
    const startFetch = Date.now();
    const html = await fetchPage(url);
    const fetchTime = Date.now() - startFetch;

    if (!html) {
      console.warn(`[Step 1/7] ❌ HTML 가져오기 실패 (${fetchTime}ms) - URL 패턴만 사용`);
      return fallbackToUrlPattern(url);
    }

    console.log(`[Step 1/7] ✅ HTML 가져오기 성공 (${fetchTime}ms, ${html.length} bytes)`);

    const $ = cheerio.load(html);

    // 2. RSS 자동 발견 (최고 우선순위)
    console.log(`[Step 2/7] 📡 RSS 피드 자동 발견 시도...`);
    const rssUrl = discoverRSS(url, $);

    if (rssUrl) {
      console.log(`[Step 2/7] 🔍 RSS URL 후보 발견: ${rssUrl}`);
      console.log(`[Step 2/7] 🔄 RSS 유효성 검증 중...`);

      const isValid = await validateRSSFeed(rssUrl);

      if (isValid) {
        console.log(`[Step 2/7] ✅ RSS 피드 검증 성공!`);
        console.log(`[Strategy Resolver] ✨ 전략 결정: RSS (confidence: 0.95)`);
        console.log(`${'='.repeat(60)}\n`);

        return {
          primaryStrategy: 'RSS',
          fallbackStrategies: ['STATIC', 'SPA'],
          rssUrl,
          selectors: null,
          pagination: null,
          confidence: 0.95,
          detectionMethod: 'rss-discovery',
          spaDetected: false,
        };
      } else {
        console.log(`[Step 2/7] ❌ RSS 검증 실패 - 다음 단계로 진행`);
      }
    } else {
      console.log(`[Step 2/7] ⏭️  RSS URL 미발견 - 다음 단계로 진행`);
    }

    // 3. CMS 감지 (WordPress, Tistory, Ghost, Medium)
    console.log(`[Step 3/7] 🏗️  CMS 플랫폼 감지 시도...`);
    const cmsResult = detectCMS($);

    if (cmsResult.cms) {
      console.log(`[Step 3/7] ✅ CMS 감지 성공: ${cmsResult.cms}`);

      // CMS별 RSS 경로 시도
      if (cmsResult.rssPath) {
        const cmsRssUrl = normalizeUrl(cmsResult.rssPath, url);
        console.log(`[Step 3/7] 🔄 ${cmsResult.cms} RSS 경로 시도: ${cmsRssUrl}`);

        const isValid = await validateRSSFeed(cmsRssUrl);

        if (isValid) {
          console.log(`[Step 3/7] ✅ ${cmsResult.cms} RSS 검증 성공!`);
          console.log(`[Strategy Resolver] ✨ 전략 결정: RSS (confidence: 0.9)`);
          console.log(`${'='.repeat(60)}\n`);

          return {
            primaryStrategy: 'RSS',
            fallbackStrategies: ['STATIC'],
            rssUrl: cmsRssUrl,
            selectors: null,
            pagination: null,
            confidence: 0.9,
            detectionMethod: 'cms-detection',
            spaDetected: false,
          };
        } else {
          console.log(`[Step 3/7] ❌ ${cmsResult.cms} RSS 검증 실패 - STATIC 전략 사용`);
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
        pagination: null,
        confidence: 0.75,
        detectionMethod: 'cms-detection',
        spaDetected: false,
      };
    } else {
      console.log(`[Step 3/7] ⏭️  CMS 미감지 - 다음 단계로 진행`);
    }

    // 4. URL 패턴 추론 (inferCrawlerTypeEnhanced)
    console.log(`[Step 4/7] 🔗 URL 패턴 분석 중...`);
    const urlInference = inferCrawlerTypeEnhanced(url);
    console.log(
      `[Step 4/7] 📊 URL 패턴 결과: ${urlInference.type} (confidence: ${urlInference.confidence.toFixed(2)})`
    );

    // 높은 confidence (0.85 이상)면 URL 패턴 신뢰
    if (urlInference.confidence >= 0.85) {
      console.log(`[Step 4/7] ✅ 높은 신뢰도 - URL 패턴 사용`);
      console.log(
        `[Strategy Resolver] ✨ 전략 결정: ${urlInference.type} (confidence: ${urlInference.confidence.toFixed(2)})`
      );
      console.log(`${'='.repeat(60)}\n`);

      return {
        primaryStrategy: urlInference.type,
        fallbackStrategies: getDefaultFallbacks(urlInference.type),
        rssUrl: null,
        selectors: null,
        pagination: null,
        confidence: urlInference.confidence,
        detectionMethod: 'url-pattern',
        spaDetected: urlInference.type === 'SPA',
      };
    } else {
      console.log(`[Step 4/7] ⏭️  낮은 신뢰도 (${urlInference.confidence.toFixed(2)}) - 다음 단계로 진행`);
    }

    // 5. SPA 감지 (스코어링 기반)
    console.log(`[Step 5/7] ⚡ SPA 페이지 감지 중...`);
    const spaScore = calculateSPAScore($);
    const spaDetected = spaScore >= 0.5;

    console.log(
      `[Step 5/7] 📊 SPA 스코어: ${spaScore.toFixed(2)} (임계값: 0.5, 감지: ${spaDetected ? 'YES' : 'NO'})`
    );

    if (spaDetected) {
      console.log(`[Step 5/7] ✅ SPA 페이지 감지!`);
      console.log(
        `[Strategy Resolver] ✨ 전략 결정: SPA (confidence: ${spaScore.toFixed(2)})`
      );
      console.log(`${'='.repeat(60)}\n`);

      return {
        primaryStrategy: 'SPA',
        fallbackStrategies: ['STATIC'],
        rssUrl: null,
        selectors: null,
        pagination: null,
        confidence: spaScore,
        detectionMethod: 'rule-analysis',
        spaDetected: true,
      };
    } else {
      console.log(`[Step 5/7] ⏭️  정적 페이지 - 다음 단계로 진행`);
    }

    // 6. 셀렉터 분석 (rule-based)
    console.log(`[Step 6/8] 🎯 CSS 셀렉터 규칙 기반 분석 중...`);
    const ruleResult = detectByRules($, url);

    // 높은 confidence (0.7 이상)면 rule-based 결과 신뢰
    if (ruleResult && ruleResult.score >= 0.7) {
      console.log(
        `[Step 6/8] ✅ 규칙 기반 셀렉터 탐지 성공 (confidence: ${ruleResult.score.toFixed(2)}, ${ruleResult.count}개 아이템)`
      );
      console.log(`[Step 6/8] 📝 탐지된 셀렉터:`);
      console.log(`  - container: ${ruleResult.container}`);
      console.log(`  - item: ${ruleResult.item}`);
      console.log(`  - title: ${ruleResult.title}`);
      console.log(`  - link: ${ruleResult.link}`);
      if (ruleResult.date) console.log(`  - date: ${ruleResult.date}`);
      if (ruleResult.thumbnail) console.log(`  - thumbnail: ${ruleResult.thumbnail}`);

      console.log(
        `[Strategy Resolver] ✨ 전략 결정: STATIC (confidence: ${ruleResult.score.toFixed(2)})`
      );
      console.log(`${'='.repeat(60)}\n`);

      return {
        primaryStrategy: 'STATIC',
        fallbackStrategies: ['SPA'],
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
    } else {
      console.log(
        `[Step 6/8] ⚠️  규칙 기반 분석 불확실 (confidence: ${ruleResult?.score.toFixed(2) || 0} < 0.7) - AI 분석으로 진행`
      );
    }

    // 7. AI 크롤러 타입 감지 (rule-based confidence < 0.7일 때)
    console.log(`[Step 7/8] 🤖 AI 기반 크롤러 타입 감지 중...`);
    const aiTypeResult = await detectCrawlerTypeByAI(html, url);

    if (aiTypeResult && aiTypeResult.confidence >= 0.6) {
      console.log(
        `[Step 7/8] ✅ AI 타입 감지 성공: ${aiTypeResult.type} (confidence: ${aiTypeResult.confidence.toFixed(2)})`
      );
      console.log(`[Step 7/8] 💡 ${aiTypeResult.reasoning}`);
      console.log(
        `[Strategy Resolver] ✨ 전략 결정: ${aiTypeResult.type} (AI, confidence: ${aiTypeResult.confidence.toFixed(2)})`
      );
      console.log(`${'='.repeat(60)}\n`);

      return {
        primaryStrategy: aiTypeResult.type,
        fallbackStrategies: getDefaultFallbacks(aiTypeResult.type),
        rssUrl: null,
        selectors: ruleResult && ruleResult.score >= 0.5 ? {
          container: ruleResult.container,
          item: ruleResult.item,
          title: ruleResult.title,
          link: ruleResult.link,
          ...(ruleResult.date && { date: ruleResult.date }),
          ...(ruleResult.thumbnail && { thumbnail: ruleResult.thumbnail }),
        } : null,
        pagination: null,
        confidence: aiTypeResult.confidence,
        detectionMethod: 'ai-type-detection',
        spaDetected: aiTypeResult.type === 'SPA',
      };
    } else {
      console.log(
        `[Step 7/8] ❌ AI 타입 감지 실패 또는 낮은 confidence - 기본값 사용`
      );
    }

    // 8. AI 셀렉터 탐지 폴백 (타입은 결정됐지만 셀렉터가 없을 때)
    console.log(`[Step 8/8] 🔍 AI 기반 셀렉터 분석 시도 (최종 폴백)...`);
    const aiResult = await detectByAI(html, url);

    if (aiResult) {
      console.log(
        `[Step 8/8] ✅ AI 셀렉터 탐지 성공 (confidence: ${aiResult.confidence.toFixed(2)})`
      );
      console.log(`[Step 8/8] 📝 AI 탐지 셀렉터:`);
      console.log(`  - item: ${aiResult.selectors.item}`);
      console.log(`  - title: ${aiResult.selectors.title}`);
      console.log(`  - link: ${aiResult.selectors.link}`);

      console.log(
        `[Strategy Resolver] ✨ 전략 결정: STATIC (AI selector, confidence: ${aiResult.confidence.toFixed(2)})`
      );
      console.log(`${'='.repeat(60)}\n`);

      return {
        primaryStrategy: 'STATIC',
        fallbackStrategies: ['SPA'],
        rssUrl: null,
        selectors: aiResult.selectors,
        pagination: aiResult.pagination || null,
        confidence: aiResult.confidence,
        detectionMethod: 'ai-selector-detection',
        spaDetected: false,
      };
    } else {
      console.log(`[Step 8/8] ❌ AI 셀렉터 분석 실패`);
    }

    // 8. 모두 실패 시: URL 패턴 결과 사용 (낮은 confidence라도)
    console.log(`[Strategy Resolver] ⚠️  모든 분석 방법 실패 - URL 패턴 기본값 사용`);
    console.log(
      `[Strategy Resolver] ✨ 전략 결정: ${urlInference.type} (default, confidence: ${Math.max(urlInference.confidence, 0.3).toFixed(2)})`
    );
    console.log(`${'='.repeat(60)}\n`);

    return {
      primaryStrategy: urlInference.type,
      fallbackStrategies: getDefaultFallbacks(urlInference.type),
      rssUrl: null,
      selectors: null,
      pagination: null,
      confidence: Math.max(urlInference.confidence, 0.3), // 최소 0.3
      detectionMethod: 'default',
      spaDetected: urlInference.type === 'SPA',
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
function discoverRSS(url: string, $: cheerio.CheerioAPI): string | null {
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

  // 2. 일반 RSS 경로 후보 (HEAD 요청은 생략, RSS 경로만 반환하여 validateRSSFeed에서 검증)
  const commonRssPaths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];

  for (const path of commonRssPaths) {
    const rssUrl = normalizeUrl(path, url);
    // 실제 검증은 validateRSSFeed에서 수행
    return rssUrl;
  }

  return null;
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
 * fetch 실패 시 URL 패턴만으로 추론
 */
function fallbackToUrlPattern(url: string): StrategyResolution {
  const urlInference = inferCrawlerTypeEnhanced(url);

  return {
    primaryStrategy: urlInference.type,
    fallbackStrategies: getDefaultFallbacks(urlInference.type),
    rssUrl: null,
    selectors: null,
    pagination: null,
    confidence: urlInference.confidence,
    detectionMethod: 'url-pattern',
    spaDetected: urlInference.type === 'SPA',
  };
}
