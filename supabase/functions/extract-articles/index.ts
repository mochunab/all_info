// @ts-nocheck
// Supabase Edge Function: LLM으로 HTML에서 아티클 직접 추출 (Gemini 2.5 Flash Lite)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `### 역할
웹 페이지 HTML에서 아티클/뉴스/포스트 목록을 직접 추출하는 전문가.

### 목표
메인 콘텐츠 영역을 식별하고, 반복되는 아이템에서 제목(title), 링크(link), 날짜(date), 썸네일(thumbnail)을 추출하여 JSON 배열로 반환한다.

### 추출 기준

1. **메인 콘텐츠 영역 식별**: aside, sidebar, widget, banner, nav, footer 내부는 무시. 가장 넓은 중앙 영역의 반복 아이템을 찾는다.
2. **반복 아이템 식별**: 동일 구조가 3개 이상 반복되는 카드/리스트/테이블 행을 찾는다.
3. **제목**: 15자 이상 텍스트가 있는 주요 텍스트. 너무 짧은 것(카테고리명, 태그)은 제외.
4. **링크**: 아이템을 클릭하면 이동할 상세 페이지 URL. href 속성에서 추출. 상대 URL은 그대로 반환.
5. **날짜**: 게시 날짜. 없으면 null.
6. **썸네일**: 대표 이미지 URL. 없으면 null.

### 거부 패턴
- 네비게이션 링크 (/about, /login, /signup 등)
- 외부 광고/쇼핑 링크
- 카테고리/태그 필터
- 짧은 브랜드명 (15자 미만)
- javascript: void 링크

### 입력
- **URL**: {url}
- **HTML**:
\`\`\`html
{html}
\`\`\`

### 출력 형식 (JSON)
\`\`\`json
{
  "articles": [
    {
      "title": "아티클 제목",
      "link": "/path/to/article 또는 https://...",
      "date": "날짜 문자열 또는 null",
      "thumbnail": "이미지 URL 또는 null"
    }
  ]
}
\`\`\`

최대 20개까지만 추출. 확실한 아티클만 포함하라.`;

type ExtractionRequest = {
  url: string;
  html: string;
};

type ExtractedArticle = {
  title: string;
  link: string;
  date: string | null;
  thumbnail: string | null;
};

type ExtractionResponse = {
  success: boolean;
  articles?: ExtractedArticle[];
  error?: string;
};

function preprocessHtml(html: string, maxLength: number = 30000): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<script[^>]*>[\s\S]{200,}?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]{200,}?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, maxLength);
}

function resolveUrl(link: string, baseUrl: string): string | null {
  if (!link || link.startsWith('javascript:')) return null;

  if (link.startsWith('http://') || link.startsWith('https://')) {
    return link;
  }

  try {
    return new URL(link, baseUrl).href;
  } catch {
    return null;
  }
}

function validateArticles(articles: unknown[], baseUrl: string): ExtractedArticle[] {
  if (!Array.isArray(articles)) return [];

  const validated: ExtractedArticle[] = [];

  for (const item of articles.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;

    const { title, link, date, thumbnail } = item as Record<string, unknown>;

    if (typeof title !== 'string' || title.length < 5) continue;

    const resolvedLink = resolveUrl(String(link || ''), baseUrl);
    if (!resolvedLink) continue;

    validated.push({
      title: title.trim(),
      link: resolvedLink,
      date: typeof date === 'string' && date.length > 0 ? date : null,
      thumbnail: typeof thumbnail === 'string' && thumbnail.length > 0
        ? resolveUrl(thumbnail, baseUrl)
        : null,
    });
  }

  return validated;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = Deno.env.get('google_API_KEY');
  if (!apiKey) throw new Error('google_API_KEY not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return text;
}

async function extractArticles(url: string, html: string): Promise<ExtractionResponse> {
  try {
    const truncatedHtml = preprocessHtml(html, 30000);

    const prompt = EXTRACTION_PROMPT
      .replace('{url}', url)
      .replace('{html}', truncatedHtml);

    const text = await callGemini(prompt);

    try {
      const parsed = JSON.parse(text);
      const articles = validateArticles(parsed.articles || parsed, url);

      return {
        success: true,
        articles,
      };
    } catch {
      console.error('[extract-articles] JSON parse failed:', text.substring(0, 200));
      return { success: false, error: 'JSON 파싱 실패' };
    }
  } catch (error) {
    console.error('[extract-articles] Extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, html } = await req.json() as ExtractionRequest;

    if (!url || !html) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing url or html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[extract-articles] Extracting from: ${url}`);

    const result = await extractArticles(url, html);

    console.log(`[extract-articles] Result: ${result.success ? `${result.articles?.length || 0} articles` : result.error}`);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[extract-articles] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
