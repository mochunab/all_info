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

**결정**: AI 요약에 GPT-4.1-mini (fallback) + GPT-5-nano (Edge Function 기본) 사용.

**이유**:
- GPT-4.1-mini: GPT-4o-mini 후속 모델, fallback 용도 (v1.6.0에서 일괄 교체)
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

## ADR-012: 다국어 지원 (i18n) - 커스텀 번역 시스템

**일시**: 2026-02-12
**상태**: 확정

**결정**: 커스텀 번역 시스템을 구현하여 4개 언어(한국어, English, 日本語, 中文)를 지원한다.

**이유**:
- 글로벌 사용자 접근성 향상
- 번역 라이브러리 오버헤드 없이 경량 구현 (i18next 등 불필요)
- 번역 키/값이 코드에 직접 포함되어 빌드 시 최적화 가능
- localStorage로 사용자 언어 설정 유지 (회원가입 불필요)

**구현**:
- 파일: `lib/i18n.ts` - translations 객체에 ko, en, ja, zh 모든 키 정의
- 타입: `Language = 'ko' | 'en' | 'ja' | 'zh'` (`types/index.ts`)
- 컴포넌트: `LanguageSwitcher.tsx` - 드롭다운 UI
- localStorage 키: `ih:language`
- 변수 치환: `{name}`, `{count}` 형식 지원

**적용 범위**:
- Header, FilterBar, ArticleGrid, Toast
- Sources 관리 페이지 전체
- 총 ~50개 번역 키

**대안 검토**:
- react-i18next: 번들 크기 증가 (~100KB), 오버엔지니어링
- next-intl: App Router 통합 좋으나 번역량이 적어 불필요
- 하드코딩: 유지보수 불가능

**트레이드오프**:
- 번역 파일이 JSON이 아닌 TypeScript 객체로 코드에 포함되어 빌드 크기 소폭 증가
- 동적 번역 추가/수정 불가 (코드 수정 필요)
- 기계 번역 API 연동 없음 (콘텐츠 번역은 별도 구현 필요 시)

---

---

## ADR-014: Server Component 페이지 캐싱 전략

**일시**: 2026-02-14
**상태**: 확정

**결정**: Server Component 페이지에서 데이터 변경 후 캐시 무효화를 위해 `force-dynamic`과 `revalidatePath`를 조합하여 사용한다.

**배경**:
- `/sources/add` 페이지에서 소스 삭제 후 저장하면, 홈으로 갔다가 다시 돌아올 때 삭제한 소스가 여전히 표시되는 문제 발생
- Next.js App Router는 Server Component를 기본적으로 캐싱하여 성능 최적화
- POST 후 in-memory 캐시만 무효화했지만, Next.js 페이지 캐시는 무효화되지 않음

**해결**:
1. **페이지 레벨**: `export const dynamic = 'force-dynamic'`
   - 위치: `app/sources/add/page.tsx`
   - 효과: 페이지를 항상 동적으로 렌더링, 캐시하지 않음

2. **API 레벨**: `revalidatePath('/sources/add')`
   - 위치: `app/api/sources/route.ts` POST 메서드
   - 효과: 소스 저장 후 해당 경로의 캐시를 명시적으로 무효화

**이유**:
- `force-dynamic` 단독으로는 사용자가 페이지를 떠났다가 돌아올 때 캐시된 버전이 보일 수 있음
- `revalidatePath` 단독으로는 초기 로드 시 캐시가 남아있을 수 있음
- 두 방법을 조합하면 확실하게 최신 데이터를 보장

**대안 검토**:
- `router.refresh()` (클라이언트): 현재 페이지만 새로고침, 페이지 이동 후 재방문 시 캐시 문제 지속
- `cache: 'no-store'` (fetch): 개별 fetch만 캐시 방지, 페이지 레벨 캐시는 유지
- Client Component 전환: SSR 이점 상실, 초기 로딩 성능 저하

**트레이드오프**:
- `force-dynamic` 사용 시 페이지가 캐시되지 않아 매 요청마다 DB 조회 발생
- 소스 관리 페이지는 자주 접근하지 않으므로 성능 영향 미미
- 데이터 일관성이 성능보다 중요한 페이지에 적합

**관련 파일**:
- `app/sources/add/page.tsx:17` - `export const dynamic = 'force-dynamic'`
- `app/api/sources/route.ts:2,275` - `revalidatePath('/sources/add')`

---

## ADR-015: AI 기반 크롤러 타입 자동 감지 시스템

**일시**: 2026-02-14
**상태**: 확정

**결정**: 크롤러 타입을 자동으로 감지하는 8단계 파이프라인 시스템을 도입한다. Rule-based 분석으로 70% 해결하고, 나머지 30%는 GPT-5-nano AI 모델로 처리한다.

**배경**:
- NIPA, 산업통상자원부 등 새 사이트마다 도메인을 하드코딩하는 문제 발생
- `if (url.includes('nipa.kr')) return 'SPA'` 방식은 확장성 없음
- 매번 코드 수정 필요 → 개발자 개입 없이 자동화 불가능
- B2C 서비스로 확장 시 사용자가 직접 크롤러 타입 선택해야 하는 UX 문제

**해결책 — 8단계 Confidence-Based Pipeline**:

```
1. Domain Override (0.95+)  — 특정 도메인 강제 지정 (legacy 호환)
2. RSS Discovery (0.95+)    — RSS 피드 자동 발견
3. URL Pattern (0.95+)      — URL 패턴 기반 타입 추정
4. CMS Detection (0.85+)    — WordPress, Tistory 등 CMS 감지
5. Rule-based Analysis (0.7+) — HTML 구조 휴리스틱 분석
6. Confidence Check        — Rule-based 신뢰도 >= 0.7 → STATIC
7. AI Type Detection (0.6+) — 🤖 GPT-5-nano가 HTML 분석하여 타입 결정
8. AI Selector Detection   — 🤖 GPT-4o-mini가 CSS 셀렉터 자동 추출 (fallback)
```

**설계 결정**:

1. **Edge Function 사용**:
   - 위치: `supabase/functions/detect-crawler-type/index.ts`
   - 이유: Supabase Edge Function이 OpenAI Responses API (GPT-5-nano) 지원
   - 대안: Vercel Serverless — `@deno/shim-deno` 패키지 없이 GPT-5-nano 사용 불가

2. **비용 최적화**:
   - Rule-based 단계(1-5)가 70% 케이스 해결 (무료)
   - AI 호출은 confidence < 0.7일 때만 실행 (30% 케이스)
   - GPT-5-nano ($0.05/1M tokens) — GPT-4o-mini 대비 10배 저렴
   - HTML 5000자로 truncate (토큰 비용 절감)

3. **Confidence 기반 진행**:
   - 각 단계마다 신뢰도 점수 계산
   - 임계값 이상이면 즉시 결과 반환 (이후 단계 생략)
   - Waterfall 방지: 높은 신뢰도 먼저 체크

4. **투명성 확보**:
   - `config._detection` 메타데이터 저장:
     ```json
     {
       "method": "ai-type-detection",
       "confidence": 0.85,
       "fallbackStrategies": ["STATIC", "SPA"],
       "reasoning": "React 기반 SPA 감지됨"
     }
     ```
   - 사용자가 자동 감지 근거 확인 가능

**AI 감지 프롬프트 전략**:
```
- 입력: URL + HTML 5000자 (메타태그, body 구조)
- 분석 대상:
  • JavaScript 프레임워크 (React, Vue, Angular) → SPA
  • Server-rendered 컨텐츠 패턴 → STATIC
  • RSS/Atom feed 링크 → RSS
- 출력: { crawlerType, confidence, reasoning }
- 검증: confidence >= 0.6일 때만 채택
```

**UI 통합 — AUTO 옵션**:
- 크롤러 타입 선택 드롭다운에 "자동지정" (AUTO) 기본값 추가
- AUTO 선택 시 백엔드에서 8단계 파이프라인 실행
- 저장 시 최종 크롤러 타입(STATIC/SPA/RSS)으로 변환되어 DB에 저장
- `crawlerType: 'AUTO'`는 UI 전용 값, DB에는 저장되지 않음

**대안 검토**:

1. **완전 Rule-based만 사용**:
   - 장점: 비용 없음, 빠름
   - 단점: 복잡한 사이트 처리 불가 (정확도 ~50%)
   - 결론: 70%만 처리 가능, 나머지 30% AI 보완 필요

2. **모든 요청에 AI 사용**:
   - 장점: 높은 정확도
   - 단점: 비용 과다 (월 수백 달러), 2-5초 지연
   - 결론: 비용 대비 효과 낮음

3. **도메인 하드코딩 유지**:
   - 장점: 구현 간단
   - 단점: 확장 불가능, 매번 코드 수정 필요
   - 결론: 근본 문제 미해결

4. **사용자가 직접 선택**:
   - 장점: 개발 불필요
   - 단점: UX 저하, 일반 사용자는 크롤러 타입 개념 모름
   - 결론: B2C 서비스 전환 불가능

**트레이드오프**:

| 항목 | 장점 | 단점 |
|------|------|------|
| **지연 시간** | Rule-based는 즉시 (~100ms) | AI 호출 시 2-5초 소요 |
| **비용** | Rule-based 70% 무료 | AI 호출 시 OpenAI API 비용 발생 |
| **정확도** | AI 사용 시 ~85% | Rule-based만 ~50% |
| **확장성** | 새 도메인 자동 처리 | Edge Function 콜드 스타트 지연 |
| **유지보수** | 코드 수정 불필요 | AI 프롬프트 튜닝 필요 시 Edge Function 재배포 |

**허용 가능한 이유**:
- 소스 저장은 1회성 작업 (크롤링 시마다 실행 X)
- 2-5초 지연은 소스 추가 시에만 발생
- 도메인 하드코딩 제거로 개발자 공수 절감 효과가 더 큼

**구현 파일**:
- `supabase/functions/detect-crawler-type/index.ts` — Edge Function (GPT-5-nano)
- `lib/crawlers/strategy-resolver.ts` — 8단계 파이프라인 오케스트레이터
- `lib/crawlers/auto-detect.ts` — AI 타입 감지 호출 (detectCrawlerTypeByAI)
- `app/sources/add/SourcesPageClient.tsx` — AUTO 옵션 UI
- `app/api/sources/route.ts` — AUTO 처리 로직 (무시하고 resolution 사용)

**배포**:
```bash
# Edge Function 배포
npx supabase functions deploy detect-crawler-type

# Supabase Secret 설정 (Management API)
# OPENAI_API_KEY — 이미 설정됨 (summarize-article 공유)
```

**검증 결과**:
- NIPA(nipa.kr): AI 타입 감지 → SPA (confidence 0.82)
- 산업통상자원부(motie.go.kr): AI 타입 감지 → STATIC (confidence 0.75)
- 하드코딩 제거 후에도 정상 동작 확인

---

## ADR-016: URL 최적화 시스템 (`crawl_url` 컬럼 도입)

**일시**: 2026-02-14
**상태**: 확정

**결정**: `crawl_sources` 테이블에 `crawl_url` 컬럼을 추가하고, 3단계 URL 최적화 파이프라인을 도입한다.

**배경**:
- 사용자가 입력한 URL이 크롤링 최적 URL이 아닌 경우가 빈번함
  - 예: `www.example.com` (메인 페이지) → `www.example.com/feed` (RSS 피드)
  - 예: `blog.company.com` (블로그 홈) → `blog.company.com/articles` (아티클 목록)
- 기존 방식: `base_url`을 덮어쓰면 원본 URL 정보가 손실됨
- 필요: 원본 URL 보존 + 최적화된 URL 사용

**결정 내용**:

1. **DB 스키마 변경**:
   - `crawl_sources.crawl_url TEXT NULL` 컬럼 추가
   - `base_url`: 사용자 입력 원본 (UI 표시용)
   - `crawl_url`: 실제 크롤링 URL (NULL이면 `base_url` 사용)

2. **URL 최적화 파이프라인 (3단계)**:
   ```
   1. 도메인 매핑 (수동 규칙, confidence: 0.95)
      - 예: www.surfit.io → directory.surfit.io (× 실패 사례)

   2. 경로 패턴 탐색 (자동, confidence: 0.8)
      - 시도 순서: /feed, /rss, /blog, /articles, /news, /posts
      - HEAD 요청으로 존재 여부 확인

   3. HTML 링크 발견 (자동, confidence: 0.75)
      - RSS/Atom <link> 태그 추출
      - 네비게이션 메뉴에서 "블로그", "아티클" 키워드 링크 탐색
   ```

3. **크롤링 로직**:
   - `effectiveUrl = source.crawl_url || source.base_url`
   - 크롤러는 `effectiveUrl`을 사용

**대안 검토**:

1. **Option A**: `base_url`만 사용, 사용자가 직접 최적 URL 입력
   - ❌ 사용자 부담 증가, UX 저하

2. **Option B**: `base_url` 자동 덮어쓰기
   - ❌ 원본 URL 손실, UI에서 이상한 URL 표시

3. **Option C**: `crawl_url` 컬럼 추가 (채택)
   - ✅ 원본 보존, 최적화 자동화, 투명성 확보

**트레이드오프**:

- ✅ 장점:
  - 자동 URL 최적화로 크롤링 성공률 향상
  - 원본 URL 보존으로 사용자 입력 존중
  - RSS 피드 자동 발견 등 편의성 증대

- ⚠️ 단점:
  - DB 컬럼 추가로 복잡도 증가
  - URL 최적화 로직 유지보수 필요

**교훈 (서핏 사례)**:

- **문제**: `www.surfit.io` → `directory.surfit.io` 매핑 실패
- **원인**: `directory.surfit.io`는 콘텐츠 디렉토리가 아니라 **사람 프로필 디렉토리**였음
- **해결**: 도메인 매핑 제거, 원본 URL 사용
- **교훈**: 수동 도메인 매핑은 실제 페이지 구조 확인 후 신중히 적용해야 함
- **결과**: 자동 탐색(경로 패턴, HTML 발견)이 더 안전하고 유연함

**관련 파일**:
- `lib/crawlers/url-optimizer.ts` - URL 최적화 로직
- `lib/crawlers/index.ts` - `crawl_url` 우선 사용
- `app/api/sources/route.ts` - `crawl_url` 저장
- `supabase/migrations/003_add_crawl_url.sql` - 마이그레이션

---


## ADR-017: getCrawler() 우선순위 버그 수정

**일시**: 2026-02-19
**상태**: 확정

**결정**: `getCrawler()` 함수의 크롤러 선택 순서를 LEGACY_CRAWLER_REGISTRY 최우선으로 변경한다.

**배경**:
- `inferCrawlerType(url)`은 항상 유효한 크롤러 타입을 반환함 (`SPA`가 기본값)
- 기존 코드: `inferCrawlerType()` 먼저 호출 → 항상 유효한 타입 반환 → `LEGACY_CRAWLER_REGISTRY` 도달 불가
- 결과: stonebc, retailtalk, brunch, iconsumer, openads, buybrand, wiseapp 전용 크롤러가 완전히 우회됨
- 이 크롤러들은 해당 사이트에 최적화된 파싱 로직을 갖고 있어 범용 전략보다 월등히 정확함

**버그 재현**:
```typescript
// 기존 코드 (버그)
function getCrawler(source: CrawlSource) {
  const inferred = inferCrawlerType(source.base_url); // 항상 유효한 값 반환
  if (isValidCrawlerType(inferred)) return crawlWithStrategy; // ← 항상 여기서 리턴
  // LEGACY_CRAWLER_REGISTRY에 절대 도달하지 못함
  return LEGACY_CRAWLER_REGISTRY[source.name] ?? crawlWithStrategy;
}
```

**해결**:
```typescript
// 수정된 코드
function getCrawler(source: CrawlSource) {
  // 1. 레거시 사이트별 크롤러 최우선
  if (LEGACY_CRAWLER_REGISTRY[source.name]) {
    return LEGACY_CRAWLER_REGISTRY[source.name];
  }
  // 2. DB crawler_type 명시적 설정
  if (source.crawler_type && isValidCrawlerType(source.crawler_type)) {
    return crawlWithStrategy;
  }
  // 3. URL 패턴 추론 폴백
  const inferred = inferCrawlerType(source.base_url);
  if (isValidCrawlerType(inferred)) return crawlWithStrategy;
  return crawlWithStrategy;
}
```

**우선순위 이유**:
- 레거시 크롤러는 해당 사이트의 특수한 HTML 구조, API 패턴, 인증 방식을 전용 처리
- 범용 전략(`crawlWithStrategy`)보다 훨씬 높은 크롤링 성공률
- 향후 새 사이트는 AUTO 파이프라인으로 처리, 레거시는 유지

**영향 받은 사이트**: stonebc, retailtalk, brunch, iconsumer, openads, buybrand, wiseapp (7개)

---

## ADR-018: Step 7.5 — API 엔드포인트 자동 감지 시스템

**일시**: 2026-02-19
**상태**: 확정

**결정**: 크롤러 타입 자동 감지 파이프라인에 Step 7.5를 추가한다. SPA 타입이 확정된 후, Puppeteer 네트워크 탐지 + AI 분석으로 숨겨진 REST API 엔드포인트를 자동 발견하여 `crawler_type=API`로 전환한다.

**배경**:
- 많은 사이트가 SPA 형태이지만 내부적으로 REST API로 데이터를 가져옴
- SPA로 크롤링하면 Puppeteer가 필요하고 느리며 JS 렌더링 실패 위험 존재
- API 크롤러(`APIStrategy`)는 훨씬 빠르고 안정적 (fetch + JSON 파싱)
- 예시: 와이즈앱 — SPA처럼 보이지만 `POST /insight/getList.json` API 실제 사용
- 기존: DB에 `crawler_type=API`와 `crawl_config`를 수동으로 입력해야 했음 → 비효율

**해결책 — Step 7.5**:

```
기존 파이프라인:
  7. AI Type Detection → SPA 확정
  8. AI Selector Detection

신규 파이프라인:
  7. AI Type Detection → SPA 확정
  7.5. 🆕 API 엔드포인트 감지 (detect-api-endpoint Edge Function)
       └─ Puppeteer로 페이지 방문 + 네트워크 요청 캡처
       └─ XHR/Fetch 요청 목록 → GPT-5-nano 분석
       └─ 콘텐츠 목록 API 식별 + body 구조/응답 스키마 추론
       └─ 성공: crawler_type=API + crawl_config 저장
       └─ 실패: SPA 유지
  8. AI Selector Detection (SPA 유지 시)
```

**설계 결정**:

1. **Supabase Edge Function 사용**:
   - 파일: `supabase/functions/detect-api-endpoint/index.ts`
   - 이유: Puppeteer(chromium)을 Edge Function에서 실행 가능, Vercel Serverless 함수 timeout 우회

2. **crawl_config 구조**:
   ```json
   {
     "endpoint": "https://example.com/api/getList.json",
     "method": "POST",
     "headers": { "Content-Type": "application/json", "Origin": "..." },
     "body": { "sortType": "new", "pageInfo": { "currentPage": 0, "pagePerCnt": 30 } },
     "responseMapping": { "items": "dataList", "title": "title", "link": "urlKeyword" },
     "urlTransform": { "linkTemplate": "https://example.com/detail/{urlKeyword}" }
   }
   ```

3. **비용 최적화**:
   - Step 7.5는 Step 7에서 SPA 확정된 경우에만 실행 (약 30% 케이스)
   - SPA 중 API 패턴 발견 성공률 예상 ~40% → 전체 소스의 ~12%만 호출
   - GPT-5-nano 사용으로 토큰 비용 최소화

4. **vercel.json maxDuration 확장**:
   - `app/api/sources/route.ts`: 60초 → 300초
   - 이유: Step 7.5 Puppeteer(~30초) + AI(~34초) = 64초 > 기존 60초

**대안 검토**:

1. **수동 crawl_config 입력**:
   - ❌ 사용자가 API 엔드포인트, 요청 body 구조를 직접 파악해야 함 → 고도의 기술 지식 필요

2. **항상 SPA 크롤러 사용**:
   - ❌ Puppeteer 필요 (느림, 불안정), 서버 리소스 과다 소비

3. **Browser DevTools 가이드 제공**:
   - ❌ 사용자 경험 저하, B2C 서비스 전환 불가

**적용 사례 (와이즈앱)**:
- URL: `https://www.wiseapp.co.kr/insight/`
- 감지된 API: `POST https://www.wiseapp.co.kr/insight/getList.json`
- 절감 효과: Puppeteer 크롤링 불필요 → fetch + JSON 파싱으로 3배 빠름

**트레이드오프**:

| 항목 | 장점 | 단점 |
|------|------|------|
| **소스 저장 시간** | 1회성, 이후 크롤링 빠름 | 저장 시 +30~60초 지연 |
| **크롤링 안정성** | API 크롤러가 더 견고 | API 스키마 변경 시 재감지 필요 |
| **비용** | 크롤링 서버 리소스 절감 | 소스 추가 시 OpenAI API 비용 |

**구현 파일**:
- `supabase/functions/detect-api-endpoint/index.ts` — Edge Function (Puppeteer + GPT-5-nano)
- `lib/crawlers/strategy-resolver.ts` — Step 7.5 통합
- `lib/crawlers/strategies/api.ts` — crawl_config 기반 API 크롤링

---

## ADR-017: SITEMAP 크롤러 전략 추가 및 YouTube/GraphQL 기각

**일시**: 2026-02-19
**상태**: 확정

**결정**: 세 가지 새로운 크롤러 타입(SITEMAP, PLATFORM_YOUTUBE, GRAPHQL) 추가를 검토하여 SITEMAP만 구현하고, YouTube와 GraphQL은 기각한다.

**배경**:
- RSS 피드가 없는 정적 사이트(기업 블로그, 공식 사이트 등)를 크롤링할 방법이 부족함
- 기존 STATIC/SPA 전략은 CSS 셀렉터 설정이 사이트마다 달라 유지보수 부담

**결정 — SITEMAP 채택**:

SITEMAP 전략은 사이트 표준 규격(sitemap.xml)을 활용하므로 사이트별 커스터마이징 없이 동작.

- **동작 방식**: sitemap.xml 파싱 → URL 목록 수집 → 각 페이지 fetch → title/content 추출
- **핵심 설계**:
  - `crawlList()`에서 title + thumbnail + content를 1회 fetch로 동시 추출 (이중 fetch 방지)
  - `item.content` 설정 시 오케스트레이터가 `crawlContent()` 재호출 생략
  - 최대 15개 URL fetch (오케스트레이터는 상위 5개만 사용, 실패 대비 버퍼)
  - 5개씩 병렬 fetch (배치 처리)
  - Sitemap Index 재귀 지원 (depth ≤ 1, 최대 3개 서브 sitemap)
- **자동 감지**: 파이프라인 Step 2.5에서 `/sitemap.xml` 자동 탐색, 성공 시 `SITEMAP` 타입 결정

**결정 — PLATFORM_YOUTUBE 기각**:

- YouTube 채널은 공식 RSS 피드 제공: `https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxx`
- 기존 RSS 전략으로 완전히 커버 가능 — 새 전략 불필요
- YouTube Data API v3 키 의존성 추가는 불필요한 복잡도

**결정 — GRAPHQL 기각**:

- GRAPHQL 주요 타깃이었던 Velog(`velog.io/@user/rss`)와 Hashnode 모두 RSS 피드 제공
- 기존 RSS 전략으로 완전히 커버 가능
- GraphQL 쿼리 설정은 사이트마다 달라 "범용 솔루션" 목표와 상충

**트레이드오프 (SITEMAP)**:

| 항목 | 장점 | 단점 |
|------|------|------|
| **범용성** | 사이트별 셀렉터 설정 불필요 | sitemap.xml 없는 사이트는 사용 불가 |
| **속도** | 최대 15 URL × 병렬 fetch | RSS보다 느림 (각 URL 개별 fetch 필요) |
| **날짜 정확도** | sitemap lastmod 활용 | lastmod 없는 sitemap도 있음 (모두 포함) |

**구현 파일**:
- `lib/crawlers/strategies/sitemap.ts` — SITEMAP 전략 클래스
- `lib/crawlers/strategy-resolver.ts` — Step 2.5 discoverSitemap() 추가
- `lib/crawlers/infer-type.ts` — sitemap URL 패턴 감지 추가 (RSS 체크보다 선행)

---

## ADR-019: Stage 6 제거 + 탐지 파이프라인 병렬화 (v1.5.1)

**일시**: 2026-02-19
**상태**: 확정

**결정**: 크롤러 타입 자동 감지 파이프라인에서 Stage 6 (Rule-based CSS 셀렉터 분석)을 제거하고, Stage 7+8을 `Promise.all`로 병렬 실행한다. 또한 RSS 경로 탐색(6개)과 Sitemap 탐색(2개)도 병렬화한다.

**배경 — Stage 6 제거**:
- `detectByRules()` (Stage 6)는 테이블/리스트/반복 요소 패턴 매칭으로 CSS 셀렉터를 추출
- 실제 운영에서 confidence 0.7 이상을 달성한 경우 거의 없음 → AI 감지로 항상 폴백
- Stage 6는 AI 호출 지연만 추가하고 유의미한 결과를 내지 못함
- Rule-based 셀렉터보다 AI(infer-type.ts)가 훨씬 정확함이 확인됨

**배경 — HTML 전처리 추가**:
- `<head>` CSS/JS 번들이 ~35KB → 50KB 제한 시 아티클 카드(53KB 위치)가 잘려 AI가 볼 수 없음
- AI는 필터탭(43KB 위치)만 보고 잘못된 셀렉터 선택 (maily.so 사례)
- `trySemanticDetection`이 `<main>` 태그만으로 confidence 0.9 반환 → AI 우회 문제

**배경 — Tailwind CSS 호환성**:
- Tailwind 유틸리티 클래스 (`.dark:text-slate-200`, `.lg:gap-4`)를 AI가 셀렉터로 출력
- Cheerio CSS 파서가 `:` 를 pseudo-class로 해석 → `Unknown pseudo-class :text-slate-200` 에러
- AI가 JSON 내 `\:` 를 생성하면 `JSON.parse`가 `Bad escaped character` 에러

**결정 내용**:

1. **Stage 6 (`detectByRules`) 파이프라인에서 완전 제거**:
   - 기존: Rule-based 분석 → confidence < 0.7 → AI 감지
   - 변경: Rule-based 분석 완전 생략 → AI 감지 항상 실행

2. **Stage 7+8 병렬화 (`Promise.all`)**:
   - AI 타입 감지 + AI 셀렉터 감지를 동시에 실행 (~5초 절약)
   - 두 결과가 나온 후 최적 값 선택

3. **RSS/Sitemap 탐색 병렬화**:
   - `discoverRSS`: 6개 경로 순차 → `Promise.all` 동시 (18초 → 3초)
   - `discoverSitemap`: 2개 후보 순차 → `Promise.all` 동시 (10초 → 5초)

4. **HTML 전처리 추가 (infer-type.ts)**:
   - `<head>` 제거 → 200자 이상 인라인 스크립트/스타일 제거 → 50KB 제한
   - `trySemanticDetection`: `<article>` 3개+ 조건으로 강화 (이전: `<main>` 태그)

5. **Tailwind 호환성 처리 (infer-type.ts)**:
   - `escapeTailwindColons()`: `.dark:text-xxx` → `.dark\:text-xxx`
   - JSON 수리: `\:` → `\\:` 변환 후 `JSON.parse`

**대안 검토**:

1. **Stage 6 유지 + AI 보조**:
   - ❌ Rule-based 결과 신뢰도가 낮아 AI를 항상 재실행해야 함 → 비효율

2. **순차 실행 유지**:
   - ❌ RSS 탐색 최악 18초, Sitemap 10초, AI 타입+셀렉터 순차 → 소스 저장 시 과도한 지연

3. **AI 셀렉터 감지 제거 (타입만 감지)**:
   - ❌ 셀렉터 없이는 STATIC 크롤링이 DEFAULT_SELECTORS에만 의존 → 크롤링 성공률 저하

**트레이드오프**:

| 항목 | 이전 | v1.5.1 |
|------|------|--------|
| 소스 저장 시 RSS 탐색 | 최악 18초 (순차) | ~3초 (병렬) |
| 소스 저장 시 Sitemap 탐색 | 최악 10초 (순차) | ~5초 (병렬) |
| AI Stage 7+8 | 순차 (~10초) | 병렬 (~5초) |
| Tailwind 사이트 셀렉터 탐지 | 에러 발생 | 자동 이스케이프 |
| AI가 필터탭 오인식 | `<head>` 때문에 발생 | HTML 전처리로 해결 |

**범용성 검증**:
- HTML 전처리: 모든 사이트의 `<head>` 제거 → 특정 사이트 하드코딩 X
- Tailwind 이스케이프: 모든 Tailwind 사이트에 적용 → 특정 사이트 하드코딩 X
- Stage 6 제거: 모든 사이트에 AI 감지 적용 → 일관된 동작

**관련 파일**:
- `lib/crawlers/strategy-resolver.ts` — Stage 6 제거, Stage 7+8 병렬, RSS/Sitemap 병렬
- `lib/crawlers/infer-type.ts` — HTML 전처리, Tailwind 이스케이프, JSON 수리, 프롬프트 개선
- `CLAUDE.md` — 범용 크롤러 원칙 추가

---

## ADR-020: AI 요약 시 해외 소스 제목 한국어 번역 (title_ko)

**일시**: 2026-02-21
**상태**: 확정

**결정**: AI 요약 생성 시 아티클 제목의 한국어 번역도 함께 생성하여 `articles.title_ko` 컬럼에 저장한다.

**배경**:
- 해외 소스 아티클의 제목이 영문 원본 그대로 표시됨
- AI 요약(summary + tags)은 이미 한국어로 생성되지만, 제목은 크롤링 원본 그대로 저장
- 추가 API 호출 없이 기존 요약 프롬프트에 포함하여 비용 최소화 가능

**구현**:
- Edge Function / 로컬 fallback 프롬프트에 `title_ko` 지시사항 추가 (이미 한국어면 원본 그대로)
- `max_tokens` 600 → 700 (번역 제목 토큰 여유분)
- 프론트엔드: `language === 'ko'` → `article.title_ko || article.title` (기존 아티클 fallback)

**대안 검토**:
- 별도 번역 API (Google Translate, DeepL): 추가 비용 + API 의존성
- 프론트엔드 실시간 번역: 매 렌더링마다 호출, 비용 과다
- 기존 요약 호출에 포함 (채택): 추가 비용 거의 없음

**관련 파일**: `supabase/functions/summarize-article/index.ts`, `lib/ai/summarizer.ts`, `lib/ai/batch-summarizer.ts`, `types/index.ts`, `components/ArticleCard.tsx`

---

## ADR-021: 카테고리 더블클릭 이름 변경 (Cascading Update)

**일시**: 2026-02-21
**상태**: 확정

**결정**: 소스 관리 페이지에서 카테고리를 더블클릭하면 인라인 편집으로 이름을 변경할 수 있다. 이름 변경 시 `categories`, `articles.category`, `crawl_sources.config.category` 3곳을 동시 업데이트한다.

**배경**:
- 카테고리 이름 변경 기능이 없어 삭제 후 재생성 필요
- `articles.category`는 FK가 아닌 텍스트 매칭이므로 이름 변경 시 관련 데이터 동기화 필수

**구현**:
- `PATCH /api/categories` 엔드포인트 추가
- Cascading update: (1) categories.name → (2) articles.category 일괄 → (3) crawl_sources.config JSONB 순회
- SortableCategory 컴포넌트에 더블클릭 인라인 편집 UI 추가
- 중복 이름 검사 (409 Conflict)

**대안 검토**:
- 모달 다이얼로그: 과도한 UI, 간단한 텍스트 변경에 불필요
- FK 관계로 변경: DB 구조 대규모 변경 필요, 비용 대비 효과 낮음

**관련 파일**: `app/api/categories/route.ts`, `app/sources/add/SourcesPageClient.tsx`

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
