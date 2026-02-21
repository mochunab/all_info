# PROJECT_CONTEXT.md - 데이터 플로우 & 런타임 동작 가이드

> 이 문서의 핵심: **데이터가 시스템을 어떻게 흐르는가**
> 최종 업데이트: 2026-02-21 (v1.5.3)
>
> **다른 문서 참조**:
> - 개발 규칙, API Routes, 파일 구조, 환경변수, 디버깅 → [CLAUDE.md](../CLAUDE.md)
> - DB 스키마, config JSONB 구조, 마이그레이션 → [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
> - 설계 의도, 대안 검토 → [DECISIONS.md](./DECISIONS.md)
> - RLS 정책 → [RLS_POLICIES.md](./supabase/RLS_POLICIES.md)
> - Edge Function 상세 → [EDGE_FUNCTIONS_GUIDE.md](./supabase/EDGE_FUNCTIONS_GUIDE.md)

---

## 시스템 전체 구조

```
┌──────────────────────┐           ┌──────────────────────────┐
│   Next.js Frontend   │  fetch()  │    Next.js API Routes     │
│   (App Router)       │ ────────► │    (Vercel Serverless)    │
│                      │           │    maxDuration: 300s      │
│  - page.tsx (메인)   │           └────────────┬──────────────┘
│  - AddSourcePage     │                        │
│  - Components (8개)  │       ┌────────────────┼──────────────┐
└──────────────────────┘       │                │              │
                               ▼                ▼              ▼
                       ┌────────────┐  ┌──────────────┐  ┌──────────────┐
                       │  Supabase  │  │  Crawlers    │  │  Edge Fn (4) │
                       │  PostgreSQL│  │  (9 전략)    │  │  GPT-5-nano  │
                       └────────────┘  └──────────────┘  └──────────────┘
```

별도 백엔드 서버 없이 **Vercel Serverless Functions**로 모든 서버 로직 처리.
Cron: 매일 00:00 UTC (09:00 KST) → `POST /api/crawl/run` 자동 호출.

---

## 1. 크롤링 플로우

### 트리거 경로

```
(A) 수동: Header "자료 불러오기" 버튼
    → POST /api/crawl/trigger (30초 rate limit)
    → 내부에서 CRON_SECRET 붙여 /api/crawl/run 프록시

(B) 자동: Vercel Cron
    → POST /api/crawl/run (Bearer {CRON_SECRET})
```

### 크롤링 실행 (`POST /api/crawl/run`)

```
1. Bearer Token 검증
2. crawl_sources 조회 (is_active=true, priority DESC)
3. 제한 병렬 실행 (v1.5.3):
   ├─ 비SPA: 최대 5개 동시 (runWithConcurrency)
   └─ SPA: 직렬 (Puppeteer 공유 인스턴스 보호)

   각 소스별:
   ├─ crawl_logs 생성 (status: 'running')
   ├─ runCrawler(source) 호출
   │   ├─ [URL 결정] effectiveUrl = crawl_url || base_url
   │   │
   │   ├─ [크롤러 선택] getCrawler() — 우선순위:
   │   │   1. LEGACY_CRAWLER_REGISTRY (검증된 전용 크롤러 7개)
   │   │   2. DB crawler_type 명시적 설정 → crawlWithStrategy()
   │   │   3. URL 패턴 추론 (inferCrawlerType) → 폴백
   │   │
   │   ├─ [목록 크롤링] strategy.crawlList() → RawContentItem[]
   │   │
   │   ├─ [본문 추출] content 없는 아티클만
   │   │   └─ content-extractor.ts 우선순위:
   │   │       1. 커스텀 셀렉터 → 2. Readability → 3. 일반 셀렉터 → 4. body 전체
   │   │       → generatePreview() → content_preview (500자)
   │   │
   │   ├─ [본문 fallback] content_preview 없거나 < 50자인 아티클
   │   │   ├─ 1차: Cheerio 정적 파싱
   │   │   └─ 2차: Puppeteer JS 렌더링 (load + 3초 대기)
   │   │   └─ 루프 종료 후 closeBrowser()
   │   │
   │   └─ [저장] saveArticles() — source_id UNIQUE로 중복 방지
   │
   ├─ crawl_logs 업데이트 (completed/failed)
   └─ crawl_sources.last_crawled_at 업데이트

4. AI 요약 배치 실행
   └─ processPendingSummaries(batchSize=30)
       └─ 아래 "AI 요약 플로우" 참조

5. 최종 응답: { success, results, summarization }
```

---

## 2. AI 요약 플로우

```
processPendingSummaries()
  ├─ ai_summary IS NULL인 아티클 최대 30건 조회
  ├─ 5개씩 병렬 (Promise.allSettled), 실패 시 최대 3회 재시도 (1s→2s→3s)
  │
  ├─ USE_EDGE_FUNCTION=true (기본):
  │   └─ Edge Function (GPT-5-nano) → 실패 시 로컬 OpenAI (GPT-4o-mini) fallback
  │
  └─ USE_EDGE_FUNCTION=false:
      └─ 로컬 OpenAI (GPT-4o-mini) 직접 호출
  │
  └─ DB UPDATE: ai_summary (1줄 80자), summary_tags (3개), summary (레거시)
```

---

## 3. 프론트엔드 데이터 플로우

```
page.tsx (메인 페이지)
  ├─ useEffect → GET /api/categories
  ├─ useEffect → fetchArticles(page, append)
  │    └─ GET /api/articles?page=1&limit=12&search=&category=
  │       정렬: published_at DESC NULLS LAST, crawled_at DESC
  │
  ├─ handleRefresh() → POST /api/crawl/trigger
  │    └─ 폴링 기반 완료 감지 (crawlSeenRunning ref)
  │    └─ 10분 AbortController 타임아웃
  │
  ├─ handleLoadMore() → fetchArticles(nextPage, true)
  └─ handleSearchChange() / onCategoryChange() → fetchArticles(1, false)
```

---

## 4. 소스 추가 플로우

```
/sources/add → POST /api/sources
  ├─ verifySameOrigin() 또는 verifyCronAuth()
  ├─ [URL 최적화] optimizeUrl() — 4단계 필터
  │   1. 도메인 매핑 (confidence: 0.95)
  │   2. 경로 패턴 탐색 (/feed, /rss, /blog 등, 0.8)
  │   3. HTML 네비게이션 링크 발견 (0.75)
  │   └─ 섹션 교차 리다이렉트 방지 → crawl_url 생성
  │
  ├─ [자동 감지] resolveStrategy() — 9단계 파이프라인
  │   → 상세: 아래 "크롤러 타입 자동 감지" 섹션
  │
  ├─ 기존 소스 → UPDATE / 신규 → INSERT
  └─ 응답에 analysis 배열 포함
```

---

## 5. 크롤러 타입 자동 감지 파이프라인

> 설계 의도, 대안 검토 → [DECISIONS.md ADR-015, 018, 019](./DECISIONS.md)

```
resolveStrategy(url) — lib/crawlers/strategy-resolver.ts

  1.  HTML 다운로드 (15s timeout, 실패 시 URL 패턴 폴백)
  2.  RSS 발견 (0.95) — 6개 경로 Promise.all 병렬
  2.5 Sitemap 발견 (0.90) — 2개 후보 Promise.all 병렬
  3.  CMS 감지 (0.75) — WordPress, Tistory, Ghost
  4.  URL 패턴 (0.85~0.95) — .go.kr, naver.com, /feed
  5.  SPA 스코어링 — body < 500자, #root/#app
  [Stage 6 제거 — v1.5.1]
  7+8 AI 타입 감지 + AI 셀렉터 감지 — Promise.all 병렬
      ├─ 7. detect-crawler-type Edge Fn (GPT-5-nano, HTML 5000자)
      └─ 8. infer-type.ts (HTML 전처리 + GPT-4o-mini)
  7.5 API 감지 — SPA 확정 후 detect-api-endpoint 호출
      └─ Puppeteer 네트워크 캡처 → GPT-5-nano → crawl_config 생성
  8.5 SPA 셀렉터 재감지 — confidence < 0.5 → Puppeteer HTML로 재시도
```

감지 우선순위 요약:

| 순서 | 방법 | Confidence | 조건 |
|------|------|-----------|------|
| 1 | RSS 발견 | 0.95 | `<link>` 태그 + 유효성 검증 |
| 1.5 | Sitemap 발견 | 0.90 | `/sitemap.xml` 존재 |
| 2 | CMS 감지 | 0.75 | WordPress/Tistory/Ghost |
| 3 | URL 패턴 | 0.85~0.95 | `.go.kr`, `naver.com` 등 |
| 4 | SPA 스코어링 | 0.5~1.0 | body 텍스트, 마운트 포인트 |
| 5 | AI 타입 감지 | 0.6~1.0 | GPT-5-nano (Stage 8과 병렬) |
| 5.5 | AI 셀렉터 감지 | 0.5~1.0 | infer-type.ts (Stage 7과 병렬) |
| 6 | API 감지 | 자동 | SPA 확정 후에만 실행 |
| 7 | SPA 셀렉터 재감지 | 재시도 | confidence < 0.5 조건 |
| 8 | 기본값 | 0.3~0.5 | 모든 분석 실패 시 |

---

## 크롤러 전략 상세

| 전략 | 엔진 | 특징 |
|------|------|------|
| `STATIC` | Cheerio | 가장 빠름, CSS 셀렉터 기반, 페이지네이션 지원 |
| `SPA` | Puppeteer | Headless Chrome, JS 렌더링, 느림 |
| `RSS` | rss-parser | 가장 안정적, 표준 포맷 |
| `SITEMAP` | fetch + Cheerio | sitemap.xml → URL 수집 → 각 페이지 fetch, 최대 15개 |
| `PLATFORM_NAVER` | Cheerio | 네이버 블로그 특화 |
| `PLATFORM_KAKAO` | Cheerio | 브런치 특화 |
| `NEWSLETTER` | Cheerio | Stibee, Substack 등 |
| `API` | fetch | JSON 응답 파싱, crawl_config 필요 |

레거시 사이트별 크롤러 (7개): wiseapp, brunch, retailtalk, stonebc, iconsumer, openads, buybrand
→ `LEGACY_CRAWLER_REGISTRY`에서 최우선 적용

---

## 출처별 브랜드 컬러

```typescript
const SOURCE_COLORS: Record<string, string> = {
  '와이즈앱': '#4F46E5',     // Indigo
  '브런치': '#18A550',       // Green
  '리테일톡': '#DC2626',     // Red
  '스톤브릿지': '#7C3AED',   // Purple
  '오픈애즈': '#0891B2',     // Cyan
  '아이컨슈머': '#EA580C',   // Orange
  '바이브랜드': '#DB2777',   // Pink
};
// 기본값: '#6B7280' (Gray)
```

---

## 성능 특성

| 항목 | 값 |
|------|-----|
| 크롤링 전체 | ~30-60초 (제한 병렬, v1.5.3) |
| AI 요약 1건 | ~2-3초 |
| 배치 요약 20건 | ~12초 (5개 병렬 × 4청크) |
| Vercel maxDuration | 300초 |
| fetch 타임아웃 | 15초 |
| 페이지당 아티클 | 12개 (최대 50) |
| 이미지 프록시 캐시 | 24시간 |
| crawl/trigger Rate Limit | 30초 |
| RSS 탐색 (6경로 병렬) | ~3초 |
| Stage 7+8 병렬화 절약 | ~5초 |

---

## 외부 서비스 의존성

| 서비스 | 용도 | 장애 시 영향 |
|--------|------|-------------|
| Supabase | DB, Edge Functions | 전체 서비스 불가 |
| OpenAI API | AI 요약/감지 | 요약 불가 (크롤링은 정상) |
| Vercel | 호스팅, Cron | 서비스 접속 불가 |
| 크롤링 대상 사이트 | 콘텐츠 소스 | 해당 소스만 실패 |

---

## 버전 히스토리

### v1.5.3 (2026-02-21)
- 크롤링 제한 병렬 처리 (비SPA 5개 동시, SPA 직렬)
- UI 무한 로딩 수정 (폴링 기반 + 10분 타임아웃)
- URL 최적화 4단계 필터 + 섹션 교차 리다이렉트 방지
- 아티클 삭제 API (soft-delete)

### v1.5.2 (2026-02-19)
- STATIC 타이틀 셀렉터 수정 (DEFAULT_SELECTORS.title에서 `a` 제거)
- RSS 0건 STATIC fallback 복원
- SPA 셀렉터 재감지 (Step 8.5)

### v1.5.1 (2026-02-19)
- AI 셀렉터 감지 고도화 (HTML 전처리, Tailwind 이스케이프)
- Stage 6 제거 + Stage 7+8 병렬화
- RSS/Sitemap 탐색 병렬화

### v1.5.0 (2026-02-19)
- SITEMAP 크롤러 전략 추가
- 자동 감지 파이프라인 Step 2.5 추가

### v1.4.1 (2026-02-19)
- 레거시 크롤러 Puppeteer 2차 fallback
- spa.crawlContent: `networkidle2` → `load` + 3초 대기

### v1.4.0 (2026-02-19)
- getCrawler() 우선순위 수정 (레거시 최우선)
- API 엔드포인트 자동 감지 (Step 7.5)
- 크롤링 윈도우 14일 확장
