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

  // Sitemap (RSS 체크보다 앞에: sitemap.xml은 RSS가 아님)
  if (
    urlLower.includes('sitemap') &&
    (urlLower.includes('.xml') || urlLower.endsWith('sitemap'))
  ) {
    return 'SITEMAP';
  }

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

  // 1. Sitemap (RSS 체크보다 앞에: sitemap.xml은 RSS가 아님)
  if (
    urlLower.includes('sitemap') &&
    (urlLower.includes('.xml') || urlLower.endsWith('sitemap'))
  ) {
    return { type: 'SITEMAP', confidence: 0.95 };
  }

  // 1b. RSS 피드 (confidence: 0.95)
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
 *
 * 주의: <main> 태그 하나만 있는 경우 AI 감지를 건너뛰지 않음.
 * Tailwind CSS 기반 현대 사이트는 <main> 안에 유틸리티 클래스 기반 카드를 사용하므로
 * 'article, .article, .post, .card' 같은 범용 셀렉터가 0개를 반환할 수 있음.
 * 실제 <article> 태그 3개 이상이 존재할 때만 신뢰 (WordPress, 전통적 CMS 패턴).
 */
function trySemanticDetection(html: string): SelectorDetectionResult {
  // <article> 태그 개수 카운트 (실제 시맨틱 마크업 사용 여부 확인)
  const articleTagCount = (html.match(/<article[\s>]/gi) || []).length;

  if (articleTagCount >= 3) {
    console.log(`[trySemanticDetection] ✅ <article> 태그 ${articleTagCount}개 발견 → 시맨틱 감지`);
    return {
      selectors: {
        container: 'main, [role="main"], body',
        item: 'article',
        title: 'h1, h2, h3, .title, .headline',
        link: 'a',
      },
      excludeSelectors: ['nav', 'header', 'footer', 'aside'],
      confidence: 0.8,
      method: 'semantic',
    };
  }

  // <article> 없으면 AI에게 넘김 (Tailwind/유틸리티 클래스 사이트 등)
  console.log(`[trySemanticDetection] ⏭️  <article> 태그 부족 (${articleTagCount}개) → AI 감지로 진행`);
  return getFallbackSelectors();
}

/**
 * AI가 생성한 CSS 셀렉터에서 Tailwind `:` 이스케이프 처리
 *
 * 문제: Tailwind 다크모드/반응형 클래스(dark:text-slate-200, lg:text-xl 등)의
 *       `:` 가 CSS 의사 클래스(pseudo-class)로 오인되어 Cheerio 파서가 에러를 던짐.
 * 해결: 클래스 내부의 Tailwind 변형 접두사 뒤 `:` 를 `\:` 로 이스케이프.
 *
 * 예: .dark:text-slate-200 → .dark\:text-slate-200
 *     .lg:gap-4            → .lg\:gap-4
 * 보존: a:hover, :nth-child(n) 등 표준 CSS 의사 클래스는 변환하지 않음
 */
function escapeTailwindColons(selector: string | undefined | null): string | undefined {
  if (!selector) return selector ?? undefined;
  // `.word:word-` 패턴: 점(.) 뒤 단어 + 콜론 + 하이픈 포함 단어 → Tailwind 유틸리티
  // 단, 표준 pseudo-class(:hover, :focus 등)는 하이픈이 없으므로 제외됨
  return selector.replace(
    /(\.[a-zA-Z0-9]+):([a-zA-Z][a-zA-Z0-9]*-)/g,
    '$1\\:$2'
  );
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

  // HTML 전처리: <head>와 대형 인라인 스크립트/스타일 제거 후 50KB 추출
  // 이유: <head> CSS/JS 번들이 30-40KB를 차지하면 실제 body 콘텐츠가 50KB 한도 밖으로 밀려남
  const cleanedHtml = html
    .replace(/<head[\s\S]*?<\/head>/i, '')                      // <head> 전체 제거
    .replace(/<script[^>]*>[\s\S]{200,}?<\/script>/gi, '')     // 인라인 스크립트(200자+) 제거
    .replace(/<style[^>]*>[\s\S]{200,}?<\/style>/gi, '')       // 인라인 스타일(200자+) 제거
    .replace(/\n{3,}/g, '\n\n')                                 // 빈 줄 정리
    .trim();
  const truncatedHtml = cleanedHtml.substring(0, 50000);

  const prompt = `You are a web scraping expert. Your task: find CSS selectors for the MAIN ARTICLE LIST on this page — the repeating cards/rows where each one is a unique article, blog post, or newsletter issue.

URL: ${url}

HTML (first 50KB):
\`\`\`html
${truncatedHtml}
\`\`\`

## HOW TO IDENTIFY REAL ARTICLE CARDS

Real article cards have ALL of these:
1. A link pointing to a UNIQUE DETAIL PAGE — URL contains a slug or ID (e.g. /posts/abc123, /articles/my-title, /p/12345, /2024/01/title)
2. A TITLE — a sentence of text longer than 10 characters (NOT a number, NOT a one-word menu label)
3. They REPEAT in a grid or list (typically 5–20 cards per page)

## WHAT TO REJECT (these look like lists but are NOT articles)

- ❌ Category / tag FILTER TABS: links to /c/category, ?tag=topic, /type/name, /category/name
- ❌ Navigation links: /about, /login, /signup, /comments, /stories, /users/
- ❌ Stat numbers: subscriber counts ("1.2K followers"), view counts ("202 reads"), like counts
- ❌ Social media links: Twitter, Instagram, YouTube icons/buttons
- ❌ "Load more" buttons, pagination numbers

## STEP-BY-STEP PROCESS

STEP 1: Find all repeating element groups in the HTML (3+ similar elements in a container)
STEP 2: For each group, check: do the child <a> links point to UNIQUE DETAIL PAGES or to CATEGORY/FILTER pages?
STEP 3: Select the group whose links point to DETAIL PAGES with slugs/IDs
STEP 4: Write specific CSS selectors for that group

## SPA SHELL DETECTION

If the HTML has almost no visible text (just nav/menu links, no article titles, heavy <script> bundles) — the page requires JavaScript rendering. In this case: set confidence to 0.2 and note "SPA shell" in reasoning.

IMPORTANT — CSS SELECTOR ESCAPING FOR TAILWIND:
Tailwind class names use ":" for variants (dark:, lg:, hover:, etc.).
In a CSS selector string, ":" must be escaped as "\\:" to avoid pseudo-class parse errors.
In JSON output this means writing "\\\\" + ":" (double-backslash colon).
Example: class "dark:text-slate-200" → JSON value ".dark\\:text-slate-200"
Example: class "lg:gap-4" → JSON value ".lg\\:gap-4"
Do NOT write ".dark:text-slate-200" — this will cause a CSS parser error.

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "container": "CSS selector for the container holding all article cards (null if not needed)",
  "item": "CSS selector for ONE article card — the repeating element",
  "title": "CSS selector for the article title text inside each card",
  "link": "CSS selector for the <a> tag inside each card that links to the article detail page",
  "date": "CSS selector for the publish date/time element (null if not present)",
  "thumbnail": "CSS selector for the thumbnail image (null if not present)",
  "excludeSelectors": ["nav", "header", "footer"],
  "confidence": 0.85,
  "reasoning": "Describe: (1) what the article cards look like, (2) an example article title you found, (3) an example URL the item links point to (e.g. /posts/abc123)"
}`;

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

    // JSON repair: \: → \\: (AI가 CSS 이스케이프를 JSON에 그대로 쓰는 경우 수정)
    // JSON 스펙상 \: 는 유효하지 않은 escape → \\: 로 수정
    const repairedJson = jsonMatch[0].replace(/(?<!\\)\\:/g, '\\\\:');
    const aiResult = JSON.parse(repairedJson);

    console.log('[detectSelectorsWithAI] ✅ AI 감지 성공:', aiResult);

    // Tailwind `dark:xxx`, `lg:xxx` 등 콜론 이스케이프 처리 (Cheerio 파서 오류 방지)
    return {
      selectors: {
        container: escapeTailwindColons(aiResult.container),
        item: escapeTailwindColons(aiResult.item) ?? aiResult.item,
        title: escapeTailwindColons(aiResult.title) ?? aiResult.title,
        link: escapeTailwindColons(aiResult.link) ?? aiResult.link,
        ...(aiResult.date && aiResult.date !== 'null'
          ? { date: escapeTailwindColons(aiResult.date) }
          : {}),
        ...(aiResult.thumbnail && aiResult.thumbnail !== 'null'
          ? { thumbnail: escapeTailwindColons(aiResult.thumbnail) }
          : {}),
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
