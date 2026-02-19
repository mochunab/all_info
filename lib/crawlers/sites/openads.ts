import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, isWithinDays, parseDate } from '../base';
import type { CrawlSource } from '@/types';

// 오픈애즈 (openads.co.kr) 크롤러
export async function crawlOpenads(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '마케팅';

  console.log(`[오픈애즈] Crawling: ${source.base_url}`);

  try {
    const response = await fetchWithTimeout(source.base_url, {
      headers: DEFAULT_HEADERS,
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 오픈애즈 콘텐츠 카드 파싱 (React SSR 초기 HTML)
    $('article, .content-card, .post-item, .card, [class*="ContentCard"], [class*="content-item"]').each(
      (_, element) => {
        try {
          const $el = $(element);

          // 링크
          const $link = $el.find('a[href*="/content/"]').first();
          let href = $link.attr('href');

          if (!href) {
            // 다른 패턴 시도
            const $altLink = $el.find('a').first();
            href = $altLink.attr('href');
          }

          if (!href || !href.includes('/content/')) return;

          // 절대 URL로 변환
          const sourceUrl = href.startsWith('http')
            ? href
            : `https://www.openads.co.kr${href}`;

          // 제목
          const $title = $el.find('h2, h3, .title, [class*="title"]');
          const title = $title.first().text().trim();

          if (!title) return;

          const sourceId = generateSourceId(sourceUrl);

          // 썸네일
          const $thumbnail = $el.find('img');
          let thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
          if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
            if (thumbnailUrl.startsWith('//')) {
              thumbnailUrl = `https:${thumbnailUrl}`;
            } else {
              thumbnailUrl = `https://www.openads.co.kr${thumbnailUrl}`;
            }
          }

          // 날짜
          const $date = $el.find('.date, time, [class*="date"], [class*="time"]');
          const dateText = $date.first().text().trim();
          const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

          console.log(`[오픈애즈] Article: "${title.substring(0, 40)}..." | Raw date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

          // 7일 이내 확인
          if (!isWithinDays(publishedAt, 14, title)) {
            console.log(`[오픈애즈] SKIP (too old): ${title}`);
            return;
          }

          // 작성자
          const $author = $el.find('.author, [class*="author"], [class*="writer"]');
          const author = $author.first().text().trim() || undefined;

          // 미리보기
          const $preview = $el.find('.description, .summary, [class*="desc"], p');
          const contentPreview = $preview.first().text().trim().substring(0, 500) || undefined;

          articles.push({
            source_id: sourceId,
            source_name: source.name,
            source_url: sourceUrl,
            title,
            thumbnail_url: thumbnailUrl,
            content_preview: contentPreview,
            author,
            published_at: publishedAt,
            category,
          });
        } catch (error) {
          console.error('[오픈애즈] Error parsing article:', error);
        }
      }
    );

    console.log(`[오픈애즈] Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[오픈애즈] Crawl error:', error);
    return [];
  }
}
