
// User agent for crawling
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Request headers
export const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Fetch with timeout to prevent hanging
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Check if date is within the last N days
export function isWithinDays(dateString: string | undefined, days: number, title?: string): boolean {
  if (!dateString) {
    console.log(`[Filter] No date for "${title?.substring(0, 30) || 'Unknown'}..." - INCLUDE (no date)`);
    return true; // Include if no date
  }

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const withinRange = diffDays <= days;

    if (!withinRange) {
      console.log(`[Filter] "${title?.substring(0, 30) || 'Unknown'}..." - EXCLUDE (${diffDays} days old, max ${days})`);
    }

    return withinRange;
  } catch {
    console.log(`[Filter] Date parse error for "${title?.substring(0, 30) || 'Unknown'}..." - INCLUDE (parse error)`);
    return true; // Include if date parsing fails
  }
}

// Parse Korean relative date (e.g., "3시간 전", "2일 전")
export function parseKoreanRelativeDate(text: string): Date {
  const now = new Date();
  const cleanText = text.trim();

  // Match patterns like "3시간 전", "2일 전", "1분 전"
  const match = cleanText.match(/(\d+)(초|분|시간|일|주|개월|년)\s*전/);

  if (!match) {
    // Try to parse as absolute date
    const date = new Date(text);
    return isNaN(date.getTime()) ? now : date;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case '초':
      return new Date(now.getTime() - value * 1000);
    case '분':
      return new Date(now.getTime() - value * 60 * 1000);
    case '시간':
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case '일':
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case '주':
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case '개월':
      return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
    case '년':
      return new Date(now.getTime() - value * 365 * 24 * 60 * 60 * 1000);
    default:
      return now;
  }
}

// Parse date in various formats
export function parseDate(dateString: string): Date | null {
  const cleanText = dateString.trim();

  // Try Korean relative date first
  if (cleanText.includes('전') || cleanText.includes('방금')) {
    return parseKoreanRelativeDate(cleanText);
  }

  // Try standard date formats
  const formats = [
    // ISO 8601
    /^\d{4}-\d{2}-\d{2}/,
    // Korean format: 2024년 1월 15일
    /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/,
    // Dot format: 2024.01.15
    /^\d{4}\.\d{2}\.\d{2}/,
    // Slash format: 2024/01/15
    /^\d{4}\/\d{2}\/\d{2}/,
  ];

  for (const format of formats) {
    if (format.test(cleanText)) {
      const normalized = cleanText
        .replace(/년\s*/g, '-')
        .replace(/월\s*/g, '-')
        .replace(/일/g, '')
        .replace(/\./g, '-')
        .replace(/\//g, '-');

      const date = new Date(normalized);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Try direct parsing
  const date = new Date(cleanText);
  return isNaN(date.getTime()) ? null : date;
}
