// Article - 크롤링된 게시글
export interface Article {
  id: string;
  source_id: string;
  source_name: string;
  source_url: string;
  title: string;
  thumbnail_url: string | null;
  content_preview: string | null;
  summary: string | null;
  ai_summary: string | null; // 1줄 요약 (80자 이내)
  summary_tags: string[]; // 요약 태그 3개
  author: string | null;
  published_at: string | null;
  crawled_at: string;
  priority: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 크롤러 타입 (Universal Crawler 전략)
export type CrawlerType =
  | 'STATIC'           // cheerio 기반 정적 HTML 파싱
  | 'SPA'              // puppeteer 기반 동적 렌더링
  | 'RSS'              // RSS/Atom 피드 파싱
  | 'PLATFORM_NAVER'   // 네이버 블로그
  | 'PLATFORM_KAKAO'   // 브런치 (카카오)
  | 'NEWSLETTER'       // Stibee, Substack, Mailchimp
  | 'API'              // REST API 호출
  | 'static'           // (레거시) cheerio
  | 'dynamic';         // (레거시) puppeteer

// CrawlSource - 크롤링 대상 사이트
export interface CrawlSource {
  id: number;
  name: string;
  base_url: string;
  priority: number;
  crawler_type: CrawlerType;
  config: Record<string, unknown>;
  is_active: boolean;
  last_crawled_at: string | null;
  created_at: string;
}

// CrawlLog - 크롤링 실행 로그
export interface CrawlLog {
  id: number;
  source_id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  articles_found: number;
  articles_new: number;
  error_message: string | null;
  created_at: string;
}

// ArticleFilter - 게시글 필터링 옵션
export interface ArticleFilter {
  search?: string;
  category?: string;
  source?: string;
  page?: number;
  limit?: number;
}

// ArticleListResponse - 게시글 목록 API 응답
export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// CrawlStatus - 크롤링 상태 조회 응답
export interface CrawlStatus {
  isRunning: boolean;
  lastRun: string | null;
  recentLogs: CrawlLog[];
  completedSources: number;
  totalSources: number;
  newArticles: number;
}

// 기본 카테고리 목록
export const DEFAULT_CATEGORIES = ['비즈니스', '소비 트렌드'] as const;

// 카테고리 목록 (전체 포함)
export const CATEGORIES = ['전체', ...DEFAULT_CATEGORIES] as const;

export type Category = (typeof CATEGORIES)[number] | string;

// 카테고리 인터페이스
export interface CategoryItem {
  id: number;
  name: string;
  is_default: boolean;
  created_at: string;
}

// 출처별 브랜드 컬러
export const SOURCE_COLORS: Record<string, string> = {
  '와이즈앱': '#4F46E5',
  '브런치': '#18A550',
  '리테일톡': '#DC2626',
  '스톤브릿지': '#7C3AED',
  '오픈애즈': '#0891B2',
  '아이컨슈머': '#EA580C',
  '바이브랜드': '#DB2777',
};

// 기본 브랜드 컬러 (매핑되지 않은 출처용)
export const DEFAULT_SOURCE_COLOR = '#6B7280';

// 번역 관련 타입
export type Language = 'ko' | 'en' | 'ja' | 'zh';

export const LANGUAGES = {
  ko: { code: 'ko', name: '한국어', flag: '🇰🇷', deepl: 'KO' },
  en: { code: 'en', name: 'English', flag: '🇺🇸', deepl: 'EN' },
  ja: { code: 'ja', name: '日本語', flag: '🇯🇵', deepl: 'JA' },
  zh: { code: 'zh', name: '中文', flag: '🇨🇳', deepl: 'ZH' },
} as const;

export interface TranslationCache {
  [articleId: string]: {
    [lang: string]: {
      title: string;
      ai_summary: string | null;
      summary: string | null;
      content_preview: string | null;
      cached_at: number; // timestamp
    };
  };
}
