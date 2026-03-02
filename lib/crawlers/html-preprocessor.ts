// Cheerio 기반 HTML 전처리 — LLM 아티클 추출 전송용

import * as cheerio from 'cheerio';

const MAX_OUTPUT_BYTES = 30000;
const MIN_TEXT_THRESHOLD = 500;

/**
 * LLM에 보내기 전 HTML에서 불필요 요소를 제거하고 크기를 제한
 */
export function preprocessHtmlForExtraction(html: string): string {
  const result = aggressivePreprocess(html);

  // 안전장치: 너무 적은 텍스트 → 가벼운 전처리로 재시도
  const textLength = cheerio.load(result).text().replace(/\s+/g, ' ').trim().length;
  if (textLength < MIN_TEXT_THRESHOLD) {
    return lightPreprocess(html);
  }

  return result;
}

function aggressivePreprocess(html: string): string {
  const $ = cheerio.load(html);

  // 구조적 요소 제거
  $('head, nav, aside, footer, header, iframe, noscript, svg, [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"]').remove();

  // 모달/다이얼로그/숨김 요소 제거 (LLM에 불필요한 boilerplate)
  $('[role="dialog"], [aria-modal="true"]').remove();
  $('[id*="modal"], [id*="Modal"], [class*="modal"], [class*="Modal"]').remove();
  $('[style*="display: none"], [style*="display:none"]').remove();

  // 폼/구독/인증 영역 제거
  $('form').remove();
  $('[id*="subscribe"], [class*="subscribe"]').remove();
  $('[id*="login"], [class*="login"]').remove();

  // script/style 제거
  $('script, style').remove();

  // sidebar/widget/banner/ad 관련 요소 제거
  $('[id*="sidebar"], [id*="side-"], [class*="sidebar"], [class*="side-bar"]').remove();
  $('[id*="widget"], [class*="widget"]').remove();
  $('[id*="banner"], [class*="banner"]').remove();
  $('[id*="advertisement"], [class*="advertisement"], [class*="ad-"], [id*="ad-"]').remove();

  // 빈 텍스트 노드 정리
  let output = $.html().replace(/\n{3,}/g, '\n\n').trim();

  if (output.length > MAX_OUTPUT_BYTES) {
    output = output.substring(0, MAX_OUTPUT_BYTES);
  }

  return output;
}

function lightPreprocess(html: string): string {
  const $ = cheerio.load(html);

  $('head, script, style, iframe, noscript, svg').remove();

  let output = $.html().replace(/\n{3,}/g, '\n\n').trim();

  if (output.length > MAX_OUTPUT_BYTES) {
    output = output.substring(0, MAX_OUTPUT_BYTES);
  }

  return output;
}
