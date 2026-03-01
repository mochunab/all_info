# SPA Stage 8.5 개발 인수인계서

> 작성일: 2026-02-22
> 커밋 범위: `b0c1fee` ~ `147583d` (3개 커밋)

---

## 1. 이번 세션에서 완료한 작업

### 1-1. Stage 8.5 Rule-based 셀렉터 폴백 (`b0c1fee`)

**파일:** `lib/crawlers/strategy-resolver.ts` (line 547-571)

Stage 8.5에서 Puppeteer 렌더링 HTML로 AI 재감지 후, `selectorResult`가 없거나 confidence < 0.5이면 `detectByRules()`를 추가 시도하는 폴백 추가.

```
기존: renderedHtml → AI 재감지 → 실패 시 포기
변경: renderedHtml → AI 재감지 → 실패 시 → Rule-based 폴백
```

**함께 커밋된 것:** `SourcesPageClient.tsx` 카테고리/링크 수 제한 (MAX_LINKS=10, MAX_CATEGORIES=20), `i18n.ts` 번역 추가.

### 1-2. `aiDetectedSPA` 플래그 (`508ae6f`)

**파일:** `lib/crawlers/strategy-resolver.ts` (line 437, 449-457, 486, 536)

AI가 낮은 confidence(< 0.6)로 SPA를 감지해도 `aiDetectedSPA = true` 플래그를 세팅하여:
- Stage 7.5 API 감지 트리거
- Stage 8.5 Puppeteer 재감지 트리거
- `preliminaryType = 'SPA'` 세팅 (최종 타입이 STATIC으로 떨어지는 버그 방지)

### 1-3. `closeBrowser` 5초 타임아웃 (`147583d`)

**파일:** `lib/crawlers/strategies/spa.ts` (line 59-75)

SPA 전략 타임아웃 후 `closeBrowser()`가 Puppeteer `protocolTimeout`(180초)까지 블로킹되는 문제 수정. 5초 내 정상 종료 실패 시 `SIGKILL`로 Chrome 프로세스 강제 종료.

---

## 2. 미완료 — 다음 세션에서 해야 할 작업

### 2-1. `detectByUnifiedAI` HTML 전처리 과도 제거 (핵심)

**우선순위: 높음 | 범용 크롤러 원칙 위배 상태**

**현재 문제:**
```
strategy-resolver.ts line 35-40 (detectByUnifiedAI 함수 내부)

$('head, nav, aside, [role="navigation"], [role="complementary"], [role="banner"], [role="contentinfo"]').remove();
$('script').filter((_, el) => ($(el).html() || '').length > 200).remove();
$('style').filter((_, el) => ($(el).html() || '').length > 200).remove();
$('[id*="sidebar"], [id*="side-"], [class*="sidebar"], [class*="side-bar"], [id*="widget"], [class*="widget"], [id*="banner"], [class*="banner"]').remove();
```

IGN(177.9KB) → 전처리 후 **205자**만 남음. AI가 "빈 SPA 셸"로 오판 → SPA 분류 → 매 크롤링마다 SPA 30초 낭비 후 STATIC 폴백.

**IGN만의 문제가 아님.** nav/aside/sidebar 클래스를 많이 쓰는 모든 SSR 사이트에서 동일 문제 발생 가능.

**수정 방향:**
```typescript
// 전처리 후 남은 텍스트가 너무 적으면 원본 HTML 재사용
const cleanedText = cleanedHtml.replace(/<[^>]+>/g, '').trim();
if (cleanedText.length < 1000) {
  // 전처리가 너무 공격적 → 원본 HTML에서 head/script/style만 제거한 경량 버전 사용
  const $light = cheerio.load(html);
  $light('head, script, style').remove();
  truncatedHtml = $light.html().substring(0, 50000);
}
```

### 2-2. `aiDetectedSPA` 코드 제거 (전처리 수정 후)

2-1이 해결되면 AI가 IGN을 STATIC으로 정확히 분류하게 됨. 그러면 `aiDetectedSPA` 플래그는 불필요해지므로 제거:
- `strategy-resolver.ts` line 437: `let aiDetectedSPA = false;` 삭제
- line 449-457: 플래그 세팅 블록 삭제
- line 486: `|| aiDetectedSPA` 조건 제거
- line 536: `|| aiDetectedSPA` 조건 제거

**단, Rule-based 폴백(1-1)과 closeBrowser 타임아웃(1-3)은 유지.** 이 두 가지는 범용적으로 유효.

### 2-3. SPA 전략 페이지 정리 미비 (선택)

SPA 전략 타임아웃 시 `page.evaluate()`가 abort되지 않고 계속 실행됨. `closeBrowser` 타임아웃으로 실용적 해결은 됐지만, 근본적으로 전략 타임아웃 시 `page.close()`를 먼저 호출하는 게 깔끔함.

**파일:** `lib/crawlers/index.ts` — `crawlWithStrategy` 함수 내 전략 타임아웃 처리 부분

---

## 3. IGN 소스 현재 상태

- **DB id:** 135 (이전 133, 134는 테스트 중 삭제됨)
- **crawler_type:** SPA
- **실제 동작:** SPA 30초 타임아웃 → STATIC 폴백으로 크롤링 성공 (5개 기사)
- **소요 시간:** closeBrowser 수정 전 ~215초, 수정 후 ~45초 예상
- **2-1 수정 후:** STATIC으로 분류되어 ~15초 내 완료 예상

---

## 4. 검증 명령어

```bash
# 전략 감지 테스트 (소스 등록 시뮬레이션)
cd 인사이트허브_크롤링/insight-hub
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
npx tsx -e "
import { resolveStrategy } from './lib/crawlers/strategy-resolver';
resolveStrategy('https://www.ign.com/news').then(r => {
  console.log('type:', r.primaryStrategy);
  console.log('confidence:', r.confidence);
  console.log('selectors:', r.selectors ? 'YES' : 'null');
});
"

# 크롤링 dry-run
npm run crawl:dry -- --source=135 --verbose
```

---

## 5. 관련 파일 맵

| 파일 | 수정 여부 | 역할 |
|------|-----------|------|
| `lib/crawlers/strategy-resolver.ts` | **수정됨** | 9단계 파이프라인 (Stage 8.5 폴백 + aiDetectedSPA) |
| `lib/crawlers/strategies/spa.ts` | **수정됨** | closeBrowser 5초 타임아웃 |
| `lib/crawlers/auto-detect.ts` | 미수정 | `detectByRules` 함수 (Stage 8.5에서 import) |
| `lib/crawlers/index.ts` | 미수정 | 오케스트레이터 (`closeBrowser` 호출 line 663) |
| `app/sources/add/SourcesPageClient.tsx` | **수정됨** | 카테고리/링크 수 제한 |
| `lib/i18n.ts` | **수정됨** | 제한 관련 번역 |
