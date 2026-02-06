// 범용 날짜 파서
// 다양한 포맷 지원: 고정 포맷, 상대 시간, 영문/한글

/**
 * 다양한 형식의 날짜 문자열을 Date 객체로 파싱
 * @param dateStr 날짜 문자열
 * @returns Date 객체 또는 null
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // 1. ISO 8601 포맷 (우선)
  const isoDate = parseISO(cleaned);
  if (isoDate) return isoDate;

  // 2. 상대 시간 (한글)
  const relativeKorean = parseKoreanRelativeDate(cleaned);
  if (relativeKorean) return relativeKorean;

  // 3. 상대 시간 (영문)
  const relativeEnglish = parseEnglishRelativeDate(cleaned);
  if (relativeEnglish) return relativeEnglish;

  // 4. 고정 포맷들
  const fixedFormat = parseFixedFormats(cleaned);
  if (fixedFormat) return fixedFormat;

  return null;
}

/**
 * ISO 8601 포맷 파싱
 */
function parseISO(dateStr: string): Date | null {
  // ISO 8601: 2024-01-15T10:30:00Z, 2024-01-15T10:30:00+09:00
  if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
  }

  // 날짜만: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr + 'T00:00:00');
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * 한글 상대 시간 파싱
 * "3일 전", "2시간 전", "30분 전", "어제", "오늘", "방금"
 */
function parseKoreanRelativeDate(dateStr: string): Date | null {
  const now = new Date();

  // "오늘" / "방금"
  if (dateStr === '오늘' || dateStr === '방금' || dateStr === '방금 전') {
    return now;
  }

  // "어제"
  if (dateStr === '어제') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // "그저께" / "그제"
  if (dateStr === '그저께' || dateStr === '그제') {
    const dayBeforeYesterday = new Date(now);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    return dayBeforeYesterday;
  }

  // "N분 전"
  const minutesMatch = dateStr.match(/(\d+)\s*분\s*전/);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10);
    const date = new Date(now);
    date.setMinutes(date.getMinutes() - minutes);
    return date;
  }

  // "N시간 전"
  const hoursMatch = dateStr.match(/(\d+)\s*시간\s*전/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    const date = new Date(now);
    date.setHours(date.getHours() - hours);
    return date;
  }

  // "N일 전"
  const daysMatch = dateStr.match(/(\d+)\s*일\s*전/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  }

  // "N주 전"
  const weeksMatch = dateStr.match(/(\d+)\s*주\s*전/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - weeks * 7);
    return date;
  }

  // "N개월 전"
  const monthsMatch = dateStr.match(/(\d+)\s*(개월|달)\s*전/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  }

  // "N년 전"
  const yearsMatch = dateStr.match(/(\d+)\s*년\s*전/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date;
  }

  return null;
}

/**
 * 영문 상대 시간 파싱
 * "3 days ago", "2 hours ago", "yesterday", "just now"
 */
function parseEnglishRelativeDate(dateStr: string): Date | null {
  const now = new Date();
  const lower = dateStr.toLowerCase();

  // "just now" / "now"
  if (lower === 'just now' || lower === 'now') {
    return now;
  }

  // "today"
  if (lower === 'today') {
    return now;
  }

  // "yesterday"
  if (lower === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  // "N minutes ago" / "N minute ago"
  const minutesMatch = lower.match(/(\d+)\s*minutes?\s*ago/);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10);
    const date = new Date(now);
    date.setMinutes(date.getMinutes() - minutes);
    return date;
  }

  // "N hours ago" / "N hour ago"
  const hoursMatch = lower.match(/(\d+)\s*hours?\s*ago/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    const date = new Date(now);
    date.setHours(date.getHours() - hours);
    return date;
  }

  // "N days ago" / "N day ago"
  const daysMatch = lower.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    return date;
  }

  // "N weeks ago" / "N week ago"
  const weeksMatch = lower.match(/(\d+)\s*weeks?\s*ago/);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const date = new Date(now);
    date.setDate(date.getDate() - weeks * 7);
    return date;
  }

  // "N months ago" / "N month ago"
  const monthsMatch = lower.match(/(\d+)\s*months?\s*ago/);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    const date = new Date(now);
    date.setMonth(date.getMonth() - months);
    return date;
  }

  // "N years ago" / "N year ago"
  const yearsMatch = lower.match(/(\d+)\s*years?\s*ago/);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date;
  }

  return null;
}

/**
 * 고정 포맷 파싱
 * YYYY.MM.DD, YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD.MM.YYYY 등
 */
function parseFixedFormats(dateStr: string): Date | null {
  // 숫자와 구분자만 추출
  const cleaned = dateStr.replace(/[^\d.\-/\s:]/g, '').trim();

  // YYYY.MM.DD 또는 YYYY-MM-DD 또는 YYYY/MM/DD
  const ymdMatch = cleaned.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // MM/DD/YYYY (미국식)
  const mdyMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // DD.MM.YYYY (유럽식)
  const dmyMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // YY.MM.DD (2자리 연도)
  const shortYmdMatch = cleaned.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (shortYmdMatch) {
    const [, year, month, day] = shortYmdMatch;
    const fullYear = parseInt(year) + 2000; // 2000년대로 가정
    const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // YYYYMMDD (구분자 없음)
  const noSepMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (noSepMatch) {
    const [, year, month, day] = noSepMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // 한글 포맷: 2024년 1월 15일
  const koreanMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (koreanMatch) {
    const [, year, month, day] = koreanMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) return date;
  }

  // 영문 포맷: Jan 15, 2024 / January 15, 2024
  const englishMonths: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };

  const englishMatch = dateStr
    .toLowerCase()
    .match(/([a-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (englishMatch) {
    const [, monthStr, day, year] = englishMatch;
    const month = englishMonths[monthStr];
    if (month !== undefined) {
      const date = new Date(parseInt(year), month, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // 15 Jan 2024 포맷
  const englishMatch2 = dateStr
    .toLowerCase()
    .match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (englishMatch2) {
    const [, day, monthStr, year] = englishMatch2;
    const month = englishMonths[monthStr];
    if (month !== undefined) {
      const date = new Date(parseInt(year), month, parseInt(day));
      if (!isNaN(date.getTime())) return date;
    }
  }

  return null;
}

/**
 * 날짜가 특정 일수 이내인지 확인
 * @param dateStr 날짜 문자열 또는 Date 객체
 * @param days 일수 (기본값: 7)
 * @param title 디버그용 제목 (선택)
 * @returns 범위 내이면 true, 날짜가 없거나 파싱 실패시에도 true (일단 수집)
 */
export function isWithinDays(
  dateStr: string | Date | null | undefined,
  days: number = 7,
  title?: string
): boolean {
  // 날짜가 없으면 일단 수집 (true 반환)
  if (!dateStr) {
    return true;
  }

  let date: Date;
  if (dateStr instanceof Date) {
    date = dateStr;
  } else {
    const parsed = parseDate(dateStr);
    // 파싱 실패시에도 일단 수집
    if (!parsed) {
      return true;
    }
    date = parsed;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // 미래 날짜는 수집
  if (diffDays < 0) {
    return true;
  }

  return diffDays <= days;
}

/**
 * Date 객체를 ISO 문자열로 변환 (DB 저장용)
 */
export function toISOString(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  return date.toISOString();
}

/**
 * 날짜 문자열을 ISO 문자열로 변환 (DB 저장용)
 */
export function parseDateToISO(dateStr: string | null | undefined): string | undefined {
  const date = parseDate(dateStr);
  return toISOString(date);
}
