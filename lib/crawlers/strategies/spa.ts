// SPA 크롤링 전략
// puppeteer-core + @sparticuz/chromium 기반 동적 렌더링 지원 (Vercel 호환)

import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig, SelectorConfig, ContentResult } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview } from '../content-extractor';
import { isWithinDays, MAX_ARTICLE_AGE_DAYS, extractDateFromText } from '../date-parser';
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
    const browser = browserInstance;
    browserInstance = null;
    try {
      // 5초 내 정상 종료 시도, 실패 시 프로세스 강제 종료
      await Promise.race([
        browser.close(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Browser close timeout')), 5000)
        ),
      ]);
    } catch {
      console.warn('[SPA] ⚠️  브라우저 정상 종료 실패 — 프로세스 강제 종료');
      browser.process()?.kill('SIGKILL');
    }
  }
}

/**
 * Puppeteer로 페이지를 렌더링한 뒤 HTML 문자열을 반환합니다.
 * SPA 셀렉터 재감지용 — 정적 HTML에 JS 로드 목록이 없을 때 사용합니다.
 */
export async function getRenderedHTML(url: string, waitMs = 3000): Promise<string | null> {
  let page: Page | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 이미지/폰트 차단 (속도 향상, 셀렉터 감지에 불필요)
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    return await page.content();
  } catch (error) {
    console.error('[SPA] getRenderedHTML 오류:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    if (page) await page.close();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cachedHtml = (source as any)._cachedHtml as string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const crawlConfig = config.crawl_config as any;

      if (cachedHtml) {
        await page.setContent(cachedHtml, { waitUntil: 'load' });
        // setContent은 page.url()을 about:blank으로 설정하므로 URL 해석용 baseUrl 보정
        if (!config.link_processing) {
          config.link_processing = { baseUrl: new URL(source.base_url).origin };
        } else if (!config.link_processing.baseUrl) {
          config.link_processing.baseUrl = new URL(source.base_url).origin;
        }
        console.log(`[SPA] Used cached HTML (skipped navigation)`);
      } else {
        await page.goto(source.base_url, {
          waitUntil: 'load',
          timeout: 30000,
        });

        const additionalWait = crawlConfig?.additionalWait || 5000;
        await this.delay(additionalWait);
        console.log(`[SPA] Waited ${additionalWait}ms for JS execution`);
      }

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

  async crawlContent(url: string, config?: CrawlConfig['content_selectors'] & { additionalWait?: number }): Promise<ContentResult> {
    const browser = await getBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      );

      // load 이벤트 후 JS 렌더링 대기 (networkidle2는 폴링/WebSocket 사이트에서 타임아웃 발생)
      await page.goto(url, {
        waitUntil: 'load',
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, config?.additionalWait ?? 2000));

      // HTML 가져오기
      const html = await page.content();
      const content = await extractContent(html, url, config);
      const contentText = generatePreview(content);

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

            // javascript: / #hash+onclick 링크 처리 (JSP/레거시 동적 페이지)
            let needsTemplate = false;
            let argsSource = '';

            if (href.startsWith('javascript:')) {
              needsTemplate = true;
              argsSource = href;
            } else if (href === '#' || (href.startsWith('#') && href.length <= 10)) {
              const onclickAttr = linkEl?.getAttribute('onclick')
                || (el as HTMLAnchorElement).getAttribute?.('onclick')
                || el.querySelector('a')?.getAttribute('onclick');
              if (onclickAttr) {
                needsTemplate = true;
                argsSource = onclickAttr;
              }
            }

            if (needsTemplate) {
              if (linkTemplate) {
                const argsMatch = argsSource.match(/\(([^)]*)\)/);
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
                  return;
                }
              } else {
                // linkTemplate 없음 → onclick 함수 본문에서 URL 자동 추출
                let resolved = false;
                const funcMatch = argsSource.match(/^(\w+)\s*\(/);
                if (funcMatch) {
                  const funcName = funcMatch[1];
                  const innerArgs = argsSource.match(/\(([^)]*)\)/);
                  const args = innerArgs
                    ? innerArgs[1].split(',').map(a => a.trim().replace(/['"]/g, ''))
                    : [];
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const func = (window as any)[funcName];
                    if (typeof func === 'function') {
                      const funcBody = func.toString();
                      const funcArgNames = (funcBody.match(/function\s*\w*\s*\(([^)]*)\)/) || [])[1]
                        ?.split(',').map((a: string) => a.trim()) || [];

                      // Pattern 1: form.action + param.value 할당
                      const actionMatch = funcBody.match(/\.action\s*=\s*["']([^"']+)["']/);
                      if (actionMatch) {
                        const actionPath = actionMatch[1];
                        const paramPattern = /\.(\w+)\.value\s*=\s*(\w+)/g;
                        const qp: string[] = [];
                        let pm;
                        while ((pm = paramPattern.exec(funcBody)) !== null) {
                          const argIdx = funcArgNames.indexOf(pm[2]);
                          if (argIdx >= 0 && args[argIdx]) {
                            qp.push(`${pm[1]}=${encodeURIComponent(args[argIdx])}`);
                          }
                        }
                        const qs = qp.length > 0 ? '?' + qp.join('&') : '';
                        try {
                          href = new URL(actionPath + qs, baseUrl).toString();
                          resolved = true;
                        } catch { /* ignore */ }
                      }

                      // Pattern 2: location.href = "path" + arg
                      if (!resolved) {
                        const locMatch = funcBody.match(/location(?:\.href)?\s*=\s*["']([^"']*?)["']\s*\+\s*(\w+)/);
                        if (locMatch) {
                          const argIdx = funcArgNames.indexOf(locMatch[2]);
                          if (argIdx >= 0 && args[argIdx]) {
                            try {
                              href = new URL(locMatch[1] + args[argIdx], baseUrl).toString();
                              resolved = true;
                            } catch { /* ignore */ }
                          }
                        }
                      }

                      // Pattern 3: window.open("path" + arg)
                      if (!resolved) {
                        const openMatch = funcBody.match(/(?:window\.)?open\s*\(\s*["']([^"']*?)["']\s*\+\s*(\w+)/);
                        if (openMatch) {
                          const argIdx = funcArgNames.indexOf(openMatch[2]);
                          if (argIdx >= 0 && args[argIdx]) {
                            try {
                              href = new URL(openMatch[1] + args[argIdx], baseUrl).toString();
                              resolved = true;
                            } catch { /* ignore */ }
                          }
                        }
                      }
                    }
                  } catch { /* ignore */ }
                }
                if (!resolved) return;
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
            let rawDateText: string | null = null;
            if (selectors.date) {
              const dateEl = el.querySelector(selectors.date);
              dateStr =
                dateEl?.getAttribute(selectors.dateAttribute || 'datetime') ||
                dateEl?.getAttribute('content') ||
                dateEl?.textContent?.trim() ||
                null;
              if (!dateStr && dateEl?.textContent) {
                rawDateText = dateEl.textContent.trim().substring(0, 100);
              }
            }

            results.push({
              title,
              link: href,
              thumbnail,
              author,
              dateStr,
              // rawDateText passed via content field temporarily
              content: rawDateText ? `__rawDateText__${rawDateText}` : undefined,
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

    // 날짜 텍스트 fallback: evaluate 내에서 추출한 rawDateText로 날짜 파싱
    for (const item of items) {
      if (!item.dateStr && item.content?.startsWith('__rawDateText__')) {
        const rawText = item.content.substring('__rawDateText__'.length);
        item.dateStr = extractDateFromText(rawText);
        item.content = undefined;
      }
    }

    // 제목 정제 + 7일 이내 필터링
    const filteredItems: RawContentItem[] = [];
    for (const item of items) {
      // 제목 정제 및 검증
      const cleanedTitle = processTitle(item.title);
      if (!cleanedTitle) {
        console.log(`[SPA] SKIP (invalid title): "${item.title.substring(0, 40)}..."`);
        continue;
      }

      if (!isWithinDays(item.dateStr, MAX_ARTICLE_AGE_DAYS, cleanedTitle)) {
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
