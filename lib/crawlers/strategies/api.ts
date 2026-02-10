// API 크롤링 전략
// REST API 호출 기반 데이터 수집

import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, CrawlConfig } from '../types';
import { parseConfig } from '../types';
import { isWithinDays } from '../date-parser';
import { generatePreview } from '../content-extractor';

// API 설정 인터페이스
interface APIConfig {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  queryParams?: Record<string, string>;
  // 응답 매핑
  responseMapping?: {
    items: string; // JSON 경로 (예: "data.posts", "results")
    title: string;
    link: string;
    thumbnail?: string;
    author?: string;
    date?: string;
    content?: string;
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

    console.log(`[API] Fetching: ${source.base_url}`);

    try {
      const items: RawContentItem[] = [];

      // 페이지네이션 처리
      if (apiConfig.pagination) {
        const pageItems = await this.fetchWithPagination(source.base_url, apiConfig);
        items.push(...pageItems);
      } else {
        const pageItems = await this.fetchSinglePage(source.base_url, apiConfig);
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
    baseUrl: string,
    apiConfig: APIConfig
  ): Promise<RawContentItem[]> {
    const url = this.buildUrl(baseUrl, apiConfig.queryParams);
    const response = await this.makeRequest(url, apiConfig);
    return this.parseResponse(response, apiConfig, baseUrl);
  }

  private async fetchWithPagination(
    baseUrl: string,
    apiConfig: APIConfig
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

      const url = this.buildUrl(baseUrl, params);
      console.log(`[API] Page ${page + 1}: ${url}`);

      try {
        const response = await this.makeRequest(url, apiConfig);
        const pageItems = this.parseResponse(response, apiConfig, baseUrl);

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

        // 필수 필드: 제목
        const title = this.getNestedValue(item, mapping.title) as string;
        if (!title) continue;

        // 필수 필드: 링크
        let link = this.getNestedValue(item, mapping.link) as string;
        if (!link) continue;

        // 절대 URL로 변환
        if (!link.startsWith('http')) {
          link = `${origin}${link.startsWith('/') ? '' : '/'}${link}`;
        }

        // 선택 필드: 썸네일
        let thumbnail: string | null = null;
        if (mapping.thumbnail) {
          thumbnail = (this.getNestedValue(item, mapping.thumbnail) as string) || null;
          if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = `${origin}${thumbnail.startsWith('/') ? '' : '/'}${thumbnail}`;
          }
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
        if (!isWithinDays(dateStr, 7, title)) {
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
          thumbnail,
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
