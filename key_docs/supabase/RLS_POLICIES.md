# RLS_POLICIES.md - Row Level Security 정책 가이드

> Supabase RLS (Row Level Security) 정책 관리 문서

---

## 현재 상태

> RLS 정책은 Supabase Dashboard에서 관리합니다.
> 아래는 프로젝트에 필요한 RLS 정책 가이드라인입니다.

---

## 역할 (Roles) 설명

| Role | 설명 | 용도 |
|------|------|------|
| `anon` | 비인증 사용자 | 공개 데이터 읽기 (아티클 목록) |
| `authenticated` | 인증된 사용자 | 현재 미사용 (인증 기능 없음) |
| `service_role` | 서비스 역할 | 크롤링, AI 요약 등 서버 작업 (RLS 우회) |

---

## 테이블별 권장 RLS 정책

### 1. articles

| 정책명 | 역할 | 작업 | USING 조건 | 설명 |
|--------|------|------|-----------|------|
| `articles_select_active` | `anon` | SELECT | `is_active = true` | 활성 아티클만 공개 읽기 |
| `articles_insert_service` | `service_role` | INSERT | (RLS 우회) | 크롤링 시 삽입 |
| `articles_update_service` | `service_role` | UPDATE | (RLS 우회) | AI 요약 업데이트 |

```sql
-- articles RLS 활성화
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (활성 아티클만)
CREATE POLICY "articles_select_active" ON articles
  FOR SELECT
  TO anon
  USING (is_active = true);

-- service_role은 RLS를 우회하므로 별도 정책 불필요
-- createServiceClient()로 연결 시 자동 적용
```

### 2. crawl_sources

| 정책명 | 역할 | 작업 | USING 조건 | 설명 |
|--------|------|------|-----------|------|
| `sources_select_all` | `anon` | SELECT | `true` | 소스 목록 공개 읽기 |
| `sources_insert_anon` | `anon` | INSERT | `true` | UI에서 소스 추가 |
| `sources_update_anon` | `anon` | UPDATE | `true` | UI에서 소스 수정 |

```sql
ALTER TABLE crawl_sources ENABLE ROW LEVEL SECURITY;

-- 공개 읽기
CREATE POLICY "sources_select_all" ON crawl_sources
  FOR SELECT TO anon USING (true);

-- 소스 추가 (AddSourcePage에서)
CREATE POLICY "sources_insert_anon" ON crawl_sources
  FOR INSERT TO anon WITH CHECK (true);

-- 소스 수정
CREATE POLICY "sources_update_anon" ON crawl_sources
  FOR UPDATE TO anon USING (true);
```

### 3. crawl_logs

| 정책명 | 역할 | 작업 | USING 조건 | 설명 |
|--------|------|------|-----------|------|
| `logs_select_all` | `anon` | SELECT | `true` | 크롤링 상태 조회 |

```sql
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;

-- 읽기 전용 (상태 조회)
CREATE POLICY "logs_select_all" ON crawl_logs
  FOR SELECT TO anon USING (true);

-- INSERT/UPDATE는 service_role만 (크롤링 API에서)
```

### 4. categories

| 정책명 | 역할 | 작업 | USING 조건 | 설명 |
|--------|------|------|-----------|------|
| `categories_select_all` | `anon` | SELECT | `true` | 카테고리 목록 조회 |
| `categories_insert_anon` | `anon` | INSERT | `true` | UI에서 카테고리 추가 |

```sql
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_all" ON categories
  FOR SELECT TO anon USING (true);

CREATE POLICY "categories_insert_anon" ON categories
  FOR INSERT TO anon WITH CHECK (true);
```

---

## Service Role Key 사용 패턴

```typescript
// Service Role은 RLS를 완전히 우회합니다.
// 서버 전용 작업에서만 사용하세요.

// lib/supabase/server.ts
export function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // ← RLS 우회
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// 사용처:
// - app/api/crawl/run/route.ts (크롤링)
// - app/api/summarize/route.ts (AI 요약)
// - app/api/summarize/batch/route.ts (배치 요약)
```

---

## 권한 문제 디버깅

### "Permission denied" 또는 빈 결과 반환 시

```sql
-- 1. RLS 활성화 상태 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 2. 현재 정책 조회
SELECT * FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. 테스트: anon 역할로 쿼리
SET ROLE anon;
SELECT * FROM articles LIMIT 5;
RESET ROLE;

-- 4. 테스트: service_role로 쿼리 (RLS 우회)
-- Supabase Dashboard → SQL Editor에서 직접 실행
```

### 자주 발생하는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| 아티클 목록 빈 배열 | articles에 anon SELECT 정책 없음 | `articles_select_active` 정책 추가 |
| 크롤링 INSERT 실패 | anon key로 INSERT 시도 | `createServiceClient()` 사용 확인 |
| 소스 추가 실패 | crawl_sources INSERT 정책 없음 | `sources_insert_anon` 정책 추가 |
| 카테고리 목록 안 뜸 | categories SELECT 정책 없음 | `categories_select_all` 정책 추가 |

---

## RLS 정책 추가/변경 시 체크리스트

1. [ ] Supabase Dashboard → Authentication → Policies에서 변경
2. [ ] 개발 환경에서 테스트 (anon key로 API 호출)
3. [ ] Service Role 작업은 `createServiceClient()` 사용 확인
4. [ ] 이 문서 업데이트
5. [ ] Staging ↔ Production 동기화 필요 시 SQL 스크립트 작성

---

## 변경 이력

| 일시 | 변경 내용 | 테이블 |
|------|-----------|--------|
| 2025-01-03 | 초기 RLS 정책 설정 | articles, crawl_sources, crawl_logs, categories |

> RLS 정책 변경 시 반드시 이 문서를 업데이트하세요.
