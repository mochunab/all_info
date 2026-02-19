// SITEMAP 크롤링 전략
// sitemap.xml 파싱 → URL 목록 수집 → 각 페이지 fetch → title/content 추출

import * as cheerio from 'cheerio';
import type { CrawlSource } from '@/types';
import type { CrawlStrategy, RawContentItem, ContentResult } from '../types';
import { parseConfig } from '../types';
import { extractContent, generatePreview, extractMetadata } from '../content-extractor';
import { isWithinDays } from '../base';
import { DEFAULT_HEADERS, fetchWithTimeout } from '../base';

type SitemapEntry = {
  loc: string;
  lastmod?: string;
};

export class SitemapStrategy implements CrawlStrategy {
  readonly type = 'SITEMAP' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const config = parseConfig(source);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crawlConfig = (config as any).crawl_config as Record<string, unknown> | undefined;
    const withinDays = (crawlConfig?.withinDays as number | undefined) || 14;
    const urlFilters = (config as unknown as { url_filters?: { include?: string[]; exclude?: string[] } }).url_filters;

    // 1. Sitemap URL 결정
    const sitemapUrl = this.resolveSitemapUrl(source);
    console.log(`[SITEMAP] Fetching: ${sitemapUrl}`);

    // 2. Sitemap XML 파싱 (Index 포함, 최대 30개 URL)
    const allEntries = await this.fetchSitemapEntries(sitemapUrl);
    console.log(`[SITEMAP] Total entries found: ${allEntries.length}`);

    if (allEntries.length === 0) {
      console.warn('[SITEMAP] No entries found in sitemap');
      return [];
    }

    // 3. 날짜 필터링 + 내림차순 정렬 (최신 우선)
    const dated = allEntries.filter(e => {
      if (!e.lastmod) return true; // lastmod 없으면 포함 (날짜는 페이지에서 추출)
      return isWithinDays(e.lastmod, withinDays, e.loc);
    });

    dated.sort((a, b) => {
      if (!a.lastmod) return 1;
      if (!b.lastmod) return -1;
      return new Date(b.lastmod).getTime() - new Date(a.lastmod).getTime();
    });

    // 4. URL include/exclude 필터 적용
    const urlFiltered = this.applyUrlFilters(dated, urlFilters);

    // 5. fetch 대상 제한 (오케스트레이터가 상위 5개만 사용하므로 15개면 충분)
    const toFetch = urlFiltered.slice(0, 15);
    console.log(`[SITEMAP] URLs to fetch: ${toFetch.length}`);

    // 6. 병렬 배치 fetch (5개씩) — 각 URL에서 title + thumbnail + content 추출
    const items: RawContentItem[] = [];
    const batchSize = 5;

    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(entry => this.fetchPageItem(entry, config.content_selectors))
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          items.push(result.value);
        }
      }
    }

    const validItems = items.filter(item => item.title.length >= 3);
    console.log(`[SITEMAP] Valid items: ${validItems.length}/${toFetch.length}`);
    return validItems;
  }

  // crawlList에서 content를 채우므로 오케스트레이터가 이 함수를 거의 호출하지 않음
  // 혹시 호출되면 기존 content-extractor 사용
  async crawlContent(url: string, config?: Parameters<typeof extractContent>[2]): Promise<ContentResult> {
    try {
      const response = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 15000);
      if (!response.ok) return '';
      const html = await response.text();
      const content = await extractContent(html, url, config);
      return generatePreview(content);
    } catch {
      return '';
    }
  }

  // 개별 페이지 fetch: title + thumbnail + content 한 번에 추출
  private async fetchPageItem(
    entry: SitemapEntry,
    contentSelectors?: Parameters<typeof extractContent>[2]
  ): Promise<RawContentItem | null> {
    try {
      const response = await fetchWithTimeout(entry.loc, { headers: DEFAULT_HEADERS }, 15000);
      if (!response.ok) {
        console.warn(`[SITEMAP] HTTP ${response.status}: ${entry.loc}`);
        return null;
      }

      const html = await response.text();
      const metadata = extractMetadata(html);
      const title = (metadata.title || '').trim();

      if (title.length < 3) {
        console.log(`[SITEMAP] SKIP (no title): ${entry.loc}`);
        return null;
      }

      // 본문도 같은 HTML에서 추출 (fetch 1회로 title + content 동시 처리)
      const rawContent = await extractContent(html, entry.loc, contentSelectors);
      const preview = generatePreview(rawContent);

      const dateStr = entry.lastmod || metadata.publishedTime || null;
      console.log(`[SITEMAP] Found: "${title.substring(0, 40)}..." | Date: ${dateStr || 'N/A'}`);

      return {
        title,
        link: entry.loc,
        thumbnail: metadata.ogImage || null,
        author: metadata.author || null,
        dateStr,
        content: preview,
      };
    } catch (error) {
      console.error(`[SITEMAP] Fetch error: ${entry.loc}`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  // Sitemap XML 파싱 (Sitemap Index 재귀 처리, 최대 3개 서브 sitemap)
  private async fetchSitemapEntries(sitemapUrl: string, depth = 0): Promise<SitemapEntry[]> {
    if (depth > 1) return []; // 최대 재귀 깊이 제한

    try {
      const response = await fetchWithTimeout(
        sitemapUrl,
        { headers: { ...DEFAULT_HEADERS, Accept: 'application/xml,text/xml,*/*' } },
        15000
      );

      if (!response.ok) {
        console.warn(`[SITEMAP] HTTP ${response.status}: ${sitemapUrl}`);
        return [];
      }

      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      // Sitemap Index 처리 (서브 sitemap 목록)
      const indexUrls = $('sitemapindex > sitemap > loc')
        .map((_, el) => $(el).text().trim())
        .get();

      if (indexUrls.length > 0) {
        console.log(`[SITEMAP] Index: ${indexUrls.length} sub-sitemaps`);
        const allEntries: SitemapEntry[] = [];
        for (const subUrl of indexUrls.slice(0, 3)) {
          const subEntries = await this.fetchSitemapEntries(subUrl, depth + 1);
          allEntries.push(...subEntries);
        }
        return allEntries;
      }

      // 일반 sitemap URL 목록
      return $('urlset > url')
        .map((_, el) => ({
          loc: $(el).find('loc').text().trim(),
          lastmod: $(el).find('lastmod').text().trim() || undefined,
        }))
        .get()
        .filter(e => e.loc.startsWith('http'));
    } catch (error) {
      console.error(`[SITEMAP] Parse error: ${sitemapUrl}`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  // Sitemap URL 결정 우선순위:
  // 1. config.sitemap_url (명시적 지정)
  // 2. config.crawl_config.rssUrl (strategy-resolver가 자동 발견한 URL)
  // 3. source.crawl_url (crawl_sources.crawl_url)
  // 4. base_url 자체가 sitemap.xml인 경우
  // 5. {origin}/sitemap.xml (기본값)
  private resolveSitemapUrl(source: CrawlSource): string {
    const config = parseConfig(source);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const explicitUrl = (config as any).sitemap_url as string | undefined;
    if (explicitUrl) return explicitUrl;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rssUrl = (config as any).crawl_config?.rssUrl as string | undefined;
    if (rssUrl) return rssUrl;

    if (source.crawl_url) return source.crawl_url;

    const base = source.base_url;
    if (base.includes('sitemap') && (base.endsWith('.xml') || base.includes('.xml?'))) {
      return base;
    }

    try {
      const u = new URL(base);
      return `${u.origin}/sitemap.xml`;
    } catch {
      return `${base}/sitemap.xml`;
    }
  }

  // URL include/exclude 필터 적용
  private applyUrlFilters(
    entries: SitemapEntry[],
    filters?: { include?: string[]; exclude?: string[] }
  ): SitemapEntry[] {
    if (!filters) return entries;

    return entries.filter(({ loc }) => {
      if (filters.exclude?.some(p => loc.includes(p))) return false;
      if (filters.include?.length && !filters.include.some(p => loc.includes(p))) return false;
      return true;
    });
  }
}

// 싱글톤 인스턴스
export const sitemapStrategy = new SitemapStrategy();
