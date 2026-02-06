# PROJECT_CONTEXT.md - 시스템 아키텍처 & 디버깅 가이드

> AI와 개발자 모두를 위한 프로젝트 전체 아키텍처 문서

## 시스템 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                         │
│                     http://localhost:3000                        │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐           ┌──────────────────────┐
│   Next.js Frontend  │           │    Next.js API Routes │
│   (App Router)      │           │    (Server-side)      │
│                     │           │                       │
│  - page.tsx (메인)  │  fetch()  │  /api/articles       │
│  - AddSourcePage    │ ────────► │  /api/sources        │
│  - Components (7개) │           │  /api/categories     │
│                     │           │  /api/crawl/run      │
│                     │           │  /api/crawl/status   │
│                     │           │  /api/summarize      │
│                     │           │  /api/summarize/batch│
│                     │           │  /api/image-proxy    │
│                     │           │  /api/articles/sources│
└─────────────────────┘           └──────────┬───────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                          ▼                  ▼                  ▼
                 ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
                 │   Supabase   │  │  Crawlers    │  │   OpenAI     │
                 │  (PostgreSQL)│  │  (7 전략)    │  │  (GPT-4o-mini│
                 │              │  │              │  │   GPT-5-nano)│
                 │  - articles  │  │  - STATIC    │  │              │
                 │  - crawl_    │  │  - SPA       │  │  요약 생성   │
                 │    sources   │  │  - RSS       │  │  태그 생성   │
                 │  - crawl_    │  │  - NAVER     │  └──────────────┘
                 │    logs      │  │  - KAKAO     │
                 │  - categories│  │  - NEWSLETTER│
                 └──────────────┘  │  - API       │
                                   └──────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                    ┌──────────┐  ┌──────────┐  ┌──────────┐
                    │ 와이즈앱  │  │  브런치   │  │ 리테일톡  │
                    │ 오픈애즈  │  │ 아이컨슈머│  │ 스톤브릿지│
                    │ 바이브랜드│  │  ...etc   │  │  ...etc  │
                    └──────────┘  └──────────┘  └──────────┘
```

---

## 핵심 데이터 플로우

### 1. 크롤링 플로우 (매일 09:00 KST)

```
Vercel Cron (0 0 * * * UTC)
  │
  ▼
POST /api/crawl/run
  │ Authorization: Bearer {CRON_SECRET}
  │
  ├─ 1. crawl_sources 테이블에서 is_active=true 소스 조회
  ├─ 2. 각 소스별 crawl_logs 레코드 생성 (status: 'running')
  ├─ 3. getStrategy(source.crawler_type) → 전략 선택
  ├─ 4. strategy.crawlList(source) → 아티클 목록 크롤링
  ├─ 5. 중복 체크 (source_id) → 신규만 articles 테이블 INSERT
  ├─ 6. crawl_logs 업데이트 (status: 'completed', articles_found, articles_new)
  ├─ 7. crawl_sources.last_crawled_at 업데이트
  │
  └─ 8. processPendingSummaries() → AI 요약 배치 처리
       ├─ ai_summary IS NULL인 아티클 조회
       ├─ 본문 추출 (content_preview 또는 소스 URL 재크롤링)
       ├─ OpenAI API 호출 (또는 Supabase Edge Function)
       └─ articles.ai_summary, articles.summary_tags 업데이트
```

### 2. 프론트엔드 데이터 플로우

```
page.tsx (메인 페이지)
  │
  ├─ useEffect → GET /api/categories → 카테고리 목록
  ├─ useEffect → fetchArticles(page, append)
  │    └─ GET /api/articles?page=1&limit=12&search=&category=
  │         └─ Supabase: articles 테이블 조회 (is_active=true, 정렬: published_at DESC)
  │
  ├─ handleRefresh() → POST /api/crawl/run
  │    └─ 크롤링 트리거 → Toast 알림
  │
  ├─ handleLoadMore() → fetchArticles(nextPage, true)
  │    └─ 기존 articles에 append
  │
  └─ handleSearchChange() / onCategoryChange()
       └─ 필터 변경 → fetchArticles(1, false)
```

### 3. 소스 추가 플로우

```
/sources/add (AddSourcePage)
  │
  ├─ useEffect → GET /api/sources → 기존 소스 목록
  ├─ useEffect → GET /api/categories → 카테고리 목록
  │
  └─ handleSave()
       └─ POST /api/sources
            ├─ URL로 크롤러 타입 자동 추론 (inferCrawlerType)
            ├─ 기존 소스 → UPDATE
            └─ 신규 소스 → INSERT (is_active: true)
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
    "removeSelectors": [".ad", ".related"]
  },
  "pagination": {
    "type": "page_param",
    "param": "page",
    "maxPages": 3
  },
  "category": "비즈니스"
}
```

---

## 출처별 브랜드 컬러 매핑

```typescript
const SOURCE_COLORS = {
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
# → "[Filter] EXCLUDE (too old)" → 날짜 필터
# → 아무 출력 없음 → 셀렉터 문제
```

### 3. 이미지 깨짐 (403/ERR_BLOCKED)

**원인**: Hotlinking 차단 (네이버 등)

**해결**:
```typescript
// components/ArticleCard.tsx → getProxiedImageUrl()
// needsProxy 배열에 도메인 추가
const needsProxy = [
  'postfiles.pstatic.net',
  'blogfiles.pstatic.net',
  // 새 도메인 추가
];
```

### 4. AI 요약 실패 (ai_summary: null)

**원인**: OpenAI API 키 만료, 요금 한도, 본문 없음

**디버깅**:
```bash
# 1. API 키 확인
# 2. content_preview가 null이면 요약 불가
# 3. USE_EDGE_FUNCTION=true → Supabase Edge Function 상태 확인
# 4. Edge Function 배포: supabase functions deploy summarize-article
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

---

## 성능 특성

| 항목 | 값 |
|------|-----|
| 크롤링 전체 소요 시간 | ~60-120초 (소스 수에 비례) |
| AI 요약 1건 | ~2-3초 |
| 배치 요약 30건 | ~60-90초 |
| Vercel maxDuration | 300초 |
| fetch 타임아웃 | 15초 |
| 페이지당 아티클 수 | 12개 |
| 최대 limit | 50개 |
| 이미지 프록시 캐시 | 24시간 |

---

## 외부 서비스 의존성

| 서비스 | 용도 | 장애 시 영향 |
|--------|------|-------------|
| Supabase | DB, Auth | 전체 서비스 불가 |
| OpenAI API | AI 요약 | 요약 생성 불가 (크롤링은 정상) |
| Vercel | 호스팅, Cron | 서비스 접속 불가 |
| 크롤링 대상 사이트 | 콘텐츠 소스 | 해당 소스만 크롤링 실패 |
