// @ts-nocheck
// Supabase Edge Function: Chat Insight (Gemini 2.5 Flash Lite)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ARTICLES = 20;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  articles: { title: string; summary: string | null; summary_tags: string[] }[];
  category: string;
  language: string;
  pinnedArticle?: {
    title: string;
    summary: string | null;
    summary_tags: string[];
    content_preview: string | null;
  };
};

function buildSystemPrompt(category: string, articles: ChatRequest['articles'], language: string, pinnedArticle?: ChatRequest['pinnedArticle']): string {
  const limited = articles.slice(0, MAX_ARTICLES);
  const articleList = limited
    .map((a, i) => `${i + 1}. [${a.title}] 태그: ${(a.summary_tags || []).join(', ')} | 요약: ${a.summary || '없음'}`)
    .join('\n');

  const langInstruction = language === 'ko' ? '한국어로 답변하세요.'
    : language === 'en' ? 'Answer in English.'
    : language === 'ja' ? '日本語で回答してください。'
    : language === 'zh' ? '请用中文回答。'
    : '한국어로 답변하세요.';

  let pinnedSection = '';
  if (pinnedArticle) {
    pinnedSection = `\n\n📌 사용자가 참조 중인 기사:
제목: ${pinnedArticle.title}
태그: ${(pinnedArticle.summary_tags || []).join(', ')}
요약: ${pinnedArticle.summary || '없음'}
본문 미리보기: ${pinnedArticle.content_preview || '없음'}

이 기사에 대한 질문이 들어오면, 위 본문 내용을 기반으로 면접에서 활용할 수 있는 답변 예시를 제시하세요.`;
  }

  return `당신은 "${category}" 업계 면접 코치입니다. 취업 준비생이 면접에서 업계 지식을 자신있게 답변할 수 있도록 도와주세요.
아래는 현재 카테고리에 수집된 ${limited.length}개의 최신 기사입니다:

${articleList}${pinnedSection}

이 기사들을 기반으로 면접 준비를 도와주세요.
- 면접에서 바로 활용할 수 있는 답변 예시를 제시하세요
- "최근 ~한 트렌드가 있는데요" 형식으로 자연스러운 답변을 구성하세요
- 구체적인 수치, 기업명, 사례를 인용해 신뢰감을 높이세요
- 마크다운 서식(볼드, 리스트 등)을 적극 활용하세요
- ${langInstruction}`;
}

function buildGeminiContents(systemPrompt: string, messages: ChatMessage[]) {
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '네, 해당 업계의 최신 기사를 분석해서 면접 답변을 코칭해드리겠습니다. 질문해주세요.' }] },
  ];

  for (const msg of messages) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  return contents;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, articles, category, language, pinnedArticle } = await req.json() as ChatRequest;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No messages provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('google_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'google_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(category || '전체', articles || [], language || 'ko', pinnedArticle);
    const contents = buildGeminiContents(systemPrompt, messages);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[chat-insight] Gemini API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Gemini API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return new Response(
        JSON.stringify({ success: false, error: 'Empty response from Gemini' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, reply }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[chat-insight] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
