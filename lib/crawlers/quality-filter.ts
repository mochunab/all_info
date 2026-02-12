// 크롤링 결과 품질 필터 - 쓰레기 콘텐츠 제거

import type { RawContentItem, CrawledArticle } from './types';

// 한국어/영어 쓰레기 제목 패턴
const GARBAGE_TITLE_PATTERNS = [
  // 로그인/회원가입 관련
  /^로그인$/,
  /^로그아웃$/,
  /^회원가입$/,
  /^비밀번호/,
  /^Login$/i,
  /^Logout$/i,
  /^Sign\s*[Ii]n$/,
  /^Sign\s*[Uu]p$/,
  /^Register$/i,

  // 페이지네이션 관련
  /^(이전|다음|처음|마지막)\s*페이지$/,
  /^(Previous|Next|First|Last)\s*Page$/i,
  /^(Prev|Next)$/i,

  // 검색/메뉴 관련
  /^(검색|Search)$/i,
  /^(홈|Home|메인|Main)$/i,
  /^(메뉴|Menu)$/i,
  /^(닫기|Close)$/i,

  // 약관/정책 관련
  /^(이용약관|개인정보|Privacy)/i,
  /^Terms\s*of\s*Service$/i,
  /^Privacy\s*Policy$/i,

  // SNS/공유 관련
  /^(공유하기|스크랩|좋아요)$/i,
  /^(Share|Like|Bookmark)$/i,
  /블로그\s*새창으로\s*열기/,
  /^(페이스북|트위터|인스타)\s*새창/,
  /^(Facebook|Twitter|Instagram)\s*new\s*window/i,

  // 목록/더보기 관련
  /^(목록|List)$/i,
  /^(더\s*보기|More)$/i,
  /^View\s*All$/i,
  /^See\s*More$/i,

  // 기타
  /^(TOP|맨위로)$/i,
  /^Scroll\s*to\s*Top$/i,
  /^Back\s*to\s*Top$/i,

  // 3자 이하 (단, 숫자만으로 구성된 경우는 제외)
  /^.{0,3}$/,

  // 공백 또는 특수문자만
  /^\s*$/,
  /^[.,!?;:\-_]+$/,
];

// 비-아티클 URL 패턴
const GARBAGE_URL_PATTERNS = [
  // 인증 관련
  /\/login/i,
  /\/signup/i,
  /\/register/i,
  /\/auth\//i,
  /\/logout/i,

  // 특수 프로토콜
  /^javascript:/i,
  /^#/,
  /^mailto:/,
  /^tel:/,

  // 정책/약관 페이지
  /\/terms/i,
  /\/privacy/i,
  /\/policy/i,

  // 관리/설정 페이지
  /\/admin/i,
  /\/settings/i,
  /\/config/i,
];

/**
 * 개별 크롤링 아이템이 쓰레기 콘텐츠인지 검사
 * @param item - 크롤링된 원시 아이템
 * @returns true면 쓰레기 콘텐츠 (필터링 대상)
 */
export function isGarbageItem(item: RawContentItem): boolean {
  // 1. 제목이 없거나 공백만 있는 경우
  if (!item.title || item.title.trim().length === 0) {
    return true;
  }

  // 2. URL이 없는 경우
  if (!item.link || item.link.trim().length === 0) {
    return true;
  }

  const title = item.title.trim();
  const url = item.link.trim();

  // 3. 제목 패턴 매칭
  for (const pattern of GARBAGE_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      return true;
    }
  }

  // 4. URL 패턴 매칭
  for (const pattern of GARBAGE_URL_PATTERNS) {
    if (pattern.test(url)) {
      return true;
    }
  }

  // 5. 숫자만으로 구성된 제목 (페이지 번호 등)
  if (/^\d+$/.test(title)) {
    return true;
  }

  return false;
}

/**
 * 크롤링된 아티클 목록에서 쓰레기 콘텐츠 필터링
 * @param articles - 크롤링된 아티클 배열
 * @param sourceName - 로깅용 소스 이름
 * @returns 필터링된 아티클 배열
 */
export function filterGarbageArticles(
  articles: CrawledArticle[],
  sourceName: string
): CrawledArticle[] {
  const originalCount = articles.length;

  const filtered = articles.filter((article) => {
    // RawContentItem 형태로 변환하여 검사
    const rawItem: RawContentItem = {
      title: article.title,
      link: article.source_url,
      thumbnail: article.thumbnail_url ?? null,
      author: article.author ?? null,
      dateStr: article.published_at ?? null,
      content: article.content_preview,
    };

    return !isGarbageItem(rawItem);
  });

  const removedCount = originalCount - filtered.length;

  if (removedCount > 0) {
    console.log(
      `[Quality Filter] ${sourceName}: ${removedCount}/${originalCount} garbage items removed`
    );
  }

  return filtered;
}

/**
 * 크롤링 결과 품질 통계
 */
export type QualityStats = {
  total: number;
  valid: number;
  garbage: number;
  garbageRatio: number;
};

/**
 * 크롤링 결과 품질 통계 계산
 * @param items - 원시 아이템 배열
 * @returns 품질 통계
 */
export function getQualityStats(items: RawContentItem[]): QualityStats {
  const total = items.length;
  const garbage = items.filter(isGarbageItem).length;
  const valid = total - garbage;
  const garbageRatio = total > 0 ? garbage / total : 0;

  return {
    total,
    valid,
    garbage,
    garbageRatio,
  };
}
