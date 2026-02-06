import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, isWithinDays, parseDate } from '../base';
import type { CrawlSource } from '@/types';

// 아이컨슈머 (iconsumer.or.kr) 크롤러
export async function crawlIconsumer(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '마케팅';

  console.log(`[아이컨슈머] Crawling: ${source.base_url}`);

  try {
    const response = await fetchWithTimeout(source.base_url, {
      headers: DEFAULT_HEADERS,
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 아이컨슈머 기사 목록 파싱
    $('.list-block').each((_, element) => {
      try {
        const $el = $(element);

        // 링크와 제목
        const $link = $el.find('.list-titles a').first();
        const href = $link.attr('href');
        const title = $link.text().trim();

        if (!href || !title) return;

        const sourceUrl = href.startsWith('http')
          ? href
          : `http://www.iconsumer.or.kr${href}`;
        const sourceId = generateSourceId(sourceUrl);

        // 썸네일
        const $thumbnail = $el.find('.list-image img');
        let thumbnailUrl = $thumbnail.attr('src');
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          thumbnailUrl = `http://www.iconsumer.or.kr${thumbnailUrl}`;
        }

        // 날짜
        const $date = $el.find('.list-dated');
        const dateText = $date.text().trim();
        const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

        console.log(`[아이컨슈머] Article: "${title.substring(0, 40)}..." | Raw date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

        // 7일 이내 확인
        if (!isWithinDays(publishedAt, 7, title)) {
          console.log(`[아이컨슈머] SKIP (too old): ${title}`);
          return;
        }

        // 요약/미리보기
        const $summary = $el.find('.list-summary');
        const contentPreview = $summary.text().trim() || undefined;

        articles.push({
          source_id: sourceId,
          source_name: source.name,
          source_url: sourceUrl,
          title,
          thumbnail_url: thumbnailUrl,
          content_preview: contentPreview,
          published_at: publishedAt,
          category,
        });
      } catch (error) {
        console.error('[아이컨슈머] Error parsing article:', error);
      }
    });

    console.log(`[아이컨슈머] Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[아이컨슈머] Crawl error:', error);
    return [];
  }
}
