// STATIC 크롤링 전략
// axios + cheerio 기반 정적 HTML 파싱

import * as cheerio from 'cheerio';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig, SelectorConfig } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview, extractMetadata } from '../content-extractor';
import { parseDate, isWithinDays } from '../date-parser';

// 기본 헤더
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// 기본 셀렉터
const DEFAULT_SELECTORS: SelectorConfig = {
  item: 'article, .article, .post, .item, .card, .list-item, tr',
  title: 'h2, h3, h1, .title, .headline, a',
  link: 'a',
  thumbnail: 'img',
  author: '.author, .writer, .byline, .name',
  date: '.date, time, .time, .published, .datetime',
};

export class StaticStrategy implements CrawlStrategy {
  readonly type = 'STATIC' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];
    const config = parseConfig(source);

    console.log(`[STATIC] Crawling: ${source.base_url}`);

    try {
      // 메인 페이지 크롤링
      const mainPageItems = await this.crawlPage(source.base_url, config, source.name);
      items.push(...mainPageItems);

      // 페이지네이션 처리
      if (config.pagination?.type === 'page_param' && config.pagination.maxPages) {
        for (let page = 2; page <= config.pagination.maxPages; page++) {
          const param = config.pagination.param || 'page';
          const pageUrl = new URL(source.base_url);
          pageUrl.searchParams.set(param, page.toString());

          console.log(`[STATIC] Page ${page}: ${pageUrl.toString()}`);
          const pageItems = await this.crawlPage(pageUrl.toString(), config, source.name);

          if (pageItems.length === 0) break; // 더 이상 아이템이 없으면 중단
          items.push(...pageItems);

          // 요청 간 딜레이
          await this.delay(config.crawl_config?.delay || 1000);
        }
      }

      console.log(`[STATIC] Found ${items.length} items`);
      return items;
    } catch (error) {
      console.error(`[STATIC] Crawl error:`, error);
      return [];
    }
  }

  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<string> {
    try {
      const html = await this.fetchPage(url);
      const content = await extractContent(html, url, config);
      return generatePreview(content);
    } catch (error) {
      console.error(`[STATIC] Content crawl error:`, error);
      return '';
    }
  }

  private async crawlPage(
    url: string,
    config: CrawlConfig,
    sourceName: string
  ): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];

    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      const selectors = { ...DEFAULT_SELECTORS, ...config.selectors };
      const baseUrl = config.link_processing?.baseUrl || new URL(url).origin;

      // 컨테이너가 있으면 그 안에서만 찾기
      const $container = config.selectors?.container
        ? $(config.selectors.container)
        : $('body');

      $container.find(selectors.item).each((_, element) => {
        try {
          const $el = $(element);
          const item = this.parseItem($, $el, selectors, baseUrl, config);

          if (item && item.title && item.link) {
            // 7일 이내 필터링
            if (!isWithinDays(item.dateStr, 7, item.title)) {
              console.log(`[STATIC] SKIP (too old): ${item.title.substring(0, 40)}...`);
              return;
            }

            console.log(
              `[STATIC] Found: "${item.title.substring(0, 40)}..." | Date: ${item.dateStr || 'N/A'}`
            );
            items.push(item);
          }
        } catch (error) {
          console.error(`[STATIC] Parse item error:`, error);
        }
      });
    } catch (error) {
      console.error(`[STATIC] Fetch page error:`, error);
    }

    return items;
  }

  private parseItem(
    $: cheerio.CheerioAPI,
    $el: ReturnType<typeof $.root>,
    selectors: SelectorConfig,
    baseUrl: string,
    config: CrawlConfig
  ): RawContentItem | null {
    // 제목
    const $title = $el.find(selectors.title).first();
    const title = $title.text().trim() || $el.find('a').first().text().trim();
    if (!title) return null;

    // 링크
    const $link = $el.find(selectors.link).first();
    let href = $link.attr('href');
    if (!href) {
      // a 태그 자체인 경우
      href = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
    }
    if (!href) return null;

    const link = this.normalizeUrl(href, baseUrl, config.link_processing?.removeParams);

    // 썸네일
    let thumbnail: string | null = null;
    if (selectors.thumbnail) {
      const $thumb = $el.find(selectors.thumbnail).first();
      thumbnail =
        $thumb.attr('src') ||
        $thumb.attr('data-src') ||
        $thumb.attr('data-lazy-src') ||
        null;
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = thumbnail.startsWith('//')
          ? `https:${thumbnail}`
          : `${baseUrl}${thumbnail.startsWith('/') ? '' : '/'}${thumbnail}`;
      }
    }

    // 작성자
    let author: string | null = null;
    if (selectors.author) {
      author = $el.find(selectors.author).first().text().trim() || null;
    }

    // 날짜
    let dateStr: string | null = null;
    if (selectors.date) {
      const $date = $el.find(selectors.date).first();
      // datetime 속성 우선
      dateStr =
        $date.attr(selectors.dateAttribute || 'datetime') ||
        $date.attr('content') ||
        $date.text().trim() ||
        null;
    }

    return {
      title,
      link,
      thumbnail,
      author,
      dateStr,
    };
  }

  private normalizeUrl(
    href: string,
    baseUrl: string,
    removeParams?: string[]
  ): string {
    // 절대 URL로 변환
    let url: URL;
    try {
      if (href.startsWith('http')) {
        url = new URL(href);
      } else if (href.startsWith('//')) {
        url = new URL(`https:${href}`);
      } else {
        url = new URL(href, baseUrl);
      }
    } catch {
      return href;
    }

    // 추적 파라미터 제거
    const paramsToRemove = removeParams || [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'fbclid',
      'gclid',
      'ref',
    ];

    paramsToRemove.forEach((param) => {
      url.searchParams.delete(param);
    });

    // trailing slash 제거
    let normalized = url.toString();
    if (normalized.endsWith('/') && url.pathname !== '/') {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  }

  private async fetchPage(url: string, timeout: number = 15000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: DEFAULT_HEADERS,
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const staticStrategy = new StaticStrategy();
