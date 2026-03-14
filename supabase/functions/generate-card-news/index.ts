// @ts-nocheck
// Supabase Edge Function: AI 카드뉴스 슬라이드 기획 (Gemini 2.5 Flash)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { topic, slideCount, ratio } = await req.json();

    if (!topic?.trim()) {
      return new Response(JSON.stringify({ error: '주제를 입력해주세요' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('google_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'google_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const count = slideCount || 10;
    const ratioLabel = ratio?.label || '인스타 피드';
    const width = ratio?.width || 1080;
    const height = ratio?.height || 1080;

    const prompt = `당신은 인스타그램 카드뉴스 기획 전문가이자 행동경제학 기반 카피라이터입니다.

주제: "${topic}"

다음 JSON 형식으로 ${count}장짜리 카드뉴스 슬라이드를 기획해주세요:

{
  "title": "카드뉴스 제목",
  "slides": [
    {
      "slide_number": 1,
      "type": "cover",
      "headline": "후킹 제목 (15자 이내)",
      "subtext": "부제목 (20자 이내)",
      "image_prompt": "배경 이미지 프롬프트 (영문, no text/letters)",
      "color_scheme": "#hex 메인 컬러"
    },
    {
      "slide_number": 2,
      "type": "content",
      "headline": "핵심 메시지 (15자 이내)",
      "body": "본문 텍스트 (50자 이내)",
      "image_prompt": "배경 이미지 프롬프트 (영문, no text/letters)",
      "color_scheme": "#hex"
    }
  ]
}

규칙:
- 1장: cover (강렬한 후킹 제목)
- 2~${count - 1}장: content (핵심 정보, 숫자/통계 활용, 각 장마다 하나의 메시지)
- ${count}장: cta (행동 유도 — 팔로우, 저장, 공유 등)
- image_prompt: 텍스트 없는 배경 이미지용, 영문으로, "no text, no letters" 포함 필수
- 모든 카피는 한국어, image_prompt만 영문
- color_scheme: 슬라이드별 통일감 있는 컬러 (전체적으로 조화)
- 이미지 비율: ${width}x${height} (${ratioLabel})에 맞는 구도
- JSON만 반환, 마크다운/설명 없이

★ 1장(cover) 카피 작성 시 반드시 아래 행동경제학 전략을 적용하세요:

[행동경제학 기반 후킹 전략]
1. 단일 메시지 집중: 장점 나열 대신 지금 행동해야 할 이유 하나만 전달. ❌ "할인+적립+무료배송" → ✅ "지금 가입하면 무조건 1만원"
2. 손실 회피: 잃는 두려움 자극. 예: "놓치면 후회", "이대로 가면 망함"
3. 구체적 숫자: 신뢰도 향상. 예: "3가지 신호", "90% 확률", "5년 안에"
4. 타겟 지목: 내 이야기처럼 느끼게. 예: "30대 직장인이라면", "짝사랑 중인 너"
5. 간편성/행동 경량화: 낮은 진입장벽. 예: "딱 3초면", "지금 당장"
6. FOMO & 비교: 소외 불안 자극. 예: "요즘 잘나가는 또래들은 다 아는"
7. 인정욕구/우월감: 특별해지고 싶은 심리. 예: "상위 1%만 아는"
8. 확실성 효과: 작아도 확실한 보상. 예: "100% 확정", "누구나 받는 무료 진단"

[카피 유형 — 주제에 맞는 유형을 선택]
- 문제점/결핍 후벼파기형: 고객이 외면하던 진짜 문제를 직면시킴
- 비교/경쟁 자극형: 타인과의 차이를 부각해 경쟁심 자극
- 경고/파국 암시형: 방치 시 최악의 상황을 가정해 불안 증폭
- 이익 약속형: 확실하고 구체적인 보상 제시
- 호기심 유발형: 결론을 숨긴 채 궁금증을 최고조로 끌어올림
- 해결책/구원 제시형: 불안에 빠진 유저에게 확실한 솔루션 제공
- 질문/테스트 유도형: '나는 어떨까?' 자기 객관화 욕구 자극
- 행동 촉구형: 더 늦기 전에 당장 확인하라는 강한 지시
- 시의성/신선함 강조형: "방금 나온", "2026 최신", "아직 아무도 모르는"

cover의 headline은 위 전략 중 주제와 가장 잘 맞는 2~3가지를 조합해 작성하세요.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[generate-card-news] Gemini error:', errText);
      return new Response(JSON.stringify({ error: `Gemini API 오류: ${geminiRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(JSON.stringify({ error: 'Gemini 응답이 비어있습니다' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = JSON.parse(text);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[generate-card-news] Error:', err);
    return new Response(JSON.stringify({ error: `생성 실패: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
