// Universal Content Extractor
// @mozilla/readability + jsdom 기반 본문 추출

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import * as cheerio from 'cheerio';
import type { ContentSelectors } from './types';

// 기본 본문 셀렉터 (우선순위 순)
const DEFAULT_CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.article-content',
  '.article-body',
  '.post-content',
  '.post-body',
  '.entry-content',
  '.content-body',
  '.story-content',
  '.blog-content',
  '.news-content',
  '.text-content',
  '#content',
  '#article',
  '#post',
  '.content',
  '.post',
  '.article',
];

// 제거할 요소 (광고, 관련 기사 등)
const DEFAULT_REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'header',
  'footer',
  '.ad',
  '.ads',
  '.advertisement',
  '.banner',
  '.sidebar',
  '.related',
  '.related-posts',
  '.related-articles',
  '.recommended',
  '.comments',
  '.comment',
  '.share',
  '.social',
  '.author-bio',
  '.newsletter',
  '.subscribe',
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[id*="ad-"]',
  '[id*="ads-"]',
];

/**
 * HTML에서 본문 텍스트 추출
 * 우선순위:
 * 1. 커스텀 셀렉터 (config.content_selectors.content)
 * 2. @mozilla/readability 자동 추출
 * 3. 일반적인 본문 셀렉터 탐색
 */
export async function extractContent(
  html: string,
  url: string,
  config?: ContentSelectors
): Promise<string> {
  try {
    // 1. 커스텀 셀렉터 시도
    if (config?.content) {
      const customContent = extractWithSelector(html, config);
      if (customContent && customContent.length > 100) {
        return customContent;
      }
    }

    // 2. Readability 사용 (useReadability가 false가 아닌 경우)
    if (config?.useReadability !== false) {
      const readabilityContent = extractWithReadability(html, url);
      if (readabilityContent && readabilityContent.length > 100) {
        return readabilityContent;
      }
    }

    // 3. 일반 셀렉터로 폴백
    const fallbackContent = extractWithFallbackSelectors(html, config);
    if (fallbackContent) {
      return fallbackContent;
    }

    // 4. 최후의 수단: body 텍스트
    return extractBodyText(html);
  } catch (error) {
    console.error('[ContentExtractor] Error:', error);
    return '';
  }
}

/**
 * 커스텀 셀렉터로 본문 추출
 */
function extractWithSelector(html: string, config: ContentSelectors): string {
  if (!config.content) return '';

  const $ = cheerio.load(html);

  // 제거할 요소 삭제
  const removeSelectors = config.removeSelectors || DEFAULT_REMOVE_SELECTORS;
  removeSelectors.forEach((selector) => {
    $(selector).remove();
  });

  const $content = $(config.content);
  if ($content.length === 0) return '';

  if (config.contentType === 'html') {
    return $content.html() || '';
  }

  return cleanText($content.text());
}

/**
 * Readability로 본문 추출
 */
function extractWithReadability(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article?.textContent) {
      return cleanText(article.textContent);
    }
  } catch (error) {
    console.error('[ContentExtractor] Readability error:', error);
  }

  return '';
}

/**
 * 폴백 셀렉터로 본문 추출
 */
function extractWithFallbackSelectors(
  html: string,
  config?: ContentSelectors
): string {
  const $ = cheerio.load(html);

  // 제거할 요소 삭제
  const removeSelectors = config?.removeSelectors || DEFAULT_REMOVE_SELECTORS;
  removeSelectors.forEach((selector) => {
    $(selector).remove();
  });

  // 우선순위 순으로 셀렉터 시도
  for (const selector of DEFAULT_CONTENT_SELECTORS) {
    const $content = $(selector);
    if ($content.length > 0) {
      const text = cleanText($content.first().text());
      if (text.length > 100) {
        return text;
      }
    }
  }

  return '';
}

/**
 * body 전체 텍스트 추출 (최후의 수단)
 */
function extractBodyText(html: string): string {
  const $ = cheerio.load(html);

  // 불필요한 요소 제거
  DEFAULT_REMOVE_SELECTORS.forEach((selector) => {
    $(selector).remove();
  });

  return cleanText($('body').text());
}

/**
 * 텍스트 정리
 * - 연속 공백 제거
 * - 앞뒤 공백 제거
 * - 빈 줄 정리
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // 연속 공백을 단일 공백으로
    .replace(/\n\s*\n/g, '\n') // 빈 줄 제거
    .trim();
}

/**
 * 본문 미리보기 생성 (최대 500자)
 */
export function generatePreview(content: string, maxLength: number = 500): string {
  const cleaned = cleanText(content);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // 문장 단위로 자르기 시도
  const truncated = cleaned.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclaim = truncated.lastIndexOf('!');

  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);

  if (lastSentenceEnd > maxLength * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  // 단어 단위로 자르기
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * HTML에서 텍스트만 추출 (cheerio 기반)
 */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  DEFAULT_REMOVE_SELECTORS.forEach((selector) => {
    $(selector).remove();
  });
  return cleanText($('body').text() || $.text());
}

/**
 * 메타데이터 추출 (og:image, description 등)
 */
export interface PageMetadata {
  title?: string;
  description?: string;
  ogImage?: string;
  author?: string;
  publishedTime?: string;
}

export function extractMetadata(html: string): PageMetadata {
  const $ = cheerio.load(html);

  return {
    title:
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="title"]').attr('content') ||
      $('title').text() ||
      undefined,
    description:
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      undefined,
    ogImage:
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      undefined,
    author:
      $('meta[name="author"]').attr('content') ||
      $('meta[property="article:author"]').attr('content') ||
      undefined,
    publishedTime:
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="pubdate"]').attr('content') ||
      $('time[datetime]').attr('datetime') ||
      undefined,
  };
}
