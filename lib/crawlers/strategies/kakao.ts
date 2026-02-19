// PLATFORM_KAKAO 크롤링 전략
// 브런치(Brunch) RSS 기반 + HTML 파싱 폴백

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview, htmlToText } from '../content-extractor';
import { isWithinDays } from '../date-parser';
import { processTitle } from '../title-cleaner';

// RSS 파서 인스턴스
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; InsightHub/1.0; +https://insight-hub.app)',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
    ],
  },
});

// 브런치 작가 ID 추출 정규식
const BRUNCH_AUTHOR_REGEX = /brunch\.co\.kr\/@([^/?]+)/;
const BRUNCH_MAGAZINE_REGEX = /brunch\.co\.kr\/magazine\/(\d+)/;

export class KakaoStrategy implements CrawlStrategy {
  readonly type = 'PLATFORM_KAKAO' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const config = parseConfig(source);

    // 작가 ID 또는 매거진 ID 추출
    const authorId = this.extractAuthorId(source.base_url);
    const magazineId = this.extractMagazineId(source.base_url);

    if (authorId) {
      console.log(`[KAKAO] Brunch author: @${authorId}`);
      return this.crawlAuthor(authorId, config);
    } else if (magazineId) {
      console.log(`[KAKAO] Brunch magazine: ${magazineId}`);
      return this.crawlMagazine(magazineId, config);
    } else {
      console.error('[KAKAO] Cannot identify Brunch URL type:', source.base_url);
      return this.crawlGeneric(source.base_url, config);
    }
  }

  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const content = await extractContent(html, url, {
        content: '.wrap_body, .wrap_article_body, article .text',
        ...config,
      });
      return generatePreview(content);
    } catch (error) {
      console.error(`[KAKAO] Content crawl error:`, error);
      return '';
    }
  }

  private async crawlAuthor(authorId: string, config: CrawlConfig): Promise<RawContentItem[]> {
    // 1. RSS 시도
    const rssUrl = `https://brunch.co.kr/rss/@@${authorId}`;
    console.log(`[KAKAO] Fetching RSS: ${rssUrl}`);

    const rssItems = await this.crawlViaRSS(rssUrl, config);
    if (rssItems.length > 0) {
      return rssItems;
    }

    // 2. HTML 파싱 폴백
    console.log('[KAKAO] RSS failed, trying HTML parsing...');
    return this.crawlAuthorHTML(authorId, config);
  }

  private async crawlMagazine(magazineId: string, config: CrawlConfig): Promise<RawContentItem[]> {
    // 매거진은 RSS가 없으므로 HTML 파싱
    const url = `https://brunch.co.kr/magazine/${magazineId}`;
    return this.crawlMagazineHTML(url, config);
  }

  private async crawlGeneric(url: string, config: CrawlConfig): Promise<RawContentItem[]> {
    // 일반 브런치 페이지 크롤링
    return this.crawlBrunchHTML(url, config);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async crawlViaRSS(rssUrl: string, config: CrawlConfig): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];

    try {
      const feed = await parser.parseURL(rssUrl);

      console.log(`[KAKAO] Feed title: ${feed.title}`);
      console.log(`[KAKAO] Items count: ${feed.items?.length || 0}`);

      if (!feed.items || feed.items.length === 0) {
        return [];
      }

      for (const feedItem of feed.items) {
        try {
          const item = this.parseFeedItem(feedItem);
          if (!item) continue;

          // 7일 이내 필터링
          if (!isWithinDays(item.dateStr, 14, item.title)) {
            console.log(`[KAKAO] SKIP (too old): ${item.title.substring(0, 40)}...`);
            continue;
          }

          console.log(
            `[KAKAO] Found: "${item.title.substring(0, 40)}..." | Date: ${item.dateStr || 'N/A'}`
          );
          items.push(item);
        } catch (error) {
          console.error('[KAKAO] Parse item error:', error);
        }
      }

      console.log(`[KAKAO] RSS valid items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[KAKAO] RSS fetch error:`, error);
      return [];
    }
  }

  private parseFeedItem(
    feedItem: Parser.Item & { contentEncoded?: string; creator?: string }
  ): RawContentItem | null {
    const rawTitle = feedItem.title?.trim();
    if (!rawTitle) return null;

    const title = processTitle(rawTitle);
    if (!title) {
      console.log(`[PLATFORM_KAKAO] SKIP (invalid title): "${rawTitle.substring(0, 50)}..."`);
      return null;
    }

    let link = feedItem.link?.trim();
    if (!link) return null;

    // URL 정규화
    link = this.normalizeUrl(link);

    // 썸네일 추출 (content에서)
    let thumbnail: string | null = null;
    const rawContent = feedItem.contentEncoded || feedItem.content || '';
    if (rawContent) {
      const imgMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1] && !imgMatch[1].startsWith('data:')) {
        thumbnail = imgMatch[1];
      }
    }

    // 작성자
    const author = feedItem.creator || (feedItem as Record<string, unknown>).author as string || null;

    // 날짜
    const dateStr = feedItem.pubDate || feedItem.isoDate || null;

    // 본문 미리보기
    let content: string | undefined;
    if (rawContent) {
      content = generatePreview(htmlToText(rawContent));
    }

    return {
      title,
      link,
      thumbnail,
      author,
      dateStr,
      content,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async crawlAuthorHTML(authorId: string, config: CrawlConfig): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];
    const url = `https://brunch.co.kr/@${authorId}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 브런치 작가 페이지 포스트 목록
      $('.list_article li, .wrap_article_list li, article.card').each((_, el) => {
        try {
          const $el = $(el);
          const $link = $el.find('a').first();
          const rawTitle = $el.find('.tit_article, .title, h2').text().trim();
          let href = $link.attr('href');

          if (!rawTitle || !href) return;

          const title = processTitle(rawTitle);
          if (!title) {
            console.log(`[PLATFORM_KAKAO] SKIP (invalid title): "${rawTitle.substring(0, 50)}..."`);
            return;
          }

          // 절대 URL로 변환
          if (!href.startsWith('http')) {
            href = `https://brunch.co.kr${href.startsWith('/') ? '' : '/'}${href}`;
          }

          // 썸네일
          const $thumb = $el.find('img').first();
          const thumbnail =
            $thumb.attr('src') || $thumb.attr('data-src') || null;

          // 날짜
          const dateStr = $el.find('.publish_time, .date, time').text().trim() || null;

          // 7일 이내 필터링
          if (!isWithinDays(dateStr, 14, title)) {
            return;
          }

          items.push({
            title,
            link: this.normalizeUrl(href),
            thumbnail,
            author: authorId,
            dateStr,
          });
        } catch {
          // 개별 아이템 파싱 실패 무시
        }
      });

      console.log(`[KAKAO] HTML valid items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[KAKAO] HTML fetch error:`, error);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async crawlMagazineHTML(url: string, config: CrawlConfig): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 매거진 아티클 목록
      $('.list_magazine_article li, .article_item, article').each((_, el) => {
        try {
          const $el = $(el);
          const $link = $el.find('a').first();
          const rawTitle = $el.find('.tit_article, .title, h3').text().trim();
          let href = $link.attr('href');

          if (!rawTitle || !href) return;

          const title = processTitle(rawTitle);
          if (!title) {
            console.log(`[PLATFORM_KAKAO] SKIP (invalid title): "${rawTitle.substring(0, 50)}..."`);
            return;
          }

          // 절대 URL로 변환
          if (!href.startsWith('http')) {
            href = `https://brunch.co.kr${href.startsWith('/') ? '' : '/'}${href}`;
          }

          // 썸네일
          const $thumb = $el.find('img').first();
          const thumbnail = $thumb.attr('src') || $thumb.attr('data-src') || null;

          // 작성자
          const author = $el.find('.author, .writer').text().trim() || null;

          // 날짜
          const dateStr = $el.find('.date, time').text().trim() || null;

          // 7일 이내 필터링
          if (!isWithinDays(dateStr, 14, title)) {
            return;
          }

          items.push({
            title,
            link: this.normalizeUrl(href),
            thumbnail,
            author,
            dateStr,
          });
        } catch {
          // 개별 아이템 파싱 실패 무시
        }
      });

      console.log(`[KAKAO] Magazine HTML items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[KAKAO] Magazine fetch error:`, error);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async crawlBrunchHTML(url: string, config: CrawlConfig): Promise<RawContentItem[]> {
    // 일반적인 브런치 페이지 크롤링 (메인, 토픽 등)
    const items: RawContentItem[] = [];

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 다양한 셀렉터 시도
      $('article, .wrap_article, .card_article, li.list_item').each((_, el) => {
        try {
          const $el = $(el);
          const $link = $el.find('a[href*="/@"]').first();
          const rawTitle =
            $el.find('.tit_article, .title, h2, h3').first().text().trim() ||
            $link.text().trim();
          let href = $link.attr('href');

          if (!rawTitle || !href) return;

          const title = processTitle(rawTitle);
          if (!title) {
            console.log(`[PLATFORM_KAKAO] SKIP (invalid title): "${rawTitle.substring(0, 50)}..."`);
            return;
          }

          // 절대 URL로 변환
          if (!href.startsWith('http')) {
            href = `https://brunch.co.kr${href.startsWith('/') ? '' : '/'}${href}`;
          }

          // 썸네일
          const $thumb = $el.find('img').first();
          const thumbnail = $thumb.attr('src') || $thumb.attr('data-src') || null;

          // 작성자
          const author = $el.find('.name_author, .author').text().trim() || null;

          // 날짜
          const dateStr = $el.find('.date, time, .publish_time').text().trim() || null;

          // 7일 이내 필터링
          if (!isWithinDays(dateStr, 14, title)) {
            return;
          }

          items.push({
            title,
            link: this.normalizeUrl(href),
            thumbnail,
            author,
            dateStr,
          });
        } catch {
          // 개별 아이템 파싱 실패 무시
        }
      });

      console.log(`[KAKAO] Generic HTML items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[KAKAO] Generic fetch error:`, error);
      return [];
    }
  }

  private extractAuthorId(url: string): string | null {
    const match = url.match(BRUNCH_AUTHOR_REGEX);
    return match ? match[1] : null;
  }

  private extractMagazineId(url: string): string | null {
    const match = url.match(BRUNCH_MAGAZINE_REGEX);
    return match ? match[1] : null;
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // 추적 파라미터 제거
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'];
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
export const kakaoStrategy = new KakaoStrategy();
