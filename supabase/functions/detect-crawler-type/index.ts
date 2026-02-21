// @ts-nocheck
// Supabase Edge Function: AI 크롤러 타입 + 셀렉터 통합 감지 (GPT-5-nano)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UNIFIED_DETECTION_PROMPT = `### **역할**

웹 페이지 HTML 구조를 분석하여 최적의 크롤링 전략(타입)을 결정하고, 콘텐츠 목록의 CSS 셀렉터까지 한 번에 추출하는 전문가

### **목표**

1. 크롤러 타입을 먼저 결정한다.
2. 해당 타입에 맞는 CSS 셀렉터를 추출한다 (예: STATIC + table 구조 → tbody > tr).

---

### **크롤러 타입 정의**

1. **STATIC**: 정적 HTML (Cheerio로 파싱 가능)
   - 서버에서 완전한 HTML을 렌더링
   - JavaScript 없이도 모든 콘텐츠 표시
   - 페이지 소스에 실제 텍스트/링크가 모두 존재
   - 예: WordPress, Jekyll, 전통적인 SSR 사이트

2. **SPA**: Single Page Application (Puppeteer 필요)
   - JavaScript로 동적 렌더링
   - 초기 HTML은 거의 비어있고 <div id="root"> 같은 마운트 포인트만 존재
   - React, Vue, Angular 등 프레임워크 사용
   - API 호출로 데이터 로드
   - 예: 대부분의 현대적 웹앱, 관리자 페이지, 정부 포털

3. **RSS**: RSS/Atom 피드

4. **PLATFORM_NAVER**: 네이버 블로그 전용

5. **PLATFORM_KAKAO**: 카카오 브런치 전용

6. **NEWSLETTER**: 뉴스레터 플랫폼

7. **API**: REST API 엔드포인트

---

### **타입 분석 기준**

#### SPA 감지 지표 (우선순위 높음):
- \`<div id="root">\`, \`<div id="app">\`, \`<div id="__next">\` 같은 마운트 포인트
- body가 거의 비어있고 스크립트만 많음
- 정부/공공기관 도메인 (.go.kr, .or.kr, nipa.kr 등)

#### STATIC 감지 지표:
- 완전한 HTML 구조 (article, section, header, footer 태그)
- 실제 콘텐츠 텍스트가 HTML 소스에 직접 포함
- WordPress, Tistory 등 CMS 흔적 (\`wp-content\`, \`.tistory.com\`)

#### 중요 원칙:
1. 정부/공공기관은 무조건 SPA
2. SSR 판별 우선: HTML body에 실제 기사 제목/텍스트가 있으면 → STATIC
3. SPA는 body가 거의 비어있고 JS로 로드하는 경우에만

---

### **셀렉터 추출 기준**

#### STEP 1 — 메인 콘텐츠 영역 식별 (최우선):
페이지에서 **메인 기사/뉴스 목록이 있는 영역**을 먼저 찾아라.
- \`<main>\`, \`#content\`, \`#main\`, \`.content\`, 또는 **가장 넓은 중앙 영역**
- ⚠️ **aside, sidebar, widget, 오른쪽/왼쪽 사이드바 내부 목록은 절대 선택 금지**
- 사이드바 판별법: id/class에 "right", "side", "widget", "banner", "ad", "promo", "review" 포함 시 사이드바 가능성 높음
- 메인 영역에 table 게시판이 있으면 그것이 메인 콘텐츠

#### STEP 2 — 실제 기사 카드 식별:
메인 영역 내에서 반복 아이템을 찾는다:
1. 개별 상세 페이지로 이동하는 고유 링크 (URL에 ID/슬러그 포함)
2. 15자 이상의 제목 텍스트
3. 3개 이상 반복되는 동일 구조
4. **같은 도메인의 내부 링크**가 있는 아이템 우선 (외부 쇼핑/광고 링크 제외)

#### 거부(REJECT) 패턴:
- ❌ aside/sidebar/widget 내부 아이템
- ❌ 카테고리/태그 필터 탭
- ❌ 네비게이션 링크 (/about, /login 등)
- ❌ 외부 도메인 링크 목록 (광고, 쇼핑, 프로모션)
- ❌ 구독자 수/조회수 등 통계 숫자
- ❌ 짧은 브랜드명/카테고리명 (15자 미만)

#### TABLE 구조 지원 (한국 사이트 필수):
- 한국 포털/게시판/뉴스 사이트는 **table > tbody > tr** 구조가 매우 흔함
- 메인 영역에 table이 있고 tr이 5개 이상이면 → 높은 확률로 기사 목록
- tr 내부의 td에서 title(.title, .subject 등), link(a) 추출
- table 기반 목록은 div/li 기반 사이드바 위젯보다 **항상 우선**

#### 우선순위 (여러 후보 시):
1. **메인 콘텐츠 영역** 내부 (aside/sidebar 제외)
2. 가장 많은 아이템 수
3. 같은 도메인 내부 링크가 있는 아이템
4. 날짜가 보이는 아이템
5. 가장 긴 제목 텍스트

#### container / item 셀렉터 작성 규칙 (중요):
- **container**: 목록을 감싸는 상위 래퍼 (예: "#webzineNews", ".article-list", "table")
  - container는 **간결한 상위 셀렉터**여야 함 (1~2 depth)
- **item**: container 기준 **상대 경로** (예: "tbody > tr", "li", "article")
  - item은 container 내부에서의 반복 단위
- ⚠️ **container와 item에 동일한 경로를 중복 넣지 마라**
  - ❌ 잘못: container="ul.list", item="ul.list > li" → 합치면 "ul.list ul.list > li" (매칭 불가)
  - ✅ 올바름: container="ul.list", item="li" → 합치면 "ul.list li" (정상 매칭)
- title, link, date 등은 **item 내부 상대 경로**로 작성

#### Tailwind 콜론 이스케이프:
CSS 셀렉터에서 Tailwind 변형 접두사(dark:, lg: 등)의 ":"는 "\\\\:"로 이스케이프 필수.
예: class "dark:text-slate-200" → JSON에서 ".dark\\\\:text-slate-200"

#### SPA 셸 감지:
HTML에 거의 텍스트가 없고 <script> 번들만 있으면 → selectors를 null로, confidence 0.2로 설정.

---

### **입력 정보**

- **URL**: {url}
- **HTML** (전처리 후):
\`\`\`html
{html}
\`\`\`

### **출력 형식 (JSON)**

\`\`\`json
{
  "crawlerType": "STATIC | SPA | RSS | PLATFORM_NAVER | PLATFORM_KAKAO | NEWSLETTER | API",
  "confidence": 0.0~1.0,
  "reasoning": "타입 선택 이유 + 셀렉터 선택 근거를 2-3문장으로.",
  "selectors": {
    "container": "메인 콘텐츠 컨테이너 (간결, 1~2 depth)",
    "item": "container 기준 상대 경로의 반복 아이템",
    "title": "item 내부 상대 경로의 제목",
    "link": "item 내부 상대 경로의 링크",
    "date": "item 내부 상대 경로의 날짜 (없으면 null)",
    "thumbnail": "item 내부 상대 경로의 썸네일 (없으면 null)"
  },
  "excludeSelectors": ["nav", "header", "footer", "aside", ".sidebar"]
}
\`\`\`

selectors가 감지 불가능한 경우(SPA 셸 등), selectors를 null로 설정하세요.

이제 위 기준으로 분석하시오.`;

type DetectionRequest = {
  url: string;
  html: string;
  currentAnalysis?: {
    urlPattern?: string;
    spaScore?: number;
    ruleBasedType?: string;
    ruleBasedConfidence?: number;
  };
}

type DetectionResponse = {
  success: boolean;
  crawlerType?: string;
  confidence?: number;
  reasoning?: string;
  selectors?: {
    container?: string;
    item: string;
    title: string;
    link: string;
    date?: string;
    thumbnail?: string;
  };
  excludeSelectors?: string[];
  error?: string;
}

// Responses API 응답에서 텍스트 추출
function extractTextFromResponse(data: Record<string, unknown>): string {
  // 1) output_text 편의 필드 (최신 API)
  if (data.output_text && typeof data.output_text === 'string') {
    return data.output_text;
  }

  // 2) output 배열에서 message content 추출
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block?.type === 'output_text' && typeof block.text === 'string' && block.text) {
            return block.text;
          }
        }
      }
    }
  }

  // 3) chat.completions 형식 (혹시 모를 호환)
  const choiceContent = (data as any)?.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string' && choiceContent) {
    return choiceContent;
  }

  return '';
}

// HTML 전처리: <head>, 대형 <script>/<style> 제거 후 truncate
function preprocessHtml(html: string, maxLength: number = 50000): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<script[^>]*>[\s\S]{200,}?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]{200,}?<\/style>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, maxLength);
}

// GPT-5-nano responses.create() API 호출
async function callGPT5Nano(prompt: string): Promise<{ output_text: string } | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // OpenAI responses.create() API (gpt-5-nano)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      input: prompt,
      reasoning: { effort: 'medium' },
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', response.status, errorText);

    // Fallback to chat.completions if responses API not available
    if (response.status === 404) {
      console.log('Falling back to chat.completions API...');
      return await fallbackToChatCompletions(prompt, apiKey);
    }

    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = extractTextFromResponse(data);

  // 텍스트 추출 실패 시 chat.completions fallback
  if (!text) {
    console.warn('[detect-crawler-type] GPT-5-nano returned empty text, response keys:', Object.keys(data));
    console.log('Falling back to chat.completions API due to empty response...');
    return await fallbackToChatCompletions(prompt, apiKey);
  }

  return { output_text: text };
}

// Fallback: chat.completions API (gpt-4.1-mini)
async function fallbackToChatCompletions(prompt: string, apiKey: string): Promise<{ output_text: string } | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 웹 페이지 HTML 구조를 분석하여 최적의 크롤링 전략을 결정하고 CSS 셀렉터를 추출하는 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat completions API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { output_text: data.choices?.[0]?.message?.content || '' };
}

// 통합 크롤러 타입 + 셀렉터 감지 함수
async function detectCrawlerType(url: string, html: string): Promise<DetectionResponse> {
  try {
    // HTML 전처리: <head>, 대형 script/style 제거 후 50000자
    const truncatedHtml = preprocessHtml(html, 50000);

    const prompt = UNIFIED_DETECTION_PROMPT
      .replace('{url}', url)
      .replace('{html}', truncatedHtml);

    const result = await callGPT5Nano(prompt);

    if (!result || !result.output_text) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    // JSON 파싱
    try {
      // JSON repair: \: → \\: (AI가 CSS 이스케이프를 JSON에 그대로 쓰는 경우 수정)
      const repairedJson = result.output_text.replace(/(?<!\\)\\:/g, '\\\\:');
      const parsed = JSON.parse(repairedJson);

      // 유효성 검증
      const validTypes = ['STATIC', 'SPA', 'RSS', 'PLATFORM_NAVER', 'PLATFORM_KAKAO', 'NEWSLETTER', 'API'];
      if (!validTypes.includes(parsed.crawlerType)) {
        return { success: false, error: `Invalid crawler type: ${parsed.crawlerType}` };
      }

      const response: DetectionResponse = {
        success: true,
        crawlerType: parsed.crawlerType,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
      };

      // 셀렉터가 있으면 추가
      if (parsed.selectors && parsed.selectors.item) {
        response.selectors = {
          item: parsed.selectors.item,
          title: parsed.selectors.title,
          link: parsed.selectors.link,
          ...(parsed.selectors.container && parsed.selectors.container !== 'null'
            ? { container: parsed.selectors.container } : {}),
          ...(parsed.selectors.date && parsed.selectors.date !== 'null'
            ? { date: parsed.selectors.date } : {}),
          ...(parsed.selectors.thumbnail && parsed.selectors.thumbnail !== 'null'
            ? { thumbnail: parsed.selectors.thumbnail } : {}),
        };
      }

      if (Array.isArray(parsed.excludeSelectors) && parsed.excludeSelectors.length > 0) {
        response.excludeSelectors = parsed.excludeSelectors;
      }

      return response;
    } catch {
      console.error('Failed to parse JSON:', result.output_text);
      return { success: false, error: 'JSON 파싱 실패' };
    }
  } catch (error) {
    console.error('Crawler type detection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Edge Function 핸들러
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, html } = await req.json() as DetectionRequest;

    if (!url || !html) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing url or html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[detect-crawler-type] Analyzing: ${url}`);

    const result = await detectCrawlerType(url, html);

    console.log(`[detect-crawler-type] Result: ${result.success ? `${result.crawlerType} (${result.confidence})` : result.error}`);
    if (result.selectors) {
      console.log(`[detect-crawler-type] Selectors: item=${result.selectors.item}, title=${result.selectors.title}`);
    }

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[detect-crawler-type] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
