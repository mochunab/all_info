// @ts-nocheck
// Supabase Edge Function: AI 기반 숨겨진 API 엔드포인트 감지 (GPT-5-nano)
// Deno runtime — excluded from Next.js type checking
//
// 입력: { pageUrl: string, requests: CapturedRequest[] }
// 출력: { success: true, config: DetectedApiConfig } | { success: false, error: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_DETECT_PROMPT = `### 역할

웹 페이지에서 가로챈 XHR/fetch API 요청들을 분석하여, 아티클/포스트 목록을 반환하는 API를 식별하는 전문가.

### 목표

주어진 API 요청 목록 중 아티클 목록 API를 찾아내고, 정확한 필드 매핑과 URL 변환 규칙을 추출한다.

### 페이지 URL

{pageUrl}

### 감지된 API 요청 목록

{requests}

### 아티클 목록 API 식별 기준

1. **배열 포함**: JSON 응답에 아티클 객체 배열이 포함됨 (2개 이상)
2. **콘텐츠 필드**: 제목(title/name/subject), 링크(url/link/urlKeyword/slug), 날짜(date/createdAt/baseDT) 등 콘텐츠 관련 필드 존재
3. **설정/메타 제외**: 단순 설정값, 카테고리 목록, 사용자 정보 등은 제외
4. **가장 적합한 1개만 선택**: 여러 후보가 있으면 아티클 수가 많고 필드가 풍부한 것 선택

### 필드 매핑 추출 규칙

- **items**: 배열이 위치한 JSON 경로 (예: "insightList", "data.posts", "result.items")
  - 루트가 배열이면 "" (빈 문자열)
  - 중첩된 경우 점(.) 구분자 사용
- **title**: 제목에 해당하는 필드명
- **link**: URL/슬러그에 해당하는 필드명 (절대 URL이면 그대로, 상대 경로면 urlTransform 필요)
- **thumbnail**: 썸네일 이미지 필드명 (없으면 생략)
- **date**: 날짜 필드명 (없으면 생략)

### URL 변환 규칙 (urlTransform)

링크 필드가 절대 URL이 아닌 경우:
- **linkTemplate**: 전체 URL 패턴 (예: "https://site.com/insight/{urlKeyword}")
  - 필드명을 \`{fieldName}\` 형식으로 치환
- **linkFields**: 템플릿에 사용할 필드 배열 (예: ["urlKeyword"])
- **thumbnailPrefix**: 썸네일이 상대 경로인 경우 prepend할 prefix URL

### 중요 원칙

1. **요청 body 재현**: POST 요청의 경우 body에 포함된 파라미터 모두 포함
2. **필요한 헤더만**: Content-Type, Authorization 등 실제로 필요한 헤더만
3. **신뢰도 기준**:
   - 0.8~1.0: 명확한 아티클 목록 API (제목+링크+날짜 모두 있음)
   - 0.6~0.8: 아티클 목록이지만 일부 필드 불확실
   - 0.4~0.6: 가능성 있지만 불확실
   - 0.4 미만: 아티클 목록 API 없음

### 출력 형식 (JSON)

\`\`\`json
{
  "found": true,
  "endpoint": "https://...",
  "method": "GET",
  "headers": {},
  "body": {},
  "responseMapping": {
    "items": "insightList",
    "title": "title",
    "link": "urlKeyword",
    "thumbnail": "coverImgPath",
    "date": "baseDT"
  },
  "urlTransform": {
    "linkTemplate": "https://www.wiseapp.co.kr/insight/{urlKeyword}",
    "linkFields": ["urlKeyword"],
    "thumbnailPrefix": "https://www.wiseapp.co.kr:10081/insight-resources"
  },
  "confidence": 0.85,
  "reasoning": "POST /insight/getList.json 요청이 insightList 배열을 반환. 각 아이템에 title, urlKeyword, baseDT, coverImgPath 필드 존재. urlKeyword는 상대 슬러그이므로 linkTemplate 적용."
}
\`\`\`

아티클 목록 API를 찾지 못한 경우:
\`\`\`json
{
  "found": false,
  "confidence": 0.1,
  "reasoning": "수집된 요청 중 아티클 목록을 반환하는 API 없음."
}
\`\`\`

이제 위 기준으로 분석하시오.`;

// 가로챈 요청 타입
type CapturedRequest = {
  url: string;
  method: string;
  requestBody: string | null;
  responsePreview: string;
  responseStatus: number;
};

// 감지된 API 설정
type DetectedApiConfig = {
  endpoint: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  responseMapping: {
    items: string;
    title: string;
    link: string;
    thumbnail?: string;
    date?: string;
  };
  urlTransform?: {
    linkTemplate?: string;
    linkFields?: string[];
    thumbnailPrefix?: string;
    baseUrl?: string;
  };
  confidence: number;
  reasoning: string;
};

// Responses API 응답에서 텍스트 추출 (detect-crawler-type과 동일한 패턴)
function extractTextFromResponse(data: Record<string, unknown>): string {
  if (data.output_text && typeof data.output_text === 'string') {
    return data.output_text;
  }

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

  const choiceContent = (data as any)?.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string' && choiceContent) {
    return choiceContent;
  }

  return '';
}

// GPT-5-nano responses.create() API 호출
async function callGPT5Nano(prompt: string): Promise<{ output_text: string } | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

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

    if (response.status === 404) {
      console.log('Falling back to chat.completions API...');
      return await fallbackToChatCompletions(prompt, apiKey);
    }

    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = extractTextFromResponse(data);

  if (!text) {
    console.warn('[detect-api-endpoint] GPT-5-nano returned empty text, falling back...');
    return await fallbackToChatCompletions(prompt, apiKey);
  }

  return { output_text: text };
}

// Fallback: chat.completions (gpt-4o-mini)
async function fallbackToChatCompletions(prompt: string, apiKey: string): Promise<{ output_text: string } | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 웹 API 분석 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
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

// API 엔드포인트 분석
async function detectApiEndpoint(
  pageUrl: string,
  requests: CapturedRequest[]
): Promise<{ success: boolean; config?: DetectedApiConfig; error?: string }> {
  try {
    // 요청 목록을 간결하게 포맷
    const requestSummary = requests.map((req, i) => {
      const urlPath = (() => {
        try { return new URL(req.url).pathname + new URL(req.url).search; } catch { return req.url; }
      })();

      return `[${i + 1}] ${req.method} ${urlPath}
응답 상태: ${req.responseStatus}
요청 body: ${req.requestBody ? req.requestBody.substring(0, 300) : '없음'}
응답 미리보기: ${req.responsePreview.substring(0, 500)}`;
    }).join('\n\n---\n\n');

    const prompt = API_DETECT_PROMPT
      .replace('{pageUrl}', pageUrl)
      .replace('{requests}', requestSummary || '(감지된 API 요청 없음)');

    const result = await callGPT5Nano(prompt);

    if (!result || !result.output_text) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    const parsed = JSON.parse(result.output_text);

    if (!parsed.found) {
      return { success: false, error: parsed.reasoning || '아티클 API 없음' };
    }

    // 필수 필드 검증
    if (!parsed.endpoint || !parsed.method || !parsed.responseMapping?.items || !parsed.responseMapping?.title || !parsed.responseMapping?.link) {
      return { success: false, error: '필수 필드 누락 (endpoint, method, responseMapping.items/title/link)' };
    }

    const config: DetectedApiConfig = {
      endpoint: parsed.endpoint,
      method: parsed.method === 'POST' ? 'POST' : 'GET',
      ...(parsed.headers && Object.keys(parsed.headers).length > 0 && { headers: parsed.headers }),
      ...(parsed.body && Object.keys(parsed.body).length > 0 && { body: parsed.body }),
      responseMapping: {
        items: parsed.responseMapping.items,
        title: parsed.responseMapping.title,
        link: parsed.responseMapping.link,
        ...(parsed.responseMapping.thumbnail && { thumbnail: parsed.responseMapping.thumbnail }),
        ...(parsed.responseMapping.date && { date: parsed.responseMapping.date }),
      },
      ...(parsed.urlTransform && {
        urlTransform: {
          ...(parsed.urlTransform.linkTemplate && { linkTemplate: parsed.urlTransform.linkTemplate }),
          ...(parsed.urlTransform.linkFields && { linkFields: parsed.urlTransform.linkFields }),
          ...(parsed.urlTransform.thumbnailPrefix && { thumbnailPrefix: parsed.urlTransform.thumbnailPrefix }),
          ...(parsed.urlTransform.baseUrl && { baseUrl: parsed.urlTransform.baseUrl }),
        },
      }),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || '',
    };

    return { success: true, config };
  } catch (error) {
    console.error('[detect-api-endpoint] 분석 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Edge Function 핸들러
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pageUrl, requests } = await req.json() as {
      pageUrl: string;
      requests: CapturedRequest[];
    };

    if (!pageUrl || !Array.isArray(requests)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing pageUrl or requests' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[detect-api-endpoint] 분석 시작: ${pageUrl} (${requests.length}개 요청)`);

    const result = await detectApiEndpoint(pageUrl, requests);

    console.log(`[detect-api-endpoint] 결과: ${result.success ? `성공 (confidence: ${result.config?.confidence})` : result.error}`);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 200, // 분석 자체는 항상 200 (성공/실패는 result.success로 구분)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[detect-api-endpoint] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
