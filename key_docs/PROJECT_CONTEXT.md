# PROJECT_CONTEXT.md - 시스템 아키텍처 & 디버깅 가이드

> AI와 개발자 모두를 위한 프로젝트 전체 아키텍처 문서
> 최종 업데이트: 2026-02-21 (v1.5.3)

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
│                     │           │  /api/sources/recommend   │
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
               ┌──────────────┐     ┌──────────────────┐    ┌──────────────────────┐
               │   Supabase   │     │  Crawlers (7전략) │    │  Supabase Edge Fn    │
               │  (PostgreSQL)│     │                  │    │                      │
               │              │     │  - STATIC        │    │  1. summarize-       │
               │  - articles  │     │  - SPA           │    │     article          │
               │  - crawl_    │     │  - RSS           │    │     (AI 요약)        │
               │    sources   │     │  - PLATFORM_NAVER│    │                      │
               │  - crawl_    │     │  - PLATFORM_KAKAO│    │  2. detect-crawler-  │
               │    logs      │     │  - NEWSLETTER    │    │     type             │
               │  - categories│     │  - API           │    │     (AI 타입 감지)   │
               └──────────────┘     └──────────────────┘    │     │                │
                                           │                │                      │
                                           │                │  3. detect-api-      │
                                           │                │     endpoint         │
                                           │                │     (API 자동 감지)  │
                                           │                │                      │
                                           │                │  4. recommend-       │
                                           │                │     sources          │
                                           │                │     (AI 소스 추천)   │
                                           │                │     │                │
                                           │                │     ▼                │
                                           │                │  OpenAI API          │
                                           │                │  • GPT-5-nano        │
                                           │                │  • GPT-4o-mini       │
                                           │                └──────────────────────┘
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
components/LanguageSwitcher.tsx       → 언어 선택 드롭다운 (4개 언어: ko, en, ja, zh)
components/Skeleton.tsx               → 로딩 스켈레톤 (카드 레이아웃)
components/Toast.tsx                  → 토스트 알림
app/api/articles/route.ts             → GET - 아티클 목록 (검색/필터/페이지네이션)
app/api/articles/sources/route.ts     → GET - 소스별 아티클
```

### 소스 관리 (추가/수정/삭제)

```
app/sources/add/page.tsx              → 소스 추가/편집 페이지 (카테고리 선택, 링크 CRUD)
app/api/sources/route.ts              → GET/POST - 소스 CRUD (upsert + deleteIds 삭제)
app/api/sources/recommend/route.ts   → POST - AI 콘텐츠 소스 추천 (Same-Origin Auth)
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
lib/crawlers/strategies/sitemap.ts    → SITEMAP: sitemap.xml 파싱 (RSS 없는 사이트)
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

### 크롤러 타입 자동 감지 (2026-02-14 추가)

```
lib/crawlers/strategy-resolver.ts     → 8+단계 크롤러 타입 자동 감지 파이프라인 (step 7.5 포함)
lib/crawlers/infer-type.ts            → URL 패턴 기반 타입 추론 (confidence 포함, SPA shell 감지 강화)
lib/crawlers/auto-detect.ts           → detectCrawlerTypeByAI() - AI 타입 감지 함수
                                         detectByRules() - Rule-based 셀렉터 분석
                                         detectByAI() - AI 셀렉터 탐지 (SPA shell 감지 규칙 추가)
lib/crawlers/url-optimizer.ts         → URL 최적화 (4단계 필터 + 섹션 교차 리다이렉트 방지)
lib/crawlers/title-cleaner.ts         → 제목 클리닝 유틸리티
lib/crawlers/quality-filter.ts        → 기사 품질 필터 (광고성 콘텐츠 제거)
lib/crawlers/firecrawl-client.ts      → Firecrawl API 클라이언트
lib/crawlers/strategies/firecrawl.ts  → Firecrawl 기반 크롤러 전략
supabase/functions/detect-crawler-type/index.ts  → Edge Function (GPT-5-nano 크롤러 타입 감지)
supabase/functions/detect-api-endpoint/index.ts  → Edge Function (Puppeteer+AI API 엔드포인트 탐지)
supabase/functions/recommend-sources/index.ts    → Edge Function (GPT-5-nano + web_search 소스 추천)
```

### AI 요약

```
lib/ai/summarizer.ts                  → 로컬 OpenAI (GPT-4o-mini) 요약 + 통합 프롬프트
lib/ai/batch-summarizer.ts            → 배치 요약 오케스트레이터 (Edge Fn 우선 → 로컬 fallback)
supabase/functions/summarize-article/index.ts → Edge Function (Deno, GPT-5-nano 요약)
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
lib/i18n.ts                           → 다국어 번역 시스템 (ko, en, ja, zh)
types/index.ts                        → 공통 타입 (Article, CrawlSource, Language 등)
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
  3. 제한 병렬 실행 (워커 풀, v1.5.3):
  │   ├─ 비SPA 소스: 최대 5개 동시 (runWithConcurrency)
  │   ├─ SPA 소스: 직렬 (Puppeteer 공유 인스턴스 보호)
  │
  │
  │   ┌─ crawl_logs 레코드 생성 (status: 'running')
  │   │
  │   ├─ runCrawler(source, supabase) 호출 (lib/crawlers/index.ts)
  │   │   │
  │   │   ├─ [0단계: URL 최적화] effectiveUrl 결정
  │   │   │   │  crawl_url이 설정되어 있으면 사용, 없으면 base_url 사용
  │   │   │   │  • effectiveUrl = source.crawl_url || source.base_url
  │   │   │   │  • base_url: 사용자 입력 원본 (UI 표시용)
  │   │   │   │  • crawl_url: 자동 최적화된 URL (소스 저장 시 생성)
  │   │   │   └─ effectiveSource = { ...source, base_url: effectiveUrl }
  │   │   │
  │   │   ├─ [크롤러 선택] getCrawler(effectiveSource) — (2026-02-19 우선순위 개선)
  │   │   │   ├─ 1. LEGACY_CRAWLER_REGISTRY 최우선 확인 (검증된 전용 크롤러)
  │   │   │   │   └─ wiseapp, brunch, retailtalk, stonebc, iconsumer, openads, buybrand
  │   │   │   ├─ 2. source.crawler_type 명시적 설정 → crawlWithStrategy() 사용
  │   │   │   └─ 3. URL 패턴 추론 (inferCrawlerType) → crawlWithStrategy() 폴백
  │   │   │       blog.naver.com  → PLATFORM_NAVER
  │   │   │       brunch.co.kr    → PLATFORM_KAKAO
  │   │   │       /feed, /rss     → RSS
  │   │   │       stibee.com      → NEWSLETTER
  │   │   │       기타             → SPA (기본)
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
  │   │   ├─ [본문 미리보기 2단계 fallback] (레거시 크롤러 포함, 2026-02-19 추가)
  │   │   │   └─ content_preview가 없거나 50자 미만인 아티클만 대상
  │   │   │       ├─ 1차: fetchArticleContent() — Cheerio 정적 파싱 (빠름)
  │   │   │       └─ 2차: spaStrategy.crawlContent() — Puppeteer JS 렌더링 (SPA 대응)
  │   │   │           └─ spa.crawlContent: `load` 이벤트 + 3초 대기 (networkidle2 타임아웃 방지)
  │   │   │   └─ 루프 종료 후 closeBrowser() 호출 (브라우저 메모리 정리)
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
- **전략 선택**: 레거시 사이트별 크롤러 최우선 → DB의 crawler_type → URL 기반 자동 추론 순 (2026-02-19 수정)
- **타임아웃**: Vercel maxDuration 300초, 개별 fetch 15초 타임아웃

---

### 1-1. AI 기반 크롤러 타입 자동 감지 시스템 (2026-02-14 추가)

새로운 소스 저장 시 최적의 크롤러 타입을 **자동으로 감지**하는 9단계 파이프라인.
Rule-based 분석이 불확실할 때 **GPT-5-nano AI**가 HTML 구조를 분석하여 결정.

#### 아키텍처

```
┌───────────────────────────────────────────────────────────────────┐
│  POST /api/sources (소스 저장)                                     │
│  - 사용자가 "자동지정" 선택 시 크롤러 타입 자동 결정                 │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────────────────────┐
│  lib/crawlers/strategy-resolver.ts                                │
│  resolveStrategy(url) → StrategyResolution                         │
│                                                                    │
│  9단계 파이프라인:                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 1. HTML 페이지 다운로드 (15초 타임아웃)                      │  │
│  │    └─ 실패 시 → URL 패턴 폴백                                │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 2. RSS 자동 발견 (최고 우선순위)                             │  │
│  │    └─ <link rel="alternate" type="rss+xml"> 태그 탐색       │  │
│  │    └─ RSS 유효성 검증 (3초 타임아웃)                         │  │
│  │    └─ ✅ 성공 → RSS (confidence: 0.95) 리턴                  │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 2.5. 🆕 Sitemap 자동 발견 (2026-02-19 추가)                  │  │
│  │    └─ /sitemap.xml, /sitemap_index.xml 후보 시도             │  │
│  │    └─ <urlset> 또는 <sitemapindex> 태그 확인                 │  │
│  │    └─ ✅ 성공 → SITEMAP (confidence: 0.90) 리턴              │  │
│  │    └─ sitemap URL은 config.crawl_config.rssUrl에 저장        │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 3. CMS 플랫폼 감지                                            │  │
│  │    └─ WordPress (wp-content, wp-includes)                   │  │
│  │    └─ Tistory (.tistory.com)                                │  │
│  │    └─ Ghost (/ghost/), Medium (medium.com)                  │  │
│  │    └─ ✅ 감지 → STATIC (confidence: 0.75) 리턴               │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 4. URL 패턴 분석 (inferCrawlerTypeEnhanced)                 │  │
│  │    └─ .go.kr, .or.kr, nipa.kr → SPA (0.95)                  │  │
│  │    └─ blog.naver.com → PLATFORM_NAVER (0.95)                │  │
│  │    └─ brunch.co.kr → PLATFORM_KAKAO (0.95)                  │  │
│  │    └─ /rss, /feed → RSS (0.95)                              │  │
│  │    └─ confidence >= 0.85 → ✅ 즉시 리턴                      │  │
│  │    └─ confidence < 0.85 → 다음 단계 진행                     │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 5. SPA 스코어링 감지 (calculateSPAScore)                     │  │
│  │    └─ body 텍스트 < 500자 → +0.3                            │  │
│  │    └─ #root, #app 마운트 포인트 → +0.3                       │  │
│  │    └─ noscript 경고 → +0.2                                   │  │
│  │    └─ score >= 0.5 → ✅ SPA 리턴                             │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ [Stage 6 Rule-based CSS 셀렉터 패턴 분석 — v1.5.1에서 제거]  │  │
│  │  └─ detectByRules() 파이프라인에서 제외 → AI가 항상 실행     │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 7+8. 🆕 AI 감지 병렬 실행 (Promise.all, v1.5.1)              │  │
│  │    ├─ 7. AI 크롤러 타입 감지 (detectCrawlerTypeByAI)         │  │
│  │    │    └─ Edge Function 호출 (detect-crawler-type)         │  │
│  │    │       └─ GPT-5-nano가 HTML 구조 분석 (30초 타임아웃)    │  │
│  │    │       └─ 출력: { crawlerType, confidence, reasoning }  │  │
│  │    │    └─ confidence >= 0.6 → ✅ AI 결과 사용               │  │
│  │    │                                                         │  │
│  │    └─ 8. AI 셀렉터 탐지 (detectContentSelectors, infer-type) │  │
│  │         └─ HTML 전처리: <head> + 인라인 스크립트 제거 후 50KB│  │
│  │         └─ trySemanticDetection: <article> 3개+ 시만 신뢰    │  │
│  │         └─ Tailwind 콜론 이스케이프 (.dark:x → .dark\:x)    │  │
│  │         └─ AI JSON 수리: \: → \\: (Bad escaped char 방지)    │  │
│  │         └─ ✅ 성공 → STATIC + AI selectors 리턴              │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 7.5. 🆕 API 엔드포인트 자동 감지 (AI 타입=SPA 확정 후)         │  │
│  │    └─ SPA 타입 확정 시 detect-api-endpoint Edge Function 호출│  │
│  │       └─ Puppeteer로 네트워크 요청 탐지                      │  │
│  │       └─ GPT-5-nano가 API 엔드포인트 식별                    │  │
│  │       └─ ✅ API 발견 → crawler_type=API + crawl_config 저장  │  │
│  │       └─ 미발견 → SPA 타입 그대로 유지                       │  │
│  │    └─ crawl_config 구조:                                     │  │
│  │       { endpoint, method, headers, body,                    │  │
│  │         responseMapping, urlTransform }                     │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 8.5. 🆕 SPA 셀렉터 재감지 (v1.5.2, 정적 HTML 신뢰도 낮을 때) │  │
│  │    └─ 조건: SPA 페이지 && 셀렉터 confidence < 0.5           │  │
│  │    └─ getRenderedHTML(url) → Puppeteer 렌더링 HTML 획득      │  │
│  │       └─ load 이벤트 후 3초 대기 (JS 실행 완료)              │  │
│  │       └─ 이미지/폰트 차단 (속도 최적화)                      │  │
│  │    └─ 렌더링 HTML로 detectContentSelectors 재실행            │  │
│  │       └─ 재감지 신뢰도 > 기존 → ✅ Puppeteer HTML 셀렉터 채택│  │
│  │       └─ 재감지 실패 → 기존 결과 유지 (graceful fallback)    │  │
│  │    └─ 해결: JS 로드 아티클 목록을 정적 HTML에서 찾지 못하던  │  │
│  │       문제 (예: joongang.co.kr/bicnic/trend 뉴스레터 오탐)   │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ Default: URL 패턴 기본값 사용 (최소 confidence: 0.3)         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────┬────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │  DB 저장 (crawl_sources)                      │
        │  - crawler_type: 감지된 타입 (SPA→API 가능)  │
        │  - config.selectors: 셀렉터                  │
        │  - config.crawl_config: API 설정 (API타입 시)│
        │  - config._detection: 메타데이터              │
        └──────────────────────────────────────────────┘
```

#### AI 크롤러 타입 감지 Edge Function

**파일**: `supabase/functions/detect-crawler-type/index.ts`

```typescript
// Edge Function 호출 흐름
detectCrawlerTypeByAI(html, url)
  └─ POST {SUPABASE_URL}/functions/v1/detect-crawler-type
     └─ Authorization: Bearer {SERVICE_ROLE_KEY}
     └─ Body: { url, html: "첫 5000자..." }

     // Edge Function 내부 (Deno)
     ├─ OpenAI Responses API (GPT-5-nano, reasoning: medium)
     │  └─ 404 시 → chat.completions (GPT-4o-mini) fallback
     │
     ├─ AI 프롬프트 (2000+ 토큰)
     │  ├─ 7가지 크롤러 타입 정의 (STATIC, SPA, RSS, ...)
     │  ├─ SPA 감지 지표: #root, React/Vue 스크립트, noscript
     │  ├─ STATIC 감지 지표: 완전한 HTML, 실제 콘텐츠, CMS 흔적
     │  ├─ 정부/공공기관 우선: .go.kr → 무조건 SPA
     │  └─ confidence 기준: 0.9~1.0 (명확), 0.7~0.9 (강함), ...
     │
     └─ 출력: { crawlerType, confidence, reasoning }
```

#### 감지 방법별 우선순위

| 순서 | 방법 | Detection Method | Confidence | 설명 |
|------|------|-----------------|------------|------|
| 1 | RSS 자동 발견 | `rss-discovery` | 0.95 | `<link>` 태그 + 유효성 검증. **6개 경로 Promise.all 병렬** (v1.5.1) |
| 1.5 | 🆕 Sitemap 발견 | `sitemap-discovery` | 0.90 | `/sitemap.xml` 탐색 → `<urlset>` 확인. **2개 후보 Promise.all 병렬** (v1.5.1) |
| 2 | CMS 감지 | `cms-detection` | 0.75 | WordPress, Tistory, Ghost 등 |
| 3 | URL 패턴 (고신뢰) | `url-pattern` | 0.85~0.95 | `.go.kr`, `naver.com`, `/feed` 등 |
| 4 | SPA 스코어링 | `rule-analysis` | 0.5~1.0 | body 텍스트, 마운트 포인트 분석 |
| ~~5~~ | ~~Rule-based 셀렉터~~ | ~~`rule-analysis`~~ | ~~0.5~1.0~~ | **v1.5.1에서 제거** — AI가 항상 실행하므로 불필요 |
| 6 | AI 타입 감지 | `ai-type-detection` | 0.6~1.0 | GPT-5-nano HTML 구조 분석. **Stage 8과 Promise.all 병렬** (v1.5.1) |
| 6.5 | 🆕 AI 셀렉터 탐지 | `ai-selector-detection` | 0.5~1.0 | infer-type.ts (HTML 전처리 + Tailwind 이스케이프, v1.5.1). Stage 6과 병렬 |
| 7.5 | 🆕 API 엔드포인트 감지 | `api-detection` | 자동 | SPA 확정 후 숨겨진 API 탐지 → crawler_type=API 전환 |
| 8.5 | 🆕 SPA 셀렉터 재감지 | `ai-selector-detection` | 재시도 | SPA + confidence < 0.5 → Puppeteer 렌더링 HTML로 재감지 (v1.5.2) |
| 8 | URL 패턴 (기본값) | `default` | 0.3~0.5 | 모든 분석 실패 시 |

#### detect-api-endpoint Edge Function (2026-02-19 추가)

**파일**: `supabase/functions/detect-api-endpoint/index.ts`

SPA 타입이 확정된 후, 숨겨진 REST API 엔드포인트를 자동으로 찾아 `crawl_config`에 저장합니다.

```typescript
// Edge Function 호출 흐름 (strategy-resolver.ts Step 7.5)
detectApiEndpoint(url)
  └─ Puppeteer로 페이지 방문 + 네트워크 요청 캡처
     └─ XHR/Fetch 요청 목록 수집
     └─ POST {SUPABASE_URL}/functions/v1/detect-api-endpoint
        └─ Body: { url, networkRequests: [...] }

        // Edge Function 내부 (Deno)
        ├─ GPT-5-nano가 네트워크 요청 목록 분석
        │  └─ 콘텐츠 목록 API vs 기타 요청 구분
        │  └─ POST body 구조, 응답 스키마 추론
        │
        └─ 출력: {
             endpoint, method, headers, body,
             responseMapping: { items, title, link, thumbnail, date },
             urlTransform: { linkTemplate, thumbnailPrefix }
           }
```

**crawl_config 저장 구조 (API 타입)**:
```json
{
  "crawl_config": {
    "endpoint": "https://example.com/api/getList.json",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
      "Origin": "https://example.com",
      "Referer": "https://example.com/list/"
    },
    "body": {
      "sortType": "new",
      "pageInfo": { "currentPage": 0, "pagePerCnt": 30 }
    },
    "responseMapping": {
      "items": "dataList",
      "title": "title",
      "link": "urlKeyword",
      "thumbnail": "imgPath",
      "date": "regDt"
    },
    "urlTransform": {
      "linkTemplate": "https://example.com/detail/{urlKeyword}",
      "linkFields": ["urlKeyword"],
      "thumbnailPrefix": "https://cdn.example.com"
    }
  },
  "_detection": {
    "method": "api-detection",
    "confidence": 0.9,
    "reasoning": "POST /api/getList.json 탐지, 30개 아이템 반환 확인"
  }
}
```

#### 사용 예시

**케이스 1: 정부 포털 (.go.kr)**
```
URL: https://www.nipa.kr/home/bsnsAll/0/select?tab=2

[Step 4] URL 패턴: .go.kr 감지 → confidence 0.95
✅ 즉시 리턴: SPA (url-pattern)
```

**케이스 2: 알 수 없는 블로그**
```
URL: https://unknown-blog.com/posts

[Step 6] Rule-based: confidence 0.55 (< 0.7)
[Step 7] AI 분석 중...
  └─ GPT-5-nano: "HTML에 완전한 article 태그와 본문 텍스트 존재.
                  WordPress 흔적 발견 (wp-content). 정적 크롤링 가능."
  └─ confidence: 0.82
✅ 리턴: STATIC (ai-type-detection)
```

**케이스 3: React SPA**
```
URL: https://spa-app.com/dashboard

[Step 5] SPA 스코어: 0.7 (body < 500자, #root 존재)
✅ 리턴: SPA (rule-analysis)
```

#### 비용 최적화

- **Rule-based 우선**: 70%의 경우 AI 호출 없이 해결
- **AI는 불확실할 때만**: confidence < 0.7일 때만 Edge Function 호출
- **소스 저장은 1회성**: 크롤링 타입 결정은 소스 추가 시 1회만 발생
- **예상 AI 호출**: 신규 소스의 약 30% (월 10개 → 3회 호출)

#### 확장성

- **하드코딩 불필요**: 새 도메인 추가 시 코드 수정 없음
- **학습 효과**: AI가 HTML 패턴을 직접 학습
- **투명성**: `reasoning` 필드로 AI 판단 근거 제공
- **재분석 가능**: 기존 소스도 재분석 가능 (crawler_type 업데이트)

---

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
            ├─ [URL 최적화] optimizeUrl() 실행 (lib/crawlers/url-optimizer.ts)
            │   ├─ 1. 도메인 매핑 (수동 규칙, confidence: 0.95)
            │   ├─ 2. 경로 패턴 탐색 (/feed, /rss, /blog 등, confidence: 0.8)
            │   ├─ 3. HTML 네비게이션 링크 발견 (confidence: 0.75)
            │   │   ├─ 4단계 필터: excludePath → excludeText → contentPath → contentText
            │   │   ├─ 섹션 교차 리다이렉트 방지 (첫 번째 경로 세그먼트 비교)
            │   │   └─ 루트 URL(/)은 제한 없이 탐색 가능
            │   └─ → crawl_url 생성 (최적화 실패 시 NULL)
            ├─ 모든 URL에 대해 resolveStrategy() 실행 (8+단계 파이프라인)
            │   ├─ Rule-based: RSS 발견, CMS 감지, URL 패턴, SPA 스코어링
            │   ├─ AI 타입 감지: GPT-5-nano (confidence < 0.7일 때)
            │   ├─ 🆕 API 감지 (Step 7.5): SPA 확정 시 detect-api-endpoint 호출
            │   │   └─ API 발견 → crawler_type=API, crawl_config 저장
            │   └─ AI 셀렉터 탐지: GPT-4o-mini (SPA shell 감지 포함)
            ├─ 기존 소스 → UPDATE (crawler_type, config 분석 결과 적용)
            ├─ 신규 소스 → INSERT (crawler_type, config.selectors/crawl_config 포함)
            └─ 응답에 analysis 배열 포함 (method, confidence, crawlerType, apiDetected)
```

---

## API Routes 전체 맵

| Route | Method | Auth | 용도 | Timeout |
|-------|--------|------|------|---------|
| `/api/articles` | GET | 없음 | 아티클 목록 (페이지네이션, 검색, 필터) | 기본 |
| `/api/articles/sources` | GET | 없음 | 활성 소스명 목록 (distinct) | 기본 |
| `/api/sources` | GET | 없음 | 크롤 소스 목록 | 기본 |
| `/api/sources` | POST | SameOrigin 또는 CRON | 소스 추가/수정 (auto-detect 셀렉터 분석 + API 감지 포함) | 300초 |
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
| `SITEMAP` | fetch + Cheerio | RSS 없는 정적 사이트 | sitemap.xml 파싱 → 각 URL 개별 fetch, 최대 15개 |
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
  기타            → SPA (기본 — JS 렌더링으로 대부분 페이지 수집 가능)
```

### CSS 셀렉터 자동 탐지 (infer-type.ts, v1.5.1 대폭 개선)

소스 저장 시 (`POST /api/sources`) 페이지 HTML을 분석하여 최적의 셀렉터를 자동 감지:

```
detectContentSelectors(url, html)   ← strategy-resolver.ts Stage 8에서 호출
  ├─ 1. HTML 전처리 (v1.5.1 NEW)
  │   ├─ <head>...</head> 전체 제거 (CSS/JS 번들 ~35KB 제거)
  │   ├─ 200자 이상 인라인 <script>/<style> 제거
  │   └─ 정리 후 50KB 제한 적용 → 아티클 카드 가시성 확보
  │
  ├─ 2. trySemanticDetection (v1.5.1 강화)
  │   ├─ <article> 태그 3개+ → confidence 0.8 반환 (신뢰)
  │   └─ 그 외 → AI 감지로 진행 (이전: <main>만으로도 0.9 반환하던 문제 수정)
  │
  └─ 3. AI 감지 (GPT-4o-mini) — 항상 실행 (Rule-based 제거로 인해)
      ├─ 개선된 프롬프트: 아티클 카드 정의, REJECT 패턴 명시
      │   ├─ REJECT: 카테고리/필터탭 (/c/category, ?tag=), 네비게이션, 통계 숫자
      │   └─ REQUIRE: 슬러그/ID가 있는 상세 페이지 URL
      ├─ JSON 수리: AI 생성 \: → \\: 변환 (Bad escaped character 방지)
      └─ Tailwind 이스케이프: .dark:text-slate-200 → .dark\:text-slate-200
```

결과가 `crawl_sources.config.selectors`에 저장되어 크롤링 시 DEFAULT_SELECTORS 대신 사용됨.

### 크롤러 설정 구조 (crawl_sources.config JSONB)

**STATIC/SPA 타입 (셀렉터 기반)**:
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
  "category": "비즈니스",
  "_detection": {
    "method": "rule-analysis",
    "confidence": 0.82,
    "fallbackStrategies": []
  }
}
```

**API 타입 (crawl_config 기반, 2026-02-19 추가)**:
```json
{
  "crawl_config": {
    "endpoint": "https://example.com/api/getList.json",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json, text/plain, */*",
      "Origin": "https://example.com",
      "Referer": "https://example.com/list/"
    },
    "body": {
      "sortType": "new",
      "pageInfo": { "currentPage": 0, "pagePerCnt": 30 }
    },
    "responseMapping": {
      "items": "dataList",
      "title": "title",
      "link": "urlKeyword",
      "thumbnail": "imgPath",
      "date": "regDt"
    },
    "urlTransform": {
      "linkTemplate": "https://example.com/detail/{urlKeyword}",
      "linkFields": ["urlKeyword"],
      "thumbnailPrefix": "https://cdn.example.com"
    }
  },
  "_detection": {
    "method": "api-detection",
    "confidence": 0.9,
    "reasoning": "Puppeteer 네트워크 탐지 + AI 분석"
  }
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

### 레거시 크롤러 본문 추출 2단계 fallback (2026-02-19 추가)

SPA/API 사이트는 Cheerio 정적 파싱이 실패(HTTP 404 또는 빈 body)하므로, `index.ts`의 본문 미리보기 추출 루프에 Puppeteer 2차 fallback이 적용됨.

```
content_preview가 없거나 < 50자인 아티클에 대해:
  1차: fetchArticleContent(url)     — Cheerio (빠름, 정적 페이지)
  2차: spaStrategy.crawlContent(url) — Puppeteer (SPA/JS 렌더링)
    └─ spa.crawlContent 내부: waitUntil='load' + 3초 대기
       (networkidle2는 폴링/WebSocket 유지 사이트에서 30초 타임아웃)
루프 종료 후: closeBrowser() (Puppeteer 싱글톤 브라우저 정리)
```

**< 50자 조건의 이유**: API 전략의 `crawlContent`가 JSON 파싱 실패 시 `'{}'` (2자)를 반환하여 `content_preview`에 저장될 수 있음. 이 경우 falsy 체크(`!content_preview`)만으로는 Puppeteer fallback이 트리거되지 않음.

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
| `base_url` | text | 사용자 입력 원본 URL (UI 표시용) |
| `crawl_url` | text (nullable) | 실제 크롤링할 최적화된 URL (NULL이면 base_url 사용) |
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
| `is_default` | boolean | 기본 카테고리 여부 (deprecated) |
| `display_order` | integer | 표시 순서 (드래그 앤 드롭으로 변경 가능) |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 |

**정렬**: `display_order ASC, name ASC`

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

**허용 도메인 (12개)**: postfiles.pstatic.net, blogfiles.pstatic.net, dimg.donga.com, img.stibee.com, www.wiseapp.co.kr (2026-02-19 추가) 등

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


### 8. API 타입 소스 content_preview NULL / SPA 페이지 본문 추출 실패

**원인 1**: `crawler_type=API` 소스의 `crawlContent`가 FE 라우트 URL에 JSON fetch를 시도 → HTTP 404 → `'{}'` (2자) 반환 → `content_preview`에 무의미한 값 저장

**원인 2**: `config.crawl_config.urlTransform.linkTemplate`이 잘못된 URL 패턴 → Cheerio·Puppeteer 모두 404 페이지 렌더링
- 예: `/insight/{insightNid}` → 실제 URL은 `/insight/detail/{insightNid}`

**자동 해결 (v1.4.1~)**: `content_preview < 50자`이면 Puppeteer fallback 자동 시도

**수동 확인**:
```bash
npm run crawl:dry -- --source=<id> --verbose
# "🔄 Cheerio 실패 → Puppeteer 시도..." 로그 확인
```

**linkTemplate 수정**:
```bash
# Supabase Dashboard → crawl_sources → config.crawl_config.urlTransform.linkTemplate 확인/수정
# 또는:
UPDATE crawl_sources
SET config = jsonb_set(config, '{crawl_config,urlTransform,linkTemplate}', '"https://example.com/detail/{id}"')
WHERE id = <소스ID>;
```

### 9. AI 셀렉터 탐지 — 필터탭/카테고리 링크를 아티클로 오인

**원인 1**: `<head>` CSS/JS 번들(~35KB)이 HTML 앞부분을 차지 → 50KB 제한 시 아티클 카드는 잘려서 AI가 볼 수 없음. AI는 필터탭(30~45KB 위치)만 보고 잘못된 셀렉터 선택.

**원인 2**: `trySemanticDetection`이 `<main>` 태그만으로 confidence 0.9 반환 → AI 우회하여 부정확한 셀렉터 사용.

**원인 3**: Tailwind CSS 클래스 (`.dark:text-slate-200`)를 Cheerio가 pseudo-class `:text-slate-200`으로 파싱 시도 → `Unknown pseudo-class` 에러.

**자동 해결 (v1.5.1~)**:
- HTML 전처리로 `<head>` 제거 → 아티클 카드 50KB 내 위치
- `<article>` 3개+ 조건으로 시맨틱 감지 강화
- `escapeTailwindColons()` 함수로 Tailwind 콜론 자동 이스케이프
- JSON 수리로 AI 생성 `\:` → `\\:` 변환

**수동 확인**:
```bash
# AI 셀렉터 탐지 테스트
npx tsx /tmp/test-selectors.ts  # detectContentSelectors 직접 호출
# config._detection.reasoning에서 감지 근거 확인
npm run crawl:dry -- --source=<id> --verbose
```

### 9. API 타입 소스 크롤링 0건 (crawl_config 없음)

**원인**: `crawler_type=API`인데 `config.crawl_config`가 없으면 APIStrategy가 `base_url`을 API URL로 사용 → HTML 응답 → JSON 파싱 실패 → 0건

**증상**: 크롤링 로그에 "JSON 파싱 실패" 또는 "articles_found: 0"

**해결**:
```bash
# Supabase Dashboard → crawl_sources → 해당 소스의 config 컬럼 확인
# crawl_config가 없으면 수동으로 추가 또는 소스 재저장 (AUTO 타입으로)

# 또는 MCP SQL로 직접 수정:
UPDATE crawl_sources 
SET config = jsonb_set(config, '{crawl_config}', '{"endpoint":"https://...","method":"POST",...}')
WHERE id = <소스ID>;
```

### 10. 날짜 필터로 기사가 누락되는 경우

**원인**: `isWithinDays()` 필터 — 기본 14일 초과 기사는 수집 안 함

**증상**: 크롤링 로그에 "SKIP (too old): <제목>"

**해결**:
```typescript
// lib/crawlers/base.ts isWithinDays()의 기본값 조정
// 또는 각 전략 파일에서 호출 시 days 파라미터 변경
isWithinDays(publishedAt, 30, title)  // 30일로 확장
```

> **현재 설정 (2026-02-19)**: 14일 윈도우 (이전 7일에서 변경)

---

## 성능 특성

| 항목 | 값 |
|------|-----|
| 크롤링 전체 소요 시간 | ~30-60초 (제한 병렬, v1.5.3) |
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
| RSS 경로 탐색 (6경로 병렬) | ~3초 (이전 최악: 18초 순차) |
| Sitemap 탐색 (2후보 병렬) | ~5초 (이전 최악: 10초 순차) |
| Stage 7+8 병렬화 절약 | ~5초 (AI 타입 + 셀렉터 동시 실행) |

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
    "app/api/summarize/batch/route.ts": { "maxDuration": 300 },
    "app/api/sources/route.ts": { "maxDuration": 300 }
  },
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
    ]}
  ]
}
```

> **sources maxDuration 300초 이유 (2026-02-19)**: 소스 저장 시 step 7.5 API 감지에 Puppeteer(~30초) + AI API(~34초) = 64초 소요 → 60초 기본 초과.

---

## 버전 히스토리 (주요 변경)

### v1.5.3 (2026-02-21)
- **크롤링 제한 병렬 처리** (`app/api/crawl/trigger/route.ts`)
  - 워커 풀 패턴 (`runWithConcurrency`): 비SPA 소스 최대 5개 동시, SPA 직렬
  - `maxDuration = 300` 추가
- **UI 무한 로딩 수정** (`app/page.tsx`)
  - 폴링 기반 크롤링 완료 감지 (`crawlSeenRunning` ref)
  - 10분 AbortController 타임아웃
- **URL 최적화 필터 강화** (`lib/crawlers/url-optimizer.ts`)
  - 4단계 필터: `excludePathPatterns` → `excludeTextKeywords` → `contentPathKeywords` → `contentTextKeywords`
  - 섹션 교차 리다이렉트 방지: 원본 URL의 첫 번째 경로 세그먼트와 다른 섹션으로의 리다이렉트 차단
    - 예: `/bicnic/trend` → `/plus` 차단 (bicnic ≠ plus), `/` → `/blog` 허용
  - RSS 발견 로직 제거 (strategy-resolver 2단계와 중복 + optimizedUrl 버그 방지)
- **아티클 삭제 API** (`app/api/articles/[id]/route.ts`): soft-delete (is_active=false)

### v1.5.2 (2026-02-19)
- **STATIC 타이틀 셀렉터 수정** (`lib/crawlers/strategies/static.ts`)
  - `DEFAULT_SELECTORS.title`에서 `a` 제거 → 부모 `<a>` 태그가 자식 `<h2>` 보다 먼저 매칭되어 제목+소제목이 붙는 문제 수정
  - `parseItem` fallback(`$el.find('a').first().text()`)은 유지
- **RSS 0건 STATIC fallback 복원** (`lib/crawlers/index.ts`)
  - RSS 0건 early return 로직 제거 → 날짜 필터 초과 시 STATIC 폴백 정상 동작
- **AI 셀렉터 프롬프트 개선** (`lib/crawlers/infer-type.ts`)
  - 뉴스레터/채널 디렉토리 오탐 방지 규칙 추가 (짧은 브랜드명, 날짜 없는 카드 REJECT)
  - 아티클 선택 우선순위: 제목 길이 > 날짜 노출 > 요약 텍스트 > URL 패턴
- **SPA 셀렉터 재감지 (Step 8.5)** (`lib/crawlers/strategy-resolver.ts`, `spa.ts`)
  - `getRenderedHTML(url)` export 추가: Puppeteer로 JS 렌더링 후 HTML 반환 (load + 3s wait)
  - SPA 페이지 + confidence < 0.5 조건에서 Puppeteer HTML로 `detectContentSelectors` 재실행
  - 재감지 신뢰도가 더 높을 때만 결과 교체 (graceful fallback)

### v1.5.1 (2026-02-19)
- **AI 셀렉터 감지 고도화** (`lib/crawlers/infer-type.ts`)
  - HTML 전처리: `<head>` + 200자 이상 인라인 `<script>`/`<style>` 제거 후 50KB 제한
    - 해결: `<head>` CSS/JS 번들(~35KB)이 아티클 카드를 50KB 밖으로 밀어내던 근본 원인
  - `trySemanticDetection` 조건 강화: `<article>` 태그 3개+ 있을 때만 신뢰도 0.8 반환
    - 이전: `<main>` 태그만으로 신뢰도 0.9 반환 → AI 우회하여 잘못된 셀렉터 사용하던 문제 수정
  - `escapeTailwindColons()` 함수 추가: `.dark:text-slate-200` → `.dark\:text-slate-200`
    - Cheerio CSS 파서가 `:` 를 pseudo-class로 해석하는 문제 방지 (모든 Tailwind 사이트에 적용)
  - JSON 수리: AI가 생성한 `\:` → `\\:` 변환 후 JSON.parse (Bad escaped character 방지)
  - AI 프롬프트 전면 재작성
    - STEP 1~3 구조화: 반복 그룹 탐색 → URL 분류 → 아티클 카드 선택
    - REJECT 패턴 명시: 카테고리 필터탭 (`/c/`, `?tag=`), 네비게이션, 통계 숫자
    - reasoning에 아티클 예시 제목 + URL 포함 요구
  - 결과에 `date`, `thumbnail` 필드 추가
- **전략 탐지 병렬화** (`lib/crawlers/strategy-resolver.ts`)
  - Stage 6 (`detectByRules`) 파이프라인에서 완전 제거 → AI가 항상 실행
  - Stage 7+8 (AI 타입 감지 + AI 셀렉터 감지) `Promise.all` 병렬 실행 (~5초 절약)
  - `discoverRSS`: 6개 경로 순차 → `Promise.all` 동시 (18초 → 3초)
  - `discoverSitemap`: 2개 후보 순차 → `Promise.all` 동시 (10초 → 5초)
- **범용 크롤러 원칙** CLAUDE.md에 추가 (하드코딩 금지, 파이프라인 개선 방향 명시)

### v1.5.0 (2026-02-19)
- **SITEMAP 크롤러 전략 추가** (`lib/crawlers/strategies/sitemap.ts`)
  - RSS 없는 사이트 대응: sitemap.xml → URL 수집 → 각 페이지 1회 fetch (title + thumbnail + content 동시 추출)
  - Sitemap Index 재귀 처리 (depth ≤ 1, 최대 3개 서브 sitemap)
  - 날짜 필터(14일), URL include/exclude 필터, 최대 15개 제한, 5개씩 병렬 fetch
- **자동 감지 파이프라인 Step 2.5 추가** (`lib/crawlers/strategy-resolver.ts`)
  - RSS 발견 실패 시 `/sitemap.xml` 자동 탐색, `config.crawl_config.rssUrl`에 sitemap URL 저장
- **SITEMAP 타입 전체 등록**: `types.ts`, `types/index.ts`, `strategies/index.ts`, `infer-type.ts`, `SourcesPageClient.tsx`, `route.ts`
- **YouTube/GraphQL 크롤러 추가 기각** (검토 결과 불필요)
  - YouTube: 기존 RSS 전략으로 커버 가능 (`feeds/videos.xml?channel_id=...`)
  - GraphQL (Velog/Hashnode): RSS 피드 존재, 복잡도 대비 효과 없음

### v1.4.1 (2026-02-19)
- **레거시 크롤러 Puppeteer 2차 fallback** (`lib/crawlers/index.ts`)
  - 본문 미리보기 추출: Cheerio → Puppeteer 자동 전환 (`spaStrategy.crawlContent`)
  - 조건: `!content_preview || content_preview.length < 50`
  - API 전략이 `'{}'` (2자)를 반환하는 케이스도 Puppeteer fallback 트리거됨
  - 루프 종료 후 `closeBrowser()` 호출
- **spa.crawlContent 전략 변경** (`lib/crawlers/strategies/spa.ts`)
  - `networkidle2` → `load` + 3초 대기 (폴링/WebSocket 유지 사이트 타임아웃 방지)
- **와이즈앱 linkTemplate 수정** (DB, crawl_sources #82)
  - `/insight/{insightNid}` → `/insight/detail/{insightNid}`
  - AI 자동 감지 시 숫자형 ID를 SEO URL keyword로 오판한 버그

### v1.4.0 (2026-02-19)
- **getCrawler() 우선순위 수정**: LEGACY_CRAWLER_REGISTRY가 URL 추론보다 먼저 확인 (사이트별 전용 크롤러 우선)
  - 변경 전: `inferCrawlerType()` 항상 유효값 반환 → 레거시 크롤러 도달 불가
  - 변경 후: Legacy 체크 → crawler_type → URL 추론 순
- **API 엔드포인트 자동 감지 (Step 7.5)**: SPA 확정 후 `detect-api-endpoint` Edge Function 호출
  - Puppeteer 네트워크 탐지 → GPT-5-nano 분석 → `crawl_config` 자동 저장
  - 적용 예: 와이즈앱 → `crawler_type=API`, `crawl_config` 자동 생성
- **AI 셀렉터 감지 SPA shell 규칙 강화**: 네비게이션 메뉴를 기사로 오인하는 문제 방지
  - `detectSelectorsWithAI()` 프롬프트에 SPA shell 감지 규칙 추가
  - confidence 0.2 이하 → SPA shell 판정, STATIC 전환 차단
- **크롤링 윈도우 14일 확장**: `isWithinDays()` 7일 → 14일 (전체 적용)
- **이미지 프록시 도메인 추가**: `www.wiseapp.co.kr` (썸네일 URL 지원)
- **vercel.json maxDuration**: `app/api/sources/route.ts` 60→300초

### GitHub

- **Repository**: https://github.com/mochunab/all_info.git
- **Branch**: main
- **GitHub Actions**: 없음 (Vercel Cron으로 크롤링 자동화)
