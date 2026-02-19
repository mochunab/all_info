# AI 기반 셀렉터 감지 전환 + getCrawler 우선순위 수정

## Context

**문제**: wiseapp.co.kr/insight/ 소스 저장 후 크롤링하면 네비게이션 메뉴(공지사항, 서비스 문의 등)가 아티클로 수집됨.

**근본 원인**:

1. **getCrawler() 우선순위 오류** (`index.ts:493-519`)
   - `inferCrawlerType()` → 'SPA' → `crawlWithStrategy()` 선택 → `LEGACY_CRAWLER_REGISTRY['와이즈앱']` 도달 불가

2. **Stage 6 rule-based가 nav을 아티클로 오인** (`strategy-resolver.ts:214-257`)
   - `detectByRules()`가 nav 항목에 score >= 0.85 부여 → 즉시 return → AI 분석 실행 안 됨

**사용자 요구**: 소스 저장 시 AI가 무조건 분석. rule-based 불필요.

---

## 수정 파일 (3개)

### 1. `lib/crawlers/index.ts` — getCrawler() 우선순위 반전

레거시 크롤러(사이트 전용) 체크를 최우선으로 이동.

**변경** (line 493-519):
```
Before: inferCrawlerType → crawlWithStrategy → (legacy 도달 불가)
After:  LEGACY_CRAWLER_REGISTRY → inferCrawlerType → crawlWithStrategy
```

### 2. `lib/crawlers/strategy-resolver.ts` — Stage 6 제거, AI가 유일한 셀렉터 감지

Stage 6 (`detectByRules` 셀렉터 분석) 블록 전체 제거. 파이프라인 단순화:

```
Before (9단계):
  1.URL최적화 → 2.HTML → 3.RSS → 4.CMS → 5.URL패턴 → 6.SPA →
  7.Rule-based셀렉터(조기리턴!) → 8.AI타입 → 9.AI셀렉터

After (7단계):
  1.URL최적화 → 2.HTML → 3.RSS → 4.CMS → 5.URL패턴 → 6.SPA →
  7.AI타입 → 8.AI셀렉터(항상실행) → fallback
```

- 기존 Stage 6 (`detectByRules` + score >= 0.85 분기) 코드 삭제
- Stage 8 AI 셀렉터 분석이 유일한 셀렉터 감지 경로
- `detectContentSelectors()` 내부에 이미 fallback 로직 있음 (AI 실패 시 제네릭 셀렉터)

### 3. `lib/crawlers/infer-type.ts` — AI 프롬프트 SPA shell 감지 강화

`detectSelectorsWithAI()` 프롬프트에 SPA shell 인식 규칙 추가:
- SPA 쉘(빈 HTML, JS 프레임워크만 존재, nav만 보임) 감지 시 confidence 0.2 반환
- wiseapp 같은 SPA에서 nav을 아티클로 오인하는 것 방지

---

## 상세 구현

### Step 1: getCrawler() — 레거시 우선 (`index.ts:493-519`)

```typescript
function getCrawler(source: CrawlSource) {
  // 1. 레거시 사이트별 크롤러 (검증된 전용 크롤러 최우선)
  if (LEGACY_CRAWLER_REGISTRY[source.name]) {
    console.log(`🔄 레거시 크롤러 사용: ${source.name}`);
    return LEGACY_CRAWLER_REGISTRY[source.name];
  }

  // 2. 이하 기존 로직 동일
  const inferred = inferCrawlerType(source.base_url);
  if (isValidCrawlerType(inferred)) {
    return crawlWithStrategy;
  }
  // ...
}
```

### Step 2: resolveStrategy() — Stage 6 제거 (`strategy-resolver.ts:208-264`)

**삭제할 코드**: line 208~264 (Stage 6 전체 블록)
- `detectByRules($, url)` 호출
- score >= 0.85 분기 + return 문
- score < 0.85 로그

**결과**: Stage 5 (SPA 감지) 직후 바로 Stage 7 (AI 타입 감지)으로 진행.
기존 Stage 7 → Stage 8 로직은 변경 없음. Stage 8이 항상 실행됨.

### Step 3: AI 프롬프트 강화 (`infer-type.ts:294-318`)

`detectSelectorsWithAI()` 프롬프트 Rules 섹션에 추가:
```
- If the HTML is a SPA shell (minimal visible text, heavy JS/framework bundles, only nav/menu links, no actual article content), set confidence to 0.2 and note "SPA shell - requires JS rendering" in reasoning
- Navigation menus (공지사항, 서비스 문의, 로그인 etc.) are NOT articles
```

---

## 검증

1. `npm run build` — 빌드 에러 없음
2. wiseapp 크롤링: `npm run crawl:dry -- --source=<id> --verbose`
   - getCrawler()가 레거시 `crawlWiseapp` 선택 확인
   - nav 항목 미포함 확인
3. 다른 소스 회귀 테스트: 기존 소스 dry-run으로 정상 동작 확인
