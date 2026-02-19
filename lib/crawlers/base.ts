import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { CrawlSource } from '@/types';

// Crawled article before database insertion
export interface CrawledArticle {
  source_id: string;
  source_name: string;
  source_url: string;
  title: string;
  thumbnail_url?: string;
  content_preview?: string;
  author?: string;
  published_at?: string;
  category?: string;
}

// Crawl result summary
export interface CrawlResult {
  found: number;
  new: number;
  errors: string[];
}

// Base crawler interface
export interface BaseCrawler {
  name: string;
  crawl(source: CrawlSource): Promise<CrawledArticle[]>;
}

// Crawler configuration from source config
export interface CrawlerConfig {
  category?: string;
  selectors?: {
    list?: string;
    title?: string;
    link?: string;
    thumbnail?: string;
    author?: string;
    date?: string;
    content?: string;
  };
  dateFormat?: string;
  maxPages?: number;
  waitTime?: number;
}

// User agent for crawling
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Request headers
export const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Fetch with timeout to prevent hanging
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Save articles to database
export async function saveArticles(
  articles: CrawledArticle[],
  supabase: SupabaseClient<Database>
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  console.log(`\n[DB] Attempting to save ${articles.length} articles...`);

  for (const article of articles) {
    console.log(`[DB] Processing: "${article.title.substring(0, 50)}..." | Date: ${article.published_at || 'N/A'} | Source: ${article.source_name}`);

    // 품질 검증 (쓰레기 데이터 필터링)
    const validation = isValidArticle(article);
    if (!validation.valid) {
      console.log(`[DB] SKIP (품질 실패): "${article.title.substring(0, 30)}..." - ${validation.reason}`);
      skipped++;
      continue;
    }

    // Check if article already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('articles')
      .select('id')
      .eq('source_id', article.source_id)
      .single();

    if (existing) {
      console.log(`[DB] SKIP (already exists): "${article.title.substring(0, 30)}..."`);
      skipped++;
      continue;
    }

    // Insert new article
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('articles').insert({
      source_id: article.source_id,
      source_name: article.source_name,
      source_url: article.source_url,
      title: article.title,
      thumbnail_url: article.thumbnail_url || null,
      content_preview: article.content_preview || null,
      author: article.author || null,
      published_at: article.published_at || null,
      category: article.category || null,
    });

    if (error) {
      console.error(`[DB] FAIL to save: "${article.title.substring(0, 30)}..."`, error.message);
      skipped++;
    } else {
      console.log(`[DB] SAVED: "${article.title.substring(0, 30)}..."`);
      saved++;
    }
  }

  console.log(`[DB] Save complete: ${saved} saved, ${skipped} skipped\n`);
  return { saved, skipped };
}

// 네비게이션/메뉴 키워드 (쓰레기 데이터 필터링)
const GARBAGE_KEYWORDS = [
  '홈',
  '로그인',
  '회원가입',
  '마이페이지',
  '고객센터',
  '공지사항',
  '이벤트',
  '문의하기',
  '회사소개',
  '이용약관',
  '개인정보',
  '카테고리',
  '전체보기',
  '더보기',
  '검색',
  '알림',
  '설정',
  '비교하기',
  '순위',
  '랭킹',
];

/**
 * 아티클 품질 검증
 * - 네비게이션 메뉴, 쓰레기 데이터 필터링
 * - 너무 짧거나 의미 없는 제목 필터링
 */
export function isValidArticle(article: CrawledArticle): { valid: boolean; reason?: string } {
  const title = article.title.trim();

  // 1. 제목이 너무 짧음 (3자 미만)
  if (title.length < 3) {
    return { valid: false, reason: '제목이 너무 짧음' };
  }

  // 2. 제목이 숫자나 특수문자만 포함
  if (/^[\d\s\W]+$/.test(title)) {
    return { valid: false, reason: '제목이 숫자/특수문자만 포함' };
  }

  // 3. 쓰레기 키워드 포함 (정확히 일치하는 경우만)
  const titleLower = title.toLowerCase().replace(/\s+/g, '');
  for (const keyword of GARBAGE_KEYWORDS) {
    const keywordLower = keyword.toLowerCase().replace(/\s+/g, '');
    if (titleLower === keywordLower || titleLower.startsWith(keywordLower)) {
      return { valid: false, reason: `쓰레기 키워드: "${keyword}"` };
    }
  }

  // 4. "공지" + 숫자/특수문자 패턴 (retailtalk의 "공지 3 min..." 같은 케이스)
  if (/^공지[\s\d\W]*$/.test(title)) {
    return { valid: false, reason: '공지 + 숫자 패턴' };
  }

  // 5. 제목에 "min read" 같은 UI 요소 포함
  if (/\d+\s*min\s*(read)?/.test(title)) {
    return { valid: false, reason: 'UI 요소 포함 (min read)' };
  }

  // 6. 본문이 너무 짧음 (50자 미만) - 경고만, 필터링은 하지 않음
  if (article.content_preview && article.content_preview.length < 50) {
    console.warn(`[Quality] 본문이 짧음 (${article.content_preview.length}자): "${title.substring(0, 30)}..."`);
  }

  return { valid: true };
}

// Check if date is within the last N days
export function isWithinDays(dateString: string | undefined, days: number, title?: string): boolean {
  if (!dateString) {
    console.log(`[Filter] No date for "${title?.substring(0, 30) || 'Unknown'}..." - INCLUDE (no date)`);
    return true; // Include if no date
  }

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const withinRange = diffDays <= days;

    if (!withinRange) {
      console.log(`[Filter] "${title?.substring(0, 30) || 'Unknown'}..." - EXCLUDE (${diffDays} days old, max ${days})`);
    }

    return withinRange;
  } catch {
    console.log(`[Filter] Date parse error for "${title?.substring(0, 30) || 'Unknown'}..." - INCLUDE (parse error)`);
    return true; // Include if date parsing fails
  }
}

// Parse Korean relative date (e.g., "3시간 전", "2일 전")
export function parseKoreanRelativeDate(text: string): Date {
  const now = new Date();
  const cleanText = text.trim();

  // Match patterns like "3시간 전", "2일 전", "1분 전"
  const match = cleanText.match(/(\d+)(초|분|시간|일|주|개월|년)\s*전/);

  if (!match) {
    // Try to parse as absolute date
    const date = new Date(text);
    return isNaN(date.getTime()) ? now : date;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case '초':
      return new Date(now.getTime() - value * 1000);
    case '분':
      return new Date(now.getTime() - value * 60 * 1000);
    case '시간':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case '일':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case '주':
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case '개월':
      return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    case '년':
      return new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000);
    default:
      return now;
  }
}

// Parse date in various formats
export function parseDate(dateString: string): Date | null {
  const cleanText = dateString.trim();

  // Try Korean relative date first
  if (cleanText.includes('전') || cleanText.includes('방금')) {
    return parseKoreanRelativeDate(cleanText);
  }

  // Try standard date formats
  const formats = [
    // ISO 8601
    /^\d{4}-\d{2}-\d{2}/,
    // Korean format: 2024년 1월 15일
    /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
    // Dot format: 2024.01.15
    /^\d{4}\.\d{2}\.\d{2}/,
    // Slash format: 2024/01/15
    /^\d{4}\/\d{2}\/\d{2}/,
  ];

  for (const format of formats) {
    if (format.test(cleanText)) {
      const normalized = cleanText
        .replace(/년\s*/g, '-')
        .replace(/월\s*/g, '-')
        .replace(/일/g, '')
        .replace(/\./g, '-')
        .replace(/\//g, '-');

      const date = new Date(normalized);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Try direct parsing
  const date = new Date(cleanText);
  return isNaN(date.getTime()) ? null : date;
}
