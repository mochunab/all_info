// @ts-nocheck
// Supabase Edge Function: AI 요약 생성 (Gemini 2.5 Flash Lite)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UNIFIED_SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 핵심을 정리하는 '요약 장인'

### **목표**

사용자가 기사를 읽지 않아도 내용을 구체적으로 파악할 수 있도록 핵심을 충분히 요약한다.

### **지시사항**

1. 아래 '본문글'을 읽고 3가지를 작성할 것:
   - **title_ko**: 원본 제목의 자연스러운 한국어 번역 (이미 한국어면 그대로 사용)
   - **summary_tag**: 핵심 키워드 태그 3개
   - **detailed_summary**: 헤드라인 + 핵심 설명 3~4문장

2. detailed_summary 작성 규칙:
   - 첫 줄: 핵심 헤드라인 (한 문장, 40자 이내)
     - **반드시** 원본 제목을 그대로 반복하지 말 것 — 새로운 관점이나 핵심 주장을 담을 것
   - 빈 줄 하나
   - 핵심 설명: 3~4문장 (총 250자 이내)
     - 구체적인 사례, 수치, 근거를 포함할 것
     - 독자가 실제로 어떤 내용인지 알 수 있는 팩트 중심으로 작성
     - 추상적인 표현("일깨운다", "보여준다") 대신 구체적으로 무슨 일이 있었는지 서술

### **제약 조건**

- **형식:** 이모티콘 및 마크다운 금지 (순수 텍스트)
- **톤:** 친근하고 쉬운 구어체
- **길이:** 헤드라인 포함 전체 250자 이내

### **출력 양식 (JSON)**

\`\`\`json
{
  "title_ko": "원본 제목의 한국어 번역 (이미 한국어면 그대로)",
  "summary_tag": [
    "주제 태그1 (7자 내외)",
    "주제 태그2 (7자 내외)",
    "주제 태그3 (7자 내외)"
  ],
  "detailed_summary": "헤드라인 (40자 이내, 제목과 다른 관점)\\n\\n핵심 설명 3~4문장 (구체적 사례·수치·근거 포함, 250자 이내)"
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
