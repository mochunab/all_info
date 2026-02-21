// @ts-nocheck
// Supabase Edge Function: AI 콘텐츠 소스 추천 (GPT-5-nano + web_search_preview)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RecommendRequest = {
  category: string;
  scope: 'domestic' | 'international' | 'both';
  existingUrls?: string[];
};

type Recommendation = {
  url: string;
  name: string;
  description: string;
};

type RecommendResponse = {
  success: boolean;
  recommendations?: Recommendation[];
  error?: string;
};

function buildPrompt(category: string, scope: 'domestic' | 'international' | 'both', existingUrls: string[] = []): string {
  const scopeInstruction = {
    domestic: '한국어로 된 국내 소스만 추천하세요. 한국 웹사이트, 블로그, 미디어를 우선합니다.',
    international: '영어 또는 글로벌 소스만 추천하세요. 해외 웹사이트, 블로그, 미디어를 우선합니다.',
    both: '국내(한국어) 소스 2-3개와 해외(영어/글로벌) 소스 2-3개를 섞어서 추천하세요.',
  }[scope];

  return `### 역할
당신은 "${category}" 분야의 최신 콘텐츠 소스를 추천하는 전문가입니다.

### 목표
"${category}" 카테고리에 적합한 고품질 콘텐츠 소스(웹사이트, 블로그, 미디어)를 웹 검색을 통해 찾아 최대 5개를 추천합니다.

### 범위
${scopeInstruction}

### 추천 기준 (반드시 모두 충족해야 추천)
1. **콘텐츠 관련성 (최우선)**: 사이트명이나 도메인이 아닌, **실제 게시된 글의 내용**이 "${category}" 분야와 직접 관련이 있어야 함. 웹 검색으로 해당 사이트의 최근 글 제목들을 반드시 확인하고, 카테고리와 무관한 콘텐츠(잡블로그, 리뷰 블로그 등)는 제외할 것
2. **최근 활성**: 최근 2개월 내 새 글이 반드시 있어야 함. 웹 검색으로 최신 글의 발행일을 확인할 것. 마지막 글이 2개월 이상 된 사이트는 추천 금지
3. **정기 발행**: 최소 월 2회 이상 새 콘텐츠가 게시되는 사이트
4. **공개 접근**: 로그인 없이 콘텐츠 목록을 볼 수 있는 페이지
5. **콘텐츠 목록 페이지 (필수)**: 여러 글이 나열된 목록/아카이브/블로그 인덱스 페이지의 URL만 허용. **개별 기사 본문 URL은 절대 금지** (예: /news/some-article-title/ 같은 단일 기사 URL 금지). URL 경로가 /news/, /blog/, /insights/, /articles/ 등 목록성 경로인지 반드시 확인할 것
6. **전문성**: 해당 분야 전문 미디어, 기업 블로그, 리서치 기관 우선. 개인 블로그나 범용 커뮤니티보다 분야 특화 소스를 우선할 것

### 검증 절차
각 추천 후보에 대해 반드시 아래를 웹 검색으로 확인:
- **URL이 콘텐츠 목록 페이지인가?** 개별 기사 본문 URL이면 해당 사이트의 목록 페이지 URL로 변환하거나, 목록 페이지를 찾을 수 없으면 제외
- 최근 글 3~5개의 제목이 "${category}" 분야와 관련 있는가?
- 가장 최근 글의 발행일이 2개월 이내인가?
- 확인되지 않으면 추천 목록에서 제외

### 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "recommendations": [
    {
      "url": "콘텐츠 목록 페이지 URL",
      "name": "소스 이름",
      "description": "이 소스를 추천하는 이유 + 최근 글 예시 1개 (1~2문장)"
    }
  ]
}
\`\`\`

### 주의사항
- 최대 5개까지만 추천 (확실한 것만, 애매하면 줄여도 됨)
- URL은 반드시 여러 글이 나열된 목록 페이지여야 함 (개별 기사 본문 URL 절대 금지)
- 올바른 예: example.com/blog/, example.com/news/, example.com/insights/
- 잘못된 예: example.com/news/some-article-title-2026/ (이건 개별 기사)
- RSS 피드 URL이 아닌 웹페이지 URL을 제공
- 각 URL은 중복 없이 고유해야 함
- **절대로** 아래 '이미 등록된 소스'에 포함된 도메인과 동일한 사이트를 추천하지 마세요${existingUrls.length > 0 ? `

### 이미 등록된 소스 (제외 대상)
${existingUrls.map(u => `- ${u}`).join('\n')}` : ''}`;
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

// GPT-5-nano Responses API + web_search_preview
async function callGPT5NanoWithSearch(prompt: string): Promise<{ output_text: string } | null> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      input: prompt,
      tools: [{ type: 'web_search_preview' }],
      reasoning: { effort: 'low' },
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
    console.warn('[recommend-sources] GPT-5-nano returned empty text, response keys:', Object.keys(data));
    console.log('Falling back to chat.completions API due to empty response...');
    return await fallbackToChatCompletions(prompt, apiKey);
  }

  return { output_text: text };
}

// Fallback: chat.completions API (gpt-4.1-mini, 웹검색 없이 학습 데이터 기반)
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
          content: '당신은 콘텐츠 소스 추천 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
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

// JSON 텍스트에서 코드블록 제거 + JSON 객체 추출
function cleanJsonText(text: string): string {
  // 1) ```json ... ``` 블록 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2) 첫 번째 { ... } 객체 추출 (앞뒤 텍스트 제거)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  return text.trim();
}

// URL 접근 가능 여부 검증 (HEAD → GET fallback, 5초 타임아웃)
async function isUrlAccessible(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // HEAD 먼저 시도 (빠름)
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightHub/1.0)' },
    });

    // HEAD가 405면 GET으로 재시도
    if (response.status === 405) {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightHub/1.0)' },
      });
    }

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// 추천 목록에서 접속 불가 URL 제거
async function filterAccessibleUrls(recommendations: Recommendation[]): Promise<Recommendation[]> {
  const results = await Promise.allSettled(
    recommendations.map(async (rec) => {
      const accessible = await isUrlAccessible(rec.url);
      return { rec, accessible };
    })
  );

  const filtered: Recommendation[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.accessible) {
      filtered.push(result.value.rec);
    } else if (result.status === 'fulfilled') {
      console.log(`[recommend-sources] Filtered out inaccessible URL: ${result.value.rec.url}`);
    }
  }
  return filtered;
}

// 추천 소스 함수
async function recommendSources(category: string, scope: 'domestic' | 'international' | 'both', existingUrls: string[] = []): Promise<RecommendResponse> {
  try {
    const prompt = buildPrompt(category, scope, existingUrls);
    const result = await callGPT5NanoWithSearch(prompt);

    if (!result || !result.output_text) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    try {
      const cleanedText = cleanJsonText(result.output_text);
      const parsed = JSON.parse(cleanedText);

      if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
        return { success: false, error: 'Invalid response format: missing recommendations array' };
      }

      // 유효한 추천만 필터링 (최대 5개)
      const candidates = parsed.recommendations
        .filter((r: Recommendation) => r.url && r.name)
        .slice(0, 5)
        .map((r: Recommendation) => ({
          url: r.url,
          name: r.name,
          description: r.description || '',
        }));

      // URL 접근 가능 여부 검증
      const validRecommendations = await filterAccessibleUrls(candidates);
      console.log(`[recommend-sources] ${candidates.length} candidates → ${validRecommendations.length} accessible`);

      return {
        success: true,
        recommendations: validRecommendations,
      };
    } catch {
      console.error('Failed to parse JSON. Raw output (first 500 chars):', result.output_text.substring(0, 500));
      // 마지막 시도: fallback으로 직접 chat.completions 호출
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (apiKey) {
        console.log('[recommend-sources] Retrying with chat.completions fallback...');
        const fallbackResult = await fallbackToChatCompletions(prompt, apiKey);
        if (fallbackResult?.output_text) {
          try {
            const fallbackCleaned = cleanJsonText(fallbackResult.output_text);
            const fallbackParsed = JSON.parse(fallbackCleaned);
            if (fallbackParsed.recommendations && Array.isArray(fallbackParsed.recommendations)) {
              const fallbackCandidates = fallbackParsed.recommendations
                .filter((r: Recommendation) => r.url && r.name)
                .slice(0, 5)
                .map((r: Recommendation) => ({ url: r.url, name: r.name, description: r.description || '' }));
              const validRecs = await filterAccessibleUrls(fallbackCandidates);
              return { success: true, recommendations: validRecs };
            }
          } catch {
            console.error('Fallback also failed to parse JSON:', fallbackResult.output_text.substring(0, 300));
          }
        }
      }
      return { success: false, error: 'JSON parsing failed' };
    }
  } catch (error) {
    console.error('Recommend sources error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
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
    const { category, scope, existingUrls } = await req.json() as RecommendRequest;

    if (!category || !scope) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing category or scope' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validScopes = ['domestic', 'international', 'both'];
    if (!validScopes.includes(scope)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid scope: ${scope}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[recommend-sources] Category: ${category}, Scope: ${scope}`);

    const result = await recommendSources(category, scope, existingUrls || []);

    console.log(`[recommend-sources] Result: ${result.success ? `${result.recommendations?.length} recommendations` : result.error}`);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[recommend-sources] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
