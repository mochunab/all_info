// API 엔드포인트 자동 감지
// SPA 페이지 로드 시 Puppeteer로 XHR/fetch 요청 가로채기
// → AI(Edge Function)가 아티클 목록 API 식별 + 필드 매핑 자동 생성

import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import type { DetectedApiConfig } from './types';

// 가로챈 API 요청
type CapturedRequest = {
  url: string;
  method: string;
  requestBody: string | null;
  responsePreview: string; // 응답 첫 2000자
  responseStatus: number;
};

// 브라우저 인스턴스 (재사용 - spa.ts와 독립적으로 관리)
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isVercel) {
      browserInstance = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: null,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      browserInstance = await puppeteer.launch({
        headless: true,
        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH ||
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });
    }
  }
  return browserInstance;
}

export async function closeApiDetectorBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
}

/**
 * SPA 페이지에서 숨겨진 API 엔드포인트 자동 감지
 *
 * 1. Puppeteer로 페이지 로드
 * 2. XHR/fetch 요청 중 JSON 배열 응답 수집
 * 3. Edge Function(GPT-5-nano)에서 아티클 목록 API 식별 + 필드 매핑
 *
 * @returns DetectedApiConfig or null (감지 실패 시)
 */
export async function detectApiEndpoint(url: string): Promise<DetectedApiConfig | null> {
  console.log(`\n[API-DETECT] 🕵️  Puppeteer 네트워크 가로채기 시작: ${url}`);
  console.log(`[API-DETECT] ⏱️  최대 대기시간: 30초`);

  let page = null;
  const captured: CapturedRequest[] = [];
  // requestId → 요청 정보
  const requestMap = new Map<string, { method: string; requestBody: string | null }>();

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 이미지/스타일/폰트 차단 (속도 향상)
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
        return;
      }
      // XHR/fetch 요청 기록
      if (resourceType === 'xhr' || resourceType === 'fetch') {
        requestMap.set(req.url(), {
          method: req.method(),
          requestBody: req.postData() || null,
        });
      }
      req.continue();
    });

    page.on('response', async (response) => {
      const reqUrl = response.url();
      const reqInfo = requestMap.get(reqUrl);
      if (!reqInfo) return;

      const contentType = response.headers()['content-type'] || '';
      if (!contentType.includes('json')) return;

      const status = response.status();
      if (status < 200 || status >= 300) return;

      try {
        const text = await response.text();
        const parsed = JSON.parse(text);

        // JSON 배열 포함 여부 확인 (2~100개 아이템)
        const arrays = extractReasonableArrays(parsed);
        if (arrays.length === 0) return;

        captured.push({
          url: reqUrl,
          method: reqInfo.method,
          requestBody: reqInfo.requestBody,
          responsePreview: text.substring(0, 2000),
          responseStatus: status,
        });

        console.log(
          `[API-DETECT] 📦 JSON API 감지: ${reqInfo.method} ${new URL(reqUrl).pathname} (배열 ${arrays[0].length}개 항목)`
        );
      } catch {
        // JSON 파싱 실패 → 무시
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log(`[API-DETECT] 📊 감지된 JSON API: ${captured.length}개`);

    if (captured.length === 0) {
      console.log(`[API-DETECT] ❌ 아티클 후보 API 없음`);
      return null;
    }

    return await analyzeWithEdgeFunction(url, captured);
  } catch (error) {
    console.error(`[API-DETECT] ❌ 오류:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

// AI 분석 프롬프트
const ANALYZE_PROMPT = `웹 페이지에서 가로챈 XHR/fetch API 요청들을 분석하여, 아티클/포스트 목록을 반환하는 API를 식별하세요.

페이지 URL: {pageUrl}

감지된 API 요청:
{requests}

아티클 목록 API 조건:
1. JSON 배열 형태로 아티클 객체 2개 이상 반환
2. 제목(title), 링크(url/link/urlKeyword/slug), 날짜 등 콘텐츠 필드 존재
3. 단순 설정값·카테고리·로딩 애니메이션은 제외

반드시 JSON으로만 답하세요:
{
  "found": true,
  "endpoint": "전체 API URL",
  "method": "GET" or "POST",
  "headers": {},
  "body": {},
  "responseMapping": {
    "items": "배열 경로 (예: insightList, data.posts, 루트면 빈 문자열)",
    "title": "제목 필드명",
    "link": "링크/슬러그 필드명",
    "thumbnail": "썸네일 필드명 (없으면 생략)",
    "date": "날짜 필드명 (없으면 생략)"
  },
  "urlTransform": {
    "linkTemplate": "절대URL 템플릿 (예: https://site.com/post/{urlKeyword})",
    "linkFields": ["urlKeyword"],
    "thumbnailPrefix": "썸네일 prefix (상대경로인 경우)"
  },
  "confidence": 0.0~1.0,
  "reasoning": "판단 근거 1-2문장"
}

아티클 API가 없으면: {"found": false, "confidence": 0.1, "reasoning": "이유"}`;

/**
 * OpenAI 직접 호출로 API 분석 (gpt-4.1-mini)
 */
async function analyzeWithOpenAI(
  pageUrl: string,
  requests: CapturedRequest[]
): Promise<DetectedApiConfig | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const requestSummary = requests.map((req, i) => {
    const urlPath = (() => { try { return new URL(req.url).pathname; } catch { return req.url; } })();
    return `[${i + 1}] ${req.method} ${urlPath}\n요청body: ${req.requestBody?.substring(0, 200) || '없음'}\n응답: ${req.responsePreview.substring(0, 400)}`;
  }).join('\n\n---\n\n');

  const prompt = ANALYZE_PROMPT
    .replace('{pageUrl}', pageUrl)
    .replace('{requests}', requestSummary);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: '당신은 웹 API 분석 전문가입니다. 반드시 JSON 형식으로만 응답하세요.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseApiConfig(JSON.parse(text));
}

/**
 * AI 응답 파싱 → DetectedApiConfig
 */
function parseApiConfig(parsed: Record<string, unknown>): DetectedApiConfig | null {
  if (!parsed.found) return null;

  const mapping = parsed.responseMapping as Record<string, string> | undefined;
  if (!parsed.endpoint || !parsed.method || !mapping?.items || !mapping?.title || !mapping?.link) {
    return null;
  }

  // 상대경로 엔드포인트 거부 — 외부 fetch 불가 (CSRF/세션 필요)
  const ep = parsed.endpoint as string;
  if (!ep.startsWith('http://') && !ep.startsWith('https://')) {
    console.log(`[API-DETECT] ⚠️  상대경로 엔드포인트 거부: ${ep} → SPA 유지`);
    return null;
  }

  const urlTransform = parsed.urlTransform as Record<string, unknown> | undefined;

  const config: DetectedApiConfig = {
    endpoint: parsed.endpoint as string,
    method: parsed.method === 'POST' ? 'POST' : 'GET',
    responseMapping: {
      items: mapping.items,
      title: mapping.title,
      link: mapping.link,
      ...(mapping.thumbnail && { thumbnail: mapping.thumbnail }),
      ...(mapping.date && { date: mapping.date }),
    },
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    reasoning: (parsed.reasoning as string) || '',
  };

  const headers = parsed.headers as Record<string, string> | undefined;
  if (headers && Object.keys(headers).length > 0) config.headers = headers;

  const body = parsed.body as Record<string, unknown> | undefined;
  if (body && Object.keys(body).length > 0) config.body = body;

  if (urlTransform) {
    config.urlTransform = {};
    if (urlTransform.linkTemplate) config.urlTransform.linkTemplate = urlTransform.linkTemplate as string;
    if (urlTransform.linkFields) config.urlTransform.linkFields = urlTransform.linkFields as string[];
    if (urlTransform.thumbnailPrefix) config.urlTransform.thumbnailPrefix = urlTransform.thumbnailPrefix as string;
  }

  return config;
}

/**
 * AI 분석: Edge Function(GPT-5-nano) → 로컬 OpenAI(GPT-4o-mini) fallback
 */
async function analyzeWithEdgeFunction(
  pageUrl: string,
  requests: CapturedRequest[]
): Promise<DetectedApiConfig | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Edge Function 시도
  if (supabaseUrl && supabaseKey) {
    console.log(`[API-DETECT] 🤖 Edge Function 분석 시작 (${requests.length}개 요청)`);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/detect-api-endpoint`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pageUrl, requests: requests.slice(0, 10) }),
        signal: AbortSignal.timeout(40000),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.config) {
          const config = result.config as DetectedApiConfig;

          // 상대경로 엔드포인트 → 캡처된 요청에서 전체 URL 복원
          if (!config.endpoint.startsWith('http')) {
            const match = requests.find(r =>
              new URL(r.url).pathname === config.endpoint ||
              r.url.endsWith(config.endpoint)
            );
            if (match) {
              const fullUrl = new URL(match.url);
              config.endpoint = `${fullUrl.origin}${fullUrl.pathname}`;
              console.log(`[API-DETECT] 🔗 상대경로 → 전체 URL 복원: ${config.endpoint}`);
            } else {
              console.log(`[API-DETECT] ⚠️  상대경로 엔드포인트 거부: ${config.endpoint} → SPA 유지`);
              return null;
            }
          }

          console.log(`[API-DETECT] ✅ API 감지 성공! (Edge Function)`);
          console.log(`[API-DETECT]    endpoint: ${config.endpoint}`);
          console.log(`[API-DETECT]    method: ${config.method}`);
          console.log(`[API-DETECT]    items 경로: ${config.responseMapping.items}`);
          console.log(`[API-DETECT]    신뢰도: ${(config.confidence * 100).toFixed(0)}%`);
          console.log(`[API-DETECT]    근거: ${config.reasoning}`);
          return config;
        }
        console.log(`[API-DETECT] ❌ Edge Function 분석 실패: ${result.error}`);
      } else {
        console.warn(`[API-DETECT] Edge Function HTTP 오류: ${response.status}`);
      }
    } catch (error) {
      console.warn(
        `[API-DETECT] Edge Function 실패, 로컬 OpenAI fallback:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // 로컬 OpenAI fallback
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.warn('[API-DETECT] OPENAI_API_KEY 없음 - 분석 불가');
    return null;
  }

  console.log(`[API-DETECT] 🤖 로컬 OpenAI(gpt-4.1-mini) fallback 분석...`);
  try {
    const config = await analyzeWithOpenAI(pageUrl, requests);
    if (config) {
      console.log(`[API-DETECT] ✅ API 감지 성공! (로컬 OpenAI)`);
      console.log(`[API-DETECT]    endpoint: ${config.endpoint}`);
      console.log(`[API-DETECT]    method: ${config.method}`);
      console.log(`[API-DETECT]    items 경로: ${config.responseMapping.items}`);
      console.log(`[API-DETECT]    신뢰도: ${(config.confidence * 100).toFixed(0)}%`);
      console.log(`[API-DETECT]    근거: ${config.reasoning}`);
    } else {
      console.log(`[API-DETECT] ❌ 로컬 OpenAI: 아티클 API 미감지`);
    }
    return config;
  } catch (error) {
    console.error(
      '[API-DETECT] 로컬 OpenAI 호출 실패:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * 응답 JSON에서 아티클 후보 배열 추출 (2~100개 항목)
 * 설정 데이터나 단순 목록은 제외
 */
function extractReasonableArrays(obj: unknown, depth = 0): unknown[][] {
  if (depth > 3) return [];

  const arrays: unknown[][] = [];

  if (Array.isArray(obj)) {
    if (obj.length >= 2 && obj.length <= 100) {
      arrays.push(obj);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      arrays.push(...extractReasonableArrays(value, depth + 1));
    }
  }

  return arrays;
}
