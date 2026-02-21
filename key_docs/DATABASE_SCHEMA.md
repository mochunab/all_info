# DATABASE_SCHEMA.md - Supabase 데이터베이스 스키마

> 모든 테이블 구조, 관계, 인덱스 정보

---

## 테이블 ERD (관계도)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   crawl_sources  │     │    crawl_logs    │     │    categories   │
│─────────────────│     │──────────────────│     │─────────────────│
│ id (PK, serial) │◄────│ source_id (FK)   │     │ id (PK, serial) │
│ name             │     │ id (PK, serial)  │     │ name             │
│ base_url         │     │ started_at       │     │ is_default       │
│ crawl_url        │     │ finished_at      │     │ display_order    │
│ priority         │     │ status           │     │ created_at       │
│ crawler_type     │     │ articles_found   │     │ updated_at       │
│ config (JSONB)   │     │ articles_new     │     └─────────────────┘
│ is_active        │     │ error_message    │
│ last_crawled_at  │     │ created_at       │
│ created_at       │     └──────────────────┘
└─────────────────┘

┌──────────────────────────────────────────────┐
│                   articles                    │
│──────────────────────────────────────────────│
│ id (PK, uuid)                                │
│ source_id (TEXT, 아티클 고유 식별자=URL)       │
│ source_name, source_url                       │
│ title                                         │
│ content_preview, summary                      │
│ summary_tags (TEXT[])                         │
│ author, published_at, crawled_at              │
│ priority, category, is_active                 │
│ created_at, updated_at                        │
└──────────────────────────────────────────────┘
```

---

## 1. articles 테이블

크롤링된 아티클 저장소.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `uuid` | `gen_random_uuid()` | PK |
| `source_id` | `text` | NOT NULL | 아티클 고유 식별자 (URL 기반, 중복 방지) |
| `source_name` | `text` | NOT NULL | 출처 이름 (와이즈앱, 브런치 등) |
| `source_url` | `text` | NOT NULL | 원본 아티클 URL |
| `title` | `text` | NOT NULL | 아티클 제목 |
| `title_ko` | `text` | NULL | 한국어 번역 제목 (AI 요약 시 생성, 이미 한국어면 원본 그대로) |
| `content_preview` | `text` | NULL | 본문 미리보기 (크롤링 시 추출) |
| `summary` | `text` | NULL | 상세 요약 (헤드라인 + 2~3문장 설명) |
| `summary_tags` | `text[]` | `'{}'` | AI 태그 3개 |
| `author` | `text` | NULL | 작성자 |
| `published_at` | `timestamptz` | NULL | 원본 게시일 |
| `crawled_at` | `timestamptz` | `now()` | 크롤링 시각 |
| `priority` | `integer` | `0` | 우선순위 |
| `category` | `text` | NULL | 카테고리 |
| `is_active` | `boolean` | `true` | 활성 여부 |
| `created_at` | `timestamptz` | `now()` | 생성일 |
| `updated_at` | `timestamptz` | `now()` | 수정일 |

**인덱스**:
- `articles_pkey` - PRIMARY KEY (id)
- `articles_source_id_key` - UNIQUE (source_id) → 중복 방지
- `articles_published_at_idx` - (published_at DESC) → 정렬 성능
- `articles_category_idx` - (category) → 카테고리 필터
- `articles_is_active_idx` - (is_active) → 활성 필터

**주요 쿼리 패턴**:
```sql
-- 아티클 목록 (메인 페이지)
SELECT * FROM articles
WHERE is_active = true
ORDER BY published_at DESC NULLS LAST, crawled_at DESC
LIMIT 12 OFFSET 0;

-- 검색
SELECT * FROM articles
WHERE is_active = true
  AND (title ILIKE '%keyword%' OR summary ILIKE '%keyword%' OR content_preview ILIKE '%keyword%')
ORDER BY published_at DESC NULLS LAST;

-- AI 요약 대기 아티클
SELECT * FROM articles
WHERE summary IS NULL AND content_preview IS NOT NULL
LIMIT 30;
```

---

## 2. crawl_sources 테이블

크롤링 대상 소스 관리.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `serial` | AUTO | PK |
| `name` | `text` | NOT NULL | 소스 이름 |
| `base_url` | `text` | NOT NULL | 사용자 입력 원본 URL (UI 표시용) |
| `crawl_url` | `text` | NULL | 실제 크롤링할 최적화된 URL (NULL이면 base_url 사용) |
| `priority` | `integer` | `1` | 크롤링 우선순위 (높을수록 먼저) |
| `crawler_type` | `text` | `'STATIC'` | 크롤러 전략 타입 |
| `config` | `jsonb` | `'{}'` | 크롤링 설정 (셀렉터, 페이지네이션 등) |
| `is_active` | `boolean` | `true` | 활성 여부 |
| `last_crawled_at` | `timestamptz` | NULL | 마지막 크롤링 시각 |
| `created_at` | `timestamptz` | `now()` | 생성일 |

**config JSONB 구조 — STATIC/SPA 타입**:
```json
{
  "selectors": {
    "container": "CSS 셀렉터",
    "item": "아이템 셀렉터",
    "title": "제목 셀렉터",
    "link": "링크 셀렉터",
    "thumbnail": "썸네일 셀렉터",
    "author": "작성자 셀렉터",
    "date": "날짜 셀렉터"
  },
  "content_selectors": {
    "content": "본문 셀렉터",
    "removeSelectors": ["제거할 셀렉터"]
  },
  "pagination": {
    "type": "page_param | infinite_scroll | none",
    "param": "page",
    "maxPages": 3
  },
  "category": "카테고리명",
  "_detection": {
    "method": "ai-type-detection | rule-analysis | rss-discovery | api-detection | ...",
    "confidence": 0.85,
    "fallbackStrategies": ["STATIC", "SPA"],
    "reasoning": "AI 또는 Rule-based 분석 근거 (선택)"
  }
}
```

**config JSONB 구조 — API 타입 (2026-02-19 추가)**:
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
    "reasoning": "Puppeteer 네트워크 탐지 + GPT-5-nano 분석"
  }
}
```

**`_detection` 메타데이터 (2026-02-14 추가)**:
- 소스 저장 시 AUTO 옵션 선택하면 9단계 파이프라인이 자동 생성
- `method`: 감지 방법
  - `domain-override` — 도메인 강제 지정 (legacy)
  - `rss-discovery` — RSS 피드 자동 발견
  - `sitemap-discovery` — sitemap.xml 자동 발견 (Step 2.5, 2026-02-19 추가)
  - `url-pattern` — URL 패턴 기반 추론
  - `cms-detection` — WordPress/Tistory 등 CMS 감지
  - `rule-analysis` — HTML 구조 rule-based 분석
  - `ai-type-detection` — GPT-5-nano HTML 구조 분석
  - `ai-selector-detection` — GPT-4o-mini CSS 셀렉터 추출
  - `api-detection` — Puppeteer 네트워크 탐지 + AI 분석 (2026-02-19 추가)
  - `manual-config` — 수동 설정 (직접 입력)
  - `default` — 모든 분석 실패 시 기본값
- `confidence`: 신뢰도 (0.0~1.0)
- `fallbackStrategies`: 대안 전략 리스트
- `reasoning`: AI 판단 근거 (ai-type-detection, api-detection일 때)

**crawler_type 가능 값**:
- `AUTO` - **자동 감지** (UI 전용, 저장 시 STATIC/SPA 등으로 변환됨, DB에는 저장 안 됨)
- `STATIC` - Cheerio 정적 파싱
- `SPA` - Puppeteer 동적 렌더링
- `RSS` - RSS/Atom 피드
- `SITEMAP` - sitemap.xml 파싱 (RSS 없는 사이트; `config.crawl_config.rssUrl`에 sitemap URL 저장)
- `PLATFORM_NAVER` - 네이버 블로그
- `PLATFORM_KAKAO` - 카카오 브런치
- `NEWSLETTER` - 뉴스레터
- `API` - REST API
- `static` (레거시) → STATIC
- `dynamic` (레거시) → SPA

> **참고**: AUTO는 UI에서만 사용되며, 소스 저장 시 백엔드의 8단계 파이프라인이 최적 타입을 결정하여 STATIC/SPA/RSS 등으로 변환 후 DB에 저장됩니다. ([DECISIONS.md → ADR-015](./DECISIONS.md#adr-015-ai-기반-크롤러-타입-자동-감지-시스템) 참조)

---

## 3. crawl_logs 테이블

크롤링 실행 로그.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `serial` | AUTO | PK |
| `source_id` | `integer` | NOT NULL | FK → crawl_sources.id |
| `started_at` | `timestamptz` | `now()` | 시작 시각 |
| `finished_at` | `timestamptz` | NULL | 종료 시각 |
| `status` | `text` | `'running'` | 상태 (running/completed/failed) |
| `articles_found` | `integer` | `0` | 발견된 아티클 수 |
| `articles_new` | `integer` | `0` | 신규 저장된 아티클 수 |
| `error_message` | `text` | NULL | 에러 메시지 |
| `created_at` | `timestamptz` | `now()` | 생성일 |

**FK 관계**: `crawl_logs.source_id → crawl_sources.id`

---

## 4. categories 테이블

카테고리 관리 (드래그 앤 드롭 정렬 지원).

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `serial` | AUTO | PK |
| `name` | `text` | NOT NULL, UNIQUE | 카테고리명 |
| `is_default` | `boolean` | `false` | 기본 카테고리 여부 (deprecated) |
| `display_order` | `integer` | `1` | 표시 순서 (드래그 앤 드롭으로 변경 가능) |
| `created_at` | `timestamptz` | `now()` | 생성일 |
| `updated_at` | `timestamptz` | `now()` | 수정일 (트리거 자동 갱신) |

**인덱스**:
- `categories_pkey` - PRIMARY KEY (id)
- `categories_name_key` - UNIQUE (name)
- `idx_categories_display_order` - (display_order) → 정렬 성능

**주요 쿼리 패턴**:
```sql
-- 카테고리 목록 (표시 순서대로)
SELECT * FROM categories
ORDER BY display_order ASC, name ASC;

-- 카테고리 순서 변경
UPDATE categories SET display_order = 3 WHERE id = 5;
```

---

## 테이블 간 관계

```
crawl_sources (1) ──── (N) crawl_logs
    │ id                    │ source_id (FK)
    │
articles (독립)
    │ source_id = 아티클 URL (crawl_sources와 직접 FK 없음)
    │ source_name = crawl_sources.name (비정규화)
    │
categories (독립)
    │ articles.category = categories.name (논리적 관계)
```

---

## 마이그레이션 참고

### 새 테이블 추가 시

```sql
-- 1. 테이블 생성
CREATE TABLE new_table (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 컬럼 정의
  created_at timestamptz DEFAULT now()
);

-- 2. RLS 활성화
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책 추가
CREATE POLICY "Allow read for all" ON new_table
  FOR SELECT USING (true);

-- 4. types/database.ts 타입 업데이트 필수!
```

### 컬럼 추가 시

```sql
ALTER TABLE articles ADD COLUMN new_column text DEFAULT null;
-- → types/database.ts 업데이트 필수!
```

---

## 마이그레이션 히스토리

### 006_drop_thumbnail_url.sql (2026-02-19)

**목적**: 미사용 thumbnail_url 컬럼 제거
- `articles.thumbnail_url` 컬럼 삭제
- 크롤링 코드 및 타입 정의에서도 제거 완료

```sql
ALTER TABLE articles DROP COLUMN IF EXISTS thumbnail_url;
```

### 003_add_crawl_url.sql (2026-02-14)

**목적**: URL 최적화 시스템 도입
- `crawl_sources.crawl_url` 컬럼 추가
- 사용자 입력 URL(`base_url`)과 실제 크롤링 URL(`crawl_url`) 분리
- 자동 URL 최적화 (RSS 피드 발견, 경로 패턴 탐색 등)

```sql
ALTER TABLE crawl_sources ADD COLUMN crawl_url TEXT;
COMMENT ON COLUMN crawl_sources.crawl_url IS
  '실제 크롤링에 사용될 최적화된 URL (NULL이면 base_url 사용)';
CREATE INDEX IF NOT EXISTS idx_crawl_sources_crawl_url
  ON crawl_sources(crawl_url);
```

### 004_crawl_config_api_type.sql (2026-02-19)

**목적**: API 타입 크롤러를 위한 crawl_config 구조 공식화 (마이그레이션 불필요 — config JSONB 컬럼 기존 활용)
- `crawl_sources.config.crawl_config` 하위 키 사용 (schema 변경 없음)
- `detect-api-endpoint` Edge Function 배포로 자동 생성 가능

### 002_add_ai_summary_tags.sql (이전)
- `articles.ai_summary`, `summary_tags` 컬럼 추가
- AI 요약 시스템 도입

### 001_initial_schema.sql (초기)
- 전체 테이블 생성
- RLS 정책 설정
