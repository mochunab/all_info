// 범용 제목 정제 모듈
// 모든 크롤러에서 사용되는 제목 정제 로직

/**
 * 제목에서 불필요한 메타데이터 제거
 * - "공지", "min read", UI 라벨 등
 * - 과도한 공백/줄바꿈
 * - 날짜 패턴
 */
export function cleanTitle(rawTitle: string): string {
  if (!rawTitle) return '';

  let cleaned = rawTitle;

  // 1. 과도한 공백/줄바꿈/탭 정리 (먼저 정규화)
  cleaned = cleaned.replace(/[\s\t\n\r]+/g, ' ').trim();

  // 2. "공지" 라벨 제거 (앞뒤 공백 포함)
  cleaned = cleaned.replace(/^공지\s+/i, '');
  cleaned = cleaned.replace(/\s+공지$/i, '');

  // 3. "n min read" / "n분 read" / "읽는 시간" 패턴 제거
  cleaned = cleaned.replace(/\d+\s*(min|분)\s*(read|읽는 시간|소요)/gi, '');

  // 4. 날짜 패턴 제거 (YYYY-MM-DD, YYYY.MM.DD, MM/DD 등)
  cleaned = cleaned.replace(/\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b/g, '');
  cleaned = cleaned.replace(/\b\d{1,2}[-./]\d{1,2}\b/g, '');

  // 5. 시간 패턴 제거 (HH:MM, HH:MM:SS)
  cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '');

  // 6. 카테고리 라벨 패턴 제거 (대괄호 안 텍스트)
  cleaned = cleaned.replace(/\[.*?\]/g, '');

  // 7. 특수 문자 정리 (여러 개 연속 → 하나)
  cleaned = cleaned.replace(/[․·•\-_|]+/g, ' ');

  // 8. "업데이트", "수정", "NEW" 등 상태 라벨 제거
  cleaned = cleaned.replace(/\b(업데이트|수정|NEW|신규|추가)\s*/gi, '');

  // 9. 다시 공백 정리
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * 제목이 유효한 콘텐츠 제목인지 검증
 * - UI 라벨, 메뉴, 카테고리명 등 걸러냄
 */
export function isTitleValid(title: string): boolean {
  if (!title || title.length < 3) return false;

  const titleLower = title.toLowerCase().trim();

  // UI 라벨/메뉴 패턴
  const uiPatterns = [
    '소매시장분석',
    '앱시장분석',
    '비교하기',
    '더보기',
    '전체보기',
    '목록',
    '이전',
    '다음',
    '처음',
    '마지막',
    '홈',
    '메인',
    '로그인',
    '회원가입',
    '마이페이지',
    '장바구니',
    '주문',
    '결제',
    '배송',
    '문의',
    '서비스 문의',
    '제품 문의',
    '고객센터',
    '공지사항',
    '이벤트',
    '이용약관',
    '개인정보',
    '회사소개',
    '검색',
    '알림',
    '설정',
    '인사이트',
    '분석',
    '통계',
    '리포트',
  ];

  // 정확히 일치하는 경우 거부
  if (uiPatterns.includes(titleLower)) {
    return false;
  }

  // 숫자/특수문자만 있는 경우 거부 (한글/영문/일본어/중국어는 허용)
  // 문자가 하나도 없고 숫자와 특수문자만 있는 경우
  if (!/[a-zA-Z가-힣ぁ-んァ-ヶ一-龯]/. test(title)) {
    return false;
  }

  // "순위", "랭킹", "top" 등 단순 키워드만 있는 경우 거부
  const simpleKeywords = ['순위', '랭킹', 'top', '베스트', 'best'];
  if (simpleKeywords.includes(titleLower)) {
    return false;
  }

  // "순위"로 끝나는 짧은 제목 거부 (예: "와이즈앱 순위", "리테일 순위")
  // 단, 15자 이상이면 유효한 제목으로 간주 (예: "2024년 상반기 앱 순위 분석")
  if (title.length < 15 && /순위$/.test(title)) {
    return false;
  }

  return true;
}

/**
 * 제목 정제 + 검증 통합 함수
 * @returns 정제된 제목 또는 null (유효하지 않은 경우)
 */
export function processTitle(rawTitle: string): string | null {
  const cleaned = cleanTitle(rawTitle);
  return isTitleValid(cleaned) ? cleaned : null;
}
