// 크롤러 전략 팩토리
// getStrategy()로 crawler_type에 따른 전략 인스턴스 반환

import type { CrawlerType, CrawlStrategy } from '../types';

// 전략 인스턴스들
import { staticStrategy } from './static';
import { rssStrategy } from './rss';
import { spaStrategy, closeBrowser } from './spa';
import { naverStrategy } from './naver';
import { kakaoStrategy } from './kakao';
import { newsletterStrategy } from './newsletter';
import { apiStrategy } from './api';

// 전략 맵 (대문자 키 + 레거시 소문자 지원)
const strategies: Record<string, CrawlStrategy> = {
  // 새로운 전략 (대문자)
  STATIC: staticStrategy,
  RSS: rssStrategy,
  SPA: spaStrategy,
  PLATFORM_NAVER: naverStrategy,
  PLATFORM_KAKAO: kakaoStrategy,
  NEWSLETTER: newsletterStrategy,
  API: apiStrategy,
  // 레거시 지원 (소문자)
  static: staticStrategy,
  dynamic: spaStrategy,
};

/**
 * crawler_type에 맞는 전략 인스턴스 반환
 * @param crawlerType 크롤러 타입
 * @returns CrawlStrategy 인스턴스
 * @throws Error if invalid crawler type
 */
export function getStrategy(crawlerType: CrawlerType): CrawlStrategy {
  const strategy = strategies[crawlerType];

  if (!strategy) {
    throw new Error(`Unknown crawler type: ${crawlerType}`);
  }

  return strategy;
}

/**
 * 지원되는 모든 크롤러 타입 반환
 */
export function getSupportedTypes(): CrawlerType[] {
  return Object.keys(strategies) as CrawlerType[];
}

/**
 * 크롤러 타입이 유효한지 확인
 */
export function isValidCrawlerType(type: string): type is CrawlerType {
  return type in strategies;
}

/**
 * URL 패턴으로 적절한 크롤러 타입 추론
 * (crawl_sources.crawler_type이 없을 때 폴백용)
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

  // 기본값: STATIC
  return 'STATIC';
}

// Re-export for convenience
export { closeBrowser };

// Re-export strategies for direct access if needed
export {
  staticStrategy,
  rssStrategy,
  spaStrategy,
  naverStrategy,
  kakaoStrategy,
  newsletterStrategy,
  apiStrategy,
};
