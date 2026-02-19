/**
 * Firecrawl REST API 클라이언트
 * - scrapeAndExtract: 리스트 페이지에서 구조화 데이터 추출 (LLM 기반)
 * - scrapeContent: 개별 페이지 본문 추출 (현재 사용 안 함, 비용 절감)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FirecrawlSchema = any;

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
const TIMEOUT_MS = 30000; // 30초

/**
 * Firecrawl scrape API로 구조화 데이터 추출
 * @param url 스크랩할 URL
 * @param schema 추출할 데이터 스키마 (JSON Schema)
 * @param prompt LLM 프롬프트 (추출 지침)
 * @returns 추출된 구조화 데이터
 */
export async function scrapeAndExtract(
  url: string,
  schema: FirecrawlSchema,
  prompt?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set');
  }

  console.log(`[Firecrawl] Scraping and extracting: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['extract'],
        extract: {
          prompt: prompt || 'Extract the content from this page',
          schema,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Firecrawl scrape failed: ${data.error || 'Unknown error'}`);
    }

    // Extract 결과 반환
    return data.data?.extract || {};
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Firecrawl request timeout (${TIMEOUT_MS}ms)`);
    }
    throw error;
  }
}

/**
 * Firecrawl scrape API로 본문 추출 (Markdown)
 * ⚠️ 비용 절감을 위해 현재 사용 안 함 (기존 Cheerio + Readability 사용)
 * @param url 스크랩할 URL
 * @returns Markdown 본문
 */
export async function scrapeContent(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set');
  }

  console.log(`[Firecrawl] Scraping content: ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Firecrawl scrape failed: ${data.error || 'Unknown error'}`);
    }

    return data.data?.markdown || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Firecrawl request timeout (${TIMEOUT_MS}ms)`);
    }
    throw error;
  }
}
