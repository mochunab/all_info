// 자동 셀렉터 탐지 모듈
// URL 페이지를 분석하여 최적의 CSS 셀렉터를 자동 감지

import * as cheerio from 'cheerio';

// 기본 헤더 (static.ts와 동일)
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
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

  // 1. 강력한 SPA 증거: body 텍스트 < 200자 + root div → +1.0 (즉시 확정)
  if (bodyText.length < 200 && hasRootDiv) {
    score += 1.0;
    return score; // 즉시 리턴
  }

  // 2. noscript + root div + body < 500자 → +0.8
  if (hasNoscript && hasRootDiv && bodyText.length < 500) {
    score += 0.8;
  }

  // 3. data-server-rendered="true" (Vue.js SSR → CSR)
  const hasVueSSR = $('[data-server-rendered="true"]').length > 0;
  if (hasVueSSR && hasRootDiv) {
    score += 0.7;
  }

  // 4. javascript: 링크 비율 (임계값 낮춤: 50% → 30%)
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

  // 5. onclick 핸들러 기반 네비게이션 (go_, fn_, moveToPage 등)
  const onclickHandlers = $('[onclick]').filter((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    return /go[A-Z_]|fn[A-Z_]|moveToPage|goToPage|pageMove/i.test(onclick);
  });

  if (onclickHandlers.length >= 5) {
    score += 0.3;
  } else if (onclickHandlers.length >= 3) {
    score += 0.15;
  }

  // 6. script 크기 비율 (임계값 낮춤: 5배 → 3배)
  const scriptLength = $('script').text().replace(/\s+/g, '').length;
  const bodyTextLength = bodyText.replace(/\s+/g, '').length;

  if (bodyTextLength > 0 && scriptLength > bodyTextLength * 3 && jsLinkCount >= 3) {
    score += 0.2;
  }

  // 7. React/Vue/Angular 프레임워크 번들 감지 (강화)
  const scriptSrc = $('script[src]')
    .map((_, el) => $(el).attr('src') || '')
    .get()
    .join(' ');

  const scriptContent = $('script:not([src])').text();

  // Vue.js 특정 패턴
  if (/vue|vuex|vue-router|nuxt/i.test(scriptSrc + scriptContent)) {
    score += 0.4;
  }
  // React 특정 패턴
  else if (/react|react-dom|next\.js|webpack|chunk|bundle|app\.[a-f0-9]{8}\.js/i.test(scriptSrc)) {
    score += 0.4;
  }
  // Angular 특정 패턴
  else if (/angular|ng-|@angular/i.test(scriptSrc + scriptContent)) {
    score += 0.4;
  }

  // 8. .go.kr/.or.kr 정부/공공 포털 가중치
  const hostname = $('link[rel="canonical"]').attr('href') || $('base').attr('href') || '';
  if (/\.go\.kr|\.or\.kr/i.test(hostname) && jsLinkCount > 0) {
    score += 0.2;
  }

  // 9. HTML 주석에서 SPA 프레임워크 흔적 확인
  const htmlText = $.html();
  if (/<!--.*?(Surfit|created by|built with|powered by).*(Vue|React|Next|Nuxt)/is.test(htmlText)) {
    score += 0.3;
  }

  // 10. SSR 역지표: 풍부한 body 텍스트 + 구조적 콘텐츠 → 감점
  const articleCount = $('article').length;
  const mainContentLength = $('body').text().replace(/\s+/g, ' ').trim().length;

  if (mainContentLength > 3000 && articleCount >= 3) {
    // 본문 텍스트 풍부 + article 태그 다수 = SSR 가능성 높음
    score -= 0.3;
  } else if (mainContentLength > 2000 && (articleCount >= 2 || $('main article, section article').length >= 2)) {
    score -= 0.2;
  }

  return Math.min(Math.max(score, 0), 1.0);
}

/**
 * Rule-based 셀렉터 탐지 (cheerio 기반 패턴 매칭)
 * @public strategy-resolver에서 재사용
 */
export function detectByRules($: cheerio.CheerioAPI, url: string): SelectorCandidate | null {
  // nav/header/footer 제거한 클론으로 분석 (content-extractor.ts와 동일 패턴)
  const $clean = cheerio.load($.html());
  $clean('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  const candidates: SelectorCandidate[] = [];

  // 1. 테이블 구조 탐지
  detectTableStructure($clean, url, candidates);

  // 2. 리스트 구조 탐지 (ul > li, ol > li)
  detectListStructure($clean, url, candidates);

  // 3. 반복 div/article/section 구조 탐지
  detectRepeatingElements($clean, url, candidates);

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

