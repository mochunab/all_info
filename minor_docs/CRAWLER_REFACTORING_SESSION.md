# 크롤링 시스템 리팩토링 세션 요약

## 세션 배경

**작업 일자**: 2026-02-15
**목표**: 크롤링 시스템의 네비게이션 메뉴 오탐 문제 해결 및 하이브리드 자동 복구 시스템 구현

### 원래 계획 vs 실제 구현

#### ❌ 원래 계획 (Phase 1-1: 레거시 크롤러 부활)
- WiseApp, RetailTalk 등 7개 사이트별 하드코딩 크롤러 부활
- **구현하지 않음** — 사용자가 명시적으로 거부

#### ✅ 실제 구현 방향
사용자 피드백:
> "레거시 크롤링은 부활 하면 안돼. 이건 B2B 제품이야. 고객사가 원하는 임의의 콘텐츠 리스트 페이지 URL을 입력하면 자동으로 크롤링하는게 목표야."

**변경된 접근**: 범용 크롤러 + 하이브리드 자동 복구 시스템
- 소스 저장 시: 8단계 파이프라인 1회 실행 → config 저장
- 크롤링 시: 저장된 config 사용 → 품질 검증 실패 시 자동 재분석 → config 업데이트

---

## 구현한 주요 변경사항

### 1. Bug Fix: Nav/Header/Footer 필터링 추가
**파일**: `lib/crawlers/auto-detect.ts`

**문제**: 전체 DOM에서 패턴 매칭 → `<nav>` 내 메뉴가 아티클 목록으로 오탐

**해결**:
```typescript
export function detectByRules($: cheerio.CheerioAPI, url: string): SelectorCandidate | null {
  // nav/header/footer 제거한 클론으로 분석
  const $clean = cheerio.load($.html());
  $clean('nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  const candidates: SelectorCandidate[] = [];
  detectTableStructure($clean, url, candidates);
  detectListStructure($clean, url, candidates);
  detectRepeatingElements($clean, url, candidates);
  // ...
}
```

---

### 2. Bug Fix: RSS Discovery 루프 버그 수정
**파일**: `lib/crawlers/strategy-resolver.ts`

**문제**: for 루프에서 첫 번째 항목만 반환 → `/feed`만 확인, `/rss`, `/feed.xml` 등 미검증

**해결**:
```typescript
async function discoverRSS(url: string, $: cheerio.CheerioAPI): Promise<string | null> {
  // 1. HTML 링크 확인
  const rssLink = $('link[type*="rss"], link[type*="atom"]').attr('href');
  if (rssLink) {
    const rssUrl = normalizeUrl(rssLink, url);
    const isValid = await validateRSSFeed(rssUrl);
    if (isValid) return rssUrl;
  }

  // 2. 각 경로를 실제 검증 후 반환 (기존: 즉시 return으로 루프 중단)
  for (const path of commonRssPaths) {
    const rssUrl = normalizeUrl(path, url);
    const isValid = await validateRSSFeed(rssUrl);
    if (isValid) return rssUrl;
  }
  return null;
}
```

---

### 3. 하이브리드 자동 복구 시스템 구현
**파일**: `lib/crawlers/index.ts`

**개념**: "저장 시 1회 분석 → 크롤링 시 재사용 → 실패 시 자동 재분석"

#### 3-1. updateSourceConfig() 함수 추가
```typescript
async function updateSourceConfig(
  sourceId: number,
  newConfig: {
    crawlerType: CrawlerType;
    selectors?: SelectorConfig;
    pagination?: PaginationConfig;
    detection: DetectionMetadata;
  }
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('crawl_sources')
    .update({
      crawler_type: newConfig.crawlerType,
      config: {
        selectors: newConfig.selectors,
        pagination: newConfig.pagination,
        _detection: newConfig.detection,
      },
    })
    .eq('id', sourceId);

  if (error) throw error;
  console.log(`[Auto-Recovery] Updated source config: ${newConfig.crawlerType}`);
}
```

#### 3-2. crawlWithStrategy() 품질 검증 로직 추가
```typescript
// Fallback 체인 실패 시 자동 재분석
if (i === strategyChain.length - 1 && validation.stats && validation.stats.garbageRatio > 0.5) {
  console.log(`[Auto-Recovery] Quality failure detected (garbage: ${validation.stats.garbageRatio.toFixed(2)})`);

  const { resolveStrategy } = await import('./strategy-resolver');
  const newStrategy = await resolveStrategy(source.base_url);

  if (newStrategy.confidence > 0.6) {
    await updateSourceConfig(source.id, {
      crawlerType: newStrategy.primaryStrategy,
      selectors: newStrategy.selectors || undefined,
      pagination: newStrategy.pagination || undefined,
      detection: {
        method: 'auto-recovery',
        confidence: newStrategy.confidence,
        fallbackStrategies: newStrategy.fallbackStrategies,
      },
    });

    // 새 config로 재크롤링
    const updatedSource = { ...source, crawler_type: newStrategy.primaryStrategy };
    const retryStrategy = getStrategy(newStrategy.primaryStrategy);
    const retryItems = await retryStrategy.crawlList(updatedSource);
    const retryValidation = await validateQuality(retryItems);

    if (retryValidation.isValid) {
      console.log(`[Auto-Recovery] Retry successful with ${newStrategy.primaryStrategy}`);
      return { items: retryItems, validation: retryValidation };
    }
  }
}
```

---

### 4. FIRECRAWL 기본 Fallback에서 제거
**파일**: `lib/crawlers/index.ts`, `strategy-resolver.ts`

**이유**: Firecrawl은 LLM 기반 추출로 Hallucination 위험 존재 (테스트에서 가짜 URL/제목 생성 확인)

**변경**:
```typescript
function getDefaultFallbacks(primaryType: CrawlerType): CrawlerType[] {
  switch (primaryType) {
    case 'RSS':       return ['STATIC'];
    case 'SPA':       return ['STATIC'];
    case 'STATIC':    return [];
    case 'FIRECRAWL': return ['STATIC'];  // FIRECRAWL만 STATIC fallback
    case 'API':       return ['STATIC'];
    default:          return ['STATIC'];
  }
}

// resolveStrategyV2() 기본값 변경: 'FIRECRAWL' → 'STATIC'
```

---

### 5. Vercel 호환성: puppeteer → puppeteer-core 교체
**파일**: `package.json`, `lib/crawlers/strategies/spa.ts`, `next.config.mjs`

#### 5-1. 패키지 변경
```bash
# 제거
@mendable/firecrawl-js
puppeteer

# 추가
puppeteer-core@^24.34.0
@sparticuz/chromium@^143.0.4
```

#### 5-2. SPA 크롤러 Vercel 환경 감지
```typescript
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

    if (isVercel) {
      // Vercel Serverless: @sparticuz/chromium
      browserInstance = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // 로컬: 시스템 Chrome
      browserInstance = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }
  return browserInstance;
}
```

#### 5-3. next.config.mjs 설정
```typescript
experimental: {
  serverComponentsExternalPackages: ['@sparticuz/chromium'],
}
```

---

### 6. TypeScript 타입 수정
**파일**: `types/index.ts`, `lib/crawlers/types.ts`

#### 6-1. FIRECRAWL 타입 추가
```typescript
// types/index.ts — CrawlerType 유니온에 추가
| 'FIRECRAWL'
```

#### 6-2. detectionMethod 타입 확장
```typescript
// lib/crawlers/types.ts
detectionMethod:
  | 'domain-override'
  | 'rss-discovery'
  | 'url-pattern'
  | 'cms-detection'
  | 'rule-analysis'
  | 'ai-type-detection'
  | 'ai-selector-detection'
  | 'spa-detection'
  | 'auto-recovery'  // 추가
  | 'firecrawl'
  | 'default'
  | 'error';
```

---

## 해결한 빌드 에러 목록

| 에러 | 원인 | 해결 |
|------|------|------|
| @sparticuz/chromium 버전 없음 | ^131.0.2 존재하지 않음 | ^143.0.4로 변경 |
| serverExternalPackages 경고 | 잘못된 설정 | experimental.serverComponentsExternalPackages로 변경 |
| FIRECRAWL 타입 없음 | types/index.ts 누락 | CrawlerType 유니온에 추가 |
| detectionMethod 타입 오류 | 'spa-detection', 'auto-recovery' 누락 | StrategyResolution 타입 확장 |
| finalMethod 타입 불일치 | 리터럴 타입 불일치 | `as StrategyResolution['detectionMethod']` 캐스팅 |
| chromium.defaultViewport 없음 | API 변경 | `defaultViewport: null` 사용 |
| category 상태 리터럴 타입 | useState 타입 추론 오류 | `useState<string>('비즈니스')` 명시 |
| Supabase 타입 오류 | DB 결과 타입 추론 실패 | `// eslint-disable-next-line @typescript-eslint/no-explicit-any` + any 캐스팅 |

**결과**: 빌드 성공 ✅

---

## ⚠️ 현재 문제 상황

사용자 피드백:
> "지금 여전히 이상하게 크롤링해와."

**문제**:
- 모든 버그 수정 및 빌드 에러 해결했지만 실제 크롤링 결과가 여전히 비정상적
- 네비게이션 메뉴 오탐 문제가 해결되지 않았거나 다른 문제가 존재

**원인 후보**:
1. Nav 필터링 코드가 실제로 실행되지 않음
2. 다른 셀렉터 탐지 로직에 문제
3. 자동 복구 시스템이 트리거되지 않음
4. RSS 루프 수정이 작동하지 않음
5. 알려지지 않은 다른 버그

---

## 다음 세션 작업 계획

### 1단계: 문제 진단 (최우선)

#### 로컬 테스트로 실제 크롤링 동작 확인
```bash
# 모든 소스 Dry-run 테스트 (DB 저장 없이 로그만)
npm run crawl:dry -- --verbose

# 특정 소스만 테스트 (RetailTalk, WiseApp 등)
npm run crawl:dry -- --source=<id> --verbose
```

#### 확인 사항:
- [ ] 어떤 소스에서 문제가 발생하는가?
- [ ] "SKIP (garbage)" 로그가 여전히 나타나는가?
- [ ] Nav 필터링 로그 `"nav/header/footer 제거 후 분석"` 출력되는가?
- [ ] 자동 복구 로그 `"[Auto-Recovery] Quality failure detected"` 출력되는가?
- [ ] 실제 추출된 제목이 네비게이션 메뉴인가, 실제 아티클인가?
- [ ] detectByRules()가 실행되는가, 아니면 다른 감지 방법이 사용되는가?

### 2단계: 코드 검증

#### Nav 필터링 작동 확인
```typescript
// auto-detect.ts에서 디버깅 로그 추가
const $clean = cheerio.load($.html());
const navCount = $clean('nav, header, footer').length;
console.log(`[DEBUG] Removing ${navCount} nav/header/footer elements`);
$clean('nav, header, footer, aside, [role="navigation"]').remove();
const afterCount = $clean('nav, header, footer').length;
console.log(`[DEBUG] After removal: ${afterCount} (should be 0)`);
```

#### 자동 복구 트리거 확인
```typescript
// index.ts의 crawlWithStrategy()에서
console.log(`[DEBUG] Garbage ratio: ${validation.stats?.garbageRatio}`);
console.log(`[DEBUG] Is last strategy: ${i === strategyChain.length - 1}`);
console.log(`[DEBUG] Should trigger auto-recovery: ${validation.stats?.garbageRatio > 0.5}`);
```

### 3단계: 근본 원인 파악 후 수정

#### 시나리오 A: Nav 필터링이 실행되지 않음
- detectByRules() 호출 경로 확인
- 다른 감지 방법(AI, URL 패턴)이 우선 실행되는지 확인

#### 시나리오 B: 필터링은 되지만 다른 셀렉터가 오탐
- detectListStructure(), detectRepeatingElements() 로직 검토
- 실제 HTML 구조 분석하여 셀렉터 패턴 확인

#### 시나리오 C: Fallback 체인 문제
- 자동 복구가 트리거되지 않는 이유 확인
- garbageRatio 계산 로직 검증

### 4단계: 검증 및 배포

```bash
# 로컬 테스트
npm run crawl:dry -- --verbose

# 성공 시 실제 크롤링
npm run crawl

# Vercel 배포
git push origin main

# 프로덕션 크롤링 테스트
# "자료 불러오기" 버튼 클릭 → 결과 확인
```

---

## 참고: 구현된 파일 목록

### 수정된 파일
- `lib/crawlers/auto-detect.ts` — Nav 필터링
- `lib/crawlers/strategy-resolver.ts` — RSS 루프 수정, STATIC 기본값
- `lib/crawlers/index.ts` — 하이브리드 자동 복구 시스템, updateSourceConfig()
- `lib/crawlers/strategies/spa.ts` — puppeteer-core 마이그레이션
- `lib/crawlers/types.ts` — detectionMethod 타입 확장
- `types/index.ts` — FIRECRAWL 타입 추가
- `package.json` — 패키지 교체
- `next.config.mjs` — serverComponentsExternalPackages 설정

### Lint/Type 수정 파일
- `app/page.tsx` — category 상태 타입 명시
- `lib/crawlers/firecrawl-client.ts`, `strategies/firecrawl.ts` — import 경로 수정
- `lib/ai/batch-summarizer.ts`, `lib/supabase/server.ts` — any 캐스팅

---

## 중요 포인트

### ✅ 올바른 방향
1. **B2B 범용성**: 레거시 크롤러 부활 대신 자동 감지 + 자동 복구
2. **비용 최적화**: FIRECRAWL 제거, Rule-based 우선
3. **Vercel 호환**: puppeteer-core로 Serverless 환경 대응
4. **투명성**: config._detection에 감지 방법, 신뢰도 저장

### ⚠️ 미해결 문제
- **크롤링 결과가 여전히 비정상** — 디버깅 필요
- 네비게이션 메뉴 오탐이 계속되는지 확인 필요
- 자동 복구 시스템이 실제로 작동하는지 검증 필요

---

## 다음 세션 시작 시 체크리스트

- [ ] `npm run crawl:dry -- --verbose` 실행하여 로그 확인
- [ ] 문제 소스 식별 (RetailTalk, WiseApp 등)
- [ ] Nav 필터링 디버깅 로그 추가
- [ ] 자동 복구 트리거 여부 확인
- [ ] 실제 추출된 아티클 제목 확인 (네비게이션 vs 실제 콘텐츠)
- [ ] 근본 원인 파악 후 수정
- [ ] 테스트 → 배포 → 검증

---

**작성 일자**: 2026-02-15
**다음 작업**: 로컬 Dry-run 테스트로 실제 크롤링 동작 디버깅
