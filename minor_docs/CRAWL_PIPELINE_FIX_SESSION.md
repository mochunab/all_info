# 크롤링 파이프라인 개선 세션 기록

> 작성일: 2026-02-21
> 상태: **구현 완료, 테스트 미완료**

---

## 배경

인벤(inven.co.kr, source_id: 115) SSR 페이지가 SPA(confidence 0.68)로 오판되고, AI 셀렉터가 사이드바 위젯(게임 평점 `.w202M .list .item`)을 기사 목록으로 오인하여 크롤링 0건 발생.

---

## 완료된 변경 사항 (6+3개)

### 플랜 항목 (6개 — 모두 구현 완료)

| # | 파일 | 변경 내용 | 상태 |
|---|------|-----------|------|
| 1 | `lib/crawlers/index.ts` | 자동 복구 0건 트리거 (`validation.reason === 'No items found'` 조건 추가) | ✅ |
| 2 | `lib/crawlers/auto-detect.ts` | AI 타입 감지 HTML 전처리 (`<head>`, `<script>`, `<style>` 제거 후 5000자) | ✅ |
| 3 | `lib/crawlers/auto-detect.ts` | SSR 역지표 감점 (body 텍스트 풍부 + article 태그 → SPA 스코어 -0.2~0.3) | ✅ |
| 4 | `supabase/functions/detect-crawler-type/index.ts` | AI 프롬프트 "의심스러우면 SPA" → "SSR 판별 우선" 변경 | ✅ 배포완료 |
| 5 | `lib/crawlers/infer-type.ts` | AI 셀렉터 프롬프트에 사이드바/위젯 REJECT 규칙 추가 | ✅ |
| 6 | `lib/crawlers/index.ts` | STATIC→SPA fallback 추가 (`case 'STATIC': return ['SPA']`) | ✅ |

### 추가 수정 (3개 — 테스트 중 발견된 문제 대응)

| # | 파일 | 변경 내용 | 상태 |
|---|------|-----------|------|
| 7 | `lib/crawlers/infer-type.ts` | AI 프롬프트 PRIORITY ORDERING 강화 — TABLE 구조 명시, 그룹 비교 STEP 1-4 절차 추가 | ✅ |
| 8 | `lib/crawlers/infer-type.ts` | `detectContentSelectors()` 사후 검증 — AI 셀렉터 0건 매칭 시 rejection feedback과 함께 1회 재시도 | ✅ |
| 9 | `lib/crawlers/infer-type.ts` | `validateSelectorsAgainstHtml()` 함수 추가 — 정규식 기반 간이 매칭 검증 | ✅ |

### 되돌린 변경 (1개)

| 파일 | 변경 내용 | 사유 |
|------|-----------|------|
| `lib/crawlers/infer-type.ts` | rule-based 감지를 `detectContentSelectors`에 삽입 | **설계 원칙 위반** — AI-first 아키텍처, rule-based는 의도적 비활성화 |

---

## 남은 작업 (다음 세션)

### 1. 인벤 dry-run 테스트 (최우선)
```bash
cd /Users/hangyeol/인사이트허브_크롤링/insight-hub
export $(grep -v '^#' .env.local | xargs)
npm run crawl:dry -- --source=115 --verbose
```
- 기대 결과: 기사 20건 수집, 셀렉터가 `table > tbody > tr` 계열
- 실패 시: `infer-type.ts` AI 프롬프트 추가 조정 필요

### 2. 기존 소스 회귀 테스트
```bash
npm run crawl:dry -- --source=114 --verbose  # 중앙일보 (RSS)
npm run crawl:dry -- --source=108 --verbose  # ifr (STATIC)
npm run crawl:dry -- --source=105 --verbose  # 나다운세 (RSS)
```
- 기존 RSS/STATIC 소스가 정상 동작하는지 확인

### 3. 인벤 날짜 N/A 문제 (별도 이슈)
- 인벤 기사 `.info` 내부 텍스트 날짜가 파싱 안 됨
- 날짜 없는 기사가 `isWithinDays(date, 14)` 필터에 걸릴 수 있음
- 우선순위: 낮음 (기사 수집이 먼저)

### 4. Vercel 배포
- `infer-type.ts`, `auto-detect.ts`, `index.ts` 변경은 로컬 코드
- `git push origin main`으로 Vercel 배포 필요
- Edge Function(`detect-crawler-type`)은 이미 배포 완료

---

## 핵심 설계 원칙 (반드시 준수)

1. **AI-first**: rule-based 감지는 의도적으로 비활성화됨. 셀렉터/타입 모두 AI가 결정.
2. **범용 크롤러**: 특정 도메인 if문 분기 절대 금지. 파이프라인 자체를 개선.
3. **사후 검증**: AI 결과를 HTML 매칭으로 검증 → 0건이면 rejection feedback으로 1회 재시도.

---

## 인벤 크롤링 구조 참고

```
실제 기사 목록 (20건):
  div.webzineNewsList.tableType2 > table > tbody > tr > td > div.content > a > span.cols.title

사이드바 위젯 (오탐 대상):
  div.w202M > ul.list > li.item (게임 평점 — "리애니멀" 등)
  div.commu-content .w202M .list .item
```
