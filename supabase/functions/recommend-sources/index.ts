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

function buildPrompt(category: string, scope: 'domestic' | 'international' | 'both'): string {
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

### 추천 기준
1. **정기 발행**: 최소 월 1회 이상 새 콘텐츠가 게시되는 사이트
2. **최근 활성**: 최근 3개월 내 새 글이 있는 사이트
3. **공개 접근**: 로그인 없이 콘텐츠 목록을 볼 수 있는 페이지
4. **콘텐츠 목록 페이지**: 개별 글이 아닌, 글 목록이 나열된 페이지의 URL
5. **품질**: 해당 분야에서 신뢰할 수 있는 정보를 제공하는 소스

### 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "recommendations": [
    {
      "url": "콘텐츠 목록 페이지 URL",
      "name": "소스 이름",
      "description": "이 소스를 추천하는 이유 (1문장)"
    }
  ]
}
\`\`\`

### 주의사항
- 최대 5개까지만 추천
- URL은 반드시 실제 접근 가능한 콘텐츠 목록 페이지여야 함
- RSS 피드 URL이 아닌 웹페이지 URL을 제공
- 각 URL은 중복 없이 고유해야 함`;
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

// Fallback: chat.completions API (gpt-4o-mini, 웹검색 없이 학습 데이터 기반)
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

// JSON 텍스트에서 코드블록 제거
function cleanJsonText(text: string): string {
  // ```json ... ``` 블록 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}

// 추천 소스 함수
async function recommendSources(category: string, scope: 'domestic' | 'international' | 'both'): Promise<RecommendResponse> {
  try {
    const prompt = buildPrompt(category, scope);
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
      const validRecommendations = parsed.recommendations
        .filter((r: Recommendation) => r.url && r.name)
        .slice(0, 5)
        .map((r: Recommendation) => ({
          url: r.url,
          name: r.name,
          description: r.description || '',
        }));

      return {
        success: true,
        recommendations: validRecommendations,
      };
    } catch {
      console.error('Failed to parse JSON:', result.output_text);
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
    const { category, scope } = await req.json() as RecommendRequest;

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

    const result = await recommendSources(category, scope);

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
