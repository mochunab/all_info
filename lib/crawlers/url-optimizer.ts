// URL 최적화: 더 나은 크롤링 대상 URL 자동 발견
// Rule-based → HTML Discovery → AI Fallback

import * as cheerio from 'cheerio';
import { fetchPage } from './auto-detect';

type UrlOptimizationResult = {
  originalUrl: string;
  optimizedUrl: string;
  reason: string;
  confidence: number;
  method: 'rule-domain' | 'rule-path' | 'html-discovery' | 'ai-suggestion' | 'no-change';
};

/**
 * URL을 분석하여 더 나은 크롤링 대상 URL 찾기
 */
export async function optimizeUrl(url: string): Promise<UrlOptimizationResult> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 [URL 최적화] 크롤링 최적화 URL 탐색 시작`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📍 원본 URL: ${url}`);

  try {
    // 1. Rule-based: 도메인별 매핑 (최우선)
    console.log(`\n📋 [1단계] Rule-based 도메인 매핑 확인...`);
    const domainResult = await optimizeByDomain(url);
    if (domainResult) {
      console.log(`   ✅ 도메인 매핑 발견!`);
      console.log(`   📍 최적화 URL: ${domainResult.optimizedUrl}`);
      console.log(`   💡 사유: ${domainResult.reason}`);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✨ [URL 최적화 완료] ${domainResult.method}`);
      console.log(`   원본: ${domainResult.originalUrl}`);
      console.log(`   최적: ${domainResult.optimizedUrl}`);
      console.log(`${'='.repeat(80)}\n`);
      return domainResult;
    }
    console.log(`   ⏭️  도메인 매핑 없음`);

    // 2. Rule-based: 일반 경로 패턴 시도
    console.log(`\n🔗 [2단계] Rule-based 경로 패턴 탐색...`);
    const pathResult = await optimizeByPath(url);
    if (pathResult) {
      console.log(`   ✅ 크롤링 가능 경로 발견!`);
      console.log(`   📍 최적화 URL: ${pathResult.optimizedUrl}`);
      console.log(`   💡 사유: ${pathResult.reason}`);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✨ [URL 최적화 완료] ${pathResult.method}`);
      console.log(`   원본: ${pathResult.originalUrl}`);
      console.log(`   최적: ${pathResult.optimizedUrl}`);
      console.log(`${'='.repeat(80)}\n`);
      return pathResult;
    }
    console.log(`   ⏭️  경로 패턴 없음`);

    // 3. HTML Discovery: 페이지 분석하여 링크 추출
    console.log(`\n🌐 [3단계] HTML 페이지 분석 (링크 발견)...`);
    const discoveryResult = await discoverFromHtml(url);
    if (discoveryResult) {
      console.log(`   ✅ HTML 분석으로 링크 발견!`);
      console.log(`   📍 최적화 URL: ${discoveryResult.optimizedUrl}`);
      console.log(`   💡 사유: ${discoveryResult.reason}`);
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✨ [URL 최적화 완료] ${discoveryResult.method}`);
      console.log(`   원본: ${discoveryResult.originalUrl}`);
      console.log(`   최적: ${discoveryResult.optimizedUrl}`);
      console.log(`${'='.repeat(80)}\n`);
      return discoveryResult;
    }
    console.log(`   ⏭️  HTML 분석 실패`);

    // 4. 최적화 불가 - 원본 URL 사용
    console.log(`\n⚠️  [알림] 최적화 가능한 URL을 찾지 못했습니다`);
    console.log(`   🔄 원본 URL 그대로 사용`);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`✨ [URL 최적화 완료] no-change`);
    console.log(`   URL: ${url}`);
    console.log(`${'='.repeat(80)}\n`);

    return {
      originalUrl: url,
      optimizedUrl: url,
      reason: '최적화 불필요',
      confidence: 1.0,
      method: 'no-change',
    };
  } catch (error) {
    console.error(`[URL 최적화] 오류 발생:`, error);
    return {
      originalUrl: url,
      optimizedUrl: url,
      reason: '최적화 실패',
      confidence: 1.0,
      method: 'no-change',
    };
  }
}

/**
 * 1단계: 도메인별 매핑 (Rule-based)
 */
async function optimizeByDomain(url: string): Promise<UrlOptimizationResult | null> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();

  // 도메인별 매핑 규칙
  const domainMappings: Record<string, { subdomain: string; reason: string }> = {
    // 'www.surfit.io': {
    //   subdomain: 'directory.surfit.io',
    //   reason: '서핏 콘텐츠 디렉토리 (크롤링 최적화)',
    // },
    // 'surfit.io': {
    //   subdomain: 'directory.surfit.io',
    //   reason: '서핏 콘텐츠 디렉토리 (크롤링 최적화)',
    // },
    // 추가 매핑 규칙을 여기에 등록
    // 'example.com': { subdomain: 'blog.example.com', reason: '...' },
  };

  const mapping = domainMappings[hostname];
  if (!mapping) {
    return null;
  }

  // 매핑된 도메인으로 URL 재구성
  const optimizedUrl = `${urlObj.protocol}//${mapping.subdomain}${urlObj.pathname}${urlObj.search}`;

  // 도메인 매핑은 수동으로 설정한 규칙이므로 validation 불필요
  // (HEAD 요청이 실패할 수 있어서 제거)
  console.log(`   ✅ 도메인 매핑 규칙 적용 (validation skip)`);

  return {
    originalUrl: url,
    optimizedUrl,
    reason: mapping.reason,
    confidence: 0.95,
    method: 'rule-domain',
  };
}

/**
 * 2단계: 경로 패턴 탐색 (Rule-based)
 */
async function optimizeByPath(url: string): Promise<UrlOptimizationResult | null> {
  const urlObj = new URL(url);

  // 메인 페이지(/, /index.html 등)인지 확인
  const isMainPage = ['/', '/index.html', '/index.htm', '/index.php'].includes(
    urlObj.pathname.toLowerCase()
  );

  if (!isMainPage) {
    return null; // 이미 특정 경로면 최적화 불필요
  }

  // 시도할 경로 패턴 (우선순위 순)
  const pathPatterns = [
    { path: '/feed', reason: 'RSS 피드 경로' },
    { path: '/rss', reason: 'RSS 피드 경로' },
    { path: '/blog', reason: '블로그 콘텐츠' },
    { path: '/articles', reason: '아티클 목록' },
    { path: '/news', reason: '뉴스 목록' },
    { path: '/posts', reason: '포스트 목록' },
    { path: '/archive', reason: '아카이브' },
  ];

  console.log(`   🔍 ${pathPatterns.length}개 경로 패턴 시도...`);

  for (const pattern of pathPatterns) {
    const testUrl = `${urlObj.origin}${pattern.path}`;
    console.log(`      • 시도: ${testUrl}`);

    const isValid = await validateUrl(testUrl);
    if (isValid) {
      console.log(`      ✅ 발견: ${testUrl}`);
      return {
        originalUrl: url,
        optimizedUrl: testUrl,
        reason: pattern.reason,
        confidence: 0.8,
        method: 'rule-path',
      };
    }
  }

  return null;
}

/**
 * 3단계: HTML 분석하여 링크 발견
 */
async function discoverFromHtml(url: string): Promise<UrlOptimizationResult | null> {
  const html = await fetchPage(url);
  if (!html) {
    return null;
  }

  const $ = cheerio.load(html);
  const urlObj = new URL(url);

  // 1. RSS/Atom 링크 확인
  const rssLink = $(
    'link[type="application/rss+xml"], link[type="application/atom+xml"]'
  ).first();
  if (rssLink.length > 0) {
    const href = rssLink.attr('href');
    if (href) {
      const rssUrl = normalizeUrl(href, url);
      console.log(`   🔍 RSS 링크 발견: ${rssUrl}`);
      return {
        originalUrl: url,
        optimizedUrl: rssUrl,
        reason: 'RSS 피드 (자동 발견)',
        confidence: 0.9,
        method: 'html-discovery',
      };
    }
  }

  // 2. 네비게이션 메뉴에서 블로그/아티클 링크 찾기
  const navLinks = $('nav a, header a, .menu a, .navigation a');
  const keywords = ['blog', 'article', 'news', 'post', '블로그', '아티클', '뉴스', '콘텐츠'];

  for (const el of navLinks.toArray()) {
    const linkEl = $(el);
    const text = linkEl.text().toLowerCase().trim();
    const href = linkEl.attr('href');

    if (!href) continue;

    // 키워드 매칭
    const hasKeyword = keywords.some((keyword) => text.includes(keyword.toLowerCase()));
    if (hasKeyword) {
      const linkUrl = normalizeUrl(href, url);

      // 같은 도메인인지 확인
      try {
        const linkUrlObj = new URL(linkUrl);
        if (linkUrlObj.hostname !== urlObj.hostname) {
          continue; // 외부 링크는 제외
        }
      } catch {
        continue;
      }

      console.log(`   🔍 네비게이션 링크 발견: ${linkUrl} (텍스트: ${text})`);

      const isValid = await validateUrl(linkUrl);
      if (isValid) {
        return {
          originalUrl: url,
          optimizedUrl: linkUrl,
          reason: `네비게이션 메뉴 "${text}" 링크`,
          confidence: 0.75,
          method: 'html-discovery',
        };
      }
    }
  }

  return null;
}

/**
 * URL 유효성 검증 (HEAD 요청)
 */
async function validateUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    return response.ok; // 200-299
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 상대 URL을 절대 URL로 정규화
 */
function normalizeUrl(href: string, baseUrl: string): string {
  try {
    if (href.startsWith('http')) {
      return href;
    }
    if (href.startsWith('//')) {
      return `https:${href}`;
    }

    const base = new URL(baseUrl);
    const resolved = new URL(href, base.origin);
    return resolved.toString();
  } catch {
    return href;
  }
}
