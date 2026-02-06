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
│ priority         │     │ finished_at      │     │ created_at       │
│ crawler_type     │     │ status           │     └─────────────────┘
│ config (JSONB)   │     │ articles_found   │
│ is_active        │     │ articles_new     │
│ last_crawled_at  │     │ error_message    │
│ created_at       │     │ created_at       │
└─────────────────┘     └──────────────────┘

┌──────────────────────────────────────────────┐
│                   articles                    │
│──────────────────────────────────────────────│
│ id (PK, uuid)                                │
│ source_id (TEXT, 아티클 고유 식별자=URL)       │
│ source_name, source_url                       │
│ title, thumbnail_url                          │
│ content_preview, summary                      │
│ ai_summary, summary_tags (TEXT[])             │
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
| `thumbnail_url` | `text` | NULL | 썸네일 이미지 URL |
| `content_preview` | `text` | NULL | 본문 미리보기 (크롤링 시 추출) |
| `summary` | `text` | NULL | 요약 (레거시, 3줄 요약) |
| `ai_summary` | `text` | NULL | AI 1줄 요약 (80자 이내) |
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
WHERE ai_summary IS NULL AND content_preview IS NOT NULL
LIMIT 30;
```

---

## 2. crawl_sources 테이블

크롤링 대상 소스 관리.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `serial` | AUTO | PK |
| `name` | `text` | NOT NULL | 소스 이름 |
| `base_url` | `text` | NOT NULL | 크롤링 대상 URL |
| `priority` | `integer` | `1` | 크롤링 우선순위 (높을수록 먼저) |
| `crawler_type` | `text` | `'STATIC'` | 크롤러 전략 타입 |
| `config` | `jsonb` | `'{}'` | 크롤링 설정 (셀렉터, 페이지네이션 등) |
| `is_active` | `boolean` | `true` | 활성 여부 |
| `last_crawled_at` | `timestamptz` | NULL | 마지막 크롤링 시각 |
| `created_at` | `timestamptz` | `now()` | 생성일 |

**config JSONB 구조**:
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
  "category": "카테고리명"
}
```

**crawler_type 가능 값**:
- `STATIC` - Cheerio 정적 파싱
- `SPA` - Puppeteer 동적 렌더링
- `RSS` - RSS/Atom 피드
- `PLATFORM_NAVER` - 네이버 블로그
- `PLATFORM_KAKAO` - 카카오 브런치
- `NEWSLETTER` - 뉴스레터
- `API` - REST API
- `static` (레거시) → STATIC
- `dynamic` (레거시) → SPA

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

카테고리 관리.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `id` | `serial` | AUTO | PK |
| `name` | `text` | NOT NULL, UNIQUE | 카테고리명 |
| `is_default` | `boolean` | `false` | 기본 카테고리 여부 |
| `created_at` | `timestamptz` | `now()` | 생성일 |

**기본 카테고리**:
- 비즈니스 (`is_default: true`)
- 소비 트렌드 (`is_default: true`)

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
