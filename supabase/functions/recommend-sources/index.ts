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
  existingUrls?: string[];
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

function buildPrompt(category: string, scope: 'domestic' | 'international' | 'both', existingUrls: string[] = []): string {
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

### 추천 기준 (반드시 모두 충족해야 추천)
1. **콘텐츠 관련성 (최우선)**: 사이트명이나 도메인이 아닌, **실제 게시된 글의 내용**이 "${category}" 분야와 직접 관련이 있어야 함. 웹 검색으로 해당 사이트의 최근 글 제목들을 반드시 확인하고, 카테고리와 무관한 콘텐츠(잡블로그, 리뷰 블로그 등)는 제외할 것
2. **최근 활성**: 최근 2개월 내 새 글이 반드시 있어야 함. 웹 검색으로 최신 글의 발행일을 확인할 것. 마지막 글이 2개월 이상 된 사이트는 추천 금지
3. **정기 발행**: 최소 월 2회 이상 새 콘텐츠가 게시되는 사이트
4. **공개 접근**: 로그인 없이 콘텐츠 목록을 볼 수 있는 페이지
5. **콘텐츠 목록 페이지 (필수)**: 여러 글이 나열된 목록/아카이브/블로그 인덱스 페이지의 URL만 허용. **개별 기사 본문 URL은 절대 금지** (예: /news/some-article-title/ 같은 단일 기사 URL 금지). URL 경로가 /news/, /blog/, /insights/, /articles/ 등 목록성 경로인지 반드시 확인할 것
6. **전문성**: 해당 분야 전문 미디어, 기업 블로그, 리서치 기관 우선. 개인 블로그나 범용 커뮤니티보다 분야 특화 소스를 우선할 것

### 검증 절차
각 추천 후보에 대해 반드시 아래를 웹 검색으로 확인:
- **URL이 콘텐츠 목록 페이지인가?** 개별 기사 본문 URL이면 해당 사이트의 목록 페이지 URL로 변환하거나, 목록 페이지를 찾을 수 없으면 제외
- 최근 글 3~5개의 제목이 "${category}" 분야와 관련 있는가?
- 가장 최근 글의 발행일이 2개월 이내인가?
- 확인되지 않으면 추천 목록에서 제외

### 출력 형식
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "recommendations": [
    {
      "url": "콘텐츠 목록 페이지 URL",
      "name": "소스 이름",
      "description": "이 소스를 추천하는 이유 + 최근 글 예시 1개 (1~2문장)"
    }
  ]
}
\`\`\`

### 주의사항
- 최대 5개까지만 추천 (확실한 것만, 애매하면 줄여도 됨)
- URL은 반드시 여러 글이 나열된 목록 페이지여야 함 (개별 기사 본문 URL 절대 금지)
- 올바른 예: example.com/blog/, example.com/news/, example.com/insights/
- 잘못된 예: example.com/news/some-article-title-2026/ (이건 개별 기사)
- RSS 피드 URL이 아닌 웹페이지 URL을 제공
- 각 URL은 중복 없이 고유해야 함
- **절대로** 아래 '이미 등록된 소스'에 포함된 도메인과 동일한 사이트를 추천하지 마세요${existingUrls.length > 0 ? `

### 이미 등록된 소스 (제외 대상)
${existingUrls.map(u => `- ${u}`).join('\n')}` : ''}`;
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

// Fallback: chat.completions API (gpt-4.1-mini, 웹검색 없이 학습 데이터 기반)
async function fallbackToChatCompletions(prompt: string, apiKey: string): Promise<{ output_text: string } | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
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

// JSON 텍스트에서 코드블록 제거 + JSON 객체 추출
function cleanJsonText(text: string): string {
  // 1) ```json ... ``` 블록 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2) 첫 번째 { ... } 객체 추출 (앞뒤 텍스트 제거)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  return text.trim();
}

type ValidationResult = {
  valid: boolean;
  reason?: string;
};

const CLOSURE_KEYWORDS = [
  '서비스가 종료', '서비스 종료', '폐쇄된', '운영이 중단',
  '접근 권한이 없습니다', '등록된 게시물이 없습니다', '페이지를 찾을 수 없',
  'This page is no longer available', 'has been discontinued', 'no longer maintained',
];

const WAF_KEYWORDS = [
  'Web firewall', 'security policies have been blocked', 'Access Denied',
  'Request blocked', 'bot detected', 'captcha', 'Please verify you are a human',
];

// HTML에서 body 텍스트만 추출 (태그 제거)
function extractBodyText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  return bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// HTML에서 title 추출
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

// HTML에서 날짜 패턴 추출 → 가장 최근 날짜 반환
function extractLatestDate(html: string): Date | null {
  const patterns = [
    /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/gi,
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/gi,
  ];

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  let latest: Date | null = null;
  const now = new Date();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let date: Date | null = null;

      if (/^\d{4}$/.test(match[1]) && /^\d{1,2}$/.test(match[2]) && /^\d{1,2}$/.test(match[3])) {
        // YYYY-MM-DD / YYYY.MM.DD / YYYY년 MM월 DD일
        date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else if (/^[A-Za-z]/.test(match[1])) {
        // Dec 20, 2025
        const month = monthMap[match[1].slice(0, 3).toLowerCase()];
        if (month !== undefined) {
          date = new Date(parseInt(match[3]), month, parseInt(match[2]));
        }
      } else if (/^[A-Za-z]/.test(match[2])) {
        // 20 Dec 2025
        const month = monthMap[match[2].slice(0, 3).toLowerCase()];
        if (month !== undefined) {
          date = new Date(parseInt(match[3]), month, parseInt(match[1]));
        }
      }

      if (date && !isNaN(date.getTime()) && date <= now && date.getFullYear() >= 2000) {
        if (!latest || date > latest) {
          latest = date;
        }
      }
    }
  }

  return latest;
}

// URL 품질 검증 (6단계 룰베이스)
async function validateUrl(url: string): Promise<ValidationResult> {
  const startTime = Date.now();
  console.log(`[validateUrl] 검증 시작: ${url}`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // Rule 1: HTTP 접근성
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightHub/1.0)' },
    });

    clearTimeout(timeout);
    console.log(`[validateUrl] Rule 1 (HTTP): ${url} → ${response.status} (${Date.now() - startTime}ms)`);

    if (!response.ok) {
      return { valid: false, reason: 'HTTP 접근 불가' };
    }

    // HTML 앞부분 50KB만 읽기
    const reader = response.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let totalBytes = 0;
      const MAX_BYTES = 50 * 1024;
      while (totalBytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        totalBytes += value.length;
      }
      reader.cancel().catch(() => {});
    } else {
      const text = await response.text();
      html = text.slice(0, 50 * 1024);
    }

    // Rule 2: 리다이렉트 감지
    const requestedPath = new URL(url).pathname;
    const finalPath = new URL(response.url).pathname;
    if (requestedPath !== finalPath) {
      console.log(`[validateUrl] Rule 2 (리다이렉트): ${url} → pathname "${requestedPath}" → "${finalPath}"`);
      if (finalPath === '/' || finalPath.startsWith('/index')) {
        return { valid: false, reason: '메인 페이지로 리다이렉트' };
      }
    }

    const htmlLower = html.toLowerCase();

    // Rule 3: 폐쇄/에러 키워드 감지
    for (const keyword of CLOSURE_KEYWORDS) {
      if (html.includes(keyword)) {
        console.log(`[validateUrl] Rule 3 (폐쇄 키워드): ${url} → "${keyword}" 발견`);
        return { valid: false, reason: '폐쇄/종료 페이지' };
      }
    }
    if (htmlLower.includes('<script>alert(') && htmlLower.includes('history.back()')) {
      console.log(`[validateUrl] Rule 3 (alert+history.back): ${url}`);
      return { valid: false, reason: '폐쇄/종료 페이지' };
    }

    // Rule 4: 빈 페이지 감지
    const bodyText = extractBodyText(html);
    const title = extractTitle(html);
    console.log(`[validateUrl] Rule 4 (빈 페이지): ${url} → body ${bodyText.length}자, title: "${title}"`);
    if (bodyText.length < 200) {
      return { valid: false, reason: '빈 페이지 또는 에러 페이지' };
    }
    if (/\b(404|not found|error)\b/i.test(title.toLowerCase())) {
      return { valid: false, reason: '빈 페이지 또는 에러 페이지' };
    }

    // Rule 5: 콘텐츠 최신성 (날짜 감지)
    const latestDate = extractLatestDate(html);
    if (latestDate) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      console.log(`[validateUrl] Rule 5 (최신성): ${url} → 최근 날짜: ${latestDate.toISOString().slice(0, 10)}, 기준: ${sixMonthsAgo.toISOString().slice(0, 10)}`);
      if (latestDate < sixMonthsAgo) {
        return { valid: false, reason: '최신 콘텐츠 없음 (6개월 이상 미갱신)' };
      }
    } else {
      console.log(`[validateUrl] Rule 5 (최신성): ${url} → 날짜 미발견 (통과)`);
    }

    // Rule 6: WAF/봇 차단 감지
    for (const keyword of WAF_KEYWORDS) {
      if (html.toLowerCase().includes(keyword.toLowerCase())) {
        console.log(`[validateUrl] Rule 6 (WAF): ${url} → "${keyword}" 발견`);
        return { valid: false, reason: 'WAF/봇 차단' };
      }
    }

    console.log(`[validateUrl] ✅ 통과: ${url} (${Date.now() - startTime}ms)`);
    return { valid: true };
  } catch (e) {
    console.log(`[validateUrl] ❌ 예외: ${url} → ${e instanceof Error ? e.message : 'Unknown'}`);
    return { valid: false, reason: 'HTTP 접근 불가' };
  }
}

// 추천 목록에서 유효하지 않은 URL 제거
async function filterValidUrls(recommendations: Recommendation[]): Promise<Recommendation[]> {
  console.log(`[filterValidUrls] ${recommendations.length}개 URL 검증 시작...`);
  const startTime = Date.now();

  const results = await Promise.allSettled(
    recommendations.map(async (rec) => {
      const result = await validateUrl(rec.url);
      return { rec, result };
    })
  );

  const filtered: Recommendation[] = [];
  for (const entry of results) {
    if (entry.status === 'fulfilled' && entry.value.result.valid) {
      filtered.push(entry.value.rec);
    } else if (entry.status === 'fulfilled') {
      console.log(`[filterValidUrls] ❌ 제외: ${entry.value.rec.name} (${entry.value.rec.url}) → ${entry.value.result.reason}`);
    } else {
      console.log(`[filterValidUrls] ❌ 예외: ${entry.reason}`);
    }
  }

  console.log(`[filterValidUrls] 완료: ${recommendations.length}개 중 ${filtered.length}개 통과 (${Date.now() - startTime}ms)`);
  return filtered;
}

// 추천 소스 함수
async function recommendSources(category: string, scope: 'domestic' | 'international' | 'both', existingUrls: string[] = []): Promise<RecommendResponse> {
  try {
    const prompt = buildPrompt(category, scope, existingUrls);
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
      const candidates = parsed.recommendations
        .filter((r: Recommendation) => r.url && r.name)
        .slice(0, 5)
        .map((r: Recommendation) => ({
          url: r.url,
          name: r.name,
          description: r.description || '',
        }));

      // URL 품질 검증 (6단계 룰베이스)
      const validRecommendations = await filterValidUrls(candidates);
      console.log(`[recommend-sources] ${candidates.length} candidates → ${validRecommendations.length} valid`);

      return {
        success: true,
        recommendations: validRecommendations,
      };
    } catch {
      console.error('Failed to parse JSON. Raw output (first 500 chars):', result.output_text.substring(0, 500));
      // 마지막 시도: fallback으로 직접 chat.completions 호출
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (apiKey) {
        console.log('[recommend-sources] Retrying with chat.completions fallback...');
        const fallbackResult = await fallbackToChatCompletions(prompt, apiKey);
        if (fallbackResult?.output_text) {
          try {
            const fallbackCleaned = cleanJsonText(fallbackResult.output_text);
            const fallbackParsed = JSON.parse(fallbackCleaned);
            if (fallbackParsed.recommendations && Array.isArray(fallbackParsed.recommendations)) {
              const fallbackCandidates = fallbackParsed.recommendations
                .filter((r: Recommendation) => r.url && r.name)
                .slice(0, 5)
                .map((r: Recommendation) => ({ url: r.url, name: r.name, description: r.description || '' }));
              const validRecs = await filterValidUrls(fallbackCandidates);
              return { success: true, recommendations: validRecs };
            }
          } catch {
            console.error('Fallback also failed to parse JSON:', fallbackResult.output_text.substring(0, 300));
          }
        }
      }
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
    const { category, scope, existingUrls } = await req.json() as RecommendRequest;

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

    const result = await recommendSources(category, scope, existingUrls || []);

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
