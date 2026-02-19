// API 크롤링 전략
// REST API 호출 기반 데이터 수집

import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig } from '../types';
import { parseConfig } from '../types';
import { isWithinDays } from '../date-parser';
import { generatePreview } from '../content-extractor';
import { processTitle } from '../title-cleaner';

// API 설정 인터페이스
interface APIConfig {
  endpoint?: string; // API 엔드포인트 (base_url과 분리 가능)
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string>;
  // 응답 매핑
  responseMapping?: {
    items: string; // JSON 경로 (예: "data.posts", "results", "insightList")
    title: string;
    link: string;
    thumbnail?: string;
    author?: string;
    date?: string;
    content?: string;
  };
  // URL 변환 설정
  urlTransform?: {
    linkTemplate?: string; // 예: "https://site.com/post/{id}" 또는 "https://site.com/{urlKeyword}"
    linkFields?: string[]; // linkTemplate에 사용할 필드들 (순서대로 {0}, {1}, ... 또는 {fieldName})
    thumbnailPrefix?: string; // 썸네일 상대 경로 앞에 붙일 prefix
    baseUrl?: string; // 상대 URL을 절대 URL로 변환할 때 사용
  };
  // 페이지네이션
  pagination?: {
    type: 'offset' | 'cursor' | 'page';
    param: string; // 예: "offset", "cursor", "page"
    limitParam?: string; // 예: "limit", "per_page"
    limit?: number;
    maxPages?: number;
  };
}

export class APIStrategy implements CrawlStrategy {
  readonly type = 'API' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const config = parseConfig(source);
    const apiConfig = (config.crawl_config as unknown as APIConfig) || {};

    // API 엔드포인트 결정 (endpoint 설정이 있으면 사용, 없으면 base_url)
    const apiUrl = apiConfig.endpoint || source.base_url;

    console.log(`[API] Fetching: ${apiUrl}`);
    if (apiConfig.endpoint) {
      console.log(`[API] Source URL: ${source.base_url} (표시용)`);
    }

    try {
      const items: RawContentItem[] = [];

      // 페이지네이션 처리
      if (apiConfig.pagination) {
        const pageItems = await this.fetchWithPagination(apiUrl, apiConfig, source.base_url);
        items.push(...pageItems);
      } else {
        const pageItems = await this.fetchSinglePage(apiUrl, apiConfig, source.base_url);
        items.push(...pageItems);
      }

      console.log(`[API] Found ${items.length} items`);
      return items;
    } catch (error) {
      console.error(`[API] Crawl error:`, error);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<string> {
    // API 전략에서는 일반적으로 목록에서 이미 content를 가져옴
    // 필요한 경우 상세 API 호출
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'InsightHub/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // content 필드 추출 시도
      const content =
        data.content ||
        data.body ||
        data.text ||
        data.description ||
        JSON.stringify(data);

      return generatePreview(content);
    } catch (error) {
      console.error(`[API] Content fetch error:`, error);
      return '';
    }
  }

  private async fetchSinglePage(
    apiUrl: string,
    apiConfig: APIConfig,
    sourceBaseUrl: string
  ): Promise<RawContentItem[]> {
    const url = this.buildUrl(apiUrl, apiConfig.queryParams);
    const response = await this.makeRequest(url, apiConfig);
    return this.parseResponse(response, apiConfig, sourceBaseUrl);
  }

  private async fetchWithPagination(
    apiUrl: string,
    apiConfig: APIConfig,
    sourceBaseUrl: string
  ): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];
    const pagination = apiConfig.pagination!;
    const maxPages = pagination.maxPages || 3;
    const limit = pagination.limit || 20;

    for (let page = 0; page < maxPages; page++) {
      const params: Record<string, string> = { ...apiConfig.queryParams };

      // 페이지네이션 파라미터 설정
      switch (pagination.type) {
        case 'offset':
          params[pagination.param] = (page * limit).toString();
          if (pagination.limitParam) {
            params[pagination.limitParam] = limit.toString();
          }
          break;
        case 'page':
          params[pagination.param] = (page + 1).toString();
          if (pagination.limitParam) {
            params[pagination.limitParam] = limit.toString();
          }
          break;
        case 'cursor':
          // cursor는 이전 응답에서 가져와야 함
          // 첫 페이지는 cursor 없이 요청
          break;
      }

      const url = this.buildUrl(apiUrl, params);
      console.log(`[API] Page ${page + 1}: ${url}`);

      try {
        const response = await this.makeRequest(url, apiConfig);
        const pageItems = this.parseResponse(response, apiConfig, sourceBaseUrl);

        if (pageItems.length === 0) {
          console.log('[API] No more items, stopping pagination');
          break;
        }

        items.push(...pageItems);

        // 요청 간 딜레이
        await this.delay(500);
      } catch (error) {
        console.error(`[API] Page ${page + 1} error:`, error);
        break;
      }
    }

    return items;
  }

  private buildUrl(baseUrl: string, params?: Record<string, string>): string {
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  private async makeRequest(
    url: string,
    apiConfig: APIConfig
  ): Promise<Record<string, unknown>> {
    const method = apiConfig.method || 'GET';
    const headers: Record<string, string> = {
      'User-Agent': 'InsightHub/1.0',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...apiConfig.headers,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && apiConfig.body) {
      options.body = JSON.stringify(apiConfig.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponse(
    response: Record<string, unknown>,
    apiConfig: APIConfig,
    baseUrl: string
  ): RawContentItem[] {
    const items: RawContentItem[] = [];
    const mapping = apiConfig.responseMapping || this.getDefaultMapping();

    // items 배열 추출
    let rawItems: unknown[];
    if (mapping.items) {
      rawItems = this.getNestedValue(response, mapping.items) as unknown[];
    } else if (Array.isArray(response)) {
      rawItems = response;
    } else if (response.data && Array.isArray(response.data)) {
      rawItems = response.data;
    } else if (response.items && Array.isArray(response.items)) {
      rawItems = response.items;
    } else if (response.results && Array.isArray(response.results)) {
      rawItems = response.results;
    } else if (response.posts && Array.isArray(response.posts)) {
      rawItems = response.posts;
    } else {
      console.error('[API] Cannot find items array in response');
      return [];
    }

    const origin = new URL(baseUrl).origin;

    for (const rawItem of rawItems) {
      try {
        const item = rawItem as Record<string, unknown>;

        // 필수 필드: 제목 (정제 + 검증)
        const rawTitle = this.getNestedValue(item, mapping.title) as string;
        if (!rawTitle) continue;

        const title = processTitle(rawTitle);
        if (!title) {
          console.log(`[API] SKIP (invalid title): "${rawTitle.substring(0, 50)}..."`);
          continue;
        }

        // 필수 필드: 링크
        let link = this.getNestedValue(item, mapping.link) as string;
        if (!link) continue;

        // URL 변환 적용
        const urlTransform = apiConfig.urlTransform;

        // 링크 템플릿 처리
        if (urlTransform?.linkTemplate) {
          const template = urlTransform.linkTemplate;
          let resolvedLink = template;

          // linkFields가 있으면 해당 필드 값들로 치환
          if (urlTransform.linkFields) {
            urlTransform.linkFields.forEach((fieldName, index) => {
              const value = this.getNestedValue(item, fieldName);
              if (value !== undefined) {
                // {0}, {1}, ... 형식과 {fieldName} 형식 모두 지원
                resolvedLink = resolvedLink
                  .replace(new RegExp(`\\{${index}\\}`, 'g'), String(value))
                  .replace(new RegExp(`\\{${fieldName}\\}`, 'g'), String(value));
              }
            });
          } else {
            // linkFields가 없으면 link 필드 값으로 치환
            resolvedLink = resolvedLink.replace(/\{[^}]+\}/g, link);
          }

          link = resolvedLink;
        }

        // 절대 URL로 변환
        if (!link.startsWith('http')) {
          const transformBase = urlTransform?.baseUrl || origin;
          link = `${transformBase}${link.startsWith('/') ? '' : '/'}${link}`;
        }

        // 선택 필드: 작성자
        let author: string | null = null;
        if (mapping.author) {
          author = (this.getNestedValue(item, mapping.author) as string) || null;
        }

        // 선택 필드: 날짜
        let dateStr: string | null = null;
        if (mapping.date) {
          dateStr = (this.getNestedValue(item, mapping.date) as string) || null;
        }

        // 7일 이내 필터링
        if (!isWithinDays(dateStr, 14, title)) {
          console.log(`[API] SKIP (too old): ${title.substring(0, 40)}...`);
          continue;
        }

        // 선택 필드: 본문
        let content: string | undefined;
        if (mapping.content) {
          const rawContent = this.getNestedValue(item, mapping.content) as string;
          if (rawContent) {
            content = generatePreview(rawContent);
          }
        }

        console.log(
          `[API] Found: "${title.substring(0, 40)}..." | Date: ${dateStr || 'N/A'}`
        );

        items.push({
          title,
          link: this.normalizeUrl(link),
          author,
          dateStr,
          content,
        });
      } catch {
        // 개별 아이템 파싱 실패 무시
      }
    }

    return items;
  }

  private getDefaultMapping(): NonNullable<APIConfig['responseMapping']> {
    return {
      items: 'data',
      title: 'title',
      link: 'url',
      thumbnail: 'thumbnail',
      author: 'author',
      date: 'created_at',
      content: 'content',
    };
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      if (typeof value === 'object') {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
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
        'ref',
      ];

      paramsToRemove.forEach((param) => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const apiStrategy = new APIStrategy();
