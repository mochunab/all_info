import { createHash } from 'crypto';
import type { Language } from '@/types';

export function generateSourceId(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 16);
}

const TIME_UNITS: Record<Language, {
  now: string; min: string; hour: string; day: string; week: string; month: string; year: string;
}> = {
  ko: { now: '방금 전', min: '분 전', hour: '시간 전', day: '일 전', week: '주 전', month: '개월 전', year: '년 전' },
  en: { now: 'just now', min: ' min ago', hour: 'h ago', day: 'd ago', week: 'w ago', month: ' mo ago', year: 'y ago' },
  vi: { now: 'vừa xong', min: ' phút trước', hour: ' giờ trước', day: ' ngày trước', week: ' tuần trước', month: ' tháng trước', year: ' năm trước' },
  zh: { now: '刚刚', min: '分钟前', hour: '小时前', day: '天前', week: '周前', month: '个月前', year: '年前' },
  ja: { now: 'たった今', min: '分前', hour: '時間前', day: '日前', week: '週間前', month: 'ヶ月前', year: '年前' },
};

export function formatDistanceToNow(dateString: string, lang: Language = 'ko'): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const u = TIME_UNITS[lang];

  if (diffInSeconds < 60) return u.now;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}${u.min}`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}${u.hour}`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}${u.day}`;

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks}${u.week}`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}${u.month}`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}${u.year}`;
}

/**
 * 날짜가 최근 7일 이내인지 확인
 */
export function isWithinDays(dateString: string, days: number): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  return diffInDays <= days;
}

/**
 * 날짜를 한국 형식으로 포맷 (예: "2024년 1월 15일")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 텍스트 길이 제한 (말줄임)
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * HTML 태그 제거
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * 연속된 공백 및 줄바꿈 정리
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 딜레이 함수 (크롤링 간격 조절용)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 재시도 로직
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < retries - 1) {
        await delay(delayMs * (i + 1)); // Exponential backoff
      }
    }
  }

  throw lastError;
}

/**
 * URL 유효성 검사
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 절대 URL로 변환
 */
export function toAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = new URL(baseUrl);
  if (url.startsWith('/')) {
    return `${base.origin}${url}`;
  }

  return new URL(url, baseUrl).href;
}
