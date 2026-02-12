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

  // RSS 피드
  if (
    urlLower.includes('/rss') ||
    urlLower.includes('/feed') ||
    urlLower.includes('.xml') ||
    urlLower.includes('atom')
  ) {
    return 'RSS';
  }

  // 네이버
  if (urlLower.includes('blog.naver.com') || urlLower.includes('naver.com')) {
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
 * URL 패턴으로 크롤러 타입 추론 (강화 버전)
 * - CMS 감지 (WordPress, Tistory, Medium, Ghost)
 * - SPA 도메인 감지 (.go.kr 정부 포털 등)
 * - confidence 점수 반환
 */
export function inferCrawlerTypeEnhanced(url: string): InferenceResult {
  const urlLower = url.toLowerCase();

  // 1. RSS 피드 (confidence: 0.95)
  if (
    urlLower.includes('/rss') ||
    urlLower.includes('/feed') ||
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
  if (urlLower.includes('naver.com')) {
    return { type: 'PLATFORM_NAVER', confidence: 0.85 };
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

  // 3. API 엔드포인트 (confidence: 0.85)
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
  // 정부 포털 (.go.kr) - 복잡한 구조로 rule-based 분석보다 우선
  if (
    urlLower.includes('.go.kr') ||
    urlLower.includes('.or.kr') ||
    urlLower.includes('k-startup.go.kr')
  ) {
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
  return { type: 'SPA', confidence: 0.5 };
}
