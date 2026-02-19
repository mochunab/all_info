// URL 패턴 기반 크롤러 타입 추론
// 경량 모듈: Puppeteer 등 무거운 의존성 없음

import type { CrawlerType } from './types';

/**
 * URL 패턴으로 적절한 크롤러 타입 추론
 * (crawl_sources.crawler_type이 없을 때 폴백용)
 * @deprecated 가능하면 inferCrawlerTypeEnhanced() 사용 권장 (confidence 정보 포함)
 */
export function inferCrawlerType(url: string): CrawlerType {
  const urlLower = url.toLowerCase();

  // RSS 피드
  if (
    urlLower.includes('/rss') ||
    urlLower.includes('/feed') ||
    urlLower.includes('.xml') ||
    urlLower.includes('atom')
  ) {
    return 'RSS';
  }

  // 네이버
  if (urlLower.includes('blog.naver.com') || urlLower.includes('naver.com')) {
    return 'PLATFORM_NAVER';
  }

  // 카카오 (브런치)
  if (urlLower.includes('brunch.co.kr')) {
    return 'PLATFORM_KAKAO';
  }

  // 뉴스레터 플랫폼
  if (
    urlLower.includes('stibee.com') ||
    urlLower.includes('substack.com') ||
    urlLower.includes('mailchimp.com') ||
    urlLower.includes('campaign-archive')
  ) {
    return 'NEWSLETTER';
  }

  // API 엔드포인트
  if (
    urlLower.includes('/api/') ||
    urlLower.includes('.json') ||
    urlLower.includes('graphql')
  ) {
    return 'API';
  }

  // 기본값: SPA (안전한 선택 - JS 렌더링으로 대부분 페이지 크롤링 가능)
  return 'SPA';
}

/**
 * URL 패턴 추론 결과 (confidence 포함)
 */
export type InferenceResult = {
  type: CrawlerType;
  confidence: number; // 0~1 (0: 추측, 1: 확신)
};

/**
 * 콘텐츠 셀렉터 감지 결과
 */
export type SelectorDetectionResult = {
  selectors: {
    container?: string; // 메인 콘텐츠 컨테이너
    item: string; // 아티클 아이템
    title: string; // 제목
    link: string; // 링크
    date?: string; // 날짜 (선택)
    thumbnail?: string; // 썸네일 (선택)
  };
  excludeSelectors?: string[]; // 제외할 영역 (nav, header 등)
  confidence: number; // 0~1
  method: 'ai' | 'semantic' | 'fallback'; // 감지 방법
  reasoning?: string; // AI 판단 근거
};

/**
 * URL 패턴으로 크롤러 타입 추론 (강화 버전)
 * - CMS 감지 (WordPress, Tistory, Medium, Ghost)
 * - SPA 도메인 감지 (.go.kr 정부 포털 등)
 * - confidence 점수 반환
 */
export function inferCrawlerTypeEnhanced(url: string): InferenceResult {
  const urlLower = url.toLowerCase();
  console.log(`\n[inferCrawlerTypeEnhanced] 🔍 URL 패턴 분석: ${url}`);

  // 1. RSS 피드 (confidence: 0.95)
  if (
    urlLower.includes('/rss') ||
    urlLower.includes('/feed') ||
    urlLower.includes('.xml') ||
    urlLower.includes('atom.xml')
  ) {
    return { type: 'RSS', confidence: 0.95 };
  }

  // 2. 플랫폼 특화 (confidence: 0.9)
  // 네이버
  if (urlLower.includes('blog.naver.com')) {
    return { type: 'PLATFORM_NAVER', confidence: 0.95 };
  }
  if (urlLower.includes('naver.com')) {
    return { type: 'PLATFORM_NAVER', confidence: 0.85 };
  }

  // 카카오 브런치
  if (urlLower.includes('brunch.co.kr')) {
    return { type: 'PLATFORM_KAKAO', confidence: 0.95 };
  }

  // 뉴스레터 플랫폼
  if (
    urlLower.includes('stibee.com') ||
    urlLower.includes('substack.com') ||
    urlLower.includes('mailchimp.com') ||
    urlLower.includes('campaign-archive')
  ) {
    return { type: 'NEWSLETTER', confidence: 0.9 };
  }

  // 3. API 엔드포인트 (confidence: 0.85+)
  // 일반 API 패턴만 감지 (도메인 하드코딩 금지 - AI 자동 감지 사용)
  if (
    urlLower.includes('/api/') ||
    urlLower.includes('.json') ||
    urlLower.includes('graphql')
  ) {
    return { type: 'API', confidence: 0.85 };
  }

  // 4. CMS 감지 (confidence: 0.75)
  // WordPress
  if (
    urlLower.includes('wp-content') ||
    urlLower.includes('wp-includes') ||
    urlLower.includes('wordpress')
  ) {
    return { type: 'STATIC', confidence: 0.75 }; // RSS 자동 발견 가능성 높음
  }

  // Tistory
  if (urlLower.includes('tistory.com')) {
    return { type: 'STATIC', confidence: 0.75 }; // RSS 피드 존재 가능성 높음
  }

  // Medium
  if (urlLower.includes('medium.com')) {
    return { type: 'STATIC', confidence: 0.75 };
  }

  // Ghost
  if (urlLower.includes('/ghost/')) {
    return { type: 'STATIC', confidence: 0.75 };
  }

  // 5. 알려진 SPA 도메인 (confidence: 0.95 - 매우 높음)
  // 정부/공공기관 포털 - 복잡한 구조로 rule-based 분석보다 우선
  if (
    urlLower.includes('.go.kr') ||
    urlLower.includes('.or.kr') ||
    urlLower.includes('nipa.kr') ||
    urlLower.includes('k-startup.go.kr')
  ) {
    console.log(`[inferCrawlerTypeEnhanced] ✅ 정부/공공기관 도메인 감지 → SPA (confidence: 0.95)`);
    return { type: 'SPA', confidence: 0.95 };
  }

  // React/Vue/Angular 프레임워크 힌트
  if (
    urlLower.includes('react-app') ||
    urlLower.includes('vue-app') ||
    urlLower.includes('angular')
  ) {
    return { type: 'SPA', confidence: 0.7 };
  }

  // 6. 기본값: SPA (안전한 선택 - 모든 페이지 크롤링 가능)
  // confidence 0.5: "확신은 없지만 작동은 함"
  console.log(`[inferCrawlerTypeEnhanced] ⚠️  기본값 사용 → SPA (confidence: 0.5)`);
  return { type: 'SPA', confidence: 0.5 };
}

/**
 * AI 기반 콘텐츠 셀렉터 자동 감지
 * - 페이지 HTML을 분석하여 아티클 리스트의 적절한 CSS 셀렉터 추천
 * - OpenAI GPT-4o-mini 사용
 * - 비용 최적화: 소스 저장 시 1회만 호출
 */
export async function detectContentSelectors(
  url: string,
  html?: string
): Promise<SelectorDetectionResult> {
  console.log(`\n[detectContentSelectors] 🔍 콘텐츠 영역 감지 시작: ${url}`);

  try {
    // 1. HTML이 제공되지 않았다면 fetch
    let pageHtml = html;
    if (!pageHtml) {
      console.log('[detectContentSelectors] 📄 HTML 가져오는 중...');
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      pageHtml = await response.text();
    }

    // 2. 먼저 시맨틱 HTML 체크 (빠른 경로)
    const semanticResult = trySemanticDetection(pageHtml);
    if (semanticResult.confidence >= 0.7) {
      console.log(
        `[detectContentSelectors] ✅ 시맨틱 HTML 감지 성공 (confidence: ${semanticResult.confidence})`
      );
      return semanticResult;
    }

    // 3. 시맨틱 실패 시 AI 감지
    console.log('[detectContentSelectors] 🤖 AI 기반 감지 시작...');
    return await detectSelectorsWithAI(url, pageHtml);
  } catch (error) {
    console.error('[detectContentSelectors] ❌ 감지 실패:', error);
    // Fallback: 범용 셀렉터 반환
    return getFallbackSelectors();
  }
}

/**
 * 시맨틱 HTML 기반 셀렉터 감지 (빠른 경로)
 */
function trySemanticDetection(html: string): SelectorDetectionResult {
  const priorities = [
    { selector: 'main', score: 0.9 },
    { selector: '[role="main"]', score: 0.9 },
    { selector: 'article', score: 0.8 },
    { selector: '.content', score: 0.6 },
    { selector: '#content', score: 0.6 },
  ];

  // 간단한 HTML 파싱 (정규식)
  for (const { selector, score } of priorities) {
    const pattern =
      selector.startsWith('[') || selector.startsWith('#') || selector.startsWith('.')
        ? new RegExp(selector.replace(/[.#[\]="]/g, '\\$&'), 'i')
        : new RegExp(`<${selector}[>\\s]`, 'i');

    if (pattern.test(html)) {
      console.log(`[trySemanticDetection] ✅ 시맨틱 태그 발견: ${selector}`);
      return {
        selectors: {
          container: selector,
          item: 'article, .article, .post, .card',
          title: 'h1, h2, h3, .title',
          link: 'a',
        },
        excludeSelectors: ['nav', 'header', 'footer', 'aside'],
        confidence: score,
        method: 'semantic',
      };
    }
  }

  return getFallbackSelectors();
}

/**
 * AI 기반 셀렉터 감지 (OpenAI GPT-4o-mini)
 */
async function detectSelectorsWithAI(
  url: string,
  html: string
): Promise<SelectorDetectionResult> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.warn('[detectSelectorsWithAI] ⚠️  OPENAI_API_KEY 없음, fallback 사용');
    return getFallbackSelectors();
  }

  // HTML 크기 제한 (토큰 비용 절감) - 처음 50KB만
  const truncatedHtml = html.substring(0, 50000);

  const prompt = `You are a web scraping expert. Analyze this HTML and provide the BEST CSS selectors to extract article/content list items.

URL: ${url}

HTML (truncated):
\`\`\`html
${truncatedHtml}
\`\`\`

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "container": "CSS selector for main content container (optional, use if exists)",
  "item": "CSS selector for each article/post item",
  "title": "CSS selector for title within each item",
  "link": "CSS selector for link within each item",
  "excludeSelectors": ["nav", "header", "footer"],
  "confidence": 0.85,
  "reasoning": "Brief explanation of your choice"
}

Rules:
- Avoid generic selectors like "li" or "div" - be specific!
- Look for semantic classes like .article, .post, .card, .insight-item
- Exclude navigation, headers, footers
- Navigation menus (공지사항, 서비스 문의, 로그인, 회원가입 etc.) are NOT articles
- If the HTML is a SPA shell (minimal visible text content, heavy JS bundle scripts, only nav/menu links visible, no actual article titles or dates), set confidence to 0.2 and note "SPA shell - requires JS rendering" in reasoning
- Return ONLY valid JSON, no other text`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // JSON 파싱 (마크다운 코드블록 제거)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 응답에 JSON 없음');
    }

    const aiResult = JSON.parse(jsonMatch[0]);

    console.log('[detectSelectorsWithAI] ✅ AI 감지 성공:', aiResult);

    return {
      selectors: {
        container: aiResult.container,
        item: aiResult.item,
        title: aiResult.title,
        link: aiResult.link,
      },
      excludeSelectors: aiResult.excludeSelectors || ['nav', 'header', 'footer'],
      confidence: aiResult.confidence || 0.7,
      method: 'ai',
      reasoning: aiResult.reasoning,
    };
  } catch (error) {
    console.error('[detectSelectorsWithAI] ❌ AI 감지 실패:', error);
    return getFallbackSelectors();
  }
}

/**
 * Fallback 셀렉터 (모든 감지 실패 시)
 */
function getFallbackSelectors(): SelectorDetectionResult {
  return {
    selectors: {
      container: 'main, [role="main"], body',
      item: 'article, .article, .post, .card, .item',
      title: 'h1, h2, h3, .title, .headline',
      link: 'a',
    },
    excludeSelectors: ['nav', 'header', 'footer', 'aside', '.sidebar'],
    confidence: 0.3,
    method: 'fallback',
  };
}
