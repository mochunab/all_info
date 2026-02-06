// NEWSLETTER 크롤링 전략
// Stibee, Substack, Mailchimp 아카이브 지원

import * as cheerio from 'cheerio';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview } from '../content-extractor';
import { isWithinDays } from '../date-parser';

// 뉴스레터 플랫폼 감지
type NewsletterPlatform = 'stibee' | 'substack' | 'mailchimp' | 'generic';

// 플랫폼별 셀렉터
const PLATFORM_SELECTORS: Record<
  NewsletterPlatform,
  {
    item: string;
    title: string;
    link: string;
    date: string;
    thumbnail?: string;
    author?: string;
  }
> = {
  stibee: {
    item: '.archive-list-item, .letter-item, article',
    title: '.archive-list-title, .title, h2, h3',
    link: 'a',
    date: '.archive-list-date, .date, time',
  },
  substack: {
    item: '.post-preview, .post-item, article.post',
    title: '.post-preview-title, .post-title, h2',
    link: 'a',
    date: '.post-date, time, .pencraft',
    thumbnail: 'img',
    author: '.author-name, .pencraft .profile-hover-card-target',
  },
  mailchimp: {
    item: '.campaign, .archive-list-item, li.campaign-item',
    title: '.campaign-title, h2, h3, .title',
    link: 'a',
    date: '.campaign-date, .date, time',
  },
  generic: {
    item: 'article, .post, .newsletter-item, .archive-item, li',
    title: 'h2, h3, .title, a',
    link: 'a',
    date: '.date, time, .datetime, .published',
    thumbnail: 'img',
  },
};

export class NewsletterStrategy implements CrawlStrategy {
  readonly type = 'NEWSLETTER' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const config = parseConfig(source);
    const platform = this.detectPlatform(source.base_url);

    console.log(`[NEWSLETTER] Platform: ${platform}`);
    console.log(`[NEWSLETTER] Crawling: ${source.base_url}`);

    try {
      const html = await this.fetchPage(source.base_url);
      const items = this.parseItems(html, source.base_url, platform, config);

      console.log(`[NEWSLETTER] Found ${items.length} items`);
      return items;
    } catch (error) {
      console.error(`[NEWSLETTER] Crawl error:`, error);
      return [];
    }
  }

  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<string> {
    try {
      const html = await this.fetchPage(url);
      const platform = this.detectPlatform(url);

      // 플랫폼별 본문 셀렉터
      const contentSelectors: Record<NewsletterPlatform, string> = {
        stibee: '.stb-text-box, .letter-content, article',
        substack: '.body, .available-content, article',
        mailchimp: '.email-body, .campaign-content, article',
        generic: 'article, .content, .post-content, .newsletter-content',
      };

      const content = await extractContent(html, url, {
        content: contentSelectors[platform],
        ...config,
      });
      return generatePreview(content);
    } catch (error) {
      console.error(`[NEWSLETTER] Content crawl error:`, error);
      return '';
    }
  }

  private detectPlatform(url: string): NewsletterPlatform {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('stibee.com') || urlLower.includes('.stibee.')) {
      return 'stibee';
    }
    if (urlLower.includes('substack.com') || urlLower.includes('.substack.')) {
      return 'substack';
    }
    if (
      urlLower.includes('mailchimp.com') ||
      urlLower.includes('campaign-archive') ||
      urlLower.includes('us1.campaign-archive')
    ) {
      return 'mailchimp';
    }

    return 'generic';
  }

  private parseItems(
    html: string,
    baseUrl: string,
    platform: NewsletterPlatform,
    config: CrawlConfig
  ): RawContentItem[] {
    const items: RawContentItem[] = [];
    const $ = cheerio.load(html);
    const selectors = PLATFORM_SELECTORS[platform];
    const origin = new URL(baseUrl).origin;

    // 설정에서 셀렉터 오버라이드
    const finalSelectors = {
      ...selectors,
      ...config.selectors,
    };

    $(finalSelectors.item).each((_, el) => {
      try {
        const $el = $(el);

        // 제목
        const $title = $el.find(finalSelectors.title).first();
        const title = $title.text().trim() || $el.find('a').first().text().trim();
        if (!title || title.length < 5) return;

        // 링크
        const $link = $el.find(finalSelectors.link).first();
        let href = $link.attr('href');
        if (!href) {
          href = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
        }
        if (!href) return;

        // 절대 URL로 변환
        if (!href.startsWith('http')) {
          if (href.startsWith('//')) {
            href = `https:${href}`;
          } else {
            href = `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
          }
        }

        // 중복 방지를 위한 URL 정규화
        href = this.normalizeUrl(href);

        // 썸네일
        let thumbnail: string | null = null;
        if (finalSelectors.thumbnail) {
          const $thumb = $el.find(finalSelectors.thumbnail).first();
          thumbnail =
            $thumb.attr('src') ||
            $thumb.attr('data-src') ||
            $thumb.attr('data-lazy-src') ||
            null;
          if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = thumbnail.startsWith('//')
              ? `https:${thumbnail}`
              : `${origin}${thumbnail.startsWith('/') ? '' : '/'}${thumbnail}`;
          }
        }

        // 작성자
        let author: string | null = null;
        if (finalSelectors.author) {
          author = $el.find(finalSelectors.author).first().text().trim() || null;
        }

        // 날짜
        let dateStr: string | null = null;
        const $date = $el.find(finalSelectors.date).first();
        dateStr =
          $date.attr('datetime') ||
          $date.attr('content') ||
          $date.text().trim() ||
          null;

        // 7일 이내 필터링
        if (!isWithinDays(dateStr, 7, title)) {
          console.log(`[NEWSLETTER] SKIP (too old): ${title.substring(0, 40)}...`);
          return;
        }

        console.log(
          `[NEWSLETTER] Found: "${title.substring(0, 40)}..." | Date: ${dateStr || 'N/A'}`
        );

        items.push({
          title,
          link: href,
          thumbnail,
          author,
          dateStr,
        });
      } catch {
        // 개별 아이템 파싱 실패 무시
      }
    });

    return items;
  }

  private async fetchPage(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // 추적 파라미터 제거
      const paramsToRemove = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'mc_cid',
        'mc_eid',
        'ref',
      ];

      paramsToRemove.forEach((param) => {
        urlObj.searchParams.delete(param);
      });

      // trailing slash 제거
      let normalized = urlObj.toString();
      if (normalized.endsWith('/') && urlObj.pathname !== '/') {
        normalized = normalized.slice(0, -1);
      }

      return normalized;
    } catch {
      return url;
    }
  }
}

// 싱글톤 인스턴스
export const newsletterStrategy = new NewsletterStrategy();
