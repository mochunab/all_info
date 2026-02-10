// RSS 크롤링 전략
// rss-parser 기반 RSS/Atom 피드 파싱

import Parser from 'rss-parser';
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
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
    ],
  },
});

export class RSSStrategy implements CrawlStrategy {
  readonly type = 'RSS' as const;

  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    const items: RawContentItem[] = [];
    const config = parseConfig(source);

    // RSS URL 결정 (config에서 지정하거나 base_url 사용)
    const rssUrl = config.crawl_config?.rssUrl || source.base_url;

    console.log(`[RSS] Fetching feed: ${rssUrl}`);

    try {
      const feed = await parser.parseURL(rssUrl);

      console.log(`[RSS] Feed title: ${feed.title}`);
      console.log(`[RSS] Items count: ${feed.items?.length || 0}`);

      if (!feed.items || feed.items.length === 0) {
        console.log('[RSS] No items in feed');
        return [];
      }

      for (const feedItem of feed.items) {
        try {
          const item = this.parseFeedItem(feedItem, config);

          if (!item || !item.title || !item.link) {
            continue;
          }

          // 7일 이내 필터링
          if (!isWithinDays(item.dateStr, 7, item.title)) {
            console.log(`[RSS] SKIP (too old): ${item.title.substring(0, 40)}...`);
            continue;
          }

          console.log(
            `[RSS] Found: "${item.title.substring(0, 40)}..." | Date: ${item.dateStr || 'N/A'}`
          );
          items.push(item);
        } catch (error) {
          console.error('[RSS] Parse item error:', error);
        }
      }

      console.log(`[RSS] Total valid items: ${items.length}`);
      return items;
    } catch (error) {
      console.error(`[RSS] Feed fetch error:`, error);
      return [];
    }
  }

  async crawlContent(url: string, config?: CrawlConfig['content_selectors']): Promise<string> {
    try {
      // RSS에서 이미 content가 있는 경우 그대로 사용
      // 없으면 페이지 직접 크롤링
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
      const content = await extractContent(html, url, config);
      return generatePreview(content);
    } catch (error) {
      console.error(`[RSS] Content crawl error:`, error);
      return '';
    }
  }

  private parseFeedItem(
    feedItem: Parser.Item & {
      contentEncoded?: string;
      creator?: string;
      mediaThumbnail?: { $?: { url?: string } };
      mediaContent?: { $?: { url?: string } };
    },
    config: CrawlConfig
  ): RawContentItem | null {
    // 제목
    const title = feedItem.title?.trim();
    if (!title) return null;

    // 링크
    let link = feedItem.link?.trim();
    if (!link) return null;

    // URL 정규화
    link = this.normalizeUrl(link, config.link_processing?.removeParams);

    // 썸네일
    let thumbnail: string | null = null;
    // 1. media:thumbnail
    if (feedItem.mediaThumbnail?.$?.url) {
      thumbnail = feedItem.mediaThumbnail.$.url;
    }
    // 2. media:content (이미지인 경우)
    else if (feedItem.mediaContent?.$?.url) {
      thumbnail = feedItem.mediaContent.$.url;
    }
    // 3. enclosure (이미지인 경우)
    else if (feedItem.enclosure?.url && feedItem.enclosure.type?.startsWith('image/')) {
      thumbnail = feedItem.enclosure.url;
    }
    // 4. content에서 첫 번째 이미지 추출
    else {
      thumbnail = this.extractFirstImage(
        feedItem.contentEncoded || feedItem.content || ''
      );
    }

    // 작성자
    const author =
      feedItem.creator ||
      (feedItem as Record<string, unknown>).author as string ||
      null;

    // 날짜
    let dateStr: string | null = null;
    if (feedItem.pubDate) {
      dateStr = feedItem.pubDate;
    } else if (feedItem.isoDate) {
      dateStr = feedItem.isoDate;
    }

    // 본문 (RSS에서 제공하는 경우)
    let content: string | undefined;
    const rawContent =
      feedItem.contentEncoded ||
      feedItem.content ||
      feedItem.summary ||
      '';

    if (rawContent) {
      // HTML을 텍스트로 변환
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

  private normalizeUrl(url: string, removeParams?: string[]): string {
    try {
      const urlObj = new URL(url);

      // 추적 파라미터 제거
      const paramsToRemove = removeParams || [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'fbclid',
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

  private extractFirstImage(htmlContent: string): string | null {
    // 간단한 정규식으로 첫 번째 이미지 URL 추출
    const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      const src = imgMatch[1];
      // 데이터 URL 제외
      if (!src.startsWith('data:')) {
        return src;
      }
    }
    return null;
  }
}

// 싱글톤 인스턴스
export const rssStrategy = new RSSStrategy();
