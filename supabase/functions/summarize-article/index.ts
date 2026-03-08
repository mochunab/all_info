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
      ### 행동경제학 기반 전략
      1. **단일 메시지 집중 (One Key Message)**: 장점 나열 대신 지금 행동해야 할 이유 하나만 전달
      2. **손실 회피 (Loss Aversion)**: 잃는 두려움 자극 — "놓치면 후회", "이대로 가면 망함"
      3. **구체적 숫자 (Specific Numbers)**: 신뢰도와 예측 가능성 향상 — "3가지 신호", "90% 확률"
      4. **타겟 지목 (Cocktail Party Effect)**: 내 이야기처럼 느끼게 함 — "30대 직장인이라면"
      5. **간편성/행동 경량화 (Low Friction)**: 낮은 진입장벽 + 가벼운 동사 선택 — "가입"→"시작", "신청"→"확인", 일상 표현 전환
      6. **비교 및 소외 불안 (FOMO & Social Comparison)**: '나만 뒤처지는 것 아닌가' 하는 조바심 유발 — "요즘 잘나가는 또래들은 다 아는"
      7. **인정욕구 및 우월감 (Ego Appeal & Prestige)**: 특별해지고 싶고, 인정받고 싶은 심리 타겟팅 — "당신만 몰랐던 진짜 잠재력"
      8. **확실성 효과 (Certainty Effect)**: 크지만 불확실한 보상보다 작아도 확실한 보상이 강력 — "무조건", "100% 확정"

      ### 카피 유형별 전략
        - 문제점/결핍 후벼파기형: 고객이 외면하고 싶었던 진짜 문제를 직면하게 만듦
        - 비교/경쟁 자극형: 타인과의 차이를 부각해 은근한 열등감이나 경쟁심을 자극
        - 경고/파국 암시형: 이대로 방치했을 때 벌어질 최악의 상황을 가정해 불안감 증폭
        - 이익 약속형: 불안을 잠재울 확실하고 구체적인 보상 제시
        - 호기심 유발형: 결론을 숨긴 채 궁금증을 최고조로 끌어올림
        - 해결책/구원 제시형: 불안에 빠진 유저에게 동아줄 같은 확실한 솔루션 제공
        - 질문/테스트 유도형: '나는 어떨까?' 하는 자기 객관화 욕구를 자극
        - 행동 촉구형: 더 늦기 전에 당장 확인하라는 강한 지시
        - 시의성/신선함 강조형: 새롭다는 사실 자체가 클릭 동기 — "방금 나온", "2026 최신", "아직 아무도 모르는"

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
