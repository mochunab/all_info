// PLATFORM_NAVER 크롤링 전략
// 네이버 블로그 RSS 기반 + HTML 파싱 폴백

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview, htmlToText } from '../content-extractor';
import { isWithinDays } from '../date-parser';

// RSS 파서 인스턴스
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; InsightHub/1.0; +https://insight-hub.app)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
});

// 네이버 블로그 ID 추출 정규식
const NAVER_BLOG_ID_REGEX = /blog\.naver\.com\/([^/?]+)/;
const NAVER_POST_ID_REGEX = /logNo=(\d+)/;

export class NaverStrategy implements CrawlStrategy {
  readonly type = 'PLATFORM_NAVER' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const config = parseConfig(source);

    // 블로그 ID 추출
    const blogId = this.extractBlogId(source.base_url);
    if (!blogId) {
      console.error('[NAVER] Cannot extract blog ID from URL:', source.base_url);
      return [];
    }

    console.log(`[NAVER] Blog ID: ${blogId}`);

    // 1. RSS 시도
    const rssItems = await this.crawlViaRSS(blogId, config);
    if (rssItems.length > 0) {
      return rssItems;
    }

    // 2. HTML 파싱 폴백
    console.log('[NAVER] RSS failed, trying HTML parsing...');
    return this.crawlViaHTML(source.base_url, config);
  }

  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<string> {
    try {
      // 모바일 URL로 변환 (더 깔끔한 콘텐츠)
      const mobileUrl = this.toMobileUrl(url);

      const response = await fetch(mobileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const content = await extractContent(html, mobileUrl, {
        content: '.se-main-container, .post-view, #postViewArea, .se_component_wrap',
        ...config,
      });
      return generatePreview(content);
    } catch (error) {
      console.error(`[NAVER] Content crawl error:`, error);
      return '';
    }
  }

  private async crawlViaRSS(blogId: string, config: CrawlConfig): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];
    const rssUrl = `https://rss.blog.naver.com/${blogId}.xml`;

    console.log(`[NAVER] Fetching RSS: ${rssUrl}`);

    try {
      const feed = await parser.parseURL(rssUrl);

      console.log(`[NAVER] Feed title: ${feed.title}`);
      console.log(`[NAVER] Items count: ${feed.items?.length || 0}`);

      if (!feed.items || feed.items.length === 0) {
        return [];
      }

      for (const feedItem of feed.items) {
        try {
          const title = feedItem.title?.trim();
          const link = feedItem.link?.trim();

          if (!title || !link) continue;

          // 날짜
          const dateStr = feedItem.pubDate || feedItem.isoDate || null;

          // 7일 이내 필터링
          if (!isWithinDays(dateStr, 7, title)) {
            console.log(`[NAVER] SKIP (too old): ${title.substring(0, 40)}...`);
            continue;
          }

          // 본문 미리보기
          let content: string | undefined;
          if (feedItem.content || feedItem.contentSnippet) {
            content = generatePreview(htmlToText(feedItem.content || feedItem.contentSnippet || ''));
          }

          console.log(
            `[NAVER] Found: "${title.substring(0, 40)}..." | Date: ${dateStr || 'N/A'}`
          );

          items.push({
            title,
            link: this.normalizeUrl(link),
            thumbnail: null, // RSS에서는 썸네일 없음
            author: feedItem.creator || feedItem.author || null,
            dateStr,
            content,
          });
        } catch (error) {
          console.error('[NAVER] Parse item error:', error);
        }
      }

      console.log(`[NAVER] RSS valid items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[NAVER] RSS fetch error:`, error);
      return [];
    }
  }

  private async crawlViaHTML(baseUrl: string, config: CrawlConfig): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];

    try {
      // 포스트 목록 페이지
      const listUrl = this.getListUrl(baseUrl);
      console.log(`[NAVER] Fetching HTML: ${listUrl}`);

      const response = await fetch(listUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 네이버 블로그 포스트 목록 셀렉터
      const postSelectors = [
        '.blog-list-item',
        '.post-item',
        '.lst_tit a',
        '#listTopForm tr',
        '.blog2_post',
      ];

      for (const selector of postSelectors) {
        const elements = $(selector);
        if (elements.length === 0) continue;

        elements.each((_, el) => {
          try {
            const $el = $(el);

            // 제목과 링크
            const $link = $el.is('a') ? $el : $el.find('a').first();
            const title = $link.text().trim() || $el.find('.title, .tit').text().trim();
            let href = $link.attr('href');

            if (!title || !href) return;

            // 절대 URL로 변환
            if (!href.startsWith('http')) {
              href = `https://blog.naver.com${href.startsWith('/') ? '' : '/'}${href}`;
            }

            // 날짜
            const dateStr =
              $el.find('.date, .datetime, time').text().trim() ||
              $el.find('[datetime]').attr('datetime') ||
              null;

            // 7일 이내 필터링
            if (!isWithinDays(dateStr, 7, title)) {
              return;
            }

            items.push({
              title,
              link: this.normalizeUrl(href),
              thumbnail: null,
              author: null,
              dateStr,
            });
          } catch {
            // 개별 아이템 파싱 실패 무시
          }
        });

        if (items.length > 0) break; // 아이템을 찾았으면 중단
      }

      console.log(`[NAVER] HTML valid items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[NAVER] HTML fetch error:`, error);
      return [];
    }
  }

  private extractBlogId(url: string): string | null {
    // https://blog.naver.com/blogId 형식
    const match = url.match(NAVER_BLOG_ID_REGEX);
    if (match) {
      return match[1];
    }

    // config에서 지정된 경우
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts[0];
      }
    } catch {
      // URL 파싱 실패
    }

    return null;
  }

  private getListUrl(baseUrl: string): string {
    const blogId = this.extractBlogId(baseUrl);
    if (blogId) {
      return `https://blog.naver.com/PostList.naver?blogId=${blogId}&from=postList&categoryNo=0`;
    }
    return baseUrl;
  }

  private toMobileUrl(url: string): string {
    // 이미 모바일 URL인 경우
    if (url.includes('m.blog.naver.com')) {
      return url;
    }

    // PC URL을 모바일로 변환
    return url.replace('blog.naver.com', 'm.blog.naver.com');
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // 추적 파라미터 제거
      const paramsToRemove = ['Redirect', 'ref', 'trackingCode'];
      paramsToRemove.forEach((param) => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }
}

// 싱글톤 인스턴스
export const naverStrategy = new NaverStrategy();
