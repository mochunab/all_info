// 크롤러 타입 정의

import type { CrawlSource } from '@/types';

// 크롤러 타입
export type CrawlerType =
  | 'STATIC'
  | 'SPA'
  | 'RSS'
  | 'PLATFORM_NAVER'
  | 'PLATFORM_KAKAO'
  | 'NEWSLETTER'
  | 'API';

// 원시 콘텐츠 아이템 (크롤링 결과)
export interface RawContentItem {
  title: string;
  link: string;
  thumbnail: string | null;
  author: string | null;
  dateStr: string | null;
  content?: string;
}

// 셀렉터 설정
export interface SelectorConfig {
  container?: string;
  item: string;
  title: string;
  link: string;
  thumbnail?: string;
  author?: string;
  date?: string;
  dateFormat?: string;
  dateAttribute?: string;
}

// 본문 추출 셀렉터
export interface ContentSelectors {
  content?: string;
  contentType?: 'text' | 'html';
  removeSelectors?: string[];
  useReadability?: boolean;
}

// 링크 처리 설정
export interface LinkProcessing {
  baseUrl?: string;
  removeParams?: string[];
}

// 페이지네이션 설정
export interface PaginationConfig {
  type: 'none' | 'page_param' | 'infinite_scroll' | 'load_more';
  param?: string;
  maxPages?: number;
  loadMoreSelector?: string;
  scrollDelay?: number;
}

// 크롤링 옵션
export interface CrawlOptions {
  waitForSelector?: string;
  waitTimeout?: number;
  delay?: number;
  rssUrl?: string;
  userAgent?: string;
}

// 전체 크롤링 설정 (crawl_sources.config JSONB)
export interface CrawlConfig {
  selectors?: SelectorConfig;
  content_selectors?: ContentSelectors;
  link_processing?: LinkProcessing;
  pagination?: PaginationConfig;
  crawl_config?: CrawlOptions;
  category?: string;
}

// 전략 인터페이스
export interface CrawlStrategy {
  readonly type: CrawlerType;
  crawlList(source: CrawlSource): Promise<RawContentItem[]>;
  crawlContent?(url: string, config?: ContentSelectors): Promise<string>;
}

// 크롤링 결과
export interface CrawlResult {
  found: number;
  new: number;
  errors: string[];
}

// 저장용 아티클 (articles 테이블 INSERT용)
export interface CrawledArticle {
  source_id: string;
  source_name: string;
  source_url: string;
  title: string;
  thumbnail_url?: string;
  content_preview?: string;
  summary?: string;
  author?: string;
  published_at?: string;
  category?: string;
}

// 유틸 함수 타입
export type CrawlerFunction = (source: CrawlSource) => Promise<CrawledArticle[]>;

// Config 타입 가드
export function isCrawlConfig(config: unknown): config is CrawlConfig {
  return typeof config === 'object' && config !== null;
}

// Config 파싱 헬퍼
export function parseConfig(source: CrawlSource): CrawlConfig {
  if (isCrawlConfig(source.config)) {
    return source.config;
  }
  return {};
}
