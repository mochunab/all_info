// 자동 셀렉터 탐지 모듈
// URL 페이지를 분석하여 최적의 CSS 셀렉터를 자동 감지

import * as cheerio from 'cheerio';
import type { CrawlerType, SelectorConfig, PaginationConfig } from './types';

// 기본 헤더 (static.ts와 동일)
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// 분석 결과 타입
type AnalysisResult = {
  success: boolean;
  crawlerType: CrawlerType;
  selectors?: SelectorConfig;
  pagination?: PaginationConfig;
  spaDetected: boolean;
  method: 'rule' | 'ai' | 'default';
  confidence: number;
  error?: string;
};

// Rule-based 후보 타입
type SelectorCandidate = {
  container: string;
  item: string;
  title: string;
  link: string;
  date?: string;
  thumbnail?: string;
  score: number;
  count: number;
};

/**
 * 페이지 HTML을 분석하여 최적의 셀렉터를 탐지
 */
export async function analyzePageStructure(url: string): Promise<AnalysisResult> {
  try {
    const html = await fetchPage(url);

    if (!html) {
      return {
        success: false,
        crawlerType: 'STATIC',
        spaDetected: false,
        method: 'default',
        confidence: 0,
        error: 'Failed to fetch page',
      };
    }

    const $ = cheerio.load(html);

    // SPA 감지
    const spaDetected = detectSPA($);

    // Rule-based 분석
    const ruleResult = detectByRules($, url);

    if (ruleResult && ruleResult.score >= 0.5) {
      return {
        success: true,
        crawlerType: spaDetected ? 'SPA' : 'STATIC',
        selectors: {
          container: ruleResult.container,
          item: ruleResult.item,
          title: ruleResult.title,
          link: ruleResult.link,
          ...(ruleResult.date && { date: ruleResult.date }),
          ...(ruleResult.thumbnail && { thumbnail: ruleResult.thumbnail }),
        },
        spaDetected,
        method: 'rule',
        confidence: ruleResult.score,
      };
    }

    // AI 폴백 (rule-based confidence < 0.5)
    const aiResult = await detectByAI(html, url);

    if (aiResult) {
      return {
        success: true,
        crawlerType: spaDetected ? 'SPA' : 'STATIC',
        selectors: aiResult.selectors,
        ...(aiResult.pagination && { pagination: aiResult.pagination }),
        spaDetected,
        method: 'ai',
        confidence: aiResult.confidence,
      };
    }

    // 모두 실패 시 기본값 반환
    return {
      success: false,
      crawlerType: spaDetected ? 'SPA' : 'STATIC',
      spaDetected,
      method: 'default',
      confidence: 0,
    };
  } catch (error) {
    console.error('[AUTO-DETECT] Error:', error);
    return {
      success: false,
      crawlerType: 'STATIC',
      spaDetected: false,
      method: 'default',
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * HTML fetch (15초 타임아웃)
 * @public strategy-resolver에서 재사용
 */
export async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[AUTO-DETECT] HTTP ${response.status} for ${url}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`[AUTO-DETECT] Fetch error for ${url}:`, error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * SPA 감지: React/Vue/Next.js + JSP/ASP 등 레거시 동적 페이지 지원
 * - 스코어링 기반 (0~1), 임계값 0.5 이상이면 SPA 판정
 */
function detectSPA($: cheerio.CheerioAPI): boolean {
  const score = calculateSPAScore($);
  return score >= 0.5;
}

/**
 * SPA 스코어 계산 (0~1)
 * @public strategy-resolver에서 재사용
 */
export function calculateSPAScore($: cheerio.CheerioAPI): number {
  let score = 0;

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const hasNoscript = $('noscript').length > 0;
  const hasRootDiv = $('#root').length > 0 || $('#app').length > 0 || $('#__next').length > 0;

  // 1. 강력한 SPA 증거: body 텍스트 < 200자 + root div → +0.9
  if (bodyText.length < 200 && hasRootDiv) {
    score += 0.9;
  }

  // 2. noscript + root div + body < 500자 → +0.7
  if (hasNoscript && hasRootDiv && bodyText.length < 500) {
    score += 0.7;
  }

  // 3. javascript: 링크 비율 (임계값 낮춤: 50% → 30%)
  const allLinkCount = $('a[href]').length;
  const jsLinkCount = $('a[href^="javascript:"]').length;

  if (allLinkCount > 0 && jsLinkCount >= 5) {
    const jsLinkRatio = jsLinkCount / allLinkCount;
    if (jsLinkRatio >= 0.3) {
      // 30% 이상
      score += 0.4;
    } else if (jsLinkRatio >= 0.15) {
      // 15% 이상
      score += 0.25;
    }
  }

  // 4. onclick 핸들러 기반 네비게이션 (go_, fn_, moveToPage 등)
  const onclickHandlers = $('[onclick]').filter((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    return /go[A-Z_]|fn[A-Z_]|moveToPage|goToPage|pageMove/i.test(onclick);
  });

  if (onclickHandlers.length >= 5) {
    score += 0.3;
  } else if (onclickHandlers.length >= 3) {
    score += 0.15;
  }

  // 5. script 크기 비율 (임계값 낮춤: 5배 → 3배)
  const scriptLength = $('script').text().replace(/\s+/g, '').length;
  const bodyTextLength = bodyText.replace(/\s+/g, '').length;

  if (bodyTextLength > 0 && scriptLength > bodyTextLength * 3 && jsLinkCount >= 3) {
    score += 0.2;
  }

  // 6. React/Vue/Angular 프레임워크 번들 감지
  const scriptSrc = $('script[src]')
    .map((_, el) => $(el).attr('src') || '')
    .get()
    .join(' ');

  if (
    /react|vue|angular|next|nuxt|webpack|chunk|bundle|app\.[a-f0-9]{8}\.js/i.test(scriptSrc)
  ) {
    score += 0.3;
  }

  // 7. .go.kr/.or.kr 정부/공공 포털 가중치
  const hostname = $('link[rel="canonical"]').attr('href') || $('base').attr('href') || '';
  if (/\.go\.kr|\.or\.kr/i.test(hostname) && jsLinkCount > 0) {
    score += 0.2;
  }

  return Math.min(score, 1.0);
}

/**
 * Rule-based 셀렉터 탐지 (cheerio 기반 패턴 매칭)
 * @public strategy-resolver에서 재사용
 */
export function detectByRules($: cheerio.CheerioAPI, url: string): SelectorCandidate | null {
  const candidates: SelectorCandidate[] = [];

  // 1. 테이블 구조 탐지
  detectTableStructure($, url, candidates);

  // 2. 리스트 구조 탐지 (ul > li, ol > li)
  detectListStructure($, url, candidates);

  // 3. 반복 div/article/section 구조 탐지
  detectRepeatingElements($, url, candidates);

  if (candidates.length === 0) {
    return null;
  }

  // 최고 점수 후보 반환
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * 테이블 구조 탐지 (게시판형 사이트)
 */
function detectTableStructure(
  $: cheerio.CheerioAPI,
  url: string,
  candidates: SelectorCandidate[]
): void {
  $('table').each((_, table) => {
    const $table = $(table);
    const $rows = $table.find('tbody > tr, tr').filter((_, tr) => {
      // 헤더 행 제외
      return $(tr).find('th').length === 0;
    });

    if ($rows.length < 3) return;

    // 행 내부에 링크가 있는지 확인
    const rowsWithLinks = $rows.filter((_, tr) => $(tr).find('a[href]').length > 0);
    if (rowsWithLinks.length < 3) return;

    const candidate = analyzeCandidateItems($, rowsWithLinks);
    if (candidate) {
      // 테이블의 고유 셀렉터 생성
      const tableSelector = getUniqueSelector($, $table);
      candidate.container = tableSelector;
      candidate.item = 'tbody > tr';
      candidates.push(candidate);
    }
  });
}

/**
 * 리스트 구조 탐지 (ul > li, ol > li)
 */
function detectListStructure(
  $: cheerio.CheerioAPI,
  url: string,
  candidates: SelectorCandidate[]
): void {
  $('ul, ol').each((_, list) => {
    const $list = $(list);
    const $items = $list.children('li');

    if ($items.length < 3) return;

    // li 내부에 링크가 있는지 확인
    const itemsWithLinks = $items.filter((_, li) => $(li).find('a[href]').length > 0);
    if (itemsWithLinks.length < 3) return;

    const candidate = analyzeCandidateItems($, itemsWithLinks);
    if (candidate) {
      const listSelector = getUniqueSelector($, $list);
      candidate.container = listSelector;
      candidate.item = 'li';
      candidates.push(candidate);
    }
  });
}

/**
 * 반복 div/article/section 구조 탐지 (카드/그리드 구조)
 */
function detectRepeatingElements(
  $: cheerio.CheerioAPI,
  url: string,
  candidates: SelectorCandidate[]
): void {
  // 클래스별 요소 그룹화
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classGroups = new Map<string, cheerio.Cheerio<any>[]>();

  $('div, article, section, li').each((_, el) => {
    const $el = $(el);
    const className = $el.attr('class');
    if (!className) return;

    // 첫 번째 클래스 기반 그룹키
    const tagName = el.type === 'tag' ? (el as { name: string }).name : '';
    const key = `${tagName}.${className.split(/\s+/)[0]}`;

    if (!classGroups.has(key)) {
      classGroups.set(key, []);
    }
    classGroups.get(key)!.push($el);
  });

  for (const [key, elements] of classGroups) {
    if (elements.length < 3) continue;

    // 링크가 있는 요소만 필터
    const withLinks = elements.filter(($el) => $el.find('a[href]').length > 0);
    if (withLinks.length < 3) continue;

    // cheerio 객체로 변환하여 분석
    const $first = withLinks[0];
    const parent = $first.parent();
    const parentSelector = getUniqueSelector($, parent);

    const [tagName, firstClass] = key.split('.');
    const itemSelector = firstClass ? `${tagName}.${firstClass}` : tagName;

    // 후보 아이템 분석
    const candidate = analyzeRepeatingCandidate($, withLinks);
    if (candidate) {
      candidate.container = parentSelector;
      candidate.item = itemSelector;
      candidates.push(candidate);
    }
  }
}

/**
 * 후보 아이템 그룹에서 title, link, date, thumbnail 셀렉터 추출
 */
function analyzeCandidateItems(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $items: cheerio.Cheerio<any>,
): SelectorCandidate | null {
  const first = $items.first();

  // title 셀렉터 탐지
  const titleSelector = findTitleSelector($, first);
  if (!titleSelector) return null;

  // link 셀렉터 탐지
  const linkSelector = findLinkSelector($, first);
  if (!linkSelector) return null;

  // date 셀렉터 탐지
  const dateSelector = findDateSelector($, first);

  // thumbnail 셀렉터 탐지
  const thumbnailSelector = findThumbnailSelector($, first);

  // 점수 산정
  let score = 0.6; // title + link 기본
  if (dateSelector) score += 0.2;
  if (thumbnailSelector) score += 0.1;
  if ($items.length >= 5) score += 0.1;

  return {
    container: '',
    item: '',
    title: titleSelector,
    link: linkSelector,
    date: dateSelector || undefined,
    thumbnail: thumbnailSelector || undefined,
    score: Math.min(score, 1.0),
    count: $items.length,
  };
}

/**
 * 반복 요소 후보 분석 (cheerio 배열용)
 */
function analyzeRepeatingCandidate(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: cheerio.Cheerio<any>[],
): SelectorCandidate | null {
  const first = elements[0];

  const titleSelector = findTitleSelector($, first);
  if (!titleSelector) return null;

  const linkSelector = findLinkSelector($, first);
  if (!linkSelector) return null;

  const dateSelector = findDateSelector($, first);
  const thumbnailSelector = findThumbnailSelector($, first);

  let score = 0.6;
  if (dateSelector) score += 0.2;
  if (thumbnailSelector) score += 0.1;
  if (elements.length >= 5) score += 0.1;

  return {
    container: '',
    item: '',
    title: titleSelector,
    link: linkSelector,
    date: dateSelector || undefined,
    thumbnail: thumbnailSelector || undefined,
    score: Math.min(score, 1.0),
    count: elements.length,
  };
}

/**
 * title 셀렉터 탐지
 */
function findTitleSelector(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $el: cheerio.Cheerio<any>
): string | null {
  // 우선순위: h1~h6 > .title/.subject > a 텍스트
  const titleCandidates = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    '.title', '.subject', '.tit', '.headline',
    '[class*="title"]', '[class*="subject"]',
    'a',
  ];

  for (const selector of titleCandidates) {
    const $found = $el.find(selector).first();
    if ($found.length > 0 && $found.text().trim().length > 2) {
      return selector;
    }
  }

  return null;
}

/**
 * link 셀렉터 탐지
 */
function findLinkSelector(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $el: cheerio.Cheerio<any>
): string | null {
  const $link = $el.find('a[href]').first();
  if ($link.length > 0) {
    return 'a';
  }
  return null;
}

/**
 * date 셀렉터 탐지
 */
function findDateSelector(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $el: cheerio.Cheerio<any>
): string | null {
  const dateCandidates = [
    'time[datetime]',
    'time',
    '.date',
    '.time',
    '.datetime',
    '.published',
    '[class*="date"]',
    '[class*="time"]',
  ];

  for (const selector of dateCandidates) {
    const $found = $el.find(selector).first();
    if ($found.length > 0) {
      const text = $found.text().trim();
      const datetime = $found.attr('datetime');
      // 날짜 패턴 매칭 (YYYY-MM-DD, YYYY.MM.DD, MM/DD, 숫자+한글날짜 등)
      if (datetime || /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(text) || /\d{1,2}[./-]\d{1,2}/.test(text) || /\d+[시간일주월년]/.test(text) || /ago|전/.test(text)) {
        return selector;
      }
    }
  }

  return null;
}

/**
 * thumbnail 셀렉터 탐지
 */
function findThumbnailSelector(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $el: cheerio.Cheerio<any>
): string | null {
  const $img = $el.find('img[src], img[data-src], img[data-lazy-src]').first();
  if ($img.length > 0) {
    return 'img';
  }
  return null;
}

/**
 * 요소의 고유 CSS 셀렉터 생성
 */
function getUniqueSelector(
  $: cheerio.CheerioAPI,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $el: cheerio.Cheerio<any>
): string {
  const el = $el.get(0);
  if (!el || el.type !== 'tag') return '';

  // id가 있으면 사용
  const id = $el.attr('id');
  if (id) return `#${id}`;

  // 클래스가 있으면 태그+첫번째 클래스
  const className = $el.attr('class');
  if (className) {
    const firstClass = className.split(/\s+/)[0];
    const selector = `${el.name}.${firstClass}`;
    // 고유한지 확인
    if ($(selector).length === 1) {
      return selector;
    }
  }

  // 태그명만 반환
  return el.name;
}

// --- AI Fallback ---

type AIDetectionResult = {
  selectors: SelectorConfig;
  pagination?: PaginationConfig;
  confidence: number;
};

/**
 * AI 기반 크롤러 타입 감지 (Edge Function 호출)
 * - Rule-based 분석이 불확실할 때 사용
 * - GPT-5-nano가 HTML 구조를 분석하여 STATIC/SPA/RSS 등 결정
 * @public strategy-resolver에서 재사용
 */
export async function detectCrawlerTypeByAI(
  html: string,
  url: string
): Promise<{ type: CrawlerType; confidence: number; reasoning: string } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[AI-TYPE-DETECT] Supabase credentials not configured');
    return null;
  }

  try {
    // HTML 정리: 처음 5000자만 전송
    const truncatedHtml = html.length > 5000 ? html.substring(0, 5000) + '\n... (truncated)' : html;

    console.log(`[AI-TYPE-DETECT] 🤖 Edge Function 호출 중...`);

    const response = await fetch(`${supabaseUrl}/functions/v1/detect-crawler-type`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, html: truncatedHtml }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI-TYPE-DETECT] Edge Function error: ${response.status}`, errorText);
      return null;
    }

    const result = await response.json();

    if (result.success && result.crawlerType) {
      console.log(
        `[AI-TYPE-DETECT] ✅ Success: ${result.crawlerType} (confidence: ${result.confidence})`
      );
      console.log(`[AI-TYPE-DETECT] 💡 Reasoning: ${result.reasoning}`);

      return {
        type: result.crawlerType as CrawlerType,
        confidence: result.confidence,
        reasoning: result.reasoning,
      };
    } else {
      console.warn(`[AI-TYPE-DETECT] ❌ Failed: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error('[AI-TYPE-DETECT] Error:', error);
    return null;
  }
}

/**
 * AI 기반 셀렉터 탐지 (GPT-5-nano → GPT-4o-mini fallback)
 * @public strategy-resolver에서 재사용
 */
export async function detectByAI(html: string, url: string): Promise<AIDetectionResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[AUTO-DETECT] OPENAI_API_KEY not configured, skipping AI detection');
    return null;
  }

  // HTML 정리: 불필요 태그 제거 후 5000자로 truncate
  const cleanedHtml = cleanHtmlForAI(html);
  const truncatedHtml = cleanedHtml.length > 5000 ? cleanedHtml.substring(0, 5000) : cleanedHtml;

  const prompt = `다음은 "${url}" 페이지의 HTML입니다. 이 페이지에서 게시글/아티클 목록의 CSS 셀렉터를 찾아 JSON으로 반환하세요.

필수 필드:
- item: 반복되는 게시글 아이템의 CSS 셀렉터
- title: 아이템 내 제목 셀렉터
- link: 아이템 내 링크(a 태그) 셀렉터

선택 필드:
- container: 목록을 감싸는 컨테이너 셀렉터 (있으면)
- date: 날짜 셀렉터 (있으면)
- thumbnail: 썸네일 이미지 셀렉터 (있으면)

JSON 형식:
{
  "item": "CSS selector",
  "title": "CSS selector",
  "link": "CSS selector",
  "container": "CSS selector or null",
  "date": "CSS selector or null",
  "thumbnail": "CSS selector or null",
  "confidence": 0.0 to 1.0
}

HTML:
${truncatedHtml}`;

  try {
    // GPT-5-nano responses API 시도
    const result = await callGPT5Nano(prompt, apiKey);

    if (result) {
      return parseAIResponse(result);
    }
  } catch (error) {
    console.error('[AUTO-DETECT] AI detection error:', error);
  }

  return null;
}

/**
 * HTML에서 불필요한 태그 제거 (AI 분석용)
 */
function cleanHtmlForAI(html: string): string {
  const $ = cheerio.load(html);

  // 불필요 태그 제거
  $('script, style, svg, noscript, iframe, link, meta').remove();

  // 주석 제거
  $('*').contents().filter(function () {
    return this.type === 'comment';
  }).remove();

  return $('body').html() || '';
}

/**
 * GPT-5-nano responses.create() → fallback: chat.completions (gpt-4o-mini)
 */
async function callGPT5Nano(prompt: string, apiKey: string): Promise<string | null> {
  // 1차: responses API (gpt-5-nano)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        input: prompt,
        reasoning: { effort: 'low' },
        text: { format: { type: 'json_object' } },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.output_text || '';
    }

    if (response.status === 404) {
      console.log('[AUTO-DETECT] responses API not available, falling back to chat.completions');
    } else {
      console.error(`[AUTO-DETECT] GPT-5-nano API error: ${response.status}`);
    }
  } catch (error) {
    console.error('[AUTO-DETECT] GPT-5-nano request failed:', error);
  }

  // 2차: chat.completions (gpt-4o-mini)
  try {
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
            content: 'HTML에서 게시글 목록의 CSS 셀렉터를 찾는 전문가입니다. 반드시 JSON 형식으로만 응답하세요.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error(`[AUTO-DETECT] chat.completions API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('[AUTO-DETECT] chat.completions request failed:', error);
    return null;
  }
}

/**
 * AI 응답 JSON 파싱
 */
function parseAIResponse(jsonStr: string): AIDetectionResult | null {
  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.item || !parsed.title || !parsed.link) {
      console.warn('[AUTO-DETECT] AI response missing required fields');
      return null;
    }

    return {
      selectors: {
        ...(parsed.container && { container: parsed.container }),
        item: parsed.item,
        title: parsed.title,
        link: parsed.link,
        ...(parsed.date && { date: parsed.date }),
        ...(parsed.thumbnail && { thumbnail: parsed.thumbnail }),
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
    };
  } catch {
    console.error('[AUTO-DETECT] Failed to parse AI response:', jsonStr);
    return null;
  }
}

export type { AnalysisResult };
