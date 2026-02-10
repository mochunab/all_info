# DECISIONS.md - 아키텍처 결정 기록 (ADR)

> "왜 이렇게 설계했는가?" 질문에 대한 답변 기록

---

## ADR-001: Next.js 14 App Router 선택

**일시**: 2025-01-03
**상태**: 확정

**결정**: Next.js 14 App Router를 사용한다.

**이유**:
- Server Components로 초기 로딩 성능 최적화
- App Router의 파일 기반 라우팅으로 API Routes 구조화
- Vercel 배포와 네이티브 통합 (Cron Jobs, Serverless Functions)
- React 18 기능 (Suspense, Streaming) 활용 가능

**대안 검토**:
- Pages Router: 레거시, App Router가 공식 권장
- Remix: Supabase 통합 생태계가 Next.js 대비 약함
- 순수 Express + React SPA: SSR 불가, SEO 불리

---

## ADR-002: Supabase를 Database + Auth로 선택

**일시**: 2025-01-03
**상태**: 확정

**결정**: Supabase를 메인 데이터베이스 및 인증 시스템으로 사용한다.

**이유**:
- 무료 플랜으로 개인 프로젝트 충분 (500MB DB, 50K MAU)
- PostgreSQL 기반으로 복잡한 쿼리 가능
- RLS(Row Level Security)로 보안 정책 관리
- Edge Functions 지원 (AI 요약 서버리스 배포)
- @supabase/ssr 패키지로 Next.js SSR 완벽 지원

**대안 검토**:
- Firebase: NoSQL, 복잡한 필터링 쿼리 불편
- PlanetScale: MySQL, Edge Functions 별도 구축 필요
- 직접 PostgreSQL: 인프라 관리 부담

---

## ADR-003: 크롤러 전략 패턴 (Strategy Pattern) 채택

**일시**: 2025-01-03
**상태**: 확정

**결정**: 크롤링 로직을 Strategy Pattern으로 설계한다.

**이유**:
- 크롤링 대상 사이트마다 HTML 구조, 렌더링 방식이 다름
- 새 크롤러 추가 시 기존 코드 수정 없이 전략만 추가 (OCP)
- crawl_sources.crawler_type으로 DB에서 전략 선택
- 팩토리 함수(getStrategy)로 런타임에 전략 결정

**구조**:
```
CrawlStrategy (인터페이스)
  ├── staticStrategy (Cheerio)
  ├── spaStrategy (Puppeteer)
  ├── rssStrategy (rss-parser)
  ├── naverStrategy (네이버 특화)
  ├── kakaoStrategy (카카오 특화)
  ├── newsletterStrategy (뉴스레터)
  └── apiStrategy (REST API)
```

**대안 검토**:
- 단일 크롤러 + 옵션: 조건문 복잡, 유지보수 어려움
- 플러그인 방식: 오버엔지니어링

---

## ADR-004: OpenAI GPT-4o-mini / GPT-5-nano 선택

**일시**: 2025-01-06
**상태**: 확정

**결정**: AI 요약에 GPT-4o-mini (기본) + GPT-5-nano (Edge Function) 사용.

**이유**:
- GPT-4o-mini: 가격 대비 성능 최고 ($0.15/1M input tokens)
- GPT-5-nano: Edge Function에서 경량 모델로 비용 절감
- 요약 작업은 복잡한 추론 불필요, 경량 모델로 충분
- JSON 포맷 응답 지원 (response_format: json_object)

**대안 검토**:
- GPT-4o: 과도한 비용 ($5/1M input tokens)
- Claude: 한글 요약 품질은 좋으나 API 비용 높음
- 로컬 LLM: 서버 인프라 필요

---

## ADR-005: CSS Variables + Tailwind CSS 스타일링

**일시**: 2025-01-03
**상태**: 확정

**결정**: Tailwind CSS 유틸리티 클래스 + CSS Variables로 테마를 관리한다.

**이유**:
- CSS Variables로 다크모드 / 라이트모드 전환 용이
- Tailwind의 `var()` 문법으로 변수 참조 가능
- 컴포넌트별 인라인 스타일 최소화
- 반응형 디자인 (`sm:`, `lg:`) 내장

**주요 CSS Variables**:
```css
--bg-primary, --bg-secondary, --bg-tertiary
--text-primary, --text-secondary, --text-tertiary
--accent, --accent-hover, --accent-light
--border
```

---

## ADR-006: Vercel Cron으로 자동 크롤링

**일시**: 2025-01-07
**상태**: 확정

**결정**: Vercel Cron Jobs를 사용해 매일 자동 크롤링을 실행한다.

**이유**:
- Vercel에 이미 배포 중이므로 추가 인프라 불필요
- vercel.json 한 줄로 설정 (`"schedule": "0 0 * * *"`)
- 최대 300초 실행 가능 (Pro 플랜)
- CRON_SECRET으로 외부 접근 차단

**설정**:
```json
{
  "crons": [{ "path": "/api/crawl/run", "schedule": "0 0 * * *" }],
  "functions": {
    "app/api/crawl/run/route.ts": { "maxDuration": 300 }
  }
}
```

**대안 검토**:
- GitHub Actions: 무료이나 별도 HTTP 호출 필요
- AWS Lambda + EventBridge: 오버엔지니어링
- 외부 Cron 서비스 (cron-job.org): 외부 의존성 추가

---

## ADR-007: 이미지 프록시 패턴

**일시**: 2025-01-06
**상태**: 확정

**결정**: Hotlinking이 차단된 이미지를 /api/image-proxy를 통해 프록시한다.

**이유**:
- 네이버 블로그 이미지 (pstatic.net)가 외부 Referer 차단
- 서버 사이드에서 적절한 Referer 헤더로 이미지 가져옴
- 24시간 Cache-Control로 불필요한 재요청 방지

**프록시 대상 도메인**:
```
postfiles.pstatic.net
blogfiles.pstatic.net
mblogthumb-phinf.pstatic.net
```

---

## ADR-008: source_id 기반 중복 방지

**일시**: 2025-01-03
**상태**: 확정

**결정**: 아티클 URL을 source_id로 사용하여 중복 저장을 방지한다.

**이유**:
- 같은 아티클이 여러 번 크롤링되어도 1건만 저장
- URL이 고유 식별자 역할 (같은 콘텐츠 = 같은 URL)
- INSERT 전 SELECT로 존재 여부 확인

**대안 검토**:
- UNIQUE 제약조건 + ON CONFLICT: DB 레벨 보장, 더 견고
- 해시 기반: URL 변경에 취약 (쿼리 파라미터 등)

---

## ADR-009: jsdom 27→24 다운그레이드

**일시**: 2026-02-10
**상태**: 확정

**결정**: jsdom을 v27.4.0에서 v24.1.3으로 다운그레이드한다.

**이유**:
- jsdom v27의 `html-encoding-sniffer@6` → `@exodus/bytes`가 ESM-only 패키지
- Vercel Serverless Functions는 CJS 환경이라 `require()` 호출 시 런타임 에러 (500)
- jsdom v24는 `html-encoding-sniffer@4`를 사용하여 CJS 호환

**트레이드오프**:
- jsdom 최신 버전의 기능/보안 패치를 받지 못함
- Vercel이 ESM을 네이티브 지원하면 v27+로 복원 가능

---

## ADR-010: AI 요약 배치 병렬 처리 + 재시도 전략

**일시**: 2026-02-10
**상태**: 확정

**결정**: AI 요약 배치를 5개씩 병렬 처리하고, 실패 시 최대 3회 재시도한다.

**이유**:
- 순차 처리 시 20건 ~40-60초 → 병렬 처리 시 ~12초 (약 4배 단축)
- Edge Function / OpenAI API의 일시적 실패에 대한 복원력 확보
- `Promise.allSettled`로 개별 실패가 전체 배치를 중단하지 않음
- 백오프 간격 (1s→2s→3s)으로 API rate limit 회피

**구현**:
- 동시성: 5개 (`CONCURRENCY = 5`)
- 재시도: 3회 (`MAX_RETRIES = 3`), 지수 백오프 (`RETRY_DELAY_MS * attempt`)
- 파일: `lib/ai/batch-summarizer.ts`

**대안 검토**:
- 전체 병렬 (동시성 무제한): API rate limit 위험
- 순차 처리 유지: Vercel 300초 maxDuration 내 처리량 제한
- 10개 병렬: API 부하 우려, 5개가 안전한 균형점

---

## ADR-011: CSS 셀렉터 자동 탐지 (Auto-Detect)

**일시**: 2026-02-10
**상태**: 확정

**결정**: 소스 저장 시 페이지 HTML을 자동 분석하여 CSS 셀렉터를 탐지하고 config에 저장한다.

**이유**:
- 소스 저장 시 `config: { category }` 만 저장되어 DEFAULT_SELECTORS에 의존 → 대부분 크롤링 실패
- 사이트마다 HTML 구조가 달라 수동 셀렉터 설정은 비실용적
- Rule-based 휴리스틱으로 대부분의 게시판/목록 사이트 자동 처리
- 규칙 실패 시 GPT-5-nano/GPT-4o-mini로 HTML 구조 분석

**구현**:
- 파일: `lib/crawlers/auto-detect.ts`
- 실행 위치: Vercel Serverless (POST `/api/sources` 내부)
- 흐름: Rule-based (cheerio) → AI fallback (confidence < 0.5일 때만)
- 점수 산정: title+link=0.6, +date=+0.2, +thumbnail=+0.1, 5개이상=+0.1
- API 응답에 `analysis` 배열로 탐지 결과 포함

**대안 검토**:
- AI만 사용: 모든 요청에 API 호출, 비용 과다
- Rule-based만 사용: 복잡한 사이트 처리 불가
- Supabase Edge Function: cheerio가 Deno 미지원, 로직 분산 우려
- 수동 입력: 사용자 경험 저하

**트레이드오프**:
- 소스 저장 시 각 URL을 fetch하므로 저장 시간 증가 (병렬 처리로 완화)
- AI fallback 사용 시 OpenAI API 비용 발생 (GPT-5-nano $0.05/1M tokens)

---

## 추가 결정 기록 시 템플릿

```markdown
## ADR-NNN: 제목

**일시**: YYYY-MM-DD
**상태**: 제안 / 확정 / 폐기

**결정**: 무엇을 결정했는가?

**이유**: 왜 이렇게 결정했는가?

**대안 검토**: 다른 어떤 선택지가 있었는가?

**트레이드오프**: 이 결정의 단점은 무엇인가?
```
