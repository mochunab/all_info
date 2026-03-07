// URL 패턴 기반 크롤러 타입 추론
// 경량 모듈: Puppeteer 등 무거운 의존성 없음

import type { CrawlerType } from './types';

/**
 * URL 패턴으로 적절한 크롤러 타입 추론
 * (crawl_sources.crawler_type이 없을 때 폴백용)
 * @deprecated 가능하면 inferCrawlerTypeEnhanced() 사용 권장 (confidence 정보 포함)
 */
export function inferCrawlerType(url: string): CrawlerType {
  const urlLower = url.toLowerCase();

  // Sitemap (RSS 체크보다 앞에: sitemap.xml은 RSS가 아님)
  if (
    urlLower.includes('sitemap') &&
    (urlLower.includes('.xml') || urlLower.endsWith('sitemap'))
  ) {
    return 'SITEMAP';
  }

  // RSS 피드
  if (
    /\/rss(\/|$|\?|#)/.test(urlLower) ||
    /\/feed(\/|$|\?|#)/.test(urlLower) ||
    urlLower.includes('.xml') ||
    urlLower.includes('atom')
  ) {
    return 'RSS';
  }

  // 네이버
  if (urlLower.includes('blog.naver.com')) {
    return 'PLATFORM_NAVER';
  }

  // 카카오 (브런치)
  if (urlLower.includes('brunch.co.kr')) {
    return 'PLATFORM_KAKAO';
  }

  // 뉴스레터 플랫폼
  if (
    urlLower.includes('stibee.com') ||
    urlLower.includes('substack.com') ||
    urlLower.includes('mailchimp.com') ||
    urlLower.includes('campaign-archive')
  ) {
    return 'NEWSLETTER';
  }

  // API 엔드포인트
  if (
    urlLower.includes('/api/') ||
    urlLower.includes('.json') ||
    urlLower.includes('graphql')
  ) {
    return 'API';
  }

  // 기본값: SPA (안전한 선택 - JS 렌더링으로 대부분 페이지 크롤링 가능)
  return 'SPA';
}

/**
 * URL 패턴 추론 결과 (confidence 포함)
 */
export type InferenceResult = {
  type: CrawlerType;
  confidence: number; // 0~1 (0: 추측, 1: 확신)
};

/**
 * 콘텐츠 셀렉터 감지 결과
 */
export type SelectorDetectionResult = {
  selectors: {
    container?: string; // 메인 콘텐츠 컨테이너
    item: string; // 아티클 아이템
    title: string; // 제목
    link: string; // 링크
    date?: string; // 날짜 (선택)
    thumbnail?: string; // 썸네일 (선택)
  };
  excludeSelectors?: string[]; // 제외할 영역 (nav, header 등)
  confidence: number; // 0~1
  method: 'ai' | 'semantic' | 'fallback'; // 감지 방법
  reasoning?: string; // AI 판단 근거
};

/**
 * URL 패턴으로 크롤러 타입 추론 (강화 버전)
 * - CMS 감지 (WordPress, Tistory, Medium, Ghost)
 * - SPA 도메인 감지 (.go.kr 정부 포털 등)
 * - confidence 점수 반환
 */
export function inferCrawlerTypeEnhanced(url: string): InferenceResult {
  const urlLower = url.toLowerCase();
  console.log(`\n[inferCrawlerTypeEnhanced] 🔍 URL 패턴 분석: ${url}`);

  // 0. Google News RSS (URL 최적화 결과)
  if (urlLower.includes('news.google.com/rss')) {
    return { type: 'RSS', confidence: 0.95 };
  }

  // 0b. Naver News API (URL 최적화 결과)
  if (urlLower.includes('openapi.naver.com')) {
    return { type: 'API', confidence: 0.95 };
  }

  // 1. Sitemap (RSS 체크보다 앞에: sitemap.xml은 RSS가 아님)
  if (
    urlLower.includes('sitemap') &&
    (urlLower.includes('.xml') || urlLower.endsWith('sitemap'))
  ) {
    return { type: 'SITEMAP', confidence: 0.95 };
  }

  // 1b. RSS 피드 (confidence: 0.95)
  if (
    /\/rss(\/|$|\?|#)/.test(urlLower) ||
    /\/feed(\/|$|\?|#)/.test(urlLower) ||
    urlLower.includes('.xml') ||
    urlLower.includes('atom.xml')
  ) {
    return { type: 'RSS', confidence: 0.95 };
  }

  // 2. 플랫폼 특화 (confidence: 0.9)
  // 네이버
  if (urlLower.includes('blog.naver.com')) {
    return { type: 'PLATFORM_NAVER', confidence: 0.95 };
  }

  // 카카오 브런치
  if (urlLower.includes('brunch.co.kr')) {
    return { type: 'PLATFORM_KAKAO', confidence: 0.95 };
  }

  // 뉴스레터 플랫폼
  if (
    urlLower.includes('stibee.com') ||
    urlLower.includes('substack.com') ||
    urlLower.includes('mailchimp.com') ||
    urlLower.includes('campaign-archive')
  ) {
    return { type: 'NEWSLETTER', confidence: 0.9 };
  }

  // 3. API 엔드포인트 (confidence: 0.85+)
  // 일반 API 패턴만 감지 (도메인 하드코딩 금지 - AI 자동 감지 사용)
  if (
    urlLower.includes('/api/') ||
    urlLower.includes('.json') ||
    urlLower.includes('graphql')
  ) {
    return { type: 'API', confidence: 0.85 };
  }

  // 4. CMS 감지 (confidence: 0.75)
  // WordPress
  if (
    urlLower.includes('wp-content') ||
    urlLower.includes('wp-includes') ||
    urlLower.includes('wordpress')
  ) {
    return { type: 'STATIC', confidence: 0.75 }; // RSS 자동 발견 가능성 높음
  }

  // Tistory
  if (urlLower.includes('tistory.com')) {
    return { type: 'STATIC', confidence: 0.75 }; // RSS 피드 존재 가능성 높음
  }

  // Medium
  if (urlLower.includes('medium.com')) {
    return { type: 'STATIC', confidence: 0.75 };
  }

  // Ghost
  if (urlLower.includes('/ghost/')) {
    return { type: 'STATIC', confidence: 0.75 };
  }

  // 5. 알려진 SPA 도메인 (confidence: 0.95 - 매우 높음)
  // 정부/공공기관 포털 - 복잡한 구조로 rule-based 분석보다 우선
  if (
    urlLower.includes('.go.kr') ||
    urlLower.includes('.or.kr') ||
    urlLower.includes('nipa.kr') ||
    urlLower.includes('k-startup.go.kr')
  ) {
    console.log(`[inferCrawlerTypeEnhanced] ✅ 정부/공공기관 도메인 감지 → SPA (confidence: 0.95)`);
    return { type: 'SPA', confidence: 0.95 };
  }

  // React/Vue/Angular 프레임워크 힌트
  if (
    urlLower.includes('react-app') ||
    urlLower.includes('vue-app') ||
    urlLower.includes('angular')
  ) {
    return { type: 'SPA', confidence: 0.7 };
  }

  // 6. 기본값: SPA (안전한 선택 - 모든 페이지 크롤링 가능)
  // confidence 0.5: "확신은 없지만 작동은 함"
  console.log(`[inferCrawlerTypeEnhanced] ⚠️  기본값 사용 → SPA (confidence: 0.5)`);
  return { type: 'SPA', confidence: 0.5 };
}

