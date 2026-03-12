# PROJECT_CONTEXT.md - 데이터 플로우 & 런타임 동작 가이드

> 이 문서의 핵심: **데이터가 시스템을 어떻게 흐르는가**
> 최종 업데이트: 2026-03-07 (v1.8.6)
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
│  - page.tsx (홈피드)  │           └────────────┬──────────────┘
│  - my-feed (마이피드) │                        │
│  - AddSourcePage     │                        │
│  - Components (11개) │       ┌────────────────┼──────────────┐
└──────────────────────┘       │                │              │
                               ▼                ▼              ▼
                       ┌────────────┐  ┌──────────────┐  ┌──────────────┐
                       │  Supabase  │  │  Crawlers    │  │  Edge Fn (6) │
                       │  PostgreSQL│  │  (9 전략)    │  │ Gemini Flash │
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
   │   ├─ [아티클 복사] 다른 유저의 동일 소스 아티클 존재 시 (v1.8.7)
   │   │   └─ 제목/요약/태그 등 통째 복사 → 크롤링/AI 요약 완전 스킵 → return
   │   │
   │   ├─ [robots.txt 체크] checkRobotsTxt(effectiveUrl)
   │   │   └─ 거부 시 스킵 (에러 아닌 빈 결과 반환)
   │   │
   │   ├─ [크롤러 선택] getCrawler() → crawlWithStrategy()
   │   │   └─ DB crawler_type 또는 URL 패턴 추론 (inferCrawlerType)
   │   │
   │   ├─ [셀렉터 위임] config에 AI 감지 셀렉터 있으면 → STATIC 전략 위임
   │   │
   │   ├─ [스코프 체크] RSS/Sitemap crawlList() 진입 시 피드 범위 vs base_url 검증
   │   │   └─ 불일치 시 throw → 폴백 체인 활성화
   │   │
   │   ├─ [목록 크롤링] strategy.crawlList() → RawContentItem[]
   │   │
   │   ├─ [변경 감지] 2단계 스킵 최적화 (v1.8.2)
   │   │   ├─ 1차: URL 해시 비교 — crawlList URL 해시 vs config._last_url_hash
   │   │   │   └─ 동일 → 전체 스킵 (본문 추출 없음)
   │   │   └─ 2차: DB 사전 중복 체크 — source_id로 기존 아티클 필터
   │   │       └─ 신규 아티클만 본문 추출 대상
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
   │   ├─ [폴백 체인] 품질 검증 실패 시 → 대체 전략 시도
   │   │   ├─ 기본: PLATFORM_KAKAO/NAVER/NEWSLETTER → SPA, STATIC → SPA
   │   │   ├─ Cheerio 0건 또는 유효 아이템 부족 → SPA fallback 허용
   │   │   └─ 전부 실패 → auto-recovery (3단계)
   │   │       1순위: LLM 직접 추출 (extract-articles Edge Fn, 셀렉터 우회)
   │   │       2순위: resolveStrategy 9단계 재실행 → 새 셀렉터로 재크롤링
   │   │       3순위: SPA 기본 셀렉터 최종 폴백
   │   │
   │   ├─ [redirect 방어] fetchWithTimeout: redirect loop 감지 시 bot UA 재시도
   │   │
   │   └─ [저장] saveArticles() — source_id UNIQUE로 중복 방지
   │
   ├─ crawl_logs 업데이트 (errors 있으면 failed + error_message, 없으면 completed)
   └─ crawl_sources.last_crawled_at 업데이트 (skipped가 아닐 때만)

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
  │   └─ Edge Function (Gemini 2.5 Flash Lite) → 실패 시 로컬 OpenAI (GPT-4.1-mini) fallback
  │
  └─ USE_EDGE_FUNCTION=false:
      └─ 로컬 OpenAI (GPT-4.1-mini) 직접 호출
  │
  └─ DB UPDATE: title_ko (한국어 번역 제목), ai_summary (1줄 80자), summary_tags (3개), summary (레거시)
```

---

## 3. 프론트엔드 데이터 플로우

```
홈피드 page.tsx ("/")
  ├─ master 계정 콘텐츠만 표시 (API user_id 미전달 → 기본값 master)
  ├─ 마스터 계정: 소스 추가/크롤링 버튼 표시
  ├─ 일반 로그인 유저: 소스 추가 버튼 숨김 (isNonMasterUser)
  ├─ 비로그인: 소스 추가 버튼 표시 (클릭 시 master 소스 관리, readOnly)
  │
  ├─ useEffect → GET /api/categories (master 기본값)
  ├─ useEffect → fetchArticles → GET /api/articles?page=1&limit=12&...
  ├─ handleRefresh() → POST /api/crawl/trigger
  └─ InsightChat, ArticleGrid 등 기존 UI 동일

마이피드 my-feed/page.tsx ("/my-feed")
  ├─ supabase.auth.getUser() → 비로그인 시 LoginPromptDialog
  ├─ 모든 API 호출에 user_id=${user.id} 파라미터 추가
  ├─ 별도 sessionStorage 키 (ih:my:articles, ih:my:categories)
  └─ 소스 추가/크롤링 기능 포함 (개인 데이터)
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
  │   └─ 섹션 교차 리다이렉트 방지 (공통 경로 세그먼트 분기 감지) → crawl_url 생성
  │
  ├─ [자동 감지] resolveStrategy() — 9단계 파이프라인
  │   → 상세: 아래 "크롤러 타입 자동 감지" 섹션
  │
  ├─ 기존 소스 → UPDATE / 신규 → INSERT
  └─ 응답에 analysis 배열 포함
```

---

## 5. AI 소스 추천 플로우 (`recommend-sources` Edge Function)

```
POST /api/sources/recommend (Same-Origin)
  → Edge Function: recommend-sources
    ├─ Gemini 2.5 Flash Lite + google_search → 최대 5개 URL 추천
    └─ validateUrl() 6단계 룰베이스 검증 (병렬, 8초 타임아웃, HTML 50KB)
       1. HTTP 접근성 (GET, response.ok)
       2. 리다이렉트 감지 (pathname → / 또는 /index)
       3. 폐쇄/종료 키워드 + alert()+history.back() 패턴
       4. 빈 페이지 (body < 200자) 또는 에러 title (404/Error)
       5. 콘텐츠 최신성 (HTML 날짜 추출, 6개월 기준)
       6. WAF/봇 차단 키워드
    → 통과한 URL만 사용자에게 반환
```

---

## 6. 크롤러 타입 자동 감지 파이프라인

> 설계 의도, 대안 검토 → [DECISIONS.md ADR-015, 018, 019](./DECISIONS.md)

```
resolveStrategy(url) — lib/crawlers/strategy-resolver.ts

  0.  URL 최적화 — 검색 URL→API/RSS 변환 (네이버 검색→News API, Google 검색→RSS)
  0.5 Early Exit — Google News RSS search / Naver API URL 즉시 반환
  1.  HTML 다운로드 (15s timeout, 실패 시 URL 패턴 폴백)
  2.  RSS 발견 (0.95) — 6개 경로 병렬 + 스코프 호환성 체크
  2.5 Sitemap 발견 (0.90) — 2개 후보 병렬 + 스코프 호환성 체크
  3.  CMS 감지 (0.75) — WordPress, Tistory, Ghost
  4.  URL 패턴 (0.85~0.95) — .go.kr, naver.com, /feed
  5.  SPA 스코어링 — body < 500자, #root/#app
  [Stage 6 제거 — v1.5.1]
  7+8 통합 AI 감지 (타입+셀렉터) — 단일 Edge Function 호출
      ├─ Cheerio 전처리: aside/nav/sidebar 제거 후 50000자 truncate
      ├─ detect-crawler-type Edge Fn (Gemini 2.5 Flash Lite)
      └─ 후검증: Cheerio로 셀렉터 매칭 (최소 3건 이상 필요)
  7.5 API 감지 — SPA 확정 후 detect-api-endpoint 호출
      ├─ Puppeteer 네트워크 캡처 → Gemini 2.5 Flash Lite → crawl_config 생성
      └─ test fetch 검증 (validateApiConfig): title/link 매핑 유효성 확인 → 실패 시 SPA 유지
  8.5 SPA 셀렉터 재감지 — confidence < 0.5 → Puppeteer HTML로 재시도
  9.  사전 감지 (크롤링 시점) — STATIC/SPA 소스에 셀렉터 없으면:
      └─ AI 1차 → Rule-based 2차 → DB 자동 저장 (SPA는 Puppeteer HTML 사용)
```

감지 우선순위 요약:

| 순서 | 방법 | Confidence | 조건 |
|------|------|-----------|------|
| 1 | RSS 발견 | 0.95 | `<link>` 태그 + 유효성 검증 |
| 1.5 | Sitemap 발견 | 0.90 | `/sitemap.xml` 존재 |
| 2 | CMS 감지 | 0.75 | WordPress/Tistory/Ghost |
| 3 | URL 패턴 | 0.85~0.95 | `.go.kr`, `naver.com` 등 |
| 4 | SPA 스코어링 | 0.5~1.0 | body 텍스트, 마운트 포인트 |
| 5 | 통합 AI 감지 (타입+셀렉터) | 0.6~1.0 | Gemini 2.5 Flash Lite 단일 호출 (Cheerio 전처리) |
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
| 크롤링 전체 | ~30-60초 (제한 병렬, 변경 감지 스킵 적용) |
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
| Google Gemini API | Edge Function AI 요약/감지 | 요약 불가 (크롤링은 정상) |
| OpenAI API | 로컬 fallback 요약 (gpt-4.1-mini) | Edge Fn 실패 시 로컬 요약 불가 |
| Vercel | 호스팅, Cron | 서비스 접속 불가 |
| Naver Open API | 뉴스 검색 API (search→API 변환) | 네이버 검색 소스만 실패 |
| DeepL Free API | 카테고리명 동적 번역 (4개 언어) | 카테고리 번역 불가 (생성/이름변경은 정상) |
| 크롤링 대상 사이트 | 콘텐츠 소스 | 해당 소스만 실패 |

---

## 버전 히스토리

### v1.8.7 (2026-03-12)
- 멀티유저 아티클 공유: 다른 유저가 이미 크롤링한 동일 소스 아티클 복사 (크롤링/AI 요약 스킵)
  - DB: `UNIQUE(source_id)` → `UNIQUE(source_id, user_id)` (마이그레이션 017)
  - `runCrawler`: 크롤링 전 `source_name` 기준 기존 아티클 검색 → 유저 카테고리로 매핑 복사
  - `saveArticles`: 중복 체크에 `user_id` 스코핑 추가
- 저장하기 버튼 즉시 비활성화: `setIsSaving(true)`를 `handleSave` 최상단으로 이동
- 카테고리 CRUD 병렬화: 순차 await 체인 → 이름변경(1단계) + 삭제/생성/순서변경 병렬(2단계)

### v1.8.6 (2026-03-07)
- robots.txt 체크 비활성화 (`lib/crawlers/index.ts`, 추후 재활성화 예정)
- API 감지 안전장치 강화 (`api-detector.ts`, `strategy-resolver.ts`):
  - 상대경로 엔드포인트 거부 (절대 URL만 허용)
  - `validateApiConfig`: test fetch 후 title/link 필드 매핑 유효성 검증 → 실패 시 SPA 유지
  - Stage 5.5 + 7.5 양쪽 모두 검증 적용
- Hydration error 수정: `language-context.tsx` 초기값을 `'ko'`로 고정, `useEffect`에서 감지
  - 서버(`'ko'`) vs 클라이언트(localStorage) 불일치로 전체 CSS 깨지는 문제 해결
- UI: LanguageSwitcher 지구본 아이콘 → 현재 언어 국기 이모지로 변경

### v1.8.5 (2026-03-06)
- SPA 소스 사전 감지 + auto-recovery Puppeteer HTML 지원
  - 사전 감지(Stage 9): STATIC → STATIC/SPA 확장, SPA는 `getRenderedHTML()`으로 HTML 획득
  - Auto-recovery LLM 추출: SPA면 Puppeteer HTML 사용 + SPA 전략으로 본문 추출
- Rule-based 셀렉터 감지 정확도 개선 (`auto-detect.ts`)
  - `article` 시맨틱 태그 가산점 (+0.15), Tailwind 유틸리티 클래스 감점 (-0.2)
  - `getUniqueSelector` body 폴백: `div`/`section` 등 일반 태그 → `body` (첫 번째만 매칭되는 버그 방지)

### v1.8.4 (2026-03-02)
- 카테고리명 동적 번역: 커스텀 카테고리 생성/이름변경 시 DeepL API로 4개 언어(en/vi/zh/ja) 자동 번역
  - `categories.translations` JSONB 컬럼 추가 (마이그레이션 013)
  - `app/api/categories/route.ts`: POST/PATCH 후 fire-and-forget DeepL 번역
  - `lib/language-context.tsx`: `translateCat()` (DB → 하드코딩 fallback → 원본)
  - 기존 카테고리 백필 스크립트: `scripts/backfill-category-translations.ts`

### v1.8.3 (2026-03-02)
- LLM 직접 아티클 추출: auto-recovery 1순위로 추가 (셀렉터 우회)
  - `extract-articles` Edge Function (Gemini 2.5 Flash Lite, temp 0.2)
  - `lib/ai/article-extractor.ts`: Edge Function → OpenAI fallback
  - `lib/crawlers/html-preprocessor.ts`: Cheerio 기반 HTML 전처리 (30KB 제한)
  - HTML 전처리 강화: 모달/다이얼로그/폼/구독·로그인 영역/숨김 요소 제거
  - LLM 추출 시 `_original_base_url` 우선 사용 (crawl_url에 콘텐츠 없을 경우 대비)
- 날짜 파서 개선: 혼합 상대 시간 + 한국어 수식어 ("1년 이상 전", "3개월 넘게 전") 파싱 추가

### v1.8.2 (2026-03-02)
- 크롤링 변경 감지 최적화: 미변경 소스 본문 추출 스킵
  - 1단계: URL 해시 비교 (`config._last_url_hash`) — 목록 동일 시 전체 스킵
  - 2단계: DB 사전 중복 체크 (`_known_source_ids`) — 기존 아티클 본문 추출 스킵
  - `CrawlResult.skipped` 필드 추가, route 로그에 스킵 상태 반영
  - DB 변경 없음 (`crawl_sources.config` JSONB에 `_last_url_hash` 키 자동 추가)

### v1.8.1 (2026-03-02)
- RSS/Sitemap 스코프 체크: 피드 범위가 base_url보다 넓으면 자동 거부 → STATIC/SPA 폴백
  - 감지 시점(`strategy-resolver.ts`) + 크롤링 시점(`rss.ts`, `sitemap.ts`) 이중 체크
  - 얕은 경로(≤2세그먼트) 루트 피드 허용, 깊은 경로(3+) 하위 경로만 허용
- URL 최적화 섹션 교차 방지 강화: 공통 경로 세그먼트 분기 감지 (`url-optimizer.ts`)
- Sitemapindex 스코프 검증: sub-sitemap URL이 base 경로와 무관하면 제외

### v1.8.0 (2026-03-01)
- 홈피드/마이피드 분리: 홈(`/`)은 master 콘텐츠, 마이피드(`/my-feed`)는 개인 피드
- 멀티유저 user_id 스코핑: articles, categories, crawl_sources, 캐시 키 모두 user별 분리
- `users` 테이블 (auth.users 가입 시 트리거 자동 생성, role: master/user)
- LoginPromptDialog: 비로그인 마이피드 접근 시 안내
- sources/add readOnly 모드: 비마스터 유저 홈피드 접근 시 저장/추가 제한
- categories unique 변경: `name` → `(user_id, name)`

### v1.7.0 (2026-03-01)
- 법적 안전장치: robots.txt 준수 (`robots-checker.ts`, 1시간 캐시, fail-open)
- User-Agent 정직화: `DEFAULT_HEADERS`를 `BOT_USER_AGENT` (`InsightHub/1.0`)로 변경
- 이용약관 페이지 (`/terms`) + Footer 컴포넌트 (opt-out 안내, 저작권 고지)

### v1.6.6 (2026-02-25)
- 네이버 뉴스 검색 API 연동: `search.naver.com` URL → Naver Open API 자동 변환
- Google News RSS 검색 early exit: 검색 전용 RSS URL이 generic RSS로 덮어써지는 버그 수정
- 기사 연령 필터 상수화: `MAX_ARTICLE_AGE_DAYS = 30` (14일→30일, 8개 전략 파일 통합)
- 제목 HTML 태그/엔티티 정제: `cleanTitle()`에 `<b>`, `&quot;` 등 제거 추가
- API 전략 본문 추출: `crawlContent()` → STATIC 위임 (HTML 페이지 Readability 파싱)
- 환경변수 추가: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`

### v1.6.5 (2026-02-25)
- 아티클 참조 채팅: 채팅 열린 상태에서 카드 클릭 → 핀 뱃지 + content_preview 기반 상세 질문
- chat-insight Edge Function 추가 (Gemini 2.5 Flash Lite)
- `/api/articles/{id}/content`, `/api/chat` API 추가

### v1.6.4 (2026-02-25)
- Edge Function AI 모델 마이그레이션: OpenAI GPT-5-nano → Gemini 2.5 Flash Lite (4개 함수)
- recommend-sources: `web_search_preview` → `google_search` 도구
- Edge Function Secret: `OPENAI_API_KEY` → `google_API_KEY`
- 로컬 fallback (`lib/ai/summarizer.ts`)은 OpenAI gpt-4.1-mini 유지

### v1.6.3 (2026-02-22)
- 자동 복구 조건 확장: `Insufficient valid items`도 auto-recovery 발동
- SPA 폴백 복구 추가: Cheerio 재감지 실패 시 SPA 기본 셀렉터로 최종 시도 (JS 렌더링 페이지 대응)

### v1.6.2 (2026-02-22)
- fetch redirect loop 방어: bot UA 자동 재시도 (`fetchWithTimeout`, `auto-detect.ts`)
- 폴백 체인 개선: PLATFORM_KAKAO/NAVER/NEWSLETTER → SPA (기존 STATIC)
- Cheerio 기반 전략 0건 시 SPA fallback 허용, 마지막 전략도 auto-recovery 도달
- 플랫폼 전략에서 AI 감지 셀렉터 있으면 STATIC 위임
- 폴백 체인 DB 오버라이드 제거 (항상 코드 기본값 사용)
- 전략별 fetch를 `fetchWithTimeout`으로 통합 (kakao/static/naver/newsletter)
- 소스 저장 후 카테고리 유지 (`router.refresh` 제거, 로컬 상태 업데이트)

### v1.6.1 (2026-02-22)
- recommend-sources URL 검증 강화 (HEAD → GET + 6단계 룰베이스 검증)
- 소스 저장 최적화 (변경 없는 소스 DB UPDATE 스킵 + 병렬 처리)

### v1.6.0 (2026-02-21)
- AI 감지 파이프라인 통합 (타입+셀렉터 단일 Edge Function 호출)
- Cheerio HTML 전처리 (aside/nav/sidebar 제거 후 AI 호출)
- 셀렉터 후검증 강화 (최소 3건 매칭 필수)
- 사전 감지 메커니즘 (STATIC 소스 셀렉터 없으면 AI → Rule-based 자동 감지)
- gpt-4o-mini → gpt-4.1-mini 일괄 교체
- varchar 길이 초과 방어 (author/source_name/category truncate)
- categories PATCH API (이름 변경)

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
- 크롤링 윈도우 14일 확장 (→ v1.6.6에서 30일로 재확장)

---

## 📂 기능별 빠른 참조 (Quick Reference by Feature)

> 사용자 메뉴(페이지) 기준으로 분류. 각 기능 수정 시 관련 파일을 빠르게 찾기 위한 참조.

---

### 🏠 홈피드 (`/`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/page.tsx` | 홈피드 서버 페이지 (master 콘텐츠) |
| `components/HomeFeed.tsx` | 홈피드 클라이언트 컴포넌트 |
| `components/ArticleGrid.tsx` | 아티클 그리드 레이아웃 |
| `components/ArticleCard.tsx` | 아티클 카드 (삭제, 핀 기능) |
| `components/FilterBar.tsx` | 카테고리/소스/태그 필터 |
| `components/InsightChat.tsx` | AI 채팅 UI (아티클 핀 참조) |
| `app/api/articles/route.ts` | 아티클 목록 GET |
| `app/api/articles/[id]/route.ts` | 아티클 삭제 DELETE |
| `app/api/articles/[id]/content/route.ts` | content_preview 조회 GET |
| `app/api/articles/sources/route.ts` | 소스별 아티클 조회 |
| `app/api/categories/route.ts` | 카테고리 CRUD |
| `app/api/chat/route.ts` | 채팅 프록시 API → chat-insight Edge Fn |
| `app/api/crawl/trigger/route.ts` | "자료 불러오기" 버튼 프록시 (rate limit 30s) |
| `app/api/image-proxy/route.ts` | 이미지 프록시 (CORS 우회) |

### 📌 마이피드 (`/my-feed`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/my-feed/page.tsx` | 마이피드 페이지 (user_id 스코핑) |
| `components/LoginPromptDialog.tsx` | 비로그인 접근 시 안내 다이얼로그 |
| _홈피드와 동일한 컴포넌트 공유_ | HomeFeed, ArticleGrid, ArticleCard, FilterBar 등 |

### ⚙️ 소스 관리 (`/sources/add`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/sources/add/page.tsx` | 소스 추가 페이지 (서버) |
| `app/[locale]/sources/add/SourcesPageClient.tsx` | 소스 관리 클라이언트 (카테고리, 링크 CRUD, 뒤로가기) |
| `app/api/sources/route.ts` | 소스 CRUD API + auto-detect (`resolveStrategy`) |
| `app/api/sources/recommend/route.ts` | AI 콘텐츠 링크 추천 API |
| `supabase/functions/recommend-sources/index.ts` | AI 소스 추천 Edge Fn (Gemini + google_search + 6단계 URL 검증) |

### ✍️ 블로그 (`/blog`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/blog/page.tsx` | 블로그 목록 페이지 |
| `app/[locale]/blog/[slug]/page.tsx` | 블로그 상세 페이지 |
| `lib/blog.ts` | 블로그 DB 쿼리 헬퍼 |
| `supabase/functions/translate-blog/index.ts` | 블로그 번역 Edge Fn |
| `app/api/translate/route.ts` | 번역 API |

### 🚀 랜딩 페이지 (`/landing`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/landing/page.tsx` | 랜딩 페이지 |
| `app/[locale]/landing/LandingContent.tsx` | 랜딩 콘텐츠 |
| `app/[locale]/landing/LandingHeader.tsx` | 랜딩 헤더 |
| `app/[locale]/landing/AnimatedSection.tsx` | 애니메이션 섹션 |

### 🔐 로그인/회원가입 (`/login`, `/signup`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/login/page.tsx` | 로그인 페이지 |
| `app/[locale]/signup/page.tsx` | 회원가입 페이지 |
| `app/auth/callback/route.ts` | OAuth 콜백 |
| `lib/auth.ts` | `verifyCronAuth`, `verifySameOrigin` |
| `lib/user.ts` | `getMasterUserId()` 헬퍼 |

### 📄 이용약관 (`/terms`)
| 파일 | 역할 |
|------|------|
| `app/[locale]/terms/page.tsx` | 이용약관 페이지 (opt-out 안내, 저작권 고지) |

### 🔍 SEO 페이지 (토픽/태그/소스/저자/아티클 상세)
| 파일 | 역할 |
|------|------|
| `app/[locale]/articles/[slug]/page.tsx` | 아티클 상세 |
| `app/[locale]/topics/page.tsx` | 토픽 목록 |
| `app/[locale]/topics/[category]/page.tsx` | 토픽별 아티클 |
| `app/[locale]/tags/page.tsx` | 태그 목록 |
| `app/[locale]/tags/[tag]/page.tsx` | 태그별 아티클 |
| `app/[locale]/sources/page.tsx` | 소스 목록 |
| `app/[locale]/sources/[name]/page.tsx` | 소스별 아티클 |
| `app/[locale]/authors/page.tsx` | 저자 목록 |
| `app/[locale]/authors/[name]/page.tsx` | 저자별 아티클 |
| `lib/seo-queries.ts` | SEO 관련 DB 쿼리 |
| `lib/article-slug.ts` | 슬러그 생성 유틸 |
| `lib/hreflang.ts` | hreflang 태그 생성 |
| `components/SeoBreadcrumb.tsx` | 구조화 데이터 (빵크럼) |
| `components/SeoArticleList.tsx` | 구조화 데이터 (아티클 리스트) |
| `app/sitemap.ts` | 사이트맵 생성 |
| `app/robots.ts` | robots.txt 생성 |
| `app/feed.xml/route.ts` | RSS 피드 생성 |
| `app/api/og/route.tsx` | OG 이미지 생성 |

---

### 🤖 크롤링 엔진 (백엔드)
| 파일 | 역할 |
|------|------|
| `app/api/crawl/run/route.ts` | 크롤링 실행 (Bearer, 300s) |
| `app/api/crawl/trigger/route.ts` | 프론트엔드 프록시 (rate limit 30s) |
| `app/api/crawl/status/route.ts` | 크롤링 상태 조회 |
| `lib/crawlers/index.ts` | 오케스트레이터 (`runCrawler`) |
| `lib/crawlers/strategy-resolver.ts` | AUTO 9단계 감지 파이프라인 |
| `lib/crawlers/infer-type.ts` | URL 패턴 기반 크롤러 타입 추론 |
| `lib/crawlers/url-optimizer.ts` | URL 최적화 (검색→API/RSS 변환) |
| `lib/crawlers/auto-detect.ts` | Rule-based 셀렉터 감지 |
| `lib/crawlers/api-detector.ts` | API 엔드포인트 감지 |
| `lib/crawlers/base.ts` | 공통 유틸 (`fetchWithTimeout`, UA) |
| `lib/crawlers/types.ts` | 크롤러 타입 정의 |
| `lib/crawlers/content-extractor.ts` | 본문 추출 (Readability 등) |
| `lib/crawlers/date-parser.ts` | 날짜 파싱 + `MAX_ARTICLE_AGE_DAYS` |
| `lib/crawlers/html-preprocessor.ts` | HTML 전처리 (LLM 추출용) |
| `lib/crawlers/quality-filter.ts` | 크롤링 품질 검증 |
| `lib/crawlers/title-cleaner.ts` | 제목 HTML 태그/엔티티 정제 |
| `lib/crawlers/robots-checker.ts` | robots.txt 파싱/캐싱 (현재 비활성화) |

### 🔌 크롤러 전략 (9종)
| 파일 | 전략 |
|------|------|
| `lib/crawlers/strategies/index.ts` | 전략 레지스트리 |
| `lib/crawlers/strategies/static.ts` | STATIC (Cheerio) |
| `lib/crawlers/strategies/spa.ts` | SPA (Puppeteer) |
| `lib/crawlers/strategies/rss.ts` | RSS (rss-parser) |
| `lib/crawlers/strategies/sitemap.ts` | SITEMAP (fetch + Cheerio) |
| `lib/crawlers/strategies/naver.ts` | PLATFORM_NAVER |
| `lib/crawlers/strategies/kakao.ts` | PLATFORM_KAKAO |
| `lib/crawlers/strategies/newsletter.ts` | NEWSLETTER |
| `lib/crawlers/strategies/api.ts` | API (fetch JSON) |
| `lib/crawlers/strategies/firecrawl.ts` | Firecrawl (외부 서비스) |

### 🧠 AI 요약 & 추출 (백엔드)
| 파일 | 역할 |
|------|------|
| `app/api/summarize/batch/route.ts` | 배치 요약 API (Bearer, 300s) |
| `app/api/summarize/route.ts` | 단일 요약 API |
| `lib/ai/batch-summarizer.ts` | 배치 요약 (Edge Fn → 로컬 fallback) |
| `lib/ai/summarizer.ts` | 로컬 OpenAI (gpt-4.1-mini) |
| `lib/ai/article-extractor.ts` | LLM 아티클 직접 추출 (auto-recovery용) |

### ☁️ Edge Functions (Supabase)
| 파일 | 역할 |
|------|------|
| `supabase/functions/summarize-article/index.ts` | AI 요약 (Gemini 2.5 Flash Lite) |
| `supabase/functions/detect-crawler-type/index.ts` | 크롤러 타입+셀렉터 감지 |
| `supabase/functions/detect-api-endpoint/index.ts` | API 엔드포인트 감지 |
| `supabase/functions/extract-articles/index.ts` | LLM 아티클 직접 추출 |
| `supabase/functions/recommend-sources/index.ts` | AI 소스 추천 |
| `supabase/functions/chat-insight/index.ts` | AI 채팅 인사이트 |
| `supabase/functions/translate-blog/index.ts` | 블로그 번역 |

### 🌐 i18n & 언어
| 파일 | 역할 |
|------|------|
| `lib/i18n.ts` | 5개 언어 번역 (`t(language, 'key')`) |
| `lib/language-context.tsx` | 언어 Provider + `translateCat()` |
| `lib/locale-config.ts` | 로케일 설정 |
| `lib/locale-path.ts` | 로케일 경로 유틸 |
| `components/LanguageSwitcher.tsx` | 언어 전환 UI |
| `lib/translation.ts` | DeepL 번역 유틸 |

### 🏗️ 공통 레이아웃 & 인프라
| 파일 | 역할 |
|------|------|
| `app/layout.tsx` | 루트 레이아웃 |
| `app/[locale]/layout.tsx` | 로케일 레이아웃 |
| `app/providers.tsx` | 글로벌 Provider |
| `middleware.ts` | Rate Limit, CORS, Security Headers, 로케일 리다이렉트 |
| `components/Header.tsx` | 글로벌 헤더 (네비게이션) |
| `components/Footer.tsx` | 글로벌 푸터 (이용약관 링크) |
| `lib/supabase/client.ts` | Supabase 브라우저 클라이언트 |
| `lib/supabase/server.ts` | Supabase 서버/서비스 클라이언트 |
| `lib/cache.ts` | 인메모리 캐시 유틸 |
| `lib/utils.ts` | 공통 유틸리티 |
| `lib/gtag.ts` | Google Analytics |
| `lib/indexnow.ts` | IndexNow 검색엔진 알림 |
| `components/Skeleton.tsx` | 로딩 스켈레톤 |
| `components/ConfirmDialog.tsx` | 확인 다이얼로그 |
| `components/Toast.tsx` | 토스트 알림 |
| `components/GTagPageView.tsx` | GA 페이지뷰 트래킹 |
| `components/LocaleLink.tsx` | 로케일 링크 컴포넌트 |
