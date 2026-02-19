# AI 기반 셀렉터 탐지 통합 계획

## 📋 작업 개요
소스 저장 시 AI 기반으로 콘텐츠 영역 셀렉터를 1회 탐지하고, 이후 크롤링은 저장된 셀렉터로 룰베이스 실행하는 시스템 구축

## ✅ 완료된 작업

### 1. 제목 필터링 시스템 (완료)
- **파일**: `/lib/crawlers/title-cleaner.ts`
- **기능**:
  - UI 레이블/메타데이터 필터링 (35+ 패턴)
  - 한글/영어/일본어/중국어 다국어 지원
  - "순위", "인사이트", "분석" 등 짧은 UI 텍스트 제거
- **적용**: 모든 크롤러 전략 (RSS, SPA, STATIC, API, KAKAO, NAVER, NEWSLETTER)에 통합 완료

### 2. AI 셀렉터 탐지 함수 구현 (완료)
- **파일**: `/lib/crawlers/infer-type.ts`
- **함수**: `detectContentSelectors(url: string, html?: string): Promise<SelectorDetectionResult>`
- **3단계 탐지 방식**:
  1. **Semantic HTML 탐지** (무료, 빠름)
     - `<main>`, `<article>`, `[role="main"]` 등 시맨틱 태그 우선 확인
  2. **AI 탐지** (OpenAI GPT-4o-mini)
     - HTML 구조 분석하여 콘텐츠 영역 CSS 셀렉터 반환
     - 제외할 네비게이션/UI 영역도 함께 탐지
  3. **Fallback 제네릭 셀렉터**
     - 모든 탐지 실패 시 기본 셀렉터 사용

### 3. strategy-resolver.ts 임포트 추가 (완료)
- `detectContentSelectors` 함수 임포트 완료
- 다음 단계: 실제 파이프라인 통합 필요

## 🚧 진행 중 작업

### strategy-resolver.ts 통합 (중단됨)
**현재 상태**: 임포트만 추가됨, 실제 로직 통합 안됨

**통합 위치**: Stage 8 (AI 셀렉터 분석) 교체
- **현재**: `detectByAI()` 사용 (auto-detect.ts)
- **변경**: `detectContentSelectors()` 사용 (infer-type.ts)

## 📝 다음 세션 작업 계획

### 1단계: strategy-resolver.ts Stage 8 교체
**파일**: `/lib/crawlers/strategy-resolver.ts`
**위치**: 라인 311-358 (현재 AI 셀렉터 탐지 부분)

**변경 내용**:
```typescript
// 8. AI 셀렉터 탐지 (새로운 3단계 방식)
console.log(`\n🔍 [8단계/9단계] AI 기반 콘텐츠 셀렉터 탐지 (3단계 방식)`);
console.log(`   🎯 1단계: Semantic HTML (무료, 빠름)`);
console.log(`   🎯 2단계: AI 분석 (GPT-4o-mini)`);
console.log(`   🎯 3단계: Fallback 제네릭 셀렉터`);

const selectorStartTime = Date.now();
const selectorResult = await detectContentSelectors(url, html);
const selectorDuration = Date.now() - selectorStartTime;

if (selectorResult && selectorResult.confidence >= 0.6) {
  const confidencePercent = (selectorResult.confidence * 100).toFixed(0);
  console.log(`   ✅ 셀렉터 탐지 성공!`);
  console.log(`   ⏱️  소요시간: ${selectorDuration}ms`);
  console.log(`   📊 신뢰도: ${confidencePercent}%`);
  console.log(`   🔧 탐지 방법: ${selectorResult.method}`);
  console.log(`   💡 판단 근거: ${selectorResult.reasoning || 'N/A'}`);
  console.log(`\n   📝 탐지된 CSS 셀렉터:`);
  console.log(`      • container: ${selectorResult.selectors.container || 'N/A'}`);
  console.log(`      • item: ${selectorResult.selectors.item}`);
  console.log(`      • title: ${selectorResult.selectors.title}`);
  console.log(`      • link: ${selectorResult.selectors.link}`);
  if (selectorResult.selectors.date) console.log(`      • date: ${selectorResult.selectors.date}`);
  if (selectorResult.selectors.thumbnail) console.log(`      • thumbnail: ${selectorResult.selectors.thumbnail}`);
  if (selectorResult.excludeSelectors?.length) {
    console.log(`\n   🚫 제외 셀렉터 (네비게이션/UI):`);
    selectorResult.excludeSelectors.forEach(sel => console.log(`      • ${sel}`));
  }

  const finalType = preliminaryType || 'STATIC';
  const finalConfidence = preliminaryType ? preliminaryConfidence : selectorResult.confidence;
  const finalMethod = (preliminaryType ? preliminaryMethod : 'ai-content-detection') as StrategyResolution['detectionMethod'];

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✨ [전략 결정] ${finalType} - ${selectorResult.method} 기반 셀렉터`);
  console.log(`   📊 신뢰도: ${(finalConfidence * 100).toFixed(0)}%`);
  console.log(`   🤖 탐지 방법: ${selectorResult.method}`);
  console.log(`   🔧 셀렉터: ${selectorResult.method} 자동 탐지`);
  console.log(`   🔄 대체 전략: ${getDefaultFallbacks(finalType).join(' → ')}`);
  console.log(`${'='.repeat(80)}\n`);

  return {
    primaryStrategy: finalType,
    fallbackStrategies: getDefaultFallbacks(finalType),
    rssUrl: null,
    selectors: selectorResult.selectors,
    excludeSelectors: selectorResult.excludeSelectors,
    pagination: null,
    confidence: finalConfidence,
    detectionMethod: finalMethod,
    spaDetected: finalType === 'SPA',
    optimizedUrl,
  };
}
```

### 2단계: StrategyResolution 타입 업데이트
**파일**: `/lib/crawlers/types.ts`
**추가 필드**: `excludeSelectors?: string[]`

### 3단계: 크롤러 전략에서 excludeSelectors 사용
- STATIC, SPA 크롤러에서 `excludeSelectors` 적용하여 네비게이션 제외
- Cheerio의 `.not()` 메서드로 제외 영역 필터링

### 4단계: 테스트 & 검증
1. **wiseapp.co.kr/insight/** 테스트
   - 셀렉터 탐지 확인
   - 콘텐츠만 크롤링되는지 검증
   - UI 레이블 제외 확인

2. **retailtalk.co.kr** 재테스트
   - 제목 필터링 정상 작동 확인

3. **일반 블로그/뉴스 사이트** 테스트
   - Semantic HTML 경로 검증
   - AI fallback 동작 확인

## 🔧 기술적 세부사항

### detectContentSelectors() 반환 타입
```typescript
type SelectorDetectionResult = {
  selectors: {
    container?: string;
    item: string;
    title: string;
    link: string;
    date?: string;
    thumbnail?: string;
  };
  excludeSelectors?: string[];  // 네비게이션/UI 제외용
  confidence: number;
  method: 'ai' | 'semantic' | 'fallback';
  reasoning?: string;
};
```

### OpenAI 프롬프트 구조 (infer-type.ts 참고)
- HTML 구조 분석
- 콘텐츠 영역 vs UI 영역 구분
- CSS 셀렉터 정확도 우선
- 한글 사이트 대응

### 비용 최적화 전략
1. **Semantic HTML 우선** (무료) → 대부분의 표준 블로그/뉴스
2. **AI 탐지** (유료, ~$0.001) → 복잡한 구조
3. **Fallback** (무료) → 탐지 실패 시

## 🎯 최종 목표

### Before (현재 문제)
- wiseapp 같은 사이트에서 UI 레이블("인사이트", "순위" 등) 크롤링
- FIRECRAWL 타입 잘못 할당
- 콘텐츠와 네비게이션 구분 안됨

### After (목표)
- **소스 저장 시**: AI가 콘텐츠 영역 셀렉터 1회 탐지 → config.selectors에 저장
- **크롤링 실행 시**: 저장된 셀렉터로 룰베이스 크롤링 (비용 0)
- **결과**: 콘텐츠만 정확히 크롤링, UI/네비게이션 제외

## 📌 주요 파일 경로

```
/lib/crawlers/
├── infer-type.ts           # detectContentSelectors() 구현 완료 ✅
├── strategy-resolver.ts    # Stage 8 통합 필요 🚧
├── title-cleaner.ts        # 제목 필터링 완료 ✅
├── types.ts                # excludeSelectors 필드 추가 필요 🚧
└── strategies/
    ├── static.ts           # excludeSelectors 적용 필요 🚧
    └── spa.ts              # excludeSelectors 적용 필요 🚧

/app/api/sources/route.ts   # 이미 config.selectors 저장 처리 있음 ✅
```

## 💡 추가 고려사항

### 1. 재탐지 메커니즘
- 페이지 구조 변경 시 셀렉터 무효화 탐지
- 크롤링 실패율 임계값 설정 (예: 3회 연속 실패 시 재탐지)

### 2. 셀렉터 검증
- 소스 저장 전 테스트 크롤링 실행
- 최소 아이템 개수 검증 (예: 2개 이상)

### 3. 로깅 개선
- 셀렉터 탐지 과정 상세 로그 (이미 대부분 구현됨)
- 크롤링 실행 시 저장된 셀렉터 사용 여부 로그

## 🚀 다음 세션 시작 시

```bash
# 1. 작업 파일 열기
code /Users/hangyeol/인사이트허브_크롤링/insight-hub/lib/crawlers/strategy-resolver.ts

# 2. Stage 8 (라인 311-358) 찾아서 위 코드로 교체

# 3. types.ts에 excludeSelectors 필드 추가

# 4. 테스트
pnpm dev
# 브라우저에서 wiseapp.co.kr/insight/ 소스 저장 테스트
```

---

**작성일**: 2026-02-15
**세션**: a973902f-71d8-41ce-90bf-3fcccfa82e37 (컨텍스트 압축으로 중단)
