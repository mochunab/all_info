// @ts-nocheck
// Supabase Edge Function: AI 요약 생성 (GPT-5-nano)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UNIFIED_SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 핵심을 정리하는 '요약 장인'

### **목표**

사용자는 수많은 콘텐츠 중에서 읽을거리를 빠르게 골라야 한다.
1줄 요약은 클릭을 유도하는 '잣대' 역할을, 상세 요약은 기사를 읽지 않아도 내용을 파악할 수 있는 역할을 해야 한다.

### **지시사항**

1. 아래 '본문글'을 읽고 3가지를 작성할 것:
   - **summary**: 1줄 요약 (클릭 유도용, 80자 이내)
   - **summary_tag**: 핵심 키워드 태그 3개
   - **detailed_summary**: 상세 요약글 (헤드라인 + 2~3문장 설명)
2. summary는 전문 용어를 배제하고, 일상적이고 친근한 말투로 풀어서 쓸 것.
3. 추상적인 표현 대신 구체적인 상황이나 이득을 명시할 것.
4. detailed_summary 작성 규칙:
   - 첫 줄: 핵심 헤드라인 (기사의 핵심을 한 문장으로)
   - 빈 줄 하나
   - 2~3문장으로 기사의 주요 내용, 배경, 의미를 설명
   - 이 요약만으로 기사 내용을 충분히 파악 가능해야 함

### **제약 조건**

- **summary 길이:** 공백 포함 80자 이내 (엄수)
- **형식:** 이모티콘 및 마크다운 금지 (순수 텍스트)
- **톤:** 친근하고 쉬운 구어체

### **출력 양식 (JSON)**

\`\`\`json
{
  "summary": "본문 핵심을 후킹 원칙으로 압축한 1줄 요약 (80자 이내)",
  "summary_tag": [
    "주제 태그1 (7자 내외)",
    "주제 태그2 (7자 내외)",
    "주제 태그3 (7자 내외)"
  ],
  "detailed_summary": "핵심 헤드라인\\n\\n상세 설명 2~3문장"
}
\`\`\`

### **본문글**

{content}`;

interface SummaryRequest {
  title: string;
  content: string;
  articleId?: string;
}

interface SummaryResponse {
  success: boolean;
  summary?: string;
  summary_tags?: string[];
  detailed_summary?: string;
  error?: string;
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
      reasoning: { effort: 'low' },
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
  return { output_text: data.output_text || data.choices?.[0]?.message?.content || '' };
}

// Fallback: chat.completions API (gpt-4o-mini)
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
          content: '당신은 콘텐츠 본문글을 읽고 핵심을 정리하는 요약 장인입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 600,
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

// 요약 생성 함수
async function generateSummary(title: string, content: string): Promise<SummaryResponse> {
  try {
    // 본문 길이 제한 (토큰 절약)
    const truncatedContent = content.length > 3000
      ? content.substring(0, 3000) + '...'
      : content;

    const fullContent = `제목: ${title}\n\n${truncatedContent}`;
    const prompt = UNIFIED_SUMMARY_PROMPT.replace('{content}', fullContent);

    const result = await callGPT5Nano(prompt);

    if (!result || !result.output_text) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    // JSON 파싱
    try {
      const parsed = JSON.parse(result.output_text);
      return {
        success: true,
        summary: parsed.summary || '',
        summary_tags: parsed.summary_tag || [],
        detailed_summary: parsed.detailed_summary || '',
      };
    } catch {
      console.error('Failed to parse JSON:', result.output_text);
      return { success: false, error: 'JSON 파싱 실패' };
    }
  } catch (error) {
    console.error('Summary generation error:', error);
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
    const { title, content, articleId } = await req.json() as SummaryRequest;

    if (!title || !content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing title or content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[summarize-article] Processing: ${title.substring(0, 50)}...`);

    const result = await generateSummary(title, content);

    console.log(`[summarize-article] Result: ${result.success ? 'success' : result.error}`);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[summarize-article] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
