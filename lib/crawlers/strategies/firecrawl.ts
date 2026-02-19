/**
 * Firecrawl 전략 (리스트 추출만 사용, 본문은 기존 방식)
 * - crawlList: Firecrawl API로 아티클 목록 추출 (1 credit/소스)
 * - crawlContent: 기존 Cheerio + Readability 사용 (무료)
 */

import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem } from '../types';
import { scrapeAndExtract } from '../firecrawl-client';
import { extractContent } from '../content-extractor';
import { isWithinDays } from '../base';

const ARTICLE_LIST_SCHEMA = {
  type: 'object',
  properties: {
    articles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '아티클 제목' },
          url: { type: 'string', description: '아티클 전체 URL (상대 경로면 절대 경로로 변환)' },
          date: { type: 'string', description: '게시 날짜 (YYYY-MM-DD 또는 상대 날짜)' },
          thumbnail_url: { type: 'string', description: '썸네일 이미지 URL (선택)' },
          content_preview: { type: 'string', description: '아티클 요약/발췌문 (선택)' },
        },
        required: ['title', 'url'],
      },
    },
  },
  required: ['articles'],
};

const EXTRACTION_PROMPT = `Extract ONLY the main content articles/blog posts from this page. DO NOT extract navigation menus, headers, footers, or sidebars.

**CRITICAL RULES**:
1. IGNORE all navigation menu items (Home, About, Categories, etc.)
2. IGNORE header/footer links
3. ONLY extract items that are ACTUAL ARTICLES with:
   - A descriptive title (NOT a menu label)
   - A unique URL that goes to an article page
   - Optionally: publication date, thumbnail image, excerpt

**What to extract**:
- Blog posts, articles, insights, news items
- Each item should represent REAL CONTENT, not a navigation link
- Look for repeating patterns of article cards/listings in the main content area
- Convert relative URLs to absolute URLs using the current domain

**Example of CORRECT extraction**:
- "데이터로 보는 2024년 앱 트렌드 분석" ✅
- "카카오톡 vs 네이버 사용자 행동 비교" ✅

**Example of WRONG extraction (DO NOT INCLUDE)**:
- "홈" ❌ (navigation menu)
- "회사소개" ❌ (navigation menu)
- "로그인" ❌ (navigation menu)
- "카테고리" ❌ (navigation menu)`;

export const firecrawlStrategy: CrawlStrategy = {
  type: 'FIRECRAWL',

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const url = source.base_url;
    console.log(`[FIRECRAWL] Extracting article list from: ${url}`);

    try {
      // Firecrawl API로 아티클 목록 추출 (1 credit)
      const result = await scrapeAndExtract(url, ARTICLE_LIST_SCHEMA, EXTRACTION_PROMPT);

      if (!result.articles || !Array.isArray(result.articles)) {
        console.warn('[FIRECRAWL] No articles array in response');
        return [];
      }

      console.log(`[FIRECRAWL] Extracted ${result.articles.length} articles`);

      // RawContentItem[]으로 변환
      const items: RawContentItem[] = result.articles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((article: any) => {
          // URL 정규화 (상대 경로 → 절대 경로)
          let normalizedUrl = article.url;
          if (normalizedUrl && !normalizedUrl.startsWith('http')) {
            const baseURL = new URL(url);
            normalizedUrl = new URL(normalizedUrl, baseURL.origin).href;
          }

          // URL 유효성 검증 (같은 도메인만)
          try {
            const articleURL = new URL(normalizedUrl);
            const sourceURL = new URL(url);
            if (articleURL.hostname !== sourceURL.hostname) {
              console.warn(`[FIRECRAWL] Skipping external URL: ${normalizedUrl}`);
              return null;
            }
          } catch {
            console.warn(`[FIRECRAWL] Invalid URL: ${normalizedUrl}`);
            return null;
          }

          return {
            title: article.title,
            link: normalizedUrl,
            dateStr: article.date || undefined,
            thumbnail: article.thumbnail_url || undefined,
            content: article.content_preview || undefined,
            author: undefined,
          };
        })
        .filter((item: RawContentItem | null): item is RawContentItem => item !== null);

      // 날짜 필터링 (최근 7일)
      const filtered = items.filter((item) => {
        if (!item.dateStr) return true; // 날짜 없으면 포함
        return isWithinDays(item.dateStr, 14);
      });

      console.log(`[FIRECRAWL] After date filter: ${filtered.length}/${items.length} articles`);
      return filtered;
    } catch (error) {
      console.error('[FIRECRAWL] crawlList failed:', error);
      throw error;
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async crawlContent(url: string, config?: any): Promise<string> {
    console.log(`[FIRECRAWL] Extracting content (using FREE method): ${url}`);

    try {
      // ✅ Firecrawl 대신 기존 무료 방식 사용
      const result = await extractContent('', url, config);
      return result || '';
    } catch (error) {
      console.error('[FIRECRAWL] crawlContent failed:', error);
      throw error;
    }
  },
};
