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

    const prompt = `당신은 인스타그램 카드뉴스 기획 전문가입니다.

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
- JSON만 반환, 마크다운/설명 없이`;

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
