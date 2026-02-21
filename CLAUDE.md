# Insight Hub - Development Guide

> AI 기반 비즈니스 콘텐츠 크롤링 & 큐레이션 플랫폼
> GitHub: https://github.com/mochunab/all_info.git
> Stack: Next.js 14 (App Router) + TypeScript + Supabase (PostgreSQL + Edge Functions) + Vercel + OpenAI

---

## 핵심 아키텍처

### 크롤러 타입 (9종)

| 타입 | 엔진 | 용도 |
|------|------|------|
| `AUTO` | 9단계 파이프라인 | 자동 감지 (UI 전용, DB 저장 안 됨) |
| `STATIC` | Cheerio | 정적 HTML |
| `SPA` | Puppeteer | JS 렌더링 필요 |
| `RSS` | rss-parser | RSS/Atom 피드 |
| `SITEMAP` | fetch + Cheerio | sitemap.xml 파싱 (RSS 없는 사이트) |
| `PLATFORM_NAVER` | Cheerio | 네이버 블로그 |
| `PLATFORM_KAKAO` | Cheerio | 카카오 브런치 |
| `NEWSLETTER` | Cheerio | 뉴스레터 플랫폼 |
| `API` | fetch | REST API 엔드포인트 |

### 자동 감지 파이프라인 (`lib/crawlers/strategy-resolver.ts`)

```
0. URL 최적화 (url-optimizer.ts) — 4단계 필터 + 섹션 교차 리다이렉트 방지
1. HTML 다운로드 (15s timeout)
2. RSS 발견 (confidence 0.95) — 6개 경로 Promise.all
2.5. Sitemap 발견 (0.90) — 2개 후보 Promise.all
3. CMS 감지 (0.85) — WordPress, Tistory, Ghost
4. URL 패턴 (0.85~0.95) — .go.kr, naver.com, /feed
5. SPA 스코어링 — body < 500자, #root/#app
[Stage 6 제거 — v1.5.1]
7+8. AI 타입 감지 + AI 셀렉터 감지 — Promise.all 병렬
7.5. API 감지 — SPA 확정 후 detect-api-endpoint 호출
8.5. SPA 셀렉터 재감지 — confidence < 0.5 → Puppeteer HTML로 재감지
```

### 데이터 파이프라인

```
크롤링 → HTML 파싱 → Readability → content_preview (500자)
         → Edge Function (GPT-5-nano) → summary + summary_tags
           └→ 실패 시 → 로컬 OpenAI (GPT-4o-mini), 최대 3회 재시도
```

### 인증 (`lib/auth.ts`)

- `verifyCronAuth` — Bearer Token (`CRON_SECRET`): crawl/run, summarize
- `verifySameOrigin` — CSRF 방어: sources POST
- 프론트엔드 버튼 → `/api/crawl/trigger` (rate limit 30s) → 서버 내부에서 Bearer로 `/api/crawl/run` 호출

---

## API Routes

| Endpoint | Method | Auth | maxDuration |
|----------|--------|------|-------------|
| `/api/articles` | GET | 없음 | 기본 |
| `/api/sources` | GET/POST | Same-Origin | **300초** |
| `/api/crawl/run` | POST | Bearer | **300초** |
| `/api/crawl/trigger` | POST | Rate Limit 30s | **300초** |
| `/api/crawl/status` | GET | 없음 | 기본 |
| `/api/summarize` | POST | Bearer | 기본 |
| `/api/summarize/batch` | POST | Bearer | **300초** |
| `/api/sources/recommend` | POST | Same-Origin | 기본 |
| `/api/categories` | GET/POST | 없음 | 기본 |
| `/api/image-proxy` | GET | 없음 | 기본 |

---

## 범용 크롤러 원칙 (CRITICAL)

> Insight Hub는 **임의의 URL을 등록하면 자동으로 전략을 결정하는 범용 AI 크롤러**다.
> 코드 수정 전 스스로 물어볼 것: **"이 수정이 다른 임의의 사이트에도 동일하게 적용되는가?"**

**❌ 절대 금지**
- 특정 도메인/URL 조건 if문 분기 추가
- 특정 소스 실패를 DB 직접 패치로 해결

**✅ 올바른 방향** — 탐지 파이프라인 자체를 개선

| 증상 | 해결책 |
|------|--------|
| AI 셀렉터 오탐 | `infer-type.ts` 프롬프트 고도화 |
| 시맨틱 감지 오작동 | `trySemanticDetection` 조건 강화 |
| 크롤러 타입 오탐 | `strategy-resolver.ts` 파이프라인 개선 |
| URL 최적화 오탐 | `url-optimizer.ts` 필터/검증 강화 |
| 특정 패턴 일관 실패 | 해당 패턴의 **범용** 감지 규칙 추가 |

---

## 개발 규칙 (MUST FOLLOW)

### TypeScript
- `type` 사용 (`interface` **금지**)
- `any` 사용 시 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 필수
- import는 `@/*` alias 사용 (상대 경로 **금지**)
- 파일명: `kebab-case` (유틸) / `PascalCase` (컴포넌트)
- 상수: `UPPER_SNAKE_CASE`

### Supabase 클라이언트 환경 분리

```typescript
// 브라우저 (Client Components)
import { createClient } from '@/lib/supabase/client';

// 서버 (Server Components, API Routes)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Admin/RLS 우회 (크롤링, 배치)
import { createServiceClient } from '@/lib/supabase/server';
```

### React
- Client Components: 파일 상단 `'use client'` 필수
- Hook 순서: `useState` → `useCallback` → `useEffect` → `return`

### 크롤러 개발
- `fetchWithTimeout(url, {}, 15000)` — 15초 타임아웃 필수
- `isWithinDays(date, 14)` — 최근 14일 필터
- `maxPages` 제한 필수 (무한 루프 방지)
- Puppeteer 사용 시 `browser.close()` 필수
- 새 전략 추가: `strategies/{name}.ts` 생성 → `strategies/index.ts` 등록 → `types.ts` 타입 추가

### i18n
- 번역: `t(language, 'key')` — `lib/i18n.ts`
- 새 키 추가 시 `ko`, `en`, `ja`, `zh` 4개 언어 모두 추가

---

## 금지 사항

| 금지 | 이유 |
|------|------|
| `interface` 사용 | `type`으로 통일 |
| `any` 주석 없이 사용 | eslint-disable 주석 필수 |
| 상대 경로 import | `@/*` alias 사용 |
| Supabase client/server 혼용 | 환경 분리 필수 |
| fetch timeout 미설정 | `fetchWithTimeout()` 사용 |
| Puppeteer `browser.close()` 누락 | 메모리 누수 |
| AI 요약 프롬프트 수정 | `summarize-article/index.ts`, `lib/ai/summarizer.ts` — 기획 확정 |
| `maxPages` 없는 크롤링 | 무한 루프 위험 |
| 클라이언트에 `CRON_SECRET` 노출 | `/api/crawl/trigger` 프록시 패턴 사용 |
| image-proxy 도메인 무분별 추가 | SSRF 위험 |

---

## 환경변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 서버 전용 (RLS 우회)
OPENAI_API_KEY=                  # 로컬 fallback용
CRON_SECRET=                     # Cron/Bearer 인증
USE_EDGE_FUNCTION=true           # false 시 로컬 OpenAI 직접 호출
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Edge Function Secrets (Dashboard에서 설정)
OPENAI_API_KEY=                  # 세 함수 공유
```

---

## 개발 워크플로우

```bash
# 로컬 개발
npm install && npm run dev

# 크롤링 테스트
npm run crawl:dry -- --source=<id> --verbose   # DB 저장 없이 테스트
npm run crawl                                   # 전체 크롤링
npm run crawl -- --source=<id>                  # 특정 소스만

# Edge Function 배포 — 반드시 CLI 사용 (MCP 금지: 백틱 이스케이프 오류 발생)
supabase functions deploy summarize-article --project-ref tcpvxihjswauwrmcxhhh
supabase functions deploy detect-crawler-type --project-ref tcpvxihjswauwrmcxhhh
supabase functions deploy detect-api-endpoint --project-ref tcpvxihjswauwrmcxhhh
supabase functions deploy recommend-sources --project-ref tcpvxihjswauwrmcxhhh
# Docker 없어도 deploy 가능 (WARNING은 무시)

# Vercel 배포
git push origin main   # → Vercel 자동 배포
# Cron: vercel.json 0 0 * * * → 매일 09:00 KST
```

---

## 디버깅

```bash
# 크롤링 실패
npm run crawl:dry -- --source=<id> --verbose
# → "[DB] SKIP" = 중복 / "EXCLUDE (too old)" = 날짜 필터 / 아무 출력 없음 = 셀렉터 문제

# AI 요약 실패
# 1. Supabase Dashboard → Edge Functions → Logs 확인
# 2. Dashboard → Secrets → OPENAI_API_KEY 존재 확인
# 3. USE_EDGE_FUNCTION=false 로 로컬 fallback 테스트

# 429 Too Many Requests
# → /api/crawl/trigger: 30초 쿨다운, middleware.ts TRIGGER_COOLDOWN_MS 확인

# image-proxy 이미지 깨짐
# → app/api/image-proxy/route.ts ALLOWED_DOMAINS에 도메인 추가
```

### 주요 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| DB 저장 안 됨 | source_id 중복 또는 RLS | dry-run 로그 "[DB] SKIP" 확인 |
| content_preview NULL | SPA/API 소스 정적 파싱 불가 | 자동: Puppeteer fallback (< 50자 조건). 수동: linkTemplate 확인 |
| AI 요약 NULL | Edge Function 미배포, API키 없음, content_preview NULL | 위 3가지 순서로 확인 |
| Vercel Puppeteer 오류 | Serverless Chrome 바이너리 불가 | puppeteer-core + @sparticuz/chromium |

---

## 파일 구조 (핵심)

```
app/api/
  articles/route.ts         GET 아티클 목록
  sources/route.ts          GET/POST 소스 CRUD + auto-detect
  sources/recommend/route.ts POST AI 콘텐츠 소스 추천 (Same-Origin)
  crawl/run/route.ts        POST 전체 크롤링 (Bearer, 300s)
  crawl/trigger/route.ts    POST 프론트엔드 프록시 (rate limit)
  summarize/batch/route.ts  POST 배치 요약 (Bearer, 300s)
  image-proxy/route.ts      GET 이미지 프록시

lib/crawlers/
  index.ts              오케스트레이터 (runCrawler)
  strategy-resolver.ts  AUTO 9단계 감지 파이프라인
  infer-type.ts         AI 셀렉터 감지 (HTML 전처리 + GPT-4o-mini)
  strategies/           STATIC / SPA / RSS / SITEMAP / NAVER / KAKAO / NEWSLETTER / API

lib/ai/
  batch-summarizer.ts   배치 요약 (Edge Function 우선 → 로컬 fallback)
  summarizer.ts         로컬 OpenAI (GPT-4o-mini)

supabase/functions/
  summarize-article/    AI 요약 (GPT-5-nano)
  detect-crawler-type/  크롤러 타입 감지 (GPT-5-nano)
  detect-api-endpoint/  API 엔드포인트 감지 (GPT-5-nano)
  recommend-sources/    AI 콘텐츠 소스 추천 (GPT-5-nano + web_search)

lib/auth.ts             verifyCronAuth, verifySameOrigin
lib/i18n.ts             4개 언어 번역 (ko, en, ja, zh)
middleware.ts           Rate Limit, CORS, Security Headers
```

---

## Serena Usage (MANDATORY)

코드 탐색 시 파일 전체 읽기 대신 Serena 심볼 도구를 우선 사용할 것.

### Workflow
1. `get_symbols_overview` — 파일 구조 파악
2. `find_symbol` — 클래스/함수/변수 위치 탐색 (`include_body=True`로 필요한 부분만)
3. `find_referencing_symbols` — 수정 전 영향도 분석
4. `replace_symbol_body` / `insert_after_symbol` / `insert_before_symbol` — 코드 수정

### Rules
- **파일 전체 읽기 최소화** — 심볼 단위로 필요한 부분만 조회
- **수정 전 반드시 영향도 분석** (`find_referencing_symbols`)
- Serena 인덱싱 안 된 파일, 설정 파일(`.yml`, `.json`, `.css`) → 직접 읽기 허용

---

## Git 커밋 컨벤션

`feat` / `fix` / `refactor` / `style` / `docs` / `chore` / `crawl`

---

## 핵심 문서

| 문서 | 참고 시점 |
|------|-----------|
| [PROJECT_CONTEXT.md](./key_docs/PROJECT_CONTEXT.md) | 아키텍처 상세, 데이터 플로우, 디버깅 |
| [DECISIONS.md](./key_docs/DECISIONS.md) | 설계 의도 확인 |
| [DATABASE_SCHEMA.md](./key_docs/DATABASE_SCHEMA.md) | DB 스키마, 인덱스, RLS |
| [EDGE_FUNCTIONS_GUIDE.md](./key_docs/supabase/EDGE_FUNCTIONS_GUIDE.md) | Edge Function 작업 |
