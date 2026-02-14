// @ts-nocheck
// Supabase Edge Function: AI 크롤러 타입 감지 (GPT-5-nano)
// Deno runtime — excluded from Next.js type checking

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRAWLER_TYPE_DETECTION_PROMPT = `### **역할**

웹 페이지 HTML 구조를 분석하여 최적의 크롤링 전략을 결정하는 전문가

### **목표**

주어진 URL과 HTML 스니펫을 분석하여 7가지 크롤러 타입 중 가장 적합한 것을 선택하고, 그 이유를 명확히 설명한다.

### **크롤러 타입 정의**

1. **STATIC**: 정적 HTML (Cheerio로 파싱 가능)
   - 서버에서 완전한 HTML을 렌더링
   - JavaScript 없이도 모든 콘텐츠 표시
   - 페이지 소스에 실제 텍스트/링크가 모두 존재
   - 예: WordPress, Jekyll, 전통적인 SSR 사이트

2. **SPA**: Single Page Application (Puppeteer 필요)
   - JavaScript로 동적 렌더링
   - 초기 HTML은 거의 비어있고 <div id="root"> 같은 마운트 포인트만 존재
   - React, Vue, Angular 등 프레임워크 사용
   - API 호출로 데이터 로드
   - 예: 대부분의 현대적 웹앱, 관리자 페이지, 정부 포털

3. **RSS**: RSS/Atom 피드
   - XML 형식의 피드 제공
   - <rss>, <feed>, <channel> 태그 존재
   - 블로그/뉴스 사이트의 구독 피드

4. **PLATFORM_NAVER**: 네이버 블로그 전용
   - blog.naver.com 도메인
   - iframe 구조 또는 특수 API

5. **PLATFORM_KAKAO**: 카카오 브런치 전용
   - brunch.co.kr 도메인
   - 특수 HTML 구조

6. **NEWSLETTER**: 뉴스레터 플랫폼
   - stibee.com, substack.com, mailchimp.com
   - 이메일 아카이브 형태

7. **API**: REST API 엔드포인트
   - JSON/XML 응답
   - /api/ 경로 또는 .json 확장자

### **분석 기준**

#### SPA 감지 지표 (우선순위 높음):
- \`<div id="root">\`, \`<div id="app">\`, \`<div id="__next">\` 같은 React/Vue/Next.js 마운트 포인트
- \`<script src="...react..."></script>\`, \`<script src="...vue..."></script>\` 등 프레임워크 로드
- HTML body가 거의 비어있고 스크립트만 많음
- \`<noscript>You need to enable JavaScript\` 경고 존재
- 정부/공공기관 도메인 (.go.kr, .or.kr, nipa.kr 등)

#### STATIC 감지 지표:
- 완전한 HTML 구조 (article, section, header, footer 태그)
- 실제 콘텐츠 텍스트가 HTML 소스에 직접 포함
- WordPress, Tistory 등 CMS 흔적 (\`wp-content\`, \`.tistory.com\`)
- 최소한의 JavaScript 사용

#### RSS 감지 지표:
- \`<?xml\` 선언 또는 \`<rss\`, \`<feed\` 태그
- \`<link rel="alternate" type="application/rss+xml"\` 존재

#### 플랫폼 특화:
- URL 도메인이 명확히 특정 플랫폼을 가리킴

### **중요 원칙**

1. **정부/공공기관은 무조건 SPA**:
   - .go.kr, .or.kr, nipa.kr 등은 복잡한 구조로 Puppeteer 필요

2. **의심스러우면 SPA**:
   - STATIC과 SPA 사이 애매하면 SPA 선택 (안전한 선택)
   - SPA로 STATIC 크롤링 가능하지만, 반대는 실패

3. **Confidence 기준**:
   - 0.9~1.0: 명확한 지표 (도메인 매칭, RSS 태그, 프레임워크 확실)
   - 0.7~0.9: 강한 지표 (여러 SPA/STATIC 특징)
   - 0.5~0.7: 추측 (일부 지표만 존재)
   - 0.3~0.5: 불확실 (기본값 선택)

### **입력 정보**

- **URL**: {url}
- **HTML 스니펫** (처음 5000자):
\`\`\`html
{html}
\`\`\`

### **출력 형식 (JSON)**

\`\`\`json
{
  "crawlerType": "STATIC | SPA | RSS | PLATFORM_NAVER | PLATFORM_KAKAO | NEWSLETTER | API",
  "confidence": 0.0~1.0,
  "reasoning": "선택 이유를 2-3문장으로 설명. 어떤 지표를 보고 이 타입을 선택했는지 구체적으로."
}
\`\`\`

### **예시**

**입력 1**: \`https://www.nipa.kr/...\`, HTML에 \`<div id="root"></div>\` + React 스크립트
**출력 1**:
\`\`\`json
{
  "crawlerType": "SPA",
  "confidence": 0.95,
  "reasoning": "정부기관 도메인(.kr)이며 HTML에 React 마운트 포인트(#root)와 번들 스크립트만 존재. JavaScript 렌더링 필수."
}
\`\`\`

**입력 2**: \`https://blog.example.com/posts\`, HTML에 완전한 article 태그 + 콘텐츠 텍스트
**출력 2**:
\`\`\`json
{
  "crawlerType": "STATIC",
  "confidence": 0.85,
  "reasoning": "HTML 소스에 article 태그와 실제 본문 텍스트가 모두 포함됨. WordPress 흔적(wp-content) 발견. 정적 크롤링 가능."
}
\`\`\`

이제 위 기준으로 분석하시오.`;

interface DetectionRequest {
  url: string;
  html: string;
  currentAnalysis?: {
    urlPattern?: string;
    spaScore?: number;
    ruleBasedType?: string;
    ruleBasedConfidence?: number;
  };
}

interface DetectionResponse {
  success: boolean;
  crawlerType?: string;
  confidence?: number;
  reasoning?: string;
  error?: string;
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
      reasoning: { effort: 'medium' }, // 크롤러 타입 감지는 medium effort
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
  const text = extractTextFromResponse(data);

  // 텍스트 추출 실패 시 chat.completions fallback
  if (!text) {
    console.warn('[detect-crawler-type] GPT-5-nano returned empty text, response keys:', Object.keys(data));
    console.log('Falling back to chat.completions API due to empty response...');
    return await fallbackToChatCompletions(prompt, apiKey);
  }

  return { output_text: text };
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
          content: '당신은 웹 페이지 HTML 구조를 분석하여 최적의 크롤링 전략을 결정하는 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 낮은 temperature로 일관성 확보
      max_tokens: 300,
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

// 크롤러 타입 감지 함수
async function detectCrawlerType(url: string, html: string): Promise<DetectionResponse> {
  try {
    // HTML 길이 제한 (처음 5000자만)
    const truncatedHtml = html.length > 5000
      ? html.substring(0, 5000) + '\n... (truncated)'
      : html;

    const prompt = CRAWLER_TYPE_DETECTION_PROMPT
      .replace('{url}', url)
      .replace('{html}', truncatedHtml);

    const result = await callGPT5Nano(prompt);

    if (!result || !result.output_text) {
      return { success: false, error: 'Empty response from OpenAI' };
    }

    // JSON 파싱
    try {
      const parsed = JSON.parse(result.output_text);

      // 유효성 검증
      const validTypes = ['STATIC', 'SPA', 'RSS', 'PLATFORM_NAVER', 'PLATFORM_KAKAO', 'NEWSLETTER', 'API'];
      if (!validTypes.includes(parsed.crawlerType)) {
        return { success: false, error: `Invalid crawler type: ${parsed.crawlerType}` };
      }

      return {
        success: true,
        crawlerType: parsed.crawlerType,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
      };
    } catch {
      console.error('Failed to parse JSON:', result.output_text);
      return { success: false, error: 'JSON 파싱 실패' };
    }
  } catch (error) {
    console.error('Crawler type detection error:', error);
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
    const { url, html } = await req.json() as DetectionRequest;

    if (!url || !html) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing url or html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[detect-crawler-type] Analyzing: ${url}`);

    const result = await detectCrawlerType(url, html);

    console.log(`[detect-crawler-type] Result: ${result.success ? `${result.crawlerType} (${result.confidence})` : result.error}`);

    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[detect-crawler-type] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
