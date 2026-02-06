# DATABASE_TRIGGERS_AND_FUNCTIONS.md - Database Triggers & Functions

> Supabase PostgreSQL Database Triggers 및 Functions 문서

---

## 현재 상태

> 현재 프로젝트에서 Database Trigger/Function은 최소한으로 사용 중입니다.
> 아래는 확인된 패턴과 추가 시 가이드입니다.

---

## 확인된 Database Functions

### 1. updated_at 자동 갱신 (추정)

```sql
-- articles.updated_at 컬럼이 수정 시 자동 갱신되도록 설정
-- Supabase Dashboard에서 확인 필요

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Trigger 추가 가이드

### updated_at 자동 갱신 패턴

모든 테이블에 `updated_at` 자동 갱신이 필요하면:

```sql
-- 1. 범용 함수 생성 (한 번만)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 각 테이블에 트리거 연결
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 다른 테이블에도 동일 패턴 적용
CREATE TRIGGER update_crawl_sources_updated_at
  BEFORE UPDATE ON crawl_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 크롤링 로그 자동 정리 패턴 (미구현)

```sql
-- 30일 이상 된 crawl_logs 자동 삭제
CREATE OR REPLACE FUNCTION cleanup_old_crawl_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM crawl_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- pg_cron으로 스케줄링 (Supabase Pro 플랜)
SELECT cron.schedule(
  'cleanup-crawl-logs',
  '0 3 * * *',  -- 매일 03:00 UTC
  'SELECT cleanup_old_crawl_logs()'
);
```

### 아티클 카운트 캐시 패턴 (미구현)

```sql
-- articles INSERT 시 소스별 카운트 캐시 업데이트
CREATE OR REPLACE FUNCTION update_source_article_count()
RETURNS TRIGGER AS $$
BEGIN
  -- crawl_sources에 article_count 컬럼이 있다면
  UPDATE crawl_sources
  SET article_count = (
    SELECT COUNT(*) FROM articles
    WHERE source_name = (
      SELECT name FROM crawl_sources WHERE id = NEW.source_id::integer
    )
  )
  WHERE name = NEW.source_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Database Function 작성 규칙

### 1. 네이밍 컨벤션

```sql
-- Trigger Function: {action}_{table}_{description}
update_updated_at_column
cleanup_old_crawl_logs

-- Trigger: {action}_{table}_{timing}
update_articles_updated_at
cleanup_crawl_logs_daily
```

### 2. 에러 핸들링

```sql
CREATE OR REPLACE FUNCTION safe_function()
RETURNS TRIGGER AS $$
BEGIN
  -- 작업 수행
  PERFORM some_operation();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 에러 로깅 (트리거 실패가 메인 쿼리를 막지 않도록)
    RAISE WARNING 'Trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 3. 성능 고려사항

```sql
-- ✅ GOOD: 간단한 연산만 수행
CREATE TRIGGER simple_trigger
  BEFORE UPDATE ON articles
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)  -- 실제 변경 시에만
  EXECUTE FUNCTION update_updated_at_column();

-- ❌ BAD: 무거운 쿼리를 트리거에 넣지 말 것
-- 외부 API 호출, 대량 SELECT 등은 별도 처리
```

---

## Trigger 확인 방법

```sql
-- 현재 등록된 트리거 목록 조회
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- 현재 등록된 함수 목록 조회
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

---

## 변경 이력

| 일시 | 변경 내용 | 테이블 |
|------|-----------|--------|
| 2025-01-03 | 프로젝트 초기 설정 | articles, crawl_sources, crawl_logs |

> Trigger/Function 추가/변경 시 이 문서를 업데이트하세요.
