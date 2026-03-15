// STATIC 크롤링 전략
// axios + cheerio 기반 정적 HTML 파싱

import * as cheerio from 'cheerio';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig, SelectorConfig } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview } from '../content-extractor';
import { isWithinDays, extractDateFromText, MAX_ARTICLE_AGE_DAYS } from '../date-parser';
import { processTitle } from '../title-cleaner';
import { fetchWithTimeout, DEFAULT_HEADERS as BASE_HEADERS } from '../base';

const DEFAULT_HEADERS = {
  ...BASE_HEADERS,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// 기본 셀렉터
const DEFAULT_SELECTORS: SelectorConfig = {
  item: 'article, .article, .post, .item, .card, .list-item',
  title: 'h2, h3, h1, .title, .headline',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cachedHtml = (source as any)._cachedHtml as string | undefined;
      const mainPageItems = await this.crawlPage(source.base_url, config, source.name, cachedHtml);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sourceName: string,
    cachedHtml?: string
  ): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];

    try {
      const html = cachedHtml || await this.fetchPage(url);
      const $ = cheerio.load(html);

      const selectors = { ...DEFAULT_SELECTORS, ...config.selectors };
      const baseUrl = config.link_processing?.baseUrl || new URL(url).origin;

      // 컨테이너가 있으면 그 안에서만 찾기
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let $container: cheerio.Cheerio<any> = $('body');
      if (config.selectors?.container) {
        const $custom = $(config.selectors.container);
        if ($custom.length > 0) {
          $container = $custom;
        } else {
          console.warn(`[STATIC] ⚠️  Container not found: "${config.selectors.container}" → body fallback`);
        }
      }

      $container.find(selectors.item).each((_, element) => {
        try {
          const $el = $(element);

          // excludeSelectors 체크 - 제외 영역 안에 있는지 확인
          if (config.excludeSelectors?.length) {
            const isExcluded = config.excludeSelectors.some(excludeSel =>
              $el.closest(excludeSel).length > 0
            );
            if (isExcluded) {
              const excludedIn = config.excludeSelectors.find(sel => $el.closest(sel).length > 0);
              console.log(`[STATIC] SKIP (excluded area): ${excludedIn}`);
              return;
            }
          }

          const item = this.parseItem($, $el, selectors, baseUrl, config);

          if (item && item.title && item.link) {
            const skipDate = Boolean(source.config && '_skipDateFilter' in (source.config as object) && (source.config as Record<string, unknown>)._skipDateFilter);
            if (!skipDate && !isWithinDays(item.dateStr, MAX_ARTICLE_AGE_DAYS, item.title)) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $el: cheerio.Cheerio<any>,
    selectors: SelectorConfig,
    baseUrl: string,
    config: CrawlConfig
  ): RawContentItem | null {
    // 제목 (정제 + 검증)
    const $title = $el.find(selectors.title).first();
    const rawTitle = $title.text().trim() || $el.find('a').first().text().trim();
    if (!rawTitle) return null;

    const title = processTitle(rawTitle);
    if (!title) {
      console.log(`[STATIC] SKIP (invalid title): "${rawTitle.substring(0, 50)}..."`);
      return null;
    }

    // 링크
    const $link = $el.find(selectors.link).first();
    let href = $link.attr('href');
    if (!href) {
      // a 태그 자체인 경우
      href = $el.is('a') ? $el.attr('href') : $el.find('a').first().attr('href');
    }
    if (!href) return null;

    // javascript: / #hash+onclick 링크 처리 (JSP/레거시 동적 페이지)
    const linkTemplate = config.link_processing?.linkTemplate || null;
    let needsTemplate = false;
    let argsSource = '';

    if (href.startsWith('javascript:')) {
      needsTemplate = true;
      argsSource = href;
    } else if (href === '#' || (href.startsWith('#') && href.length <= 10)) {
      const onclickAttr = $link.attr('onclick') || $el.attr('onclick') || $el.find('a').first().attr('onclick');
      if (onclickAttr) {
        needsTemplate = true;
        argsSource = onclickAttr;
      }
    }

    if (needsTemplate) {
      if (linkTemplate) {
        const argsMatch = argsSource.match(/\(([^)]*)\)/);
        if (argsMatch) {
          const args = argsMatch[1].split(',').map((a: string) => a.trim().replace(/['"]/g, ''));
          let resolvedUrl = linkTemplate;
          args.forEach((arg: string, i: number) => {
            resolvedUrl = resolvedUrl.replace(`{${i}}`, arg);
          });
          href = resolvedUrl;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

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
    // fallback: 셀렉터로 날짜 못 찾으면 아이템 텍스트에서 패턴 추출
    if (!dateStr) {
      dateStr = extractDateFromText($el.text());
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
    const response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, timeout);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const staticStrategy = new StaticStrategy();
