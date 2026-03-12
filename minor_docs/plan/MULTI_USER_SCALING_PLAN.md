# 멀티유저 크롤링 스케일링 계획안 (상세)

> 작성일: 2026-03-02
> 상태: 계획 (미구현)
> 관련: [PROJECT_CONTEXT.md](../key_docs/PROJECT_CONTEXT.md), [DATABASE_SCHEMA.md](../key_docs/DATABASE_SCHEMA.md), [⭐️MULTI_USER_SCALING_PLAN.md](./⭐️MULTI_USER_SCALING_PLAN.md)

---

## 1. 멀티유저 준비도 평가

### 현재 상태: ~85% 완료

| 구성요소 | 상태 | 비고 |
|----------|------|------|
| `user_id` in 핵심 테이블 | ✅ 완료 | `articles`, `crawl_sources` — `crawl_logs`만 미비 |
| API 유저 스코핑 | ✅ 구현됨 | `/api/crawl/trigger`에 있음; `/api/crawl/run`에는 없음 |
| 홈/마이피드 분리 | ✅ 구현됨 | `/` = master, `/my-feed` = 로그인 유저 |
| RLS 정책 | ⚠️ 부분적 | DB에서 허용; API 레벨에서만 검증 |
| DB 인덱스 | ⚠️ 기본만 | 멀티유저 복합 인덱스 미적용 |
| DB 격리 | ⚠️ 논리적만 | 하드 DB 제약 없음 |
| 큐 시스템 | ❌ 없음 | 5~10유저 이상 스케일링에 필수 |
| 크롤링 병렬화 | ❌ 없음 | Cron 경로 순차 처리만 |

### 잔여 작업 요약

1. 큐 시스템 도입 (QStash)
2. `crawl_logs.user_id` 직접 컬럼 + 복합 인덱스
3. `/api/crawl/run` → dispatch/worker 패턴 전환
4. RLS 정책 강화 (DB 레벨)
5. 유저별 크롤링 스케줄/속도 제한

---

## 2. 현재 아키텍처 상세 분석

### 2-1. Cron 크롤링 흐름 (`/api/crawl/run`)

```
Vercel Cron (매일 00:00 UTC / 09:00 KST)
  → POST /api/crawl/run (Bearer CRON_SECRET)
    → 전체 유저의 모든 active 소스 조회 (user_id 필터 없음)
    → for-loop 순차 처리 (소스 하나씩)
    → 완료 후 반환
```

**문제점:**
- 모든 소스를 단일 Serverless Function에서 순차 처리
- N개 소스 × 15초(평균) = 총 실행 시간
- Vercel Pro 300초 제한 → 최대 ~20개 소스 처리 가능
- user_id 스코핑 없이 전체 소스 크롤링

### 2-2. 수동 트리거 흐름 (`/api/crawl/trigger`)

```
프론트엔드 버튼 클릭
  → POST /api/crawl/trigger (rate limit 30s, 로그인 필수)
    → 해당 유저의 active 소스만 조회 (user_id 스코핑 ✅)
    → 하이브리드 병렬화:
      - 병렬 풀 (max 5): RSS/STATIC/SITEMAP/NEWSLETTER/PLATFORM_*/API
      - 직렬 풀: SPA (Puppeteer 단일 인스턴스 제약)
    → 완료 후 응답
```

**장점:** user_id 스코핑 + 병렬 5개 → 동일 시간 내 더 많은 소스 처리
**한계:** 수동 의존, Vercel 300초 제한 여전히 적용

### 2-3. 소스당 크롤링 시간 분석

| 단계 | 소요 시간 |
|------|----------|
| URL 최적화 | ~100ms |
| robots.txt 체크 (1시간 TTL 캐시, fail-open) | ~500ms–3s |
| HTML 다운로드 (15s timeout) | 1–15s |
| 전략 감지 (AUTO인 경우) | 5–10s |
| 리스트 크롤링 (30s timeout/전략) | 2–30s |
| 품질 검증 | ~100ms |
| 콘텐츠 추출 (아티클당 1–2s, 5건 × 500ms 딜레이) | 3–12s |
| DB 저장 (아티클당 ~200–500ms) | 1–2.5s |

**종합:**

| 시나리오 | 소요 시간 |
|----------|----------|
| 최적 (캐시된 RSS) | 2–3초 |
| 평균 (STATIC + 콘텐츠 추출) | 10–15초 |
| 최악 (SPA + AI 감지) | 30–45초 |
| 트리거 전체 (15s 병렬 + 80s 직렬 혼합) | ~60–100초 |

### 2-4. 요약 파이프라인

```
별도 Cron (00:05 UTC)
  → POST /api/summarize/batch (Bearer CRON_SECRET)
    → 미요약 아티클 조회
    → 배치 크기: 20건, 동시 처리: 5건
    → 4배치/실행 = 40–60초
    → Edge Function (Gemini 2.5 Flash Lite) → 실패 시 로컬 OpenAI (gpt-4.1-mini, max 3회)
```

### 2-5. 스케일 한계 정리

| 항목 | Hobby (무료) | Pro ($20/월) |
|------|-------------|-------------|
| 실제 maxDuration | 60초 | 300초 |
| 소스당 평균 소요 | ~15초 | ~15초 |
| Cron 1회 처리 가능 소스 | 3–4개 | 15–20개 |
| 수용 가능 유저 (30소스/명) | 0명 | ~1명 |

- 유저당 최대 200소스 (20카테고리 × 10링크) 등록 가능
- 150소스 × 5아티클 = 750개 개별 INSERT (배치 미적용)
- Vercel Cron: 프로젝트당 최대 40개 (유저별 Cron 불가)
- 요약 배치: 20건/Cron × 5 동시 → 일 생성량 초과 시 백로그 누적

**결론: 현재 아키텍처는 master 1명 전용. 멀티유저 자동 크롤링 근본적으로 불가.**

---

## 3. 큐 시스템 비교 분석

### 3-1. 후보 4개 상세 비교

| 항목 | QStash (Upstash) | Inngest | Trigger.dev v3 | pg_cron + pg_net |
|------|-----------------|---------|----------------|-----------------|
| **아키텍처** | HTTP 메시지 큐 | 이벤트 기반 워크플로우 | 원격 태스크 실행 | DB 내장 스케줄러 |
| **무료 티어** | 500msg/일 (~16유저) | 50K runs/월 (~8유저) | ~1–2유저 | 무제한* |
| **10유저 큐 비용** | ~$0.60/월 | ~$52/월 | ~$10/월 (Hobby) | $0 |
| **100유저 큐 비용** | ~$6/월 | ~$150/월 | ~$83/월 (Pro) | $0 |
| **재시도** | 5회, 지수 백오프, DLQ | 우수 (스텝별) | 우수 | 없음 (DIY) |
| **동시성 제어** | Rate limit 설정 | 빌트인 | 빌트인 | 최대 32 동시 |
| **통합 난이도** | 낮음 (HTTP) | 낮음 (SDK) | 중간 | 높음 |
| **관측성** | 기본 대시보드 | 우수 | 우수 | 없음 |
| **실행 환경** | Vercel Functions | Vercel Functions | Trigger.dev 자체 | Supabase 내부 |
| **최대 실행 시간** | Vercel 제한 (800s) | Vercel 제한 (800s) | 무제한 (CRIU) | pg_net timeout |
| **DX** | HTTP 기반, 간단 | 최고 (Next.js 네이티브) | 좋음 | 낮음 (SQL 기반) |

\* pg_cron은 오케스트레이션만 무료, 실행 비용은 별도.

### 3-2. 유저 규모별 총 비용 비교 (큐 비용만)

| 유저 수 | QStash | Inngest | Trigger.dev | pg_cron |
|---------|--------|---------|-------------|---------|
| 1–8명 | $0 (무료) | $0 (무료) | $0 (무료) | $0 |
| 10명 | $0.60 | $52 | $10 | $0 |
| 30명 | $1.80 | ~$80 | ~$30 | $0 |
| 50명 | $3.00 | ~$110 | ~$55 | $0 |
| 100명 | $6.00 | ~$150 | ~$83 | $0 |

### 3-3. QStash 선택 근거

1. **큐 비용이 거의 $0** — 수익 모델에서 마진 극대화
2. **HTTP 기반** — 기존 Vercel + Supabase 스택에 SDK 하나로 간단 통합
3. **Upstash 생태계** — Redis, Kafka 등 필요 시 확장 가능
4. **무료 티어로 MVP 검증** — 500msg/일이면 평균 유저 16명까지 무료
5. **충분한 재시도 메커니즘** — 5회 지수 백오프 + DLQ

> 추후 관측성/워크플로우가 중요해지면 Inngest로 마이그레이션 가능 (큐 레이어만 교체).

---

## 4. 목표 아키텍처: QStash Fan-Out 패턴

### 4-1. 핵심 아이디어

**1 소스 = 1 Serverless Function 호출**

단일 함수에서 모든 소스를 처리하는 대신, 소스마다 별도 함수를 호출하여 타임아웃 제한을 회피.

### 4-2. 전체 구조

```
Vercel Cron (매일 00:00 UTC)
  │
  ▼
POST /api/crawl/dispatch (디스패처, ~3–5초)
  │  crawl_sources에서 크롤링 대상 조회
  │  (WHERE is_active = true AND next_crawl_at <= now())
  │  소스 1개 = QStash 메시지 1개 발행
  │
  ▼ (QStash가 비동기 호출)
POST /api/crawl/worker × N (소스 수만큼 병렬, 각 15~45초)
  │  QStash 서명 검증 (Receiver.verify)
  │  단일 소스 크롤링 (runCrawler)
  │  아티클 저장 + crawl_log 기록
  │
  ▼ (별도 Cron, 매 30분)
POST /api/summarize/batch
     미요약 아티클 배치 처리
```

### 4-3. 이전 대비 변경점

| 항목 | Before | After |
|------|--------|-------|
| Cron 타겟 | `/api/crawl/run` | `/api/crawl/dispatch` |
| 소스 처리 | 단일 함수 내 순차 | 소스별 독립 함수 (QStash) |
| 타임아웃 영향 | 전체 소스 합산 | 소스 1개 단위 |
| 유저 확장 | 불가 (~1명) | 소스 수에 비례 (제한 없음) |
| 요약 주기 | 1일 1회 (00:05 UTC) | 30분 간격 |
| 수동 트리거 | 단일 함수 내 병렬 | QStash 발행 → 즉시 반환 |
| 실패 처리 | 전체 중단 | 소스별 독립 재시도 |

---

## 5. 유저당 비용 추정

### 5-1. 전제

- 1일 1회 크롤링
- 소스당 평균 크롤 시간: 15초 (RSS ~3초, STATIC ~15초, SPA ~40초 혼합)
- 소스당 일 신규 아티클: ~1.5건
- Gemini 2.5 Flash Lite 요약 단가: ~$0.00007/건

### 5-2. 인프라 고정 비용

| 서비스 | 플랜 | 월 비용 | 포함 내역 |
|--------|------|---------|----------|
| Vercel Pro | 기본 | $20 | 40시간 컴퓨트, 1TB 전송 |
| Supabase Pro | 기본 | $25 | 8GB DB, 100K MAU, 2M Edge 호출 |
| **합계** | | **$45/월** | |

### 5-3. 유저당 변동 비용

| 항목 | 산식 | 평균 유저 (30소스) | 파워 유저 (200소스) |
|------|------|-------------------|-------------------|
| Vercel 컴퓨트 | 소스 × 15초 × 30일 ÷ 3600 × $0.128/hr | 3.75hr → **$0.48** | 25hr → **$3.20** |
| QStash 메시지 | 소스 × 30일 × $1/100K | 900건 → **~$0** | 6,000건 → **$0.06** |
| Gemini 요약 | 소스 × 1.5건 × 30일 × $0.00007 | 1,350건 → **$0.09** | 9,000건 → **$0.61** |
| Supabase Edge Fn | Pro 2M 포함 | **$0** | **$0** |
| DB 스토리지 | 아티클당 ~2KB | ~무시 | ~무시 |
| **유저당 합계** | | **~$0.57/월** | **~$3.87/월** |

### 5-4. 유저 수 확장 시나리오 (평균 30소스/유저 기준)

| 유저 수 | 총 인프라 비용 | 유저당 비용 | $5 과금 시 손익 | $10 과금 시 손익 |
|---------|--------------|-----------|---------------|----------------|
| 1명 | $45.57 | $45.57 | -$40.57 | -$35.57 |
| 5명 | $47.85 | $9.57 | -$22.85 | +$2.15 |
| **10명** | **$50.70** | **$5.07** | **-$0.70** | **+$49.30** |
| 30명 | $62.10 | $2.07 | +$87.90 | +$237.90 |
| 50명 | $73.50 | $1.47 | +$176.50 | +$426.50 |
| 100명 | $102.00 | $1.02 | +$398.00 | +$898.00 |

### 5-5. 손익 분기점

| 유저 과금 | 손익 분기 유저 수 |
|-----------|-----------------|
| $3/월 | ~19명 |
| $5/월 | ~10명 |
| $10/월 | ~5명 |

> **$10/월 기준 5명이면 흑자 전환, 유저가 늘수록 고정비($45) 분산으로 마진 급증.**

---

## 6. DB 스키마 변경

### 6-1. `crawl_sources`에 `next_crawl_at` 추가

크롤링 스케줄 관리용. 디스패처가 이 값으로 대상 소스를 조회.

```sql
ALTER TABLE crawl_sources
  ADD COLUMN next_crawl_at timestamptz DEFAULT now();

CREATE INDEX idx_crawl_sources_next_crawl
  ON crawl_sources(next_crawl_at)
  WHERE is_active = true;
```

- 디스패처 조회: `WHERE is_active = true AND next_crawl_at <= now()`
- 크롤링 완료 후: `UPDATE ... SET next_crawl_at = now() + interval '24 hours'`
- 향후 유저별 크롤링 주기 차등 적용 가능 (무료: 24h, 유료: 6h 등)

### 6-2. `crawl_logs`에 `user_id` 직접 추가

현재 source_id JOIN으로만 유저 추적 가능 → 직접 컬럼으로 쿼리 효율화.

```sql
ALTER TABLE crawl_logs
  ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

UPDATE crawl_logs SET user_id = (
  SELECT user_id FROM crawl_sources
  WHERE crawl_sources.id = crawl_logs.source_id
);

CREATE INDEX idx_crawl_logs_user_id ON crawl_logs(user_id);
```

### 6-3. 복합 인덱스 추가

멀티유저 쿼리 최적화용.

```sql
CREATE INDEX idx_articles_user_published
  ON articles(user_id, published_at DESC);

CREATE INDEX idx_crawl_sources_user_active
  ON crawl_sources(user_id, is_active);

CREATE INDEX idx_crawl_logs_user_status
  ON crawl_logs(user_id, status);
```

### 6-4. RLS 정책 강화 (권장)

현재 API 레벨에서만 유저 검증 → DB 레벨 RLS로 이중 보호.

```sql
-- articles: 자신의 아티클만 수정/삭제 가능
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own articles"
  ON articles FOR SELECT
  USING (user_id = auth.uid() OR user_id = (SELECT id FROM users WHERE role = 'master'));

CREATE POLICY "Users can insert own articles"
  ON articles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own articles"
  ON articles FOR UPDATE
  USING (user_id = auth.uid());

-- crawl_sources: 자신의 소스만 CRUD
ALTER TABLE crawl_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sources"
  ON crawl_sources FOR ALL
  USING (user_id = auth.uid());

-- Service Role (크롤링, 배치)은 RLS 우회 → createServiceClient() 사용
```

> 주의: 크롤링/요약 배치는 `createServiceClient()` (service_role)로 RLS 우회 필수.

---

## 7. 파일 변경 목록

### 신규 파일

| 파일 | 역할 |
|------|------|
| `app/api/crawl/dispatch/route.ts` | 디스패처 — Cron 타겟, 대상 소스 조회 → QStash 메시지 발행 |
| `app/api/crawl/worker/route.ts` | 워커 — QStash 콜백 수신, 단일 소스 크롤링 실행 |
| `lib/queue/qstash.ts` | QStash 클라이언트 래퍼 (publish, verify, 타입 정의) |
| `supabase/migrations/xxx_add_crawl_scheduling.sql` | DB 마이그레이션 (next_crawl_at, user_id, 인덱스) |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `app/api/crawl/run/route.ts` | 레거시 유지, 내부적으로 dispatch 위임 |
| `app/api/crawl/trigger/route.ts` | 유저 소스 → QStash 개별 발행으로 전환 |
| `lib/crawlers/index.ts` | `runCrawler` 단일 소스 인터페이스 정리 (변경 최소) |
| `vercel.json` | Cron 스케줄 변경 (dispatch + summarize 30분) |
| `.env.local` | QStash 환경변수 3개 추가 |

---

## 8. 상세 구현 설계

### 8-1. 디스패처 (`/api/crawl/dispatch`)

```
POST /api/crawl/dispatch
  Auth: verifyCronAuth() (Bearer CRON_SECRET)

  1. crawl_sources 조회
     SELECT id, user_id, base_url, crawler_type, config
     FROM crawl_sources
     WHERE is_active = true
       AND next_crawl_at <= now()
     ORDER BY priority DESC
     LIMIT 500

  2. QStash 메시지 발행 (소스마다 1개)
     For each source:
       qstash.publishJSON({
         url: `${SITE_URL}/api/crawl/worker`,
         body: { sourceId: source.id },
         retries: 3,
         dedup: `crawl-${source.id}-${YYYY-MM-DD}`,
         headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
       })

  3. next_crawl_at 업데이트
     UPDATE crawl_sources
     SET next_crawl_at = now() + interval '24 hours'
     WHERE id = ANY(dispatched_ids)

  4. 응답
     Return { success: true, dispatched: count }
```

실행 시간: ~3–5초 (DB 조회 + HTTP 발행). maxDuration 제한과 무관.

### 8-2. 워커 (`/api/crawl/worker`)

```
POST /api/crawl/worker
  Auth: QStash 서명 검증 (Receiver.verify) + Bearer CRON_SECRET

  1. body에서 sourceId 추출
  2. crawl_source 조회 (user_id 포함)
  3. crawl_log 생성 (status: 'running', user_id: source.user_id)
  4. runCrawler(source) — 기존 lib/crawlers/index.ts 로직 그대로 사용
  5. saveArticles(articles, source)
  6. crawl_log 업데이트 (completed/failed, articles_found, articles_new)
  7. Return 200 (QStash에 성공 신호)
     실패 시 4xx/5xx → QStash 자동 재시도 (최대 3회, 지수 백오프)
```

실행 시간: 소스 1개 기준 15~45초. Hobby(60초)/Pro(300초) 모두 여유.

### 8-3. QStash 클라이언트 (`lib/queue/qstash.ts`)

```typescript
// 의존성: @upstash/qstash

// 환경변수:
// QSTASH_TOKEN — 메시지 발행용
// QSTASH_CURRENT_SIGNING_KEY — 콜백 서명 검증용
// QSTASH_NEXT_SIGNING_KEY — 키 로테이션 대응

// 함수:
// publishCrawlJob(sourceId: number) — 단일 소스 크롤링 메시지 발행
// verifyCrawlRequest(req: Request) — 워커 엔드포인트에서 QStash 서명 검증
```

### 8-4. 수동 트리거 전환 (`/api/crawl/trigger`)

```
Before:
  유저 소스 전체 조회 → 단일 함수 내 병렬 처리 → 완료 후 응답

After:
  유저 소스 전체 조회 → QStash로 소스별 메시지 발행 → 즉시 응답
  → 각 소스는 /api/crawl/worker에서 비동기 처리
```

장점:
- 소스 수에 관계없이 트리거 **즉시 반환** (타임아웃 걱정 없음)
- 유저에게 "크롤링 시작됨" 안내 후 백그라운드 처리

### 8-5. vercel.json 변경

```json
{
  "crons": [
    {
      "path": "/api/crawl/dispatch",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/summarize/batch",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

- 크롤링 디스패치: 매일 00:00 UTC (09:00 KST)
- 요약 배치: **30분 간격** (크롤링이 비동기 분산되므로 자주 처리 필요)

### 8-6. 환경변수 추가

```bash
# .env.local 추가분
QSTASH_TOKEN=                    # Upstash Console에서 발급
QSTASH_CURRENT_SIGNING_KEY=      # 콜백 서명 검증용
QSTASH_NEXT_SIGNING_KEY=         # 키 로테이션 대응
```

---

## 9. 마이그레이션 단계

### Phase 1: 기반 작업

1. QStash 계정 생성 (Upstash Console) + 환경변수 설정
2. `npm install @upstash/qstash`
3. DB 마이그레이션 실행 (next_crawl_at, crawl_logs.user_id, 복합 인덱스)
4. `lib/queue/qstash.ts` 구현

### Phase 2: 워커 + 디스패처

5. `/api/crawl/worker` 구현 (기존 runCrawler 재사용)
6. `/api/crawl/dispatch` 구현
7. vercel.json Cron 스케줄 변경

### Phase 3: 기존 경로 전환

8. `/api/crawl/trigger` → QStash 발행 방식으로 전환
9. `/api/crawl/run` → dispatch 위임 (하위 호환 유지)
10. summarize/batch 주기 30분으로 변경

### Phase 4: RLS 강화 (선택)

11. articles, crawl_sources RLS 정책 추가
12. 기존 API 경로에서 `createServiceClient()` 사용 확인

### Phase 5: 검증 + 배포

13. 로컬 워커 직접 호출 테스트
14. Vercel Preview 배포 → dispatch → worker 흐름 E2E 테스트
15. QStash 대시보드에서 메시지 발행/완료/재시도 확인
16. 프로덕션 배포

---

## 10. 검증 방법

### 로컬 테스트

```bash
# 워커 직접 호출 (QStash 없이)
curl -X POST http://localhost:3000/api/crawl/worker \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"sourceId": 1}'
```

### 디스패처 테스트

```bash
# 디스패처 호출 → QStash 대시보드에서 메시지 확인
curl -X POST http://localhost:3000/api/crawl/dispatch \
  -H "Authorization: Bearer $CRON_SECRET"
```

### E2E 테스트

1. Vercel Preview 배포
2. QStash Console에서 타겟 URL을 Preview URL로 설정
3. 디스패처 수동 호출
4. QStash 대시보드: 메시지 발행 → 워커 호출 → 200 응답 확인
5. Supabase: 신규 아티클 + crawl_log 확인

### 부하 테스트

50개 소스 동시 dispatch → QStash 처리율 + Vercel 동시 실행 수 모니터링.
Vercel Pro 기본 동시 실행: ~1,000개 (병목 없음).

---

## 11. 향후 확장 가능성

| 확장 | 방법 |
|------|------|
| 유저별 크롤링 주기 차등 | `next_crawl_at` 간격 조정 (무료: 24h, 프리미엄: 6h) |
| 우선순위 큐 | QStash delay 파라미터로 유료 유저 우선 처리 |
| 실시간 크롤링 상태 | Supabase Realtime으로 crawl_logs 변경 구독 |
| Inngest 마이그레이션 | 큐 레이어만 교체 (워커 로직 그대로) |
| 크롤링 빈도 증가 | Cron을 `*/6 * * * *` (6시간) 등으로 변경 |
| SPA 전용 워커 분리 | Puppeteer 전용 워커를 별도 엔드포인트로 분리 |
| 배치 INSERT 도입 | 150소스 × 5아티클 = 750건 → 소스별 batch upsert |
| 유저별 속도 제한 | QStash rate limit + 유저별 동시 소스 수 제한 |

---

## 12. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| QStash 장애 | 크롤링 전체 중단 | `/api/crawl/run` 레거시 경로 유지 (수동 폴백) |
| Vercel 동시 실행 폭주 | 429 에러, 비용 급증 | QStash rate limit 설정 (초당 N개) |
| 워커 반복 실패 | DLQ 적재 | QStash DLQ 모니터링 + 알림 설정 |
| DB 부하 (대량 INSERT) | 쿼리 지연 | 배치 INSERT 도입, connection pooling |
| 무료 티어 초과 | QStash 500msg/일 초과 | 유료 전환 ($1/100K, 무시할 수준) |
| RLS 정책 누락 | 타 유저 데이터 접근 가능 | Phase 4에서 DB 레벨 RLS 강화 |
| SPA Puppeteer 동시 실행 | Chrome 인스턴스 충돌 | SPA 전용 워커 분리 또는 QStash 동시성 제한 |

---

## 부록: 참조 자료

### 현재 핵심 파일 위치

| 파일 | 역할 |
|------|------|
| `lib/crawlers/index.ts` | 크롤링 오케스트레이터 (runCrawler) |
| `lib/crawlers/strategy-resolver.ts` | AUTO 9단계 감지 파이프라인 |
| `app/api/crawl/run/route.ts` | Cron 전체 크롤링 (순차) |
| `app/api/crawl/trigger/route.ts` | 수동 트리거 (하이브리드 병렬) |
| `lib/user.ts` | getMasterUserId() 헬퍼 |
| `lib/auth.ts` | Bearer/Same-Origin 인증 |
| `lib/ai/batch-summarizer.ts` | AI 요약 배치 처리 |
| `middleware.ts` | Rate limit, CORS, 보안 헤더 |

### 현재 환경변수 (기존)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
CRON_SECRET=
USE_EDGE_FUNCTION=true
NEXT_PUBLIC_SITE_URL=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

### Vercel 현재 설정

```json
{
  "crons": [
    { "path": "/api/crawl/run", "schedule": "0 0 * * *" },
    { "path": "/api/summarize/batch", "schedule": "5 0 * * *" }
  ],
  "functions": {
    "app/api/crawl/run/route.ts": { "maxDuration": 300 },
    "app/api/crawl/trigger/route.ts": { "maxDuration": 300 },
    "app/api/summarize/batch/route.ts": { "maxDuration": 300 }
  }
}
```
