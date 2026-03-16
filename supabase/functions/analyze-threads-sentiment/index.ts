// @ts-nocheck
// Supabase Edge Function: Threads 센티먼트 분석 (Gemini 2.5 Flash Lite)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENTIMENT_PROMPT = `### 역할
Threads(Meta) 크립토 게시물의 센티먼트를 분석하는 전문가

### 지시사항
아래 Threads 게시물을 읽고 다음을 분석할 것:

1. **sentiment_score**: -1.0(매우 약세) ~ 1.0(매우 강세) 사이의 수치
2. **sentiment_label**: "bullish" | "bearish" | "neutral"
3. **confidence**: 분석 확신도 0.0 ~ 1.0
4. **mentioned_coins**: 언급된 코인 심볼 배열 (예: ["DOGE", "PEPE"])
5. **key_phrases**: 센티먼트를 결정한 핵심 구문 (최대 5개)
6. **fomo_score**: FOMO(놓칠까봐 두려움) 수준 0.0 ~ 1.0
7. **fud_score**: FUD(두려움/불확실성/의심) 수준 0.0 ~ 1.0
8. **reasoning**: 판단 근거 1문장 (한국어)

### Threads 특성 고려
- 최대 500자의 짧은 게시물 — 함축적 표현 주의
- 해시태그(#memecoin, #crypto)와 @멘션이 포함될 수 있음
- 이모지 사용 빈번 — 🚀📈 = 강세, 📉💀 = 약세로 해석
- 리포스트/인용이 많아 원문 맥락 파악 필요
- "NFA"(Not Financial Advice), "DYOR"(Do Your Own Research) = 면책 표현, 중립 처리

### 분석 기준
- 가격 상승 기대, 매수 추천, 긍정적 뉴스 → bullish
- 가격 하락 경고, 매도 추천, 스캠 경고 → bearish
- 질문, 정보 공유, 중립적 토론 → neutral
- FOMO 표현: "to the moon", "don't miss", "last chance", "about to explode", 🚀🔥💎🙌
- FUD 표현: "rug pull", "scam", "dead cat bounce", "dump incoming", 📉💀🗑️

### 출력 (JSON만 반환)
\`\`\`json
{
  "sentiment_score": 0.0,
  "sentiment_label": "neutral",
  "confidence": 0.0,
  "mentioned_coins": [],
  "key_phrases": [],
  "fomo_score": 0.0,
  "fud_score": 0.0,
  "reasoning": ""
}
\`\`\`

### 게시물
{content}`;

async function callGemini(prompt) {
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
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

async function analyzeSentiment(title, body) {
  const truncated = body && body.length > 500 ? body.substring(0, 500) + '...' : body || '';
  const content = `${title}\n\n${truncated}`;
  const prompt = SENTIMENT_PROMPT.replace('{content}', content);

  const text = await callGemini(prompt);
  const parsed = JSON.parse(text);

  return {
    success: true,
    sentiment_score: Number(parsed.sentiment_score) || 0,
    sentiment_label: parsed.sentiment_label || 'neutral',
    confidence: Number(parsed.confidence) || 0,
    mentioned_coins: parsed.mentioned_coins || [],
    key_phrases: parsed.key_phrases || [],
    fomo_score: Number(parsed.fomo_score) || 0,
    fud_score: Number(parsed.fud_score) || 0,
    reasoning: parsed.reasoning || '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { title, body } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await analyzeSentiment(title, body);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
