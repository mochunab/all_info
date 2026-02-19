// 와이즈앱 (wiseapp.co.kr) API 크롤러
// POST /insight/getList.json

import { generateSourceId } from '@/lib/utils';
import { CrawledArticle, parseDate, isWithinDays } from '../base';
import type { CrawlSource } from '@/types';

type WiseAppInsightItem = {
  insightNid?: number;
  title?: string;
  urlKeyword?: string;
  coverImgPath?: string;
  baseDT?: string;
  createDT?: string;
  displayDT?: string;
  metaDesc?: string;
  content?: string;
};

type WiseAppAPIResponse = {
  insightList?: WiseAppInsightItem[];
  insights?: WiseAppInsightItem[];
  data?: WiseAppInsightItem[];
  items?: WiseAppInsightItem[];
  results?: WiseAppInsightItem[];
};

/**
 * 와이즈앱 인사이트 크롤러 (API 방식)
 */
export async function crawlWiseapp(source: CrawlSource): Promise<CrawledArticle[]> {
  const articles: CrawledArticle[] = [];
  const category = (source.config as { category?: string })?.category || '트렌드';

  console.log(`[와이즈앱 API] Crawling: ${source.base_url}`);

  try {
    // API 엔드포인트: /insight/getList.json
    const apiUrl = 'https://www.wiseapp.co.kr/insight/getList.json';

    // API 요청 페이로드
    const payload = {
      sortType: 'new',
      searchStr: '',
      pageInfo: {
        currentPage: 0,
        pagePerCnt: 30,
        isSearched: 0,
      },
      insightTypeApp: 0,
      insightTypeRetail: 0,
      insightTypeGoods: 0,
    };

    console.log(`[와이즈앱 API] POST ${apiUrl}`);
    console.log(`[와이즈앱 API] Payload:`, JSON.stringify(payload, null, 2));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          Accept: 'application/json, text/plain, */*',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Origin: 'https://www.wiseapp.co.kr',
          Referer: 'https://www.wiseapp.co.kr/insight/',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as WiseAppAPIResponse;
      console.log(`[와이즈앱 API] Response keys:`, Object.keys(data));

      // insightList 배열 찾기
      let insightList: WiseAppInsightItem[] = [];

      if (data.insightList && Array.isArray(data.insightList)) {
        insightList = data.insightList;
      } else if (data.insights && Array.isArray(data.insights)) {
        insightList = data.insights;
      } else if (data.data && Array.isArray(data.data)) {
        insightList = data.data;
      } else if (data.items && Array.isArray(data.items)) {
        insightList = data.items;
      } else if (data.results && Array.isArray(data.results)) {
        insightList = data.results;
      } else if (Array.isArray(data)) {
        insightList = data as unknown as WiseAppInsightItem[];
      } else {
        console.error('[와이즈앱 API] Cannot find insight list in response');
        console.log('[와이즈앱 API] Response structure:', JSON.stringify(data).substring(0, 500));
        return [];
      }

      console.log(`[와이즈앱 API] Found ${insightList.length} items in response`);

      // 각 아이템 파싱
      for (const item of insightList) {
        try {
          // 제목
          const title = item.title?.trim();
          if (!title) {
            console.log(`[와이즈앱 API] SKIP: No title`);
            continue;
          }

          // URL 생성
          let url: string;
          if (item.urlKeyword) {
            // urlKeyword가 있으면 SEO URL 사용
            url = `https://www.wiseapp.co.kr/insight/${item.urlKeyword}`;
          } else if (item.insightNid) {
            // insightNid로 폴백
            url = `https://www.wiseapp.co.kr/insight/detail/${item.insightNid}`;
          } else {
            console.log(`[와이즈앱 API] SKIP: No URL for "${title}"`);
            continue;
          }

          const sourceId = generateSourceId(url);

          // 썸네일 (coverImgPath)
          let thumbnailUrl: string | undefined;
          if (item.coverImgPath) {
            // API 응답에서 경로만 제공: /2026-02-10/xxx.png
            // 실제 이미지 서버: https://www.wiseapp.co.kr:10081/insight-resources
            thumbnailUrl = `https://www.wiseapp.co.kr:10081/insight-resources${item.coverImgPath}`;
          }

          // 날짜 (baseDT 우선)
          const dateText = item.baseDT || item.createDT || item.displayDT || null;
          const publishedAt = dateText ? parseDate(dateText)?.toISOString() : undefined;

          console.log(
            `[와이즈앱 API] Article: "${title.substring(0, 40)}..." | Date: ${dateText || 'N/A'} | Parsed: ${publishedAt || 'N/A'}`
          );

          // 7일 이내 확인
          if (!isWithinDays(publishedAt, 14, title)) {
            console.log(`[와이즈앱 API] SKIP (too old): ${title.substring(0, 40)}...`);
            continue;
          }

          // 미리보기 (metaDesc 우선, content HTML은 후순위)
          const contentPreview = item.metaDesc?.trim().substring(0, 500) || undefined;

          articles.push({
            source_id: sourceId,
            source_name: source.name,
            source_url: url,
            title,
            thumbnail_url: thumbnailUrl,
            content_preview: contentPreview,
            published_at: publishedAt,
            category,
          });

          console.log(`[와이즈앱 API] ✅ Added: "${title.substring(0, 40)}..."`);
        } catch (error) {
          console.error('[와이즈앱 API] Error parsing item:', error);
        }
      }

      console.log(`[와이즈앱 API] Total articles: ${articles.length}`);
      return articles;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('[와이즈앱 API] Crawl error:', error);
    return [];
  }
}
