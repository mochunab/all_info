// @ts-nocheck
// Supabase Edge Function: AI 요약 생성 (Gemini 2.5 Flash Lite)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UNIFIED_SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 핵심을 정리하는 '요약 장인' + 클릭을 부르는 '후킹 카피라이터'

### **목표**

1. 사용자가 스크롤을 멈추고 클릭하게 만드는 후킹 제목을 만든다.
2. 기사를 읽지 않아도 내용을 구체적으로 파악할 수 있도록 핵심을 충분히 요약한다.

### **지시사항**

1. 아래 '본문글'을 읽고 4가지를 작성할 것:
   - **title_ko**: 원본 제목의 자연스러운 한국어 번역 (이미 한국어면 그대로 사용)
   - **hook_title**: 클릭을 유도하는 후킹 제목 (40자 이내)
   - **summary_tag**: 핵심 키워드 태그 3개
   - **detailed_summary**: 핵심 설명 3~4문장

2. hook_title 작성 규칙:
   - title_ko와 완전히 다른 문장으로 작성 (절대 제목을 반복하거나 요약하지 말 것)
   - 본문의 가장 흥미로운 팩트, 반전, 시사점을 뽑아 호기심을 자극할 것
   - 아래 전략 중 본문에 가장 어울리는 1~2개를 조합:
     a. 손실 회피: 놓치면 손해라는 느낌 ("이거 모르면 진짜 손해", "지금 안 바꾸면 늦음")
     b. 구체적 숫자: 신뢰감 + 예측 가능성 ("3가지 신호", "90%가 모르는")
     c. 호기심 갭: 결론을 살짝 숨겨 궁금증 유발 ("진짜 이유는 따로 있었다", "아무도 예상 못한 결말")
     d. 비교/경쟁 자극: 나만 뒤처지는 불안 ("요즘 잘나가는 팀들은 이미 쓰고 있는")
     e. 경고/파국 암시: 최악의 시나리오 제시 ("이대로면 3년 안에 사라질 직업")
     f. 이익 약속: 확실한 보상 제시 ("매출 2배 올린 단 한 가지 비결")
   - 40자 이내, 한 문장, '-요/-다/-음' 등 종결어미 자유

3. detailed_summary 작성 규칙:
   - 핵심 설명 3~4문장 (총 250자 이내)
   - 구체적인 사례, 수치, 근거를 포함할 것
   - 독자가 실제로 어떤 내용인지 알 수 있는 팩트 중심으로 작성
   - 추상적인 표현("일깨운다", "보여준다") 대신 구체적으로 무슨 일이 있었는지 서술

### **제약 조건**

- **형식:** 이모티콘 및 마크다운 금지 (순수 텍스트)
- **톤:** 친근하고 쉬운 구어체
- **길이:** detailed_summary 전체 250자 이내

### **출력 양식 (JSON)**

\`\`\`json
{
  "title_ko": "원본 제목의 한국어 번역 (이미 한국어면 그대로)",
  "hook_title": "클릭을 부르는 후킹 제목 (40자 이내, title_ko와 완전히 다른 문장)",
  "summary_tag": [
    "주제 태그1 (7자 내외)",
    "주제 태그2 (7자 내외)",
    "주제 태그3 (7자 내외)"
  ],
  "detailed_summary": "핵심 설명 3~4문장 (구체적 사례·수치·근거 포함, 250자 이내)"
}
\`\`\`

### **본문글**

{content}`;

type SummaryRequest = {
  title: string;
  content: string;
  articleId?: string;
}

type SummaryResponse = {
  success: boolean;
  title_ko?: string;
  hook_title?: string;
  summary_tags?: string[];
  detailed_summary?: string;
  error?: string;
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
          temperature: 0.5,
          maxOutputTokens: 700,
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
  if (!text) {
    console.warn('[summarize-article] Gemini returned empty text');
    throw new Error('Empty response from Gemini');
  }

  return text;
}

async function generateSummary(title: string, content: string): Promise<SummaryResponse> {
  try {
    const truncatedContent = content.length > 3000
      ? content.substring(0, 3000) + '...'
      : content;

    const fullContent = `제목: ${title}\n\n${truncatedContent}`;
    const prompt = UNIFIED_SUMMARY_PROMPT.replace('{content}', fullContent);

    const text = await callGemini(prompt);

    try {
      const parsed = JSON.parse(text);
      return {
        success: true,
        title_ko: parsed.title_ko || null,
        hook_title: parsed.hook_title || null,
        summary_tags: parsed.summary_tag || [],
        detailed_summary: parsed.detailed_summary || '',
      };
    } catch {
      console.error('Failed to parse JSON:', text);
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

Deno.serve(async (req: Request) => {
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
