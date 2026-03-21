// @ts-nocheck
// Supabase Edge Function: 크립토 센티먼트 분석 (Gemini 2.5 Flash)
// 단일 게시물 또는 배치(최대 10개) 지원

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SINGLE_PROMPT = `### 역할
Reddit/Twitter/Telegram 크립토 게시물의 센티먼트를 분석하는 전문가

### 지시사항
아래 게시물을 읽고 다음을 분석할 것:

1. **sentiment_score**: -1.0(매우 약세) ~ 1.0(매우 강세) 사이의 수치
2. **sentiment_label**: "bullish" | "bearish" | "neutral"
3. **confidence**: 분석 확신도 0.0 ~ 1.0
4. **mentioned_coins**: 언급된 코인 심볼 배열 (예: ["DOGE", "PEPE"])
5. **key_phrases**: 센티먼트를 결정한 핵심 구문 (최대 5개)
6. **fomo_score**: FOMO(놓칠까봐 두려움) 수준 0.0 ~ 1.0
7. **fud_score**: FUD(두려움/불확실성/의심) 수준 0.0 ~ 1.0
8. **reasoning**: 판단 근거 1문장 (한국어)
9. **narratives**: 이 게시물이 속하는 크립토 테마/내러티브 1~3개 (예: "AI tokens", "dog coins", "DeFi summer")
10. **events**: 감지된 시장 이벤트 배열. 각 이벤트는 {name, coins, impact} 구조
    - name: 이벤트명 (예: "Binance listing")
    - coins: 영향받는 코인 심볼 배열
    - impact: "positive" | "negative" | "neutral"

### 분석 기준
- 가격 상승 기대, 매수 추천, 긍정적 뉴스 → bullish
- 가격 하락 경고, 매도 추천, 스캠 경고 → bearish
- 질문, 정보 공유, 중립적 토론 → neutral
- FOMO 표현: "to the moon", "don't miss", "last chance", "about to explode"
- FUD 표현: "rug pull", "scam", "dead cat bounce", "dump incoming"

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
  "reasoning": "",
  "narratives": [],
  "events": []
}
\`\`\`

### 게시물
{content}`;

const BATCH_PROMPT = `### 역할
Reddit/Twitter/Telegram 크립토 게시물의 센티먼트를 분석하는 전문가

### 지시사항
아래 **여러 게시물**을 각각 분석하여, 게시물별 결과를 배열로 반환할 것.

각 게시물의 분석 항목:
- sentiment_score: -1.0 ~ 1.0
- sentiment_label: "bullish" | "bearish" | "neutral"
- confidence: 0.0 ~ 1.0
- mentioned_coins: 코인 심볼 배열
- key_phrases: 핵심 구문 최대 5개
- fomo_score: 0.0 ~ 1.0
- fud_score: 0.0 ~ 1.0
- reasoning: 판단 근거 1문장 (한국어)
- narratives: 크립토 테마 1~3개
- events: 시장 이벤트 배열 [{name, coins, impact}]

### 분석 기준
- 가격 상승 기대, 매수 추천, 긍정적 뉴스 → bullish
- 가격 하락 경고, 매도 추천, 스캠 경고 → bearish
- 질문, 정보 공유, 중립적 토론 → neutral

### 출력 (JSON 배열만 반환, 게시물 순서대로)
\`\`\`json
{
  "results": [
    {
      "id": "post_id_here",
      "sentiment_score": 0.0,
      "sentiment_label": "neutral",
      "confidence": 0.0,
      "mentioned_coins": [],
      "key_phrases": [],
      "fomo_score": 0.0,
      "fud_score": 0.0,
      "reasoning": "",
      "narratives": [],
      "events": []
    }
  ]
}
\`\`\`

### 게시물 목록
{content}`;

async function callGemini(prompt) {
  const apiKey = Deno.env.get('google_API_KEY');
  if (!apiKey) throw new Error('google_API_KEY not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 4096,
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

function truncate(text, maxLen = 1500) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

function parseResult(parsed) {
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
    narratives: Array.isArray(parsed.narratives) ? parsed.narratives : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
}

async function analyzeSingle(title, body) {
  const content = `제목: ${title}\n\n${truncate(body)}`;
  const prompt = SINGLE_PROMPT.replace('{content}', content);
  const text = await callGemini(prompt);
  return parseResult(JSON.parse(text));
}

async function analyzeBatch(posts) {
  const content = posts.map((p, i) =>
    `--- 게시물 ${i + 1} (ID: ${p.id}) ---\n제목: ${p.title}\n${truncate(p.body)}`
  ).join('\n\n');

  const prompt = BATCH_PROMPT.replace('{content}', content);
  const text = await callGemini(prompt);
  const parsed = JSON.parse(text);

  const results = parsed.results || parsed;
  if (!Array.isArray(results)) throw new Error('Batch response is not an array');

  const resultMap = new Map();
  results.forEach((r, i) => {
    const id = r.id || posts[i]?.id;
    if (id) resultMap.set(id, parseResult(r));
  });

  return posts.map(p => resultMap.get(p.id) || {
    success: false, error: 'Missing in batch response',
    sentiment_score: 0, sentiment_label: 'neutral', confidence: 0,
    mentioned_coins: [], key_phrases: [], fomo_score: 0, fud_score: 0,
    reasoning: '', narratives: [], events: [],
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // 배치 모드: { posts: [{id, title, body}, ...] }
    if (body.posts && Array.isArray(body.posts)) {
      if (body.posts.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empty posts array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results = await analyzeBatch(body.posts);
      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 단일 모드 (하위 호환): { title, body }
    const { title } = body;
    if (!title) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing title' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await analyzeSingle(title, body.body);
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
