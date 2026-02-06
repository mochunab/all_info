import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, parseDate, isWithinDays } from '../base';
import type { CrawlSource } from '@/types';

// 제목에서 불필요한 부분 제거
function cleanTitle(title: string): string {
  return title
    .replace(/공지\s*/g, '')           // "공지" 제거
    .replace(/\d+\s*min\s*read\s*/gi, '') // "X min read" 제거
    .replace(/Strategy\s*/gi, '')       // "Strategy" 제거
    .replace(/\s*\[.*?\]\s*/g, '')      // [대괄호 내용] 제거
    .replace(/\n+/g, ' ')               // 줄바꿈 -> 공백
    .replace(/\t+/g, ' ')               // 탭 -> 공백
    .replace(/\s+/g, ' ')               // 연속 공백 정리
    .trim();
}

// 리테일톡 (retailtalk.co.kr) 크롤러
export async function crawlRetailtalk(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '리테일';

  console.log(`[리테일톡] Crawling: ${source.base_url}`);

  try {
    const response = await fetchWithTimeout(source.base_url, {
      headers: DEFAULT_HEADERS,
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 리테일톡 기사 목록 파싱 - imweb 기반 사이트
    console.log(`[리테일톡] Parsing HTML with selectors...`);

    // 먼저 어떤 요소들이 있는지 확인
    const itemCount = $('.ma-item._post_item_wrap').length;
    const articleCount = $('article').length;
    const cardCount = $('.card').length;
    console.log(`[리테일톡] Found elements: .ma-item._post_item_wrap=${itemCount}, article=${articleCount}, .card=${cardCount}`);

    $('.ma-item._post_item_wrap, .ma-item, article, .post-item, .card').each((idx, element) => {
      try {
        const $el = $(element);

        // 디버그: 요소 클래스 확인
        const elementClass = $el.attr('class') || 'no-class';
        console.log(`[리테일톡] [${idx}] Processing element: ${elementClass.substring(0, 50)}`);

        // 링크
        const $link = $el.find('a[href*="bmode=view"]').first();
        if (!$link.length) {
          console.log(`[리테일톡] [${idx}] No link found with bmode=view`);
          return;
        }

        const href = $link.attr('href');
        if (!href) return;

        // 절대 URL로 변환
        const sourceUrl = href.startsWith('http')
          ? href
          : `https://retailtalk.co.kr${href.startsWith('/') ? '' : '/'}${href}`;

        // 제목 추출 및 정리
        const $title = $el.find('h2, h3, .title, .headline, [class*="title"]');
        const rawTitle = $title.first().text().trim() || $link.text().trim();
        const title = cleanTitle(rawTitle);

        if (!title || title.length < 5) return;

        const sourceId = generateSourceId(sourceUrl);

        // 썸네일 - 리테일톡은 background-image 스타일 사용
        let thumbnailUrl: string | undefined;

        // 디버그: 모든 style 속성을 가진 요소 확인
        const $allStyled = $el.find('[style]');
        console.log(`[리테일톡] [${idx}] Elements with style attr: ${$allStyled.length}`);

        $allStyled.each((i, styled) => {
          const style = $(styled).attr('style');
          if (style && style.includes('background')) {
            console.log(`[리테일톡] [${idx}] Found bg style: ${style.substring(0, 100)}...`);
          }
        });

        // background-image 스타일에서 URL 추출
        const $cardWrapper = $el.find('.card_wrapper, [style*="background-image"]');
        const bgStyle = $cardWrapper.attr('style');
        console.log(`[리테일톡] [${idx}] card_wrapper style: ${bgStyle || 'NOT FOUND'}`);

        if (bgStyle) {
          const bgMatch = bgStyle.match(/url\(([^)]+)\)/);
          if (bgMatch) {
            thumbnailUrl = bgMatch[1].replace(/['"`]/g, ''); // 따옴표 제거
            console.log(`[리테일톡] [${idx}] Extracted from bg: ${thumbnailUrl}`);
          }
        }

        // img 태그도 시도
        if (!thumbnailUrl) {
          const $thumbnail = $el.find('img');
          thumbnailUrl = $thumbnail.attr('src') || $thumbnail.attr('data-src');
          if (thumbnailUrl) {
            console.log(`[리테일톡] [${idx}] Extracted from img: ${thumbnailUrl}`);
          }
        }

        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          thumbnailUrl = `https://retailtalk.co.kr${thumbnailUrl}`;
        }

        console.log(`[리테일톡] [${idx}] Final thumbnail URL: ${thumbnailUrl || 'NONE'}`);

        // 날짜 - 리테일톡은 목록에서 날짜를 숨김 (hide_time)
        // 썸네일 URL에서 날짜 추출 시도: /thumbnail/20251224/
        let publishedAt: string | undefined;
        const thumbnailMatch = thumbnailUrl?.match(/\/thumbnail\/(\d{8})\//);
        if (thumbnailMatch) {
          const dateStr = thumbnailMatch[1]; // YYYYMMDD
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const parsedDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(parsedDate.getTime())) {
            publishedAt = parsedDate.toISOString();
          }
        }

        // 기존 날짜 셀렉터도 시도
        if (!publishedAt) {
          const $date = $el.find('.date, time, .published, .meta, [class*="date"], .txt_date');
          const dateText = $date.first().text().trim();
          publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;
        }

        console.log(`[리테일톡] Article: "${title.substring(0, 40)}..." | Thumbnail date: ${thumbnailMatch?.[1] || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

        // 7일 이내 확인
        if (!isWithinDays(publishedAt, 7, title)) {
          console.log(`[리테일톡] SKIP (too old): ${title}`);
          return;
        }

        // 작성자
        const $author = $el.find('.author, .writer, [class*="author"]');
        const author = $author.first().text().trim() || '리테일톡';

        // 미리보기
        const $preview = $el.find('.summary, .excerpt, .description, p, [class*="content"]');
        const rawPreview = $preview.first().text().trim();
        const contentPreview = rawPreview ? cleanTitle(rawPreview).substring(0, 500) : undefined;

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
        console.error('[리테일톡] Error parsing article:', error);
      }
    });

    console.log(`[리테일톡] Found ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[리테일톡] Crawl error:', error);
    return [];
  }
}
