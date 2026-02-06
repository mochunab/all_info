import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, isWithinDays, parseDate } from '../base';
import type { CrawlSource } from '@/types';

// 와이즈앱 (wiseapp.co.kr) 크롤러
export async function crawlWiseapp(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '트렌드';

  console.log(`[와이즈앱] Crawling: ${source.base_url}`);

  try {
    const response = await fetchWithTimeout(source.base_url, {
      headers: DEFAULT_HEADERS,
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 와이즈앱 인사이트 카드 파싱
    $('.insight-card, .post-item, article, .card').each((_, element) => {
      try {
        const $el = $(element);

        // 링크
        const $link = $el.find('a').first();
        const href = $link.attr('href');

        if (!href) return;

        // 절대 URL로 변환
        const sourceUrl = href.startsWith('http')
          ? href
          : `https://www.wiseapp.co.kr${href.startsWith('/') ? '' : '/'}${href}`;

        // 제목
        const $title = $el.find('h2, h3, .title, .card-title');
        const title = $title.text().trim();

        if (!title) return;

        const sourceId = generateSourceId(sourceUrl);

        // 썸네일
        const $thumbnail = $el.find('img');
        let thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          if (thumbnailUrl.startsWith('//')) {
            thumbnailUrl = `https:${thumbnailUrl}`;
          } else {
            thumbnailUrl = `https://www.wiseapp.co.kr${thumbnailUrl}`;
          }
        }

        // 날짜
        const $date = $el.find('.date, time, .published');
        const dateText = $date.text().trim();
        const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

        console.log(`[와이즈앱] Article: "${title.substring(0, 40)}..." | Raw date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

        // 7일 이내 확인
        if (!isWithinDays(publishedAt, 7, title)) {
          console.log(`[와이즈앱] SKIP (too old): ${title}`);
          return;
        }

        // 미리보기
        const $preview = $el.find('.summary, .description, .excerpt, p');
        const contentPreview = $preview.first().text().trim().substring(0, 500) || undefined;

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
        console.error('[와이즈앱] Error parsing article:', error);
      }
    });

    console.log(`[와이즈앱] Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[와이즈앱] Crawl error:', error);
    return [];
  }
}
