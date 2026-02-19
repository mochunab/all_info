// SPA 크롤링 전략
// puppeteer-core + @sparticuz/chromium 기반 동적 렌더링 지원 (Vercel 호환)

import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig, SelectorConfig, ContentResult } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview } from '../content-extractor';
import { isWithinDays } from '../date-parser';
import { processTitle } from '../title-cleaner';

// 기본 셀렉터
const DEFAULT_SELECTORS: SelectorConfig = {
  item: 'article, .article, .post, .item, .card, .list-item',
  title: 'h2, h3, h1, .title, .headline, a',
  link: 'a',
  thumbnail: 'img',
  author: '.author, .writer, .byline, .name',
  date: '.date, time, .time, .published, .datetime',
};

// 브라우저 인스턴스 (재사용)
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    // Vercel 환경 감지
    const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isVercel) {
      // Vercel Serverless: @sparticuz/chromium 사용
      browserInstance = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: null,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // 로컬 환경: 시스템 Chrome 사용
      browserInstance = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });
    }
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export class SPAStrategy implements CrawlStrategy {
  readonly type = 'SPA' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];
    const config = parseConfig(source);
    const browser = await getBrowser();
    let page: Page | null = null;

    console.log(`[SPA] Crawling: ${source.base_url}`);

    try {
      page = await browser.newPage();

      // User-Agent 설정
      await page.setUserAgent(
        config.crawl_config?.userAgent ||
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 불필요한 리소스 차단 (성능 향상)
      // + API 요청 로깅 (디버깅용)
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        const url = request.url();

        // API 요청 로깅
        if (url.includes('/api/') || url.includes('api.surfit.io')) {
          console.log(`[SPA] 🔍 API Request: ${request.method()} ${url}`);
        }

        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // API 응답 로깅
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') || url.includes('api.surfit.io')) {
          console.log(`[SPA] ✅ API Response: ${response.status()} ${url}`);

          // JSON 응답인 경우 일부 출력 (디버깅)
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            try {
              const data = await response.json();
              const preview = JSON.stringify(data).substring(0, 200);
              console.log(`[SPA] 📦 Response Preview: ${preview}...`);
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      });

      // 페이지 로드
      await page.goto(source.base_url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // 추가 대기 시간 (JavaScript 실행 완료 대기)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const crawlConfig = config.crawl_config as any;
      const additionalWait = crawlConfig?.additionalWait || 2000;
      await this.delay(additionalWait);
      console.log(`[SPA] Waited ${additionalWait}ms for JS execution`);

      // 특정 셀렉터 대기 (설정된 경우)
      if (crawlConfig?.waitForSelector) {
        console.log(`[SPA] Waiting for selector: ${crawlConfig.waitForSelector}`);
        await page.waitForSelector(crawlConfig.waitForSelector, {
          timeout: crawlConfig?.waitTimeout || 10000,
        });
        console.log(`[SPA] Selector found!`);
      }

      // 페이지네이션 처리
      if (config.pagination?.type === 'infinite_scroll') {
        await this.handleInfiniteScroll(page, config);
      } else if (config.pagination?.type === 'load_more') {
        await this.handleLoadMore(page, config);
      }

      // 아이템 추출
      const pageItems = await this.extractItems(page, config);
      items.push(...pageItems);

      console.log(`[SPA] Found ${items.length} items`);
      return items;
    } catch (error) {
      console.error(`[SPA] Crawl error:`, error);
      return [];
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<ContentResult> {
    const browser = await getBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      );

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // HTML 가져오기
      const html = await page.content();
      const content = await extractContent(html, url, config);
      const contentText = generatePreview(content);

      // 썸네일 추출 시도 (DOM 이미지 → 스크립트 내 이미지)
      const thumbnail = await page.evaluate(() => {
        // 1. DOM에서 큰 이미지 찾기 (프로필/아이콘 제외)
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          if (
            img.naturalWidth >= 200 &&
            img.naturalHeight >= 150 &&
            !img.alt?.includes('profile') &&
            !img.src?.includes('icon') &&
            !img.src?.includes('.svg')
          ) {
            return img.src;
          }
        }

        // 2. 스크립트 태그에서 콘텐츠 이미지 추출 (stibee 등 SPA)
        const scripts = document.querySelectorAll('script');
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        for (const s of scripts) {
          const text = s.textContent || '';
          const imgUrls = text.match(/https:\/\/img2\.stibee\.com\/\d+_\d+_[^"\\]+\.(jpg|jpeg|png|webp)/g);
          if (imgUrls && imgUrls.length > 0) {
            return imgUrls[0];
          }
        }

        // 3. og:image 폴백 (프로필 이미지가 아닌 경우만)
        if (ogImage && !ogImage.includes('profile')) {
          return ogImage;
        }

        return null;
      });

      if (thumbnail) {
        console.log(`[SPA] Extracted thumbnail: ${thumbnail.substring(0, 80)}...`);
        return { content: contentText, thumbnail };
      }

      return contentText;
    } catch (error) {
      console.error(`[SPA] Content crawl error:`, error);
      return '';
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async handleInfiniteScroll(page: Page, config: CrawlConfig): Promise<void> {
    const maxScrolls = config.pagination?.maxPages || 3;
    const scrollDelay = config.pagination?.scrollDelay || 1500;

    console.log(`[SPA] Handling infinite scroll (max: ${maxScrolls})`);

    let previousHeight = 0;

    for (let i = 0; i < maxScrolls; i++) {
      // 페이지 끝까지 스크롤
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // 콘텐츠 로딩 대기
      await this.delay(scrollDelay);

      // 새 콘텐츠가 로드되었는지 확인
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        console.log(`[SPA] No more content to load (scroll ${i + 1})`);
        break;
      }
      previousHeight = currentHeight;

      console.log(`[SPA] Scroll ${i + 1}/${maxScrolls}`);
    }
  }

  private async handleLoadMore(page: Page, config: CrawlConfig): Promise<void> {
    const maxClicks = config.pagination?.maxPages || 3;
    const loadMoreSelector = config.pagination?.loadMoreSelector || 'button.load-more, .more-btn, [data-load-more]';
    const clickDelay = config.pagination?.scrollDelay || 1500;

    console.log(`[SPA] Handling load more button (max: ${maxClicks})`);

    for (let i = 0; i < maxClicks; i++) {
      try {
        // 버튼 찾기
        const button = await page.$(loadMoreSelector);
        if (!button) {
          console.log(`[SPA] Load more button not found`);
          break;
        }

        // 버튼이 보이는지 확인
        const isVisible = await page.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }, button);

        if (!isVisible) {
          console.log(`[SPA] Load more button not visible`);
          break;
        }

        // 버튼 클릭
        await button.click();
        console.log(`[SPA] Clicked load more (${i + 1}/${maxClicks})`);

        // 콘텐츠 로딩 대기
        await this.delay(clickDelay);
      } catch (error) {
        console.log(`[SPA] Load more click error:`, error);
        break;
      }
    }
  }

  private async extractItems(page: Page, config: CrawlConfig): Promise<RawContentItem[]> {
    const selectors = { ...DEFAULT_SELECTORS, ...config.selectors };
    const baseUrl = config.link_processing?.baseUrl || new URL(page.url()).origin;

    // 컨테이너 셀렉터
    const containerSelector = config.selectors?.container || 'body';

    const linkTemplate = config.link_processing?.linkTemplate || null;

    const items = await page.evaluate(
      (params: {
        containerSelector: string;
        selectors: SelectorConfig;
        baseUrl: string;
        removeParams: string[];
        linkTemplate: string | null;
        excludeSelectors?: string[];
      }) => {
        const { containerSelector, selectors, baseUrl, removeParams, linkTemplate, excludeSelectors } = params;
        const results: RawContentItem[] = [];

        const container = document.querySelector(containerSelector);
        if (!container) return results;

        const elements = container.querySelectorAll(selectors.item);

        elements.forEach((el) => {
          try {
            // excludeSelectors 체크 - 제외 영역 안에 있는지 확인
            if (excludeSelectors?.length) {
              const isExcluded = excludeSelectors.some(excludeSel =>
                el.closest(excludeSel) !== null
              );
              if (isExcluded) {
                return;
              }
            }

            // 제목
            const titleEl = el.querySelector(selectors.title);
            const title = titleEl?.textContent?.trim() || el.querySelector('a')?.textContent?.trim();
            if (!title) return;

            // 링크
            const linkEl = el.querySelector(selectors.link) as HTMLAnchorElement;
            let href = linkEl?.getAttribute('href') || (el as HTMLAnchorElement).getAttribute?.('href') || el.querySelector('a')?.getAttribute('href');
            if (!href) return;

            // javascript: 링크 처리 (JSP/레거시 동적 페이지)
            if (href.startsWith('javascript:')) {
              if (linkTemplate) {
                // 함수 인자 추출: javascript:go_view(12345) → ['12345']
                const argsMatch = href.match(/\(([^)]*)\)/);
                if (argsMatch) {
                  const args = argsMatch[1].split(',').map(a => a.trim().replace(/['"]/g, ''));
                  let resolvedUrl = linkTemplate;
                  args.forEach((arg, i) => {
                    resolvedUrl = resolvedUrl.replace(`{${i}}`, arg);
                  });
                  try {
                    href = new URL(resolvedUrl, baseUrl).toString();
                  } catch {
                    href = `${baseUrl}${resolvedUrl}`;
                  }
                } else {
                  return; // 인자 추출 실패 시 스킵
                }
              } else {
                return; // linkTemplate 없으면 javascript: 링크 스킵
              }
            } else {
              // 일반 링크: 절대 URL로 변환
              try {
                const url = new URL(href, baseUrl);
                removeParams.forEach((param) => url.searchParams.delete(param));
                href = url.toString();
              } catch {
                // URL 파싱 실패시 원본 유지
              }
            }

            // 썸네일
            let thumbnail: string | null = null;
            if (selectors.thumbnail) {
              const thumbEl = el.querySelector(selectors.thumbnail) as HTMLImageElement;
              thumbnail =
                thumbEl?.src ||
                thumbEl?.getAttribute('data-src') ||
                thumbEl?.getAttribute('data-lazy-src') ||
                null;
            }

            // 작성자
            let author: string | null = null;
            if (selectors.author) {
              author = el.querySelector(selectors.author)?.textContent?.trim() || null;
            }

            // 날짜
            let dateStr: string | null = null;
            if (selectors.date) {
              const dateEl = el.querySelector(selectors.date);
              dateStr =
                dateEl?.getAttribute(selectors.dateAttribute || 'datetime') ||
                dateEl?.getAttribute('content') ||
                dateEl?.textContent?.trim() ||
                null;
            }

            results.push({
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

        return results;
      },
      {
        containerSelector,
        selectors,
        baseUrl,
        linkTemplate,
        removeParams: config.link_processing?.removeParams || [
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_content',
          'utm_term',
          'fbclid',
          'ref',
        ],
        excludeSelectors: config.excludeSelectors,
      }
    );

    // 제목 정제 + 7일 이내 필터링
    const filteredItems: RawContentItem[] = [];
    for (const item of items) {
      // 제목 정제 및 검증
      const cleanedTitle = processTitle(item.title);
      if (!cleanedTitle) {
        console.log(`[SPA] SKIP (invalid title): "${item.title.substring(0, 40)}..."`);
        continue;
      }

      // 7일 이내 체크
      if (!isWithinDays(item.dateStr, 14, cleanedTitle)) {
        console.log(`[SPA] SKIP (too old): ${cleanedTitle.substring(0, 40)}...`);
        continue;
      }

      console.log(
        `[SPA] Found: "${cleanedTitle.substring(0, 40)}..." | Date: ${item.dateStr || 'N/A'}`
      );

      filteredItems.push({
        ...item,
        title: cleanedTitle, // 정제된 제목으로 교체
      });
    }

    return filteredItems;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const spaStrategy = new SPAStrategy();
