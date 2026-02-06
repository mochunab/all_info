import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, isWithinDays, parseDate } from '../base';
import type { CrawlSource } from '@/types';

// 바이브랜드 (buybrand.stibee.com) 크롤러
// Stibee 뉴스레터 아카이브 페이지
export async function crawlBuybrand(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '브랜딩';

  console.log(`[바이브랜드] Crawling: ${source.base_url}`);

  try {
    const response = await fetchWithTimeout(source.base_url, {
      headers: DEFAULT_HEADERS,
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Stibee 뉴스레터 아카이브 파싱
    // Stibee는 표준 HTML 구조를 사용
    $(
      '.newsletter-item, .archive-item, article, .letter-item, [class*="newsletter"], [class*="letter"]'
    ).each((_, element) => {
      try {
        const $el = $(element);

        // 링크
        const $link = $el.find('a').first();
        const href = $link.attr('href');

        if (!href) return;

        // 절대 URL로 변환
        let sourceUrl = href;
        if (!href.startsWith('http')) {
          if (href.startsWith('//')) {
            sourceUrl = `https:${href}`;
          } else {
            sourceUrl = `https://buybrand.stibee.com${href.startsWith('/') ? '' : '/'}${href}`;
          }
        }

        // 제목
        const $title = $el.find('h2, h3, .title, .subject, [class*="title"]');
        const title = $title.first().text().trim() || $link.text().trim();

        if (!title) return;

        const sourceId = generateSourceId(sourceUrl);

        // 썸네일
        const $thumbnail = $el.find('img');
        let thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          if (thumbnailUrl.startsWith('//')) {
            thumbnailUrl = `https:${thumbnailUrl}`;
          } else {
            thumbnailUrl = `https://buybrand.stibee.com${thumbnailUrl}`;
          }
        }

        // 날짜
        const $date = $el.find('.date, time, .sent-date, [class*="date"]');
        const dateText = $date.first().text().trim();
        const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

        console.log(`[바이브랜드] Article: "${title.substring(0, 40)}..." | Raw date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

        // 7일 이내 확인
        if (!isWithinDays(publishedAt, 7, title)) {
          console.log(`[바이브랜드] SKIP (too old): ${title}`);
          return;
        }

        // 미리보기
        const $preview = $el.find('.preview, .summary, .excerpt, p');
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
        console.error('[바이브랜드] Error parsing article:', error);
      }
    });

    console.log(`[바이브랜드] Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[바이브랜드] Crawl error:', error);
    return [];
  }
}
