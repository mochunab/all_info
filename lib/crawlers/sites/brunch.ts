import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, isWithinDays, parseDate } from '../base';
import type { CrawlSource } from '@/types';

// 브런치 (brunch.co.kr) 크롤러
// 브런치는 SPA이지만 초기 HTML에 기본 컨텐츠가 있음
export async function crawlBrunch(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '트렌드';

  console.log(`[브런치] Crawling: ${source.base_url}`);

  try {
    const response = await fetchWithTimeout(source.base_url, {
      headers: {
        ...DEFAULT_HEADERS,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 브런치 작가 페이지 또는 매거진 페이지
    // 글 목록 파싱
    $('li.article, .wrap_article_list li, .list_article li').each((_, element) => {
      try {
        const $el = $(element);

        // 링크
        const $link = $el.find('a[href*="/@"]').first();
        let href = $link.attr('href');

        if (!href) {
          // 다른 링크 패턴 시도
          const $altLink = $el.find('a').first();
          href = $altLink.attr('href');
        }

        if (!href) return;

        // 절대 URL로 변환
        const sourceUrl = href.startsWith('http')
          ? href
          : `https://brunch.co.kr${href}`;

        // 제목
        const $title = $el.find('.tit_subject, .wrap_title .title, .cover_title, h3, .title');
        const title = $title.text().trim();

        if (!title) return;

        const sourceId = generateSourceId(sourceUrl);

        // 썸네일
        const $thumbnail = $el.find('img');
        let thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
        if (thumbnailUrl && thumbnailUrl.startsWith('//')) {
          thumbnailUrl = `https:${thumbnailUrl}`;
        }

        // 날짜 (브런치는 상대 시간을 많이 사용)
        const $date = $el.find('.publish_time, .date, time, .txt_date');
        const dateText = $date.text().trim();
        const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

        console.log(`[브런치] Article: "${title.substring(0, 40)}..." | Raw date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

        // 7일 이내 확인
        if (!isWithinDays(publishedAt, 7, title)) {
          console.log(`[브런치] SKIP (too old): ${title}`);
          return;
        }

        // 작성자
        const $author = $el.find('.name, .author, .writer_info .name');
        const author = $author.text().trim() || undefined;

        // 미리보기
        const $preview = $el.find('.article_content, .dsc, .desc, .txt_sub');
        const contentPreview = $preview.text().trim().substring(0, 500) || undefined;

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
        console.error('[브런치] Error parsing article:', error);
      }
    });

    // 추가 패턴: article 태그
    $('article').each((_, element) => {
      try {
        const $el = $(element);

        const $link = $el.find('a').first();
        const href = $link.attr('href');

        if (!href || !href.includes('/@')) return;

        const sourceUrl = href.startsWith('http')
          ? href
          : `https://brunch.co.kr${href}`;

        // 이미 추가된 URL인지 확인
        if (articles.some((a) => a.source_url === sourceUrl)) return;

        const $title = $el.find('h2, h3, .title').first();
        const title = $title.text().trim();

        if (!title) return;

        const sourceId = generateSourceId(sourceUrl);

        const $thumbnail = $el.find('img');
        let thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
        if (thumbnailUrl && thumbnailUrl.startsWith('//')) {
          thumbnailUrl = `https:${thumbnailUrl}`;
        }

        articles.push({
          source_id: sourceId,
          source_name: source.name,
          source_url: sourceUrl,
          title,
          thumbnail_url: thumbnailUrl,
          category,
        });
      } catch (error) {
        console.error('[브런치] Error parsing article:', error);
      }
    });

    console.log(`[브런치] Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[브런치] Crawl error:', error);
    return [];
  }
}
