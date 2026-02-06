import * as cheerio from 'cheerio';
import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, DEFAULT_HEADERS, fetchWithTimeout, isWithinDays, parseDate } from '../base';
import type { CrawlSource } from '@/types';

// 스톤브릿지 (stonebc.com) 크롤러
export async function crawlStonebc(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '브랜딩';

  console.log(`[스톤브릿지] Crawling: ${source.base_url}`);

  try {
    // 1. 목록 페이지에서 기사 링크 수집
    const response = await fetchWithTimeout(source.base_url, {
      headers: DEFAULT_HEADERS,
    }, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // /archives/숫자 패턴의 링크만 수집
    const archiveLinks = new Set<string>();
    $('a[href*="/archives/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && /\/archives\/\d+/.test(href)) {
        const fullUrl = href.startsWith('http') ? href : `https://stonebc.com${href}`;
        archiveLinks.add(fullUrl);
      }
    });

    console.log(`[스톤브릿지] Found ${archiveLinks.size} article links`);

    // 2. 각 기사 페이지에서 상세 정보 추출 (최대 10개)
    const links = Array.from(archiveLinks).slice(0, 10);

    for (const articleUrl of links) {
      try {
        const articleResponse = await fetchWithTimeout(articleUrl, {
          headers: DEFAULT_HEADERS,
        }, 10000);

        if (!articleResponse.ok) continue;

        const articleHtml = await articleResponse.text();
        const $article = cheerio.load(articleHtml);

        // og 메타 태그에서 정보 추출
        const title = $article('meta[property="og:title"]').attr('content')?.replace(' - 스톤브랜드컨설팅', '').trim();
        const description = $article('meta[property="og:description"]').attr('content')?.trim();
        const thumbnailUrl = $article('meta[property="og:image"]').attr('content');
        const updatedTime = $article('meta[property="og:updated_time"]').attr('content');

        if (!title) continue;

        // 날짜 파싱 및 7일 이내 확인
        const publishedAt = updatedTime ? parseDate(updatedTime)?.toISOString() : undefined;
        console.log(`[스톤브릿지] Article: "${title.substring(0, 40)}..." | Raw date: ${updatedTime || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`);

        if (!isWithinDays(publishedAt, 7, title)) {
          console.log(`[스톤브릿지] SKIP (too old): ${title}`);
          continue;
        }

        const sourceId = generateSourceId(articleUrl);

        articles.push({
          source_id: sourceId,
          source_name: source.name,
          source_url: articleUrl,
          title,
          thumbnail_url: thumbnailUrl,
          content_preview: description?.substring(0, 500),
          published_at: publishedAt,
          category,
        });

        console.log(`[스톤브릿지] INCLUDE: ${title.substring(0, 40)}...`);

        // 요청 간 딜레이
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[스톤브릿지] Error fetching article:`, error);
      }
    }

    console.log(`[스톤브릿지] Completed with ${articles.length} articles`);
    return articles;
  } catch (error) {
    console.error('[스톤브릿지] Crawl error:', error);
    return [];
  }
}
