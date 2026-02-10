# PROJECT_CONTEXT.md - 시스템 아키텍처 & 디버깅 가이드

> AI와 개발자 모두를 위한 프로젝트 전체 아키텍처 문서
> 최종 업데이트: 2026-02-09

## 시스템 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                         │
│                     http://localhost:3000                        │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐           ┌──────────────────────────┐
│   Next.js Frontend  │           │    Next.js API Routes     │
│   (App Router)      │           │    (Server-side)          │
│                     │           │                           │
│  - page.tsx (메인)  │  fetch()  │  /api/articles            │
│  - AddSourcePage    │ ────────► │  /api/articles/sources    │
│  - Components (7개) │           │  /api/sources             │
│                     │           │  /api/categories          │
│                     │           │  /api/crawl/run           │
│                     │           │  /api/crawl/status        │
│                     │           │  /api/crawl/trigger       │
│                     │           │  /api/summarize           │
│                     │           │  /api/summarize/batch     │
│                     │           │  /api/image-proxy         │
└─────────────────────┘           └────────────┬──────────────┘
                                               │
                        ┌──────────────────────┼───────────────────────┐
                        │                      │                       │
                        ▼                      ▼                       ▼
               ┌──────────────┐     ┌──────────────────┐    ┌──────────────────┐
               │   Supabase   │     │  Crawlers (7전략) │    │  Supabase Edge   │
               │  (PostgreSQL)│     │                  │    │  Function        │
               │              │     │  - STATIC        │    │                  │
               │  - articles  │     │  - SPA           │    │  summarize-      │
               │  - crawl_    │     │  - RSS           │    │  article         │
               │    sources   │     │  - PLATFORM_NAVER│    │    │             │
               │  - crawl_    │     │  - PLATFORM_KAKAO│    │    ▼             │
               │    logs      │     │  - NEWSLETTER    │    │  OpenAI API      │
               │  - categories│     │  - API           │    │  (GPT-5-nano /   │
               └──────────────┘     └──────────────────┘    │   GPT-4o-mini)   │
                                           │                └──────────────────┘
                        ┌──────────────────┼──────────────┐
                        ▼                  ▼              ▼
                  ┌──────────┐      ┌──────────┐   ┌──────────┐
                  │ 와이즈앱  │      │  브런치   │   │ 리테일톡  │
                  │ 오픈애즈  │      │ 아이컨슈머│   │ 스톤브릿지│
                  │ 바이브랜드│      │  ...etc   │   │  ...etc  │
                  └──────────┘      └──────────┘   └──────────┘
```

---

## File Structure (Key Files)

### 메인 페이지 (아티클 목록/검색/필터/무한스크롤)

```
app/page.tsx                          → 메인 페이지 (SSR + 클라이언트 상태 관리)
components/ArticleCard.tsx            → 아티클 카드 (텍스트 중심 UI, 요약/태그 표시)
components/ArticleGrid.tsx            → 아티클 그리드 + 무한스크롤 (Intersection Observer)
components/FilterBar.tsx              → 검색바 + 카테고리 필터 UI
components/Header.tsx                 → 헤더 ("자료 불러오기" 버튼 → /api/crawl/trigger)
components/Skeleton.tsx               → 로딩 스켈레톤 (카드 레이아웃)
components/Toast.tsx                  → 토스트 알림
app/api/articles/route.ts             → GET - 아티클 목록 (검색/필터/페이지네이션)
app/api/articles/sources/route.ts     → GET - 소스별 아티클
```

### 소스 관리 (추가/수정/삭제)

```
app/sources/add/page.tsx              → 소스 추가/편집 페이지 (카테고리 선택, 링크 CRUD)
app/api/sources/route.ts              → GET/POST - 소스 CRUD (upsert + deleteIds 삭제)
app/api/categories/route.ts           → GET/POST - 카테고리 CRUD
```

### 크롤링 시스템

```
app/api/crawl/run/route.ts            → POST - 전체 크롤링 실행 (Cron/Bearer Auth, 300초)
app/api/crawl/trigger/route.ts        → POST - 프론트엔드 트리거 (CRON_SECRET 프록시)
app/api/crawl/status/route.ts         → GET - 크롤링 상태 조회
lib/crawlers/index.ts                 → 크롤링 오케스트레이터 (runCrawler, runAllCrawlers)
lib/crawlers/base.ts                  → 공통 유틸 (saveArticles, isWithinDays)
lib/crawlers/types.ts                 → 크롤러 타입 정의 (CrawlStrategy, RawContentItem)
lib/crawlers/auto-detect.ts           → CSS 셀렉터 자동 탐지 (rule-based + AI fallback)
lib/crawlers/content-extractor.ts     → 본문 추출 (Readability → 셀렉터 → body)
lib/crawlers/date-parser.ts           → 날짜 파싱 (한글 상대 날짜 지원)
lib/crawlers/strategies/index.ts      → 전략 팩토리 (getStrategy, inferCrawlerType)
lib/crawlers/strategies/static.ts     → STATIC: Cheerio 정적 HTML (페이지네이션)
lib/crawlers/strategies/spa.ts        → SPA: Puppeteer 동적 렌더링
lib/crawlers/strategies/rss.ts        → RSS: rss-parser 피드 파싱
lib/crawlers/strategies/naver.ts      → PLATFORM_NAVER: 네이버 블로그 특화
lib/crawlers/strategies/kakao.ts      → PLATFORM_KAKAO: 카카오 브런치 특화
lib/crawlers/strategies/newsletter.ts → NEWSLETTER: 뉴스레터 크롤러
lib/crawlers/strategies/api.ts        → API: REST API 엔드포인트
```

### 사이트별 커스텀 크롤러 (레거시)

```
lib/crawlers/sites/wiseapp.ts         → 와이즈앱
lib/crawlers/sites/brunch.ts          → 브런치
lib/crawlers/sites/retailtalk.ts      → 리테일톡
lib/crawlers/sites/stonebc.ts         → 스톤브릿지
lib/crawlers/sites/openads.ts         → 오픈애즈
lib/crawlers/sites/iconsumer.ts       → 아이컨슈머
lib/crawlers/sites/buybrand.ts        → 바이브랜드
```

### AI 요약

```
lib/ai/summarizer.ts                  → 로컬 OpenAI (GPT-4o-mini) 요약 + 통합 프롬프트
lib/ai/batch-summarizer.ts            → 배치 요약 오케스트레이터 (Edge Fn 우선 → 로컬 fallback)
supabase/functions/summarize-article/index.ts → Edge Function (Deno, GPT-5-nano)
app/api/summarize/route.ts            → POST - 단건 요약 (Bearer Auth)
app/api/summarize/batch/route.ts      → POST - 일괄 요약 (Bearer Auth, 300초)
```

### 인증/보안/미들웨어

```
lib/auth.ts                           → 인증 (verifyCronAuth, verifySameOrigin)
middleware.ts                         → Rate Limit, CORS, Security Headers
app/api/image-proxy/route.ts          → 이미지 프록시 (Hotlinking/SSRF 방지)
```

### Supabase/DB

```
lib/supabase/client.ts                → 브라우저 Supabase 클라이언트
lib/supabase/server.ts                → 서버 Supabase 클라이언트 (SSR) + Service Client
types/index.ts                        → 공통 타입 (Article, CrawlSource, CrawlerType 등)
types/database.ts                     → Supabase Database 타입
supabase/migrations/001_initial_schema.sql         → 초기 스키마
supabase/migrations/002_add_ai_summary_tags.sql    → AI 요약 컬럼 추가
```

### 설정/배포

```
app/layout.tsx                        → 전역 레이아웃 (Pretendard + Outfit 폰트)
app/globals.css                       → CSS Variables + Tailwind + 유틸리티 클래스
components/index.ts                   → Barrel export
vercel.json                           → Vercel 배포 설정 (Cron, maxDuration, Headers)
scripts/crawl.ts                      → 크롤링 CLI (npx tsx)
```

---

## 서버 구성

별도 백엔드 서버 없이 **Vercel Serverless Functions**로 모든 서버 로직을 처리하는 구조.

```
┌───────────────────────────────────────────────────────┐
│                    Vercel (호스팅)                      │
│                                                       │
│  Next.js 14 App Router                                │
│  ├─ 프론트엔드: React 18 (SSR + CSR)                  │
│  └─ 백엔드: app/api/*/route.ts (Serverless Functions) │
│             → 요청마다 함수 실행, 상시 서버 없음         │
│                                                       │
│  Cron: 매일 00:00 UTC (09:00 KST)                     │
│        → POST /api/crawl/run 자동 호출                 │
└───────────┬──────────────┬────────────────────────────┘
            │              │
            ▼              ▼
     ┌────────────┐  ┌──────────────────┐
     │  Supabase  │  │  OpenAI API      │
     │  - DB      │  │  - GPT-5-nano    │
     │  - Edge Fn │  │  - GPT-4o-mini   │
     │  - Auth    │  │  (AI 요약 생성)   │
     └────────────┘  └──────────────────┘
```

| 역할 | 기술 | 설명 |
|------|------|------|
| 웹 서버 / API | Next.js API Routes | Vercel Serverless로 실행, Express 등 별도 서버 없음 |
| 데이터베이스 | Supabase (PostgreSQL) | 클라우드 매니지드, RLS 적용 |
| AI 요약 | Supabase Edge Function (Deno) | GPT-5-nano 우선, 실패 시 로컬 OpenAI GPT-4o-mini fallback |
| 호스팅 + Cron | Vercel | 자동 배포 (Git push), Cron Job으로 자동 크롤링 |
| 크롤링 엔진 | Cheerio / Puppeteer | API Route 내부에서 실행 (Serverless 환경) |
| 인증 | 커스텀 (`lib/auth.ts`) | Bearer Token (서버간), Same-Origin (CSRF), 사용자 로그인 없음 |

> **왜 Serverless?**: 크롤링은 하루 1회, 일반 트래픽도 적어 상시 서버 불필요. Vercel Free/Pro 플랜으로 충분.

---

## 핵심 데이터 플로우

### 1. 크롤링 플로우 ("자료 불러오기" 버튼 / Cron)

크롤링은 두 가지 경로로 트리거됨:
- **수동**: 헤더의 "자료 불러오기" 버튼 클릭
- **자동**: Vercel Cron (매일 00:00 UTC = 09:00 KST)

두 경로 모두 최종적으로 `POST /api/crawl/run`을 호출하며, 이후 동작은 동일.

```
[트리거 경로]

  (A) 수동 — "자료 불러오기" 버튼
  Header.tsx 버튼 클릭
    → handleRefresh() → onRefresh() 콜백
    → POST /api/crawl/trigger        ← CRON_SECRET 노출 방지용 프록시
       │  ⚡ Middleware: 30초 Rate Limit (429 Too Many Requests)
       │  서버 내부에서 CRON_SECRET을 Authorization 헤더에 붙여 호출
       ▼
  POST /api/crawl/run (Bearer {CRON_SECRET})

  (B) 자동 — Vercel Cron
  매일 00:00 UTC
    → POST /api/crawl/run (Bearer {CRON_SECRET})


[크롤링 실행] POST /api/crawl/run (run/route.ts)

  1. Bearer Token 검증 (verifyCronSecret)
     └─ 실패 시 401 Unauthorized 반환
  │
  2. crawl_sources 테이블 조회 (is_active=true, priority DESC)
  │
  3. 각 소스별 순차 실행 (for loop):
  │
  │   ┌─ crawl_logs 레코드 생성 (status: 'running')
  │   │
  │   ├─ runCrawler(source, supabase) 호출 (lib/crawlers/index.ts)
  │   │   │
  │   │   ├─ [크롤러 선택] getCrawler(source)
  │   │   │   ├─ inferCrawlerType(url) — URL 패턴으로 전략 자동 추론
  │   │   │   │   blog.naver.com  → PLATFORM_NAVER
  │   │   │   │   brunch.co.kr    → PLATFORM_KAKAO
  │   │   │   │   /feed, /rss     → RSS
  │   │   │   │   stibee.com      → NEWSLETTER
  │   │   │   │   기타             → STATIC (기본)
  │   │   │   ├─ 유효한 전략이면 → crawlWithStrategy() 사용
  │   │   │   └─ 아니면 → LEGACY_CRAWLER_REGISTRY에서 사이트별 크롤러 폴백
  │   │   │
  │   │   ├─ [목록 크롤링] strategy.crawlList(source)
  │   │   │   └─ RawContentItem[] 반환 (title, link, dateStr, thumbnail 등)
  │   │   │
  │   │   ├─ [본문 추출] 본문(content)이 없는 아티클만
  │   │   │   └─ strategy.crawlContent(url, config)
  │   │   │       └─ content-extractor.ts 우선순위:
  │   │   │           1. 커스텀 셀렉터 (config.content_selectors)
  │   │   │           2. @mozilla/readability (광고/메뉴 자동 제거)
  │   │   │           3. 일반 셀렉터 탐색 (article, main, .content 등)
  │   │   │           4. body 전체 텍스트 (최후 수단)
  │   │   │       └─ generatePreview() → 최대 500자로 잘라서 content_preview 저장
  │   │   │       └─ 요청 간 딜레이 (기본 500ms)
  │   │   │
  │   │   ├─ [중복 체크 + 저장] saveArticles()
  │   │   │   └─ source_id (URL 해시) 기준 SELECT → 이미 있으면 SKIP
  │   │   │   └─ 신규만 articles 테이블 INSERT
  │   │   │
  │   │   └─ CrawlResult { found, new, errors } 반환
  │   │
  │   ├─ crawl_logs 업데이트 (status: completed/failed, articles_found/new)
  │   └─ crawl_sources.last_crawled_at 업데이트
  │
  4. 크롤링 완료 후 AI 요약 배치 실행 (skipSummary가 아닌 경우)
     └─ processPendingSummaries(supabase, batchSize=30)
         ├─ ai_summary IS NULL인 아티클 최대 30건 조회
         ├─ Edge Function (GPT-5-nano) 우선 호출
         ├─ 실패 시 → 로컬 OpenAI API (GPT-4o-mini) fallback
         └─ articles.ai_summary, summary_tags, summary 업데이트

  5. 최종 응답 반환
     { success, results: [...], summarization: { processed, success, failed } }
```

**핵심 포인트**:
- **보안**: 클라이언트는 `/api/crawl/trigger`만 호출 → 서버가 내부에서 `CRON_SECRET`을 붙여 `/api/crawl/run` 호출 (프록시 패턴)
- **중복 방지**: `source_id` (URL 기반 해시) UNIQUE 제약으로 같은 아티클 재저장 차단
- **전략 선택**: URL 기반 자동 추론 우선 → DB의 crawler_type → 레거시 사이트별 크롤러 순
- **타임아웃**: Vercel maxDuration 300초, 개별 fetch 15초 타임아웃

### 2. AI 요약 생성 플로우 (2경로)

```
                    ┌─────────────────────────────────────────┐
                    │  batch-summarizer.ts                     │
                    │  processPendingSummaries()                │
                    │  ※ 5개씩 병렬 처리 (Promise.allSettled)   │
                    │  ※ 실패 시 최대 3회 재시도 (1s→2s→3s)     │
                    └────────────┬────────────────────────────┘
                                 │
                    USE_EDGE_FUNCTION !== 'false' (기본: true)
                                 │
              ┌──────────────────┼──────────────────┐
              │ true (기본)      │                   │ false
              ▼                  │                   ▼
   ┌─────────────────────┐      │        ┌─────────────────────┐
   │  Edge Function      │      │        │  로컬 OpenAI 직접   │
   │  (Supabase Deno)    │      │        │  (lib/ai/summarizer) │
   │                     │      │        │                     │
   │  GPT-5-nano 우선    │      │        │  GPT-4o-mini       │
   │  → 404시 fallback:  │      │        │  chat.completions  │
   │    GPT-4o-mini      │      │        │  API               │
   └────────┬────────────┘      │        └─────────────────────┘
            │                   │
            │ 실패 시           │
            └───────────────────┘
                    │
                    ▼
            ┌──────────────┐
            │  DB UPDATE   │
            │  ai_summary  │  ← 1줄 요약 (80자 이내)
            │  summary_tags│  ← 태그 3개
            │  summary     │  ← 3줄 요약 (레거시)
            └──────────────┘
```

### 3. 프론트엔드 데이터 플로우

```
page.tsx (메인 페이지)
  │
  ├─ useEffect → GET /api/categories → 카테고리 목록
  ├─ useEffect → fetchArticles(page, append)
  │    └─ GET /api/articles?page=1&limit=12&search=&category=
  │         └─ Supabase: articles 테이블 조회 (is_active=true)
  │            정렬: published_at DESC NULLS LAST, crawled_at DESC
  │
  ├─ handleRefresh() → POST /api/crawl/trigger
  │    └─ 내부에서 /api/crawl/run 프록시 (CRON_SECRET 포함)
  │    └─ Rate Limit: 30초 쿨다운 (middleware.ts)
  │
  ├─ handleLoadMore() → fetchArticles(nextPage, true)
  │    └─ 기존 articles에 append
  │
  └─ handleSearchChange() / onCategoryChange()
       └─ 필터 변경 → fetchArticles(1, false)
```

### 4. 소스 추가 플로우

```
/sources/add (AddSourcePage)
  │
  ├─ useEffect → GET /api/sources → 기존 소스 목록
  ├─ useEffect → GET /api/categories → 카테고리 목록
  │
  └─ handleSave()
       └─ POST /api/sources
            ├─ verifySameOrigin() 또는 verifyCronAuth() 필수
            ├─ 모든 URL에 대해 병렬로 analyzePageStructure() 실행
            │   ├─ Rule-based: cheerio로 HTML 구조 패턴 매칭
            │   ├─ AI fallback: GPT-5-nano/GPT-4o-mini (confidence < 0.5일 때)
            │   └─ SPA 감지 시 crawler_type을 SPA로 override
            ├─ URL로 크롤러 타입 자동 추론 (inferCrawlerType)
            ├─ 기존 소스 → UPDATE (selectors 없으면 분석 결과 적용)
            ├─ 신규 소스 → INSERT (config에 selectors 포함)
            └─ 응답에 analysis 배열 포함 (method, confidence, crawlerType)
```

---

## API Routes 전체 맵

| Route | Method | Auth | 용도 | Timeout |
|-------|--------|------|------|---------|
| `/api/articles` | GET | 없음 | 아티클 목록 (페이지네이션, 검색, 필터) | 기본 |
| `/api/articles/sources` | GET | 없음 | 활성 소스명 목록 (distinct) | 기본 |
| `/api/sources` | GET | 없음 | 크롤 소스 목록 | 기본 |
| `/api/sources` | POST | SameOrigin 또는 CRON | 소스 추가/수정 (auto-detect 셀렉터 분석 포함) | 기본 |
| `/api/categories` | GET | 없음 | 카테고리 목록 | 기본 |
| `/api/categories` | POST | SameOrigin 또는 CRON | 카테고리 추가 | 기본 |
| `/api/crawl/run` | POST | CRON_SECRET | 전체 크롤링 + 요약 배치 | 300초 |
| `/api/crawl/trigger` | POST | 없음 (30초 rate limit) | crawl/run 프록시 | 기본 |
| `/api/crawl/status` | GET | 없음 | 크롤링 상태 조회 | 기본 |
| `/api/summarize` | POST | CRON_SECRET | 단건 요약 생성 | 기본 |
| `/api/summarize/batch` | POST | CRON_SECRET | 배치 요약 (기본 20건) | 300초 |
| `/api/image-proxy` | GET | 없음 | Hotlink 방지 이미지 프록시 | 기본 |

---

## 인증 체계

```typescript
// lib/auth.ts

// 1. verifyCronAuth(request) - 서버간 통신 인증
//    Authorization: Bearer {CRON_SECRET}
//    용도: crawl/run, summarize, summarize/batch

// 2. verifySameOrigin(request) - CSRF 방어
//    origin 또는 referer 헤더가 host와 일치하는지 확인
//    용도: sources POST, categories POST (브라우저에서 호출 시)

// 3. Supabase Auth → 미사용 (사용자 로그인 시스템 없음)
```

---

## 크롤러 전략 상세

| 전략 | 엔진 | 사용 대상 | 특징 |
|------|------|-----------|------|
| `STATIC` | Cheerio | 정적 HTML 페이지 | 가장 빠름, CSS 셀렉터 기반 |
| `SPA` | Puppeteer | JavaScript 렌더링 필요 | Headless Chrome, 느림 |
| `RSS` | rss-parser | RSS/Atom 피드 | 가장 안정적, 표준 포맷 |
| `PLATFORM_NAVER` | Cheerio | 네이버 블로그 | 네이버 특화 파싱 |
| `PLATFORM_KAKAO` | Cheerio | 카카오 브런치 | 브런치 특화 파싱 |
| `NEWSLETTER` | Cheerio | Stibee, Substack 등 | 뉴스레터 구조 파싱 |
| `API` | fetch | REST API 제공 사이트 | JSON 응답 파싱 |

### 크롤러 자동 추론 (inferCrawlerType)

```
URL 분석 → 최적 전략 자동 선택
  blog.naver.com  → PLATFORM_NAVER
  brunch.co.kr    → PLATFORM_KAKAO
  /feed, /rss     → RSS
  stibee.com      → NEWSLETTER
  기타            → STATIC (기본)
```

### CSS 셀렉터 자동 탐지 (auto-detect.ts)

소스 저장 시 (`POST /api/sources`) 페이지 HTML을 분석하여 최적의 셀렉터를 자동 감지:

```
analyzePageStructure(url)
  ├─ 1. fetchPage(url) — 15초 타임아웃, Chrome UA 헤더
  ├─ 2. SPA 감지 — body 텍스트 < 200자 + #root/#app → spaDetected: true
  ├─ 3. Rule-based (detectByRules) — cheerio 패턴 매칭
  │   ├─ 테이블 구조 (table > tbody > tr)
  │   ├─ 리스트 구조 (ul > li, ol > li)
  │   └─ 반복 요소 (동일 클래스 div/article/section)
  │   → 점수: title+link=0.6, +date=+0.2, +thumbnail=+0.1, 5개이상=+0.1
  └─ 4. AI fallback (confidence < 0.5일 때만)
      ├─ HTML 정리 후 5000자 truncate
      ├─ GPT-5-nano (responses API) 우선
      └─ 404시 GPT-4o-mini (chat.completions) fallback
```

결과가 `crawl_sources.config.selectors`에 저장되어 크롤링 시 DEFAULT_SELECTORS 대신 사용됨.

### 크롤러 설정 구조 (crawl_sources.config JSONB)

```json
{
  "selectors": {
    "container": ".article-list",
    "item": ".article-item",
    "title": "h2.title",
    "link": "a",
    "thumbnail": "img.thumbnail",
    "author": ".author",
    "date": ".date"
  },
  "content_selectors": {
    "content": ".article-body",
    "removeSelectors": [".ad", ".related"],
    "useReadability": true
  },
  "pagination": {
    "type": "page_param",
    "param": "page",
    "maxPages": 3
  },
  "crawl_config": {
    "delay": 1000
  },
  "category": "비즈니스"
}
```

### 본문 추출 우선순위 (content-extractor.ts)

```
1. 커스텀 셀렉터 (config.content_selectors.content)
2. @mozilla/readability 자동 추출 (광고/메뉴 자동 제거)
3. 일반 셀렉터 탐색 (article, main, .content 등 20개)
4. body 전체 텍스트 (최후의 수단)
→ generatePreview()로 최대 500자 잘라서 content_preview에 저장
```

---

## 데이터베이스 스키마

### articles 테이블

| 컬럼 | 타입 | 설명 | 채워지는 시점 |
|------|------|------|-------------|
| `id` | uuid (PK) | gen_random_uuid() | INSERT 시 자동 |
| `source_id` | varchar(32) UNIQUE | URL 기반 해시 (중복 방지) | 크롤링 시 |
| `source_name` | varchar(100) | 소스 이름 | 크롤링 시 |
| `source_url` | text | 원본 기사 URL | 크롤링 시 |
| `title` | varchar(500) | 기사 제목 | 크롤링 시 |
| `thumbnail_url` | text | 썸네일 이미지 URL | 크롤링 시 |
| `content_preview` | text | **원본 본문 텍스트 (500~3000자)** | **크롤링 시 (Readability/Cheerio)** |
| `summary` | text | 3줄 요약 (레거시) | **AI 배치 요약 시 (OpenAI)** |
| `ai_summary` | text | 1줄 요약 (80자 이내) | **AI 배치 요약 시 (Edge Function)** |
| `summary_tags` | text[] | 태그 3개 | **AI 배치 요약 시 (Edge Function)** |
| `author` | varchar(100) | 작성자 | 크롤링 시 |
| `published_at` | timestamptz | 원본 게시일 | 크롤링 시 |
| `crawled_at` | timestamptz | 크롤링 시각 | INSERT 시 자동 (now()) |
| `priority` | integer | 우선순위 (기본 1) | INSERT 시 |
| `category` | varchar(50) | 카테고리 | 크롤링 시 |
| `is_active` | boolean | 활성 여부 (기본 true) | INSERT 시 |
| `created_at` | timestamptz | 생성 시각 | INSERT 시 자동 |
| `updated_at` | timestamptz | 수정 시각 | UPDATE 트리거 자동 |

**인덱스**: published_at DESC, source_name, source_id, category, is_active, crawled_at DESC

### crawl_sources 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | serial (PK) | 소스 ID |
| `name` | varchar(100) | 소스 이름 |
| `base_url` | text | 크롤링 대상 URL |
| `priority` | integer | 크롤링 우선순위 |
| `crawler_type` | text | 크롤러 전략 (STATIC/SPA/RSS 등) |
| `config` | jsonb | 크롤링 설정 (셀렉터, 페이지네이션 등) |
| `is_active` | boolean | 활성 여부 |
| `last_crawled_at` | timestamptz | 마지막 크롤링 시각 |

### crawl_logs 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | serial (PK) | 로그 ID |
| `source_id` | integer (FK) | crawl_sources.id |
| `started_at` | timestamptz | 시작 시각 |
| `finished_at` | timestamptz | 완료 시각 |
| `status` | text | running / completed / failed |
| `articles_found` | integer | 발견 수 |
| `articles_new` | integer | 신규 저장 수 |
| `error_message` | text | 에러 메시지 |

### categories 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | serial (PK) | 카테고리 ID |
| `name` | text UNIQUE | 카테고리명 |
| `is_default` | boolean | 기본 카테고리 여부 |

**기본 카테고리**: 비즈니스, 소비 트렌드

---

## 출처별 브랜드 컬러 매핑

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

## 보안 체계

### Middleware (middleware.ts)

```
모든 요청
  ├─ Rate Limiting: /api/crawl/trigger → 30초 쿨다운 (in-memory)
  ├─ Security Headers:
  │    - X-Frame-Options: DENY
  │    - X-Content-Type-Options: nosniff
  │    - Referrer-Policy: strict-origin-when-cross-origin
  │    - Permissions-Policy: camera=(), microphone=(), geolocation=()
  └─ Matcher: 정적 파일, _next, 이미지 제외
```

### 이미지 프록시 보안 (/api/image-proxy)

```
요청 → HTTPS only → 도메인 화이트리스트 → Private IP 차단 (SSRF 방지)
     → 사이즈 제한 (10MB) → Content-Type 검증 (이미지만)
     → Redirect 차단 → Referer 위장 (도메인별)
     → Cache-Control: 24h
```

**허용 도메인 (11개)**: postfiles.pstatic.net, blogfiles.pstatic.net, dimg.donga.com, img.stibee.com 등

### RLS (Row Level Security)

| 테이블 | anon (공개) | service_role (관리) |
|--------|------------|-------------------|
| articles | SELECT (is_active=true) | INSERT, UPDATE |
| crawl_sources | SELECT, INSERT, UPDATE | 전체 |
| crawl_logs | SELECT | INSERT, UPDATE |
| categories | SELECT, INSERT | 전체 |

---

## 주요 버그 패턴 및 해결책

### 1. "Failed to fetch articles" 에러

**원인**: Supabase 연결 실패 또는 RLS 정책 문제

**디버깅**:
```bash
# 1. 환경변수 확인
echo $NEXT_PUBLIC_SUPABASE_URL

# 2. Supabase Dashboard → Database → articles → Policies 확인
# anon 역할에 SELECT 권한 필요

# 3. 서버 로그 확인
# app/api/articles/route.ts의 catch 블록
```

### 2. 크롤링 0건 (articles_new: 0)

**원인**: 셀렉터 변경, 사이트 구조 변경, 모든 아티클이 이미 존재

**디버깅**:
```bash
npm run crawl:dry -- --source=<id> --verbose
# → "[DB] SKIP (already exists)" → 중복
# → "[Filter] EXCLUDE (too old)" → 날짜 필터 (7일)
# → 아무 출력 없음 → 셀렉터 문제
```

### 3. 이미지 깨짐 (403/ERR_BLOCKED)

**원인**: Hotlinking 차단 (네이버 등)

**해결**:
```typescript
// components/ArticleCard.tsx → getProxiedImageUrl()
// needsProxy 배열에 도메인 추가

// /api/image-proxy/route.ts → ALLOWED_DOMAINS에 도메인 추가
```

### 4. AI 요약 실패 (ai_summary: null)

**원인**: OpenAI API 키 만료, 요금 한도, content_preview 없음, Edge Function 오류

**디버깅**:
```bash
# 1. Supabase secrets 확인 (OPENAI_API_KEY 등록 여부)
# 2. content_preview가 null이면 요약 불가
# 3. Edge Function 로그 확인: Supabase Dashboard → Edge Functions → Logs
# 4. USE_EDGE_FUNCTION=false로 로컬 fallback 테스트
```

### 5. Puppeteer 타임아웃

**원인**: SPA 크롤러 대상 사이트 응답 지연

**해결**:
```typescript
// 1. waitForSelector 타임아웃 늘리기
// 2. 리소스 차단 (이미지, CSS)
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
    req.abort();
  }
});
// 3. STATIC 전략 전환 가능 여부 확인
```

### 6. Vercel 배포 후 크롤링 실패

**원인**: Vercel Serverless에서 Puppeteer 미지원, 타임아웃

**해결**:
```
1. maxDuration: 300 확인 (vercel.json)
2. Puppeteer → puppeteer-core + @sparticuz/chromium
3. 또는 SPA 크롤러 대상을 STATIC으로 전환
```

### 7. Edge Function 배포 오류

**원인**: Secret 미등록, 코드 오류

**해결**:
```bash
# 1. Supabase secrets 확인
curl -X GET 'https://api.supabase.com/v1/projects/{project_id}/secrets' \
  -H 'Authorization: Bearer {SUPABASE_ACCESS_TOKEN}'

# 2. Edge Function 재배포 (MCP 또는 CLI)
supabase functions deploy summarize-article

# 3. Edge Function 로그 확인
# Supabase Dashboard → Edge Functions → summarize-article → Logs
```

---

## 성능 특성

| 항목 | 값 |
|------|-----|
| 크롤링 전체 소요 시간 | ~60-120초 (소스 수에 비례) |
| AI 요약 1건 (Edge Function) | ~2-3초 |
| AI 요약 1건 (로컬 OpenAI) | ~2-3초 |
| 배치 요약 20건 | ~12초 (5개 병렬 × 4청크) |
| AI 요약 재시도 | 최대 3회 (1s→2s→3s 백오프) |
| Vercel maxDuration | 300초 |
| fetch 타임아웃 | 15초 |
| 페이지당 아티클 수 | 12개 |
| 최대 limit | 50개 |
| 이미지 프록시 캐시 | 24시간 |
| crawl/trigger Rate Limit | 30초 |

---

## 외부 서비스 의존성

| 서비스 | 용도 | 장애 시 영향 |
|--------|------|-------------|
| Supabase (PostgreSQL) | DB, Edge Functions | 전체 서비스 불가 |
| Supabase Edge Function | AI 요약 생성 (기본 경로) | 로컬 OpenAI fallback 작동 |
| OpenAI API | AI 요약 (GPT-5-nano/GPT-4o-mini) | 요약 생성 불가 (크롤링은 정상) |
| Vercel | 호스팅, Cron | 서비스 접속 불가 |
| 크롤링 대상 사이트 | 콘텐츠 소스 | 해당 소스만 크롤링 실패 |

---

## 환경변수

### 필수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 (공개) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키 (서버 전용) |
| `OPENAI_API_KEY` | OpenAI API 키 (로컬 fallback용) |
| `CRON_SECRET` | Cron Job 인증 토큰 |

### 선택

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `USE_EDGE_FUNCTION` | `true` | AI 요약 경로 (true: Edge Function, false: 로컬) |

### Supabase Secrets (Edge Function용)

| Secret | 용도 |
|--------|------|
| `OPENAI_API_KEY` | Edge Function에서 OpenAI API 호출 |

---

## 배포 구성

### Vercel (vercel.json)

```json
{
  "crons": [{ "path": "/api/crawl/run", "schedule": "0 0 * * *" }],
  "functions": {
    "app/api/crawl/run/route.ts": { "maxDuration": 300 },
    "app/api/summarize/batch/route.ts": { "maxDuration": 300 }
  },
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
    ]}
  ]
}
```

### GitHub

- **Repository**: https://github.com/mochunab/all_info.git
- **Branch**: main
- **GitHub Actions**: 없음 (Vercel Cron으로 크롤링 자동화)
