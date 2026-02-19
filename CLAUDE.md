# Insight Hub - Development Guide

> AI 기반 비즈니스 인사이트 콘텐츠 크롤링 및 큐레이션 플랫폼

## 프로젝트 개요

**Insight Hub**는 다양한 비즈니스 콘텐츠 소스를 크롤링하고, Supabase Edge Function (GPT-5-nano) 또는 로컬 OpenAI API (GPT-4o-mini)를 활용해 1줄 요약 및 태그를 자동 생성하는 인사이트 큐레이션 플랫폼입니다.

### 핵심 기능
- 다중 소스 자동 크롤링 (정적 페이지, SPA, RSS, 플랫폼 특화 등 7가지 전략)
- AI 요약 및 태그 자동 생성 (Edge Function 우선, 로컬 fallback)
- 다국어 지원 (한국어, English, 日本語, 中文)
- 실시간 검색 및 카테고리 필터링
- 반응형 UI (Desktop, Tablet, Mobile)
- 매일 아침 9시 자동 크롤링 (Vercel Cron)
- 이미지 프록시 (Hotlinking 방지, SSRF 차단)

### GitHub Repository
```
https://github.com/mochunab/all_info.git
```

---

## 기술 스택

### 📱 Frontend
| 항목 | 기술 | 설명 |
|------|------|------|
| Framework | Next.js 14 (App Router) | React 기반 풀스택 프레임워크, SSR/CSR 하이브리드 |
| Language | TypeScript (strict mode) | 정적 타입 체킹, `type` 사용 (interface 금지) |
| UI Library | React 18 | Hooks 기반 상태 관리 (useState, useEffect, useCallback) |
| Styling | Tailwind CSS v3 | 유틸리티 퍼스트 CSS + CSS Variables |
| i18n | 커스텀 시스템 | `lib/i18n.ts` - 4개 언어 지원 (ko, en, ja, zh) |
| Fonts | Pretendard, Outfit | 본문(Pretendard), 로고(Outfit) |

### 🔧 Backend
| 항목 | 기술 | 설명 |
|------|------|------|
| API | Next.js API Routes | Vercel Serverless Functions로 실행 (별도 서버 없음) |
| Language | TypeScript | API Routes 및 비즈니스 로직 |
| Auth | 커스텀 인증 시스템 | Bearer Token (서버 간) + Same-Origin (CSRF 방어) |
| Middleware | Next.js Middleware | Rate Limiting, CORS, Security Headers |

### 🗄️ Database
| 항목 | 기술 | 설명 |
|------|------|------|
| Database | Supabase (PostgreSQL) | 클라우드 매니지드 PostgreSQL |
| Client | Supabase JS SDK | Browser / Server / Service (Admin) 클라이언트 분리 |
| RLS | Row Level Security | 테이블별 권한 정책 적용 |

> **참고**: Supabase Auth 미사용. 사용자 로그인 시스템 없음. 모든 인증은 서버 간 통신용.

### 🤖 AI & Edge Functions
| 항목 | 기술 | 설명 |
|------|------|------|
| AI 요약 (Primary) | Supabase Edge Function (Deno) | GPT-5-nano 기반 1줄 요약 + 태그 생성 |
| AI 요약 (Fallback) | OpenAI API (GPT-4o-mini) | Edge Function 실패 시 자동 fallback |
| AI 크롤러 타입 감지 | Edge Function (GPT-5-nano) | HTML 구조 분석하여 최적 크롤러 타입 자동 결정 |
| Retry Logic | 최대 3회 재시도 | 백오프 전략 (1s → 2s → 3s) |

### 🕷️ Crawling Engine
| 항목 | 기술 | 설명 |
|------|------|------|
| 정적 HTML | Cheerio | CSS 셀렉터 기반 파싱 (가장 빠름) |
| 동적 렌더링 (SPA) | Puppeteer | Headless Chrome, JavaScript 렌더링 |
| RSS/Atom | rss-parser | 피드 파서 |
| 본문 추출 | @mozilla/readability | 광고/메뉴 자동 제거 |
| DOM 파싱 | jsdom@24 | Node.js 환경 DOM 조작 |
| 전략 패턴 | 8가지 크롤러 타입 | STATIC, SPA, RSS, SITEMAP, PLATFORM_NAVER, PLATFORM_KAKAO, NEWSLETTER, API |

### 🚀 Deployment & Hosting
| 항목 | 기술 | 설명 |
|------|------|------|
| Hosting | Vercel | Serverless 플랫폼 |
| Cron Jobs | Vercel Cron | 매일 00:00 UTC (09:00 KST) 자동 크롤링 |
| Serverless Functions | maxDuration 300초 | 크롤링/요약 API 타임아웃 설정 |
| CDN | Vercel Edge Network | 글로벌 CDN 자동 배포 |

### 🛠️ Development Tools
| 항목 | 기술 | 설명 |
|------|------|------|
| Version Control | GitHub | https://github.com/mochunab/all_info.git |
| Package Manager | npm | 의존성 관리 |
| Build Tool | Next.js (Turbopack) | 빌드 및 번들링 |
| Linting | ESLint | TypeScript 코드 품질 검사 |

---

### 📊 Infrastructure Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Vercel Platform                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Next.js 14 App                                   │  │
│  │  ├─ Frontend (React 18 SSR/CSR)                   │  │
│  │  └─ Backend (API Routes → Serverless Functions)  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Cron: 매일 09:00 KST → POST /api/crawl/run             │
└────────┬────────────────────────────┬───────────────────┘
         │                            │
         ▼                            ▼
  ┌─────────────┐            ┌──────────────────┐
  │  Supabase   │            │  OpenAI API      │
  │  - PostgreSQL│            │  - GPT-5-nano    │
  │  - Edge Fn   │            │  - GPT-4o-mini   │
  │  - RLS       │            │  (AI 요약)       │
  └─────────────┘            └──────────────────┘
```

> **서버 구성 상세**: [PROJECT_CONTEXT.md → 서버 구성](./key_docs/PROJECT_CONTEXT.md#서버-구성) 참조
> **크롤링 플로우 상세**: [PROJECT_CONTEXT.md → 크롤링 플로우](./key_docs/PROJECT_CONTEXT.md#1-크롤링-플로우-자료-불러오기-버튼--cron) 참조

---

## 프로젝트 구조

```
insight-hub/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── articles/             # 아티클 조회 API
│   │   │   ├── route.ts          # GET - 아티클 목록 (검색/필터/페이지네이션)
│   │   │   └── sources/route.ts  # GET - 소스별 아티클
│   │   ├── sources/route.ts      # GET/POST - 크롤링 소스 CRUD
│   │   ├── crawl/                # 크롤링 관련
│   │   │   ├── run/route.ts      # POST - 전체 크롤링 실행 (Cron/Bearer Auth)
│   │   │   ├── trigger/route.ts  # POST - 프론트엔드 트리거 (CRON_SECRET 노출 방지 프록시)
│   │   │   └── status/route.ts   # GET - 크롤링 상태 조회
│   │   ├── summarize/            # AI 요약 관련
│   │   │   ├── route.ts          # POST - 단건 요약 (Bearer Auth)
│   │   │   └── batch/route.ts    # POST - 일괄 요약 (Bearer Auth)
│   │   ├── categories/route.ts   # GET/POST - 카테고리 관리
│   │   └── image-proxy/route.ts  # GET - 이미지 프록시 (Hotlinking/SSRF 방지)
│   ├── sources/                  # 소스 관리 페이지
│   ├── layout.tsx                # 전역 레이아웃 (Pretendard + Outfit 폰트)
│   ├── page.tsx                  # 메인 페이지
│   └── globals.css               # CSS Variables + Tailwind 설정
│
├── components/                   # React 컴포넌트 (Client Components)
│   ├── ArticleCard.tsx           # 아티클 카드 (이미지 프록시, ai_summary 표시)
│   ├── ArticleGrid.tsx           # 아티클 그리드 + 무한 스크롤
│   ├── FilterBar.tsx             # 검색/카테고리 필터 UI
│   ├── Header.tsx                # 헤더 (자료 불러오기 버튼 → /api/crawl/trigger)
│   ├── LanguageSwitcher.tsx      # 언어 선택 드롭다운 (4개 언어)
│   ├── Toast.tsx                 # 토스트 알림
│   ├── Skeleton.tsx              # 로딩 스켈레톤
│   └── index.ts                  # Barrel export
│
├── lib/                          # 유틸리티 및 비즈니스 로직
│   ├── auth.ts                   # 인증 함수 (verifyCronAuth, verifySameOrigin)
│   ├── i18n.ts                   # 다국어 번역 시스템 (ko, en, ja, zh)
│   ├── utils.ts                  # 공통 유틸 (cn, fetchWithTimeout 등)
│   ├── supabase/                 # Supabase 클라이언트
│   │   ├── client.ts             # 브라우저 클라이언트
│   │   └── server.ts             # 서버 클라이언트 (SSR) + Service Client (Admin)
│   ├── ai/                       # AI 요약 로직
│   │   ├── summarizer.ts         # 로컬 OpenAI 직접 호출 (GPT-4o-mini)
│   │   └── batch-summarizer.ts   # 배치 요약 (Edge Function 우선 → 로컬 fallback)
│   └── crawlers/                 # 크롤링 로직
│       ├── index.ts              # 오케스트레이터 (runCrawler, runAllCrawlers)
│       ├── base.ts               # 공통 유틸 (saveArticles, isWithinDays, parseDate)
│       ├── types.ts              # 크롤러 타입 정의
│       ├── auto-detect.ts        # CSS 셀렉터 자동 탐지 (rule-based + AI fallback)
│       ├── content-extractor.ts  # 본문 추출 (Readability → 셀렉터 → body 순)
│       ├── date-parser.ts        # 날짜 파싱 (한글 상대 날짜 지원)
│       ├── cheerio-crawler.ts    # Cheerio 기반 크롤러
│       ├── playwright-crawler.ts # Puppeteer/Playwright 기반 크롤러
│       ├── strategies/           # 크롤러 전략 (Strategy Pattern)
│       │   ├── index.ts          # 전략 팩토리 (getStrategy, inferCrawlerType)
│       │   ├── static.ts         # STATIC: 정적 페이지 (Cheerio + 페이지네이션)
│       │   ├── spa.ts            # SPA: 동적 페이지 (Puppeteer)
│       │   ├── rss.ts            # RSS: 피드 파서 (rss-parser)
│       │   ├── sitemap.ts        # SITEMAP: sitemap.xml 파싱 (RSS 없는 사이트 대응)
│       │   ├── naver.ts          # PLATFORM_NAVER: 네이버 블로그 특화
│       │   ├── kakao.ts          # PLATFORM_KAKAO: 카카오 브런치 특화
│       │   ├── newsletter.ts     # NEWSLETTER: 뉴스레터 크롤러
│       │   └── api.ts            # API: REST API 엔드포인트
│       └── sites/                # 사이트별 커스텀 크롤러
│           ├── stonebc.ts
│           ├── retailtalk.ts
│           ├── iconsumer.ts
│           ├── brunch.ts
│           ├── wiseapp.ts
│           ├── openads.ts
│           └── buybrand.ts
│
├── types/                        # TypeScript 타입 정의
│   ├── database.ts               # Supabase Database 타입
│   └── index.ts                  # 공통 타입 (Article, CrawlSource 등)
│
├── scripts/                      # CLI 스크립트
│   └── crawl.ts                  # 크롤링 CLI (npx tsx)
│
├── supabase/                     # Supabase 설정
│   ├── functions/                # Edge Functions
│   │   └── summarize-article/    # AI 요약 Edge Function (Deno, GPT-5-nano)
│   │       └── index.ts
│   └── migrations/               # DB 마이그레이션
│       ├── 001_initial_schema.sql
│       └── 002_add_ai_summary_tags.sql
│
├── middleware.ts                  # Next.js Middleware (Rate Limit, CORS, Security Headers)
├── vercel.json                   # Vercel 배포 설정 (Cron, maxDuration, Security Headers)
└── .env.local                    # 환경변수 (로컬)
```

---

## 핵심 아키텍처 패턴

### 1. 크롤러 전략 패턴 (Strategy Pattern)

모든 크롤러는 `CrawlStrategy` 인터페이스를 구현하며, `getStrategy()` 팩토리 함수로 인스턴스를 반환합니다.

```typescript
// 전략 인터페이스
interface CrawlStrategy {
  readonly type: CrawlerType;
  crawlList(source: CrawlSource): Promise<RawContentItem[]>;
  crawlContent?(url: string, config?: ContentSelectors): Promise<string>;
}

// 사용 예시
const strategy = getStrategy(source.crawler_type);
const items = await strategy.crawlList(source);
```

**지원 크롤러 타입 (9종)**:
| 타입 | 엔진 | 용도 |
|------|------|------|
| `AUTO` | 9단계 파이프라인 | **자동 감지** (UI 전용, DB에는 저장 안 됨) |
| `STATIC` | Cheerio | 정적 HTML (페이지네이션 지원) |
| `SPA` | Puppeteer | JS 렌더링 필요한 동적 페이지 |
| `RSS` | rss-parser | RSS/Atom 피드 |
| `SITEMAP` | fetch + Cheerio | sitemap.xml 파싱 → 각 페이지 크롤링 (RSS 없는 사이트) |
| `PLATFORM_NAVER` | Cheerio | 네이버 블로그 특화 |
| `PLATFORM_KAKAO` | Cheerio | 카카오 브런치 특화 |
| `NEWSLETTER` | Cheerio | 뉴스레터 플랫폼 |
| `API` | fetch | REST API 엔드포인트 |

**크롤러 타입 자동 감지 (2026-02-14)**:
- **9단계 파이프라인**: Rule-based (1-6단계, Step 2.5 Sitemap 포함) → AI 감지 (7-8단계)
- **AUTO 옵션**: UI에서 "자동지정" 선택 시 백엔드가 8단계 파이프라인으로 최적 타입 결정
- **비용 최적화**: Rule-based가 70% 해결 (무료), AI는 confidence < 0.7일 때만 호출 (30%)
- **Edge Function**: `detect-crawler-type` — GPT-5-nano가 HTML 구조 분석
- **투명성**: `config._detection` 메타데이터에 감지 방법, 신뢰도, 근거 저장
- 상세: [PROJECT_CONTEXT.md → AI 기반 크롤러 타입 자동 감지 시스템](./key_docs/PROJECT_CONTEXT.md#ai-기반-크롤러-타입-자동-감지-시스템)

### 2. 2단계 데이터 파이프라인

```
[Stage 1: 크롤링]
  크롤러 → HTML 파싱 → Readability 본문 추출 → content_preview (최대 500자)

[Stage 2: AI 요약 (배치, 5개 병렬)]
  content_preview → Edge Function (GPT-5-nano) → ai_summary + summary_tags
                    └→ 실패 시 → 로컬 OpenAI (GPT-4o-mini) (최대 3회 재시도)
  ※ 5개씩 Promise.allSettled 병렬 처리, 실패 시 1s→2s→3s 백오프 재시도
```

**중요**: `content_preview`는 크롤링 시 웹페이지에서 직접 추출한 원문 텍스트이며, AI 생성물이 아닙니다.

### 3. AI 요약 생성 (Edge Function 우선)

```
USE_EDGE_FUNCTION 환경변수 (기본값: true)
├── true (기본): Supabase Edge Function → GPT-5-nano
│   └── 실패 시: 로컬 OpenAI API → GPT-4o-mini (자동 fallback)
└── false (명시): 로컬 OpenAI API → GPT-4o-mini (직접 호출)
```

**요약 형식**:
- 1줄 핵심 요약 (`ai_summary`): 80자 이내, 구어체, 이모지/마크다운 금지
- 3개 태그 (`summary_tags`): 각 7자 내외

**관련 파일**:
- `supabase/functions/summarize-article/index.ts` — Edge Function (Deno, GPT-5-nano)
- `lib/ai/summarizer.ts` — 로컬 OpenAI 직접 호출 (GPT-4o-mini)
- `lib/ai/batch-summarizer.ts` — 배치 요약 오케스트레이터 (Edge Function 우선 로직)

### 4. 인증 시스템 (`lib/auth.ts`)

> **사용자 로그인 없음** — 모든 인증은 서버 간 통신용

| 함수 | 용도 | 사용처 |
|------|------|--------|
| `verifyCronAuth(request)` | Bearer Token 검증 (`CRON_SECRET`) | `/api/crawl/run`, `/api/summarize`, `/api/summarize/batch` |
| `verifySameOrigin(request)` | CSRF 방어 (Origin/Referer ↔ Host 비교) | 프론트엔드 호출 API |

**프론트엔드 → 크롤링 트리거 흐름**:
```
Header.tsx "자료 불러오기" 버튼
  → POST /api/crawl/trigger (인증 불필요, rate limit 30초)
    → 서버 내부에서 POST /api/crawl/run + Bearer CRON_SECRET (서버→서버)
```
이 패턴은 `CRON_SECRET`이 클라이언트에 노출되지 않도록 합니다.

### 5. Middleware (`middleware.ts`)

| 기능 | 대상 | 설명 |
|------|------|------|
| Rate Limiting | `POST /api/crawl/trigger` | 30초 쿨다운 (429 Too Many Requests) |
| CORS | 모든 요청 | `ALLOWED_ORIGINS` 화이트리스트 기반 |
| Security Headers | 모든 응답 | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| OPTIONS Preflight | CORS 사전 요청 | Access-Control-Allow-Methods/Headers |

### 6. 이미지 프록시 (`/api/image-proxy`)

외부 이미지 핫링킹 방지 + SSRF 차단:

| 보안 레이어 | 설명 |
|-------------|------|
| **도메인 화이트리스트** | `pstatic.net`, `stibee.com`, `daumcdn.net` 등 허용 도메인만 |
| **SSRF 차단** | Private IP (127.x, 10.x, 192.168.x, localhost 등) 접근 차단 |
| **프로토콜 제한** | HTTPS만 허용 |
| **리다이렉트 차단** | `redirect: 'error'` 설정으로 SSRF 우회 방지 |
| **크기 제한** | 최대 10MB |
| **Content-Type 검증** | `image/*` 타입만 허용 |
| **Referer 스푸핑** | 네이버 → `blog.naver.com`, 카카오 → `brunch.co.kr` |

---

## API Routes 전체 맵

| Endpoint | Method | Auth | 용도 | maxDuration |
|----------|--------|------|------|-------------|
| `/api/articles` | GET | 없음 | 아티클 목록 (검색, 필터, 페이지네이션) | 기본 |
| `/api/articles/sources` | GET | 없음 | 소스별 아티클 조회 | 기본 |
| `/api/sources` | GET/POST | Same-Origin | 크롤링 소스 CRUD (POST 시 auto-detect + API 감지 포함) | **300초** |
| `/api/crawl/run` | POST | Bearer Token | 전체 크롤링 실행 + 배치 요약 | **300초** |
| `/api/crawl/trigger` | POST | Rate Limit (30s) | 프론트엔드 → crawl/run 프록시 | 기본 |
| `/api/crawl/status` | GET | 없음 | 크롤링 상태 조회 | 기본 |
| `/api/summarize` | POST | Bearer Token | 단건 AI 요약 | 기본 |
| `/api/summarize/batch` | POST | Bearer Token | 일괄 AI 요약 | **300초** |
| `/api/categories` | GET/POST | 없음 | 카테고리 CRUD | 기본 |
| `/api/image-proxy` | GET | 없음 | 이미지 프록시 | 기본 |

---

## 범용 크롤러 원칙 (CRITICAL — 모든 세션에서 반드시 인지)

> **핵심 목표**: Insight Hub는 **임의의 URL을 등록하면 자동으로 크롤링 전략을 결정하는 범용 AI 크롤러**다.
> 특정 사이트에 맞춘 하드코딩은 이 목표에 정면으로 위배된다.

### ❌ 절대 금지 — 소스별 하드코딩

| 금지 행위 | 이유 |
|-----------|------|
| `crawl_sources.config` (DB)를 특정 사이트에 맞게 직접 수정 | 다른 소스에 적용 불가, 반복 유지보수 부담 |
| 특정 도메인/URL 조건 if문으로 분기 추가 | 하드코딩 누적 → 스파게티 코드 |
| 특정 소스 실패를 DB 패치로 해결 | 근본 원인 미해결, 다음 소스에서 동일 문제 재발 |

### ✅ 올바른 문제 해결 방향

크롤링이 실패하거나 AI가 잘못된 config를 생성하면 → **탐지 파이프라인 자체를 개선**

| 증상 | 올바른 해결책 |
|------|------------|
| AI 셀렉터 오탐 (필터탭 → 아티클로 오인) | `infer-type.ts` `detectSelectorsWithAI` 프롬프트 고도화 |
| 시맨틱 감지가 AI를 우회해 잘못된 결과 | `trySemanticDetection` 조건 강화 (article 태그 3개+ 등) |
| 크롤러 타입 오탐 | `strategy-resolver.ts` 파이프라인 로직 개선 |
| 특정 사이트 구조에서 일관 실패 | 해당 패턴의 **범용** 감지 규칙 추가 (단일 사이트 X) |

### 범용성 자가 검증 기준

> 코드를 수정하기 전, 스스로에게 물어볼 것:
> **"이 수정이 maily.so 외 다른 임의의 사이트에도 동일하게 적용되는가?"**
> 특정 사이트에만 해당한다면 → 잘못된 방향. 파이프라인 개선으로 돌아갈 것.

---

## 개발 규칙 (MUST FOLLOW)

### 1. TypeScript 코딩 컨벤션

```typescript
// ✅ GOOD: type 사용 (interface 대신)
type Article = {
  id: string;
  title: string;
};

// ❌ BAD: interface 금지
interface Article {
  id: string;
  title: string;
}

// ✅ GOOD: any 사용 시 반드시 eslint-disable 주석 추가
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient(url, key) as any;

// ❌ BAD: any 주석 없이 사용 금지
const supabase = createClient(url, key) as any;

// ✅ GOOD: Path alias 사용
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

// ❌ BAD: 상대 경로 사용 금지
import { createClient } from '../../lib/supabase/client';
```

### 네이밍 컨벤션

```typescript
// 파일명: kebab-case (유틸) / PascalCase (컴포넌트)
batch-summarizer.ts
ArticleCard.tsx

// 컴포넌트: PascalCase
export default function ArticleCard() {}

// 함수/변수: camelCase
const fetchArticles = async () => {}
const isLoading = true;

// 타입: PascalCase
type CrawlerType = 'STATIC' | 'SPA';
type CrawlResult = { found: number; new: number };

// 상수: UPPER_SNAKE_CASE
const USER_AGENT = 'Mozilla/5.0...';
const DEFAULT_HEADERS = { ... };
```

### 2. React 컴포넌트 규칙

```typescript
// Client Components — 'use client' 필수
'use client';

import { useState, useEffect, useCallback } from 'react';

export default function MyComponent() {
  // 1. useState → 2. useCallback → 3. useEffect → 4. return
  const [data, setData] = useState<Type[]>([]);
  const handleChange = useCallback((v: string) => setValue(v), []);
  useEffect(() => { fetchData(); }, [dependency]);
  return <div>...</div>;
}

// Server Components — 'use client' 없음 (기본값)
import { createClient } from '@/lib/supabase/server';

export default async function ServerPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('articles').select('*');
  return <div>{/* ... */}</div>;
}
```

### 3. Supabase 사용 규칙

```typescript
// 브라우저 환경 (Client Components)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// 서버 환경 (Server Components, SSR)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Admin 작업 (크롤링, 배치 요약 등 — RLS 우회)
import { createServiceClient } from '@/lib/supabase/server';
const supabase = createServiceClient(); // Service Role Key 사용
```

### 4. 인증 패턴 (API Routes)

```typescript
// 서버 간 인증 (Cron, 배치 등) — Bearer Token
import { verifyCronAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... 비즈니스 로직
}

// 프론트엔드 호출 (CSRF 방어)
import { verifySameOrigin } from '@/lib/auth';

// 프론트엔드 → 서버 프록시 (CRON_SECRET 노출 방지)
// /api/crawl/trigger → 내부에서 /api/crawl/run + Bearer 호출
```

### 5. 크롤러 개발 규칙

```typescript
// 새 전략 추가: 3단계
// 1. lib/crawlers/strategies/example.ts 생성
export const exampleStrategy: CrawlStrategy = {
  type: 'EXAMPLE',
  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    return items;
  },
};

// 2. lib/crawlers/strategies/index.ts 에 전략 등록
// 3. types.ts의 CrawlerType에 타입 추가

// 필수 체크 사항:
// - fetchWithTimeout(url, {}, 15000) — 15초 기본 타임아웃
// - source_id 중복 체크 (URL 기반 해시)
// - isWithinDays(date, 14) — 최근 14일 필터링 (2026-02-19: 7→14 변경)
// - DEFAULT_HEADERS 사용 (User-Agent 설정)
// - maxPages 제한 필수 (무한 루프 방지)
// - Puppeteer 사용 시 browser.close() 필수

// AI 기반 크롤러 타입 자동 감지 (2026-02-14, v1.5.1에서 개선)
// - 소스 저장 시 crawlerType='AUTO' 선택하면 파이프라인 자동 실행
// - 하드코딩 금지: 도메인 기반 if문으로 타입 지정하지 말 것
// - 파이프라인 (lib/crawlers/strategy-resolver.ts):
//   1. HTML 다운로드 (15초 타임아웃) — 실패 시 URL 패턴 폴백
//   2. RSS Discovery (0.95+) — Promise.all로 6개 경로 동시 탐색 (v1.5.1)
//   2.5. Sitemap Discovery (0.90+) — Promise.all로 2개 후보 동시 확인 (v1.5.0)
//   3. CMS Detection (0.85+) — WordPress, Tistory, Ghost 등
//   4. URL Pattern Analysis (0.85~0.95) — .go.kr, naver.com, /feed 등
//   5. SPA Scoring (calculateSPAScore) — body 텍스트 < 500자, #root/#app
//   [Stage 6 Rule-based CSS Analysis 제거됨 — v1.5.1]
//   7. AI Type Detection — 🤖 GPT-5-nano Edge Function (항상 실행)
//   7.5. API 엔드포인트 감지 — SPA 확정 후 detect-api-endpoint Edge Function 호출
//   8. AI Selector Detection — 🤖 infer-type.ts (7+8 Promise.all 병렬 실행, v1.5.1)
//      └─ HTML 전처리: <head>/인라인 스크립트 제거 후 50KB 제한 (아티클 카드 가시성 확보)
//      └─ Tailwind 콜론 이스케이프: .dark:text → .dark\:text (Cheerio 파서 호환)
//      └─ trySemanticDetection: <article> 3개+ 있을 때만 신뢰 (0.8)
//   8.5. SPA 셀렉터 재감지 (v1.5.2) — SPA + confidence < 0.5 → Puppeteer 렌더링 HTML로 재감지
//      └─ getRenderedHTML(url): load + 3s wait (JS 렌더링 완료 대기)
//      └─ 재감지 신뢰도 > 기존 신뢰도일 때만 결과 교체
// - Edge Function 배포: npx supabase functions deploy detect-crawler-type
// - 결과 저장: config._detection에 method, confidence, reasoning 저장
```

### 6. 에러 핸들링 패턴

```typescript
export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 7. 페이지네이션 패턴

```typescript
const page = parseInt(searchParams.get('page') || '1', 10);
const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);
const offset = (page - 1) * limit;

const { data, count } = await supabase
  .from('articles')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1);

const hasMore = offset + limit < (count || 0);
```

### 8. 다국어 (i18n) 규칙

```typescript
// 번역 키 사용 (lib/i18n.ts)
import { t } from '@/lib/i18n';
import type { Language } from '@/types';

// 컴포넌트에서 사용
const message = t(language, 'header.refresh');
const dynamicMessage = t(language, 'toast.crawlSuccess', { count: String(5) });

// 새 번역 키 추가 시 lib/i18n.ts의 translations 객체에 ko, en, ja, zh 모두 추가
// 변수 치환: {변수명} 문법 사용, params로 전달
```

**번역 키 추가 절차**:
1. `lib/i18n.ts` → `translations` 객체에 4개 언어 모두 추가
2. TypeScript가 자동으로 타입 체크 (존재하지 않는 키 사용 시 에러)
3. 변수 치환이 필요하면 `{name}`, `{count}` 형식 사용

---

## 금지 사항 (NEVER DO)

### AI 요약 프롬프트 (절대 변경 금지)

```
프롬프트 위치:
  - Edge Function: supabase/functions/summarize-article/index.ts
  - 로컬: lib/ai/summarizer.ts (SUMMARY_PROMPT 상수)

규칙:
  - 1줄 요약: 80자 이내, 이모지/마크다운 금지, 구어체
  - 태그 3개: 7자 내외
  - 출력: JSON { "summary": "...", "summary_tag": ["...", "...", "..."] }
```

### 금지 사항 요약 테이블

| 금지 | 이유 |
|------|------|
| `interface` 사용 | `type`으로 통일 |
| `any` 주석 없이 사용 | eslint-disable 주석 필수 |
| 상대 경로 import | `@/*` alias 사용 |
| Supabase client/server 혼용 | 환경 분리 필수 |
| 하드코딩 URL/API Key | 환경변수 사용 |
| fetch timeout 미설정 | `fetchWithTimeout()` 사용 |
| Puppeteer browser.close() 누락 | 메모리 누수 |
| AI 요약 프롬프트 수정 | 기획 확정된 프롬프트 |
| console.log 디버깅 잔류 | 의미 있는 로그만 |
| maxPages 제한 없는 크롤링 | 무한 루프 위험 |
| 클라이언트에 CRON_SECRET 노출 | `/api/crawl/trigger` 프록시 패턴 사용 |
| image-proxy 도메인 무분별 추가 | SSRF 위험, 화이트리스트만 |

---

## 환경변수 관리

### .env.local (로컬 개발)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...    # 서버 전용 (RLS 우회)

# OpenAI (로컬 fallback용)
OPENAI_API_KEY=sk-...

# Cron 보안
CRON_SECRET=random_secret_string

# AI 요약 경로 선택 (기본값: true → Edge Function 우선)
USE_EDGE_FUNCTION=true
# false로 설정 시 로컬 OpenAI API 직접 호출

# 사이트 URL (crawl/trigger 내부 호출용)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Supabase Secrets (Edge Function용)

```bash
# Supabase Dashboard → Edge Functions → Secrets
# 또는 Management API로 설정됨
OPENAI_API_KEY=sk-...    # Edge Function에서 GPT-5-nano 호출 시 사용
```

### Vercel 환경변수 (프로덕션)

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
CRON_SECRET
USE_EDGE_FUNCTION=true
```

---

## 개발 워크플로우

### 1. 로컬 개발 시작

```bash
# 1. 환경변수 설정
cp .env.local.example .env.local
# .env.local 파일 수정 (Supabase, OpenAI API 키 입력)

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
# → http://localhost:3000

# 4. 크롤링 테스트 (Dry-run)
npm run crawl:dry -- --verbose
# → DB 저장 없이 크롤링 테스트 + 상세 로그

# 5. 실제 크롤링 실행
npm run crawl
# → 모든 활성 소스 크롤링 + DB 저장

# 6. 특정 소스만 크롤링
npm run crawl -- --source=1
```

### 2. 새 크롤링 소스 추가

**권장 방법**: UI에서 "소스 관리" 페이지 사용
1. 홈 → "소스 관리" → "소스 링크 추가"
2. URL 입력 후 크롤러 타입 "자동지정" (AUTO) 선택 (기본값)
3. 저장 → 백엔드가 8단계 파이프라인으로 자동 분석
4. `config._detection`에 감지 결과 저장됨

**수동 방법**: Supabase Dashboard 직접 수정
1. `crawl_sources` 테이블에 레코드 삽입
2. `crawler_type` 설정 (또는 UI에서 AUTO 선택 권장)
3. `config` JSON에 `selectors`, `pagination` 등 설정 (AUTO면 자동 생성)
4. `npm run crawl:dry -- --source=<id> --verbose` 테스트
5. 성공 시 `is_active = true` 활성화

### 3. AI 요약 생성

```bash
# 자동: /api/crawl/run 크롤링 완료 후 자동으로 배치 요약 실행

# 수동: 요약 없는 아티클 일괄 처리
POST /api/summarize/batch
Authorization: Bearer {CRON_SECRET}

# 수동: 특정 아티클만 요약
POST /api/summarize
Authorization: Bearer {CRON_SECRET}
Body: { "articleId": "uuid" }
```

### 4. Edge Function 배포

```bash
# AI 요약 Edge Function (GPT-5-nano)
supabase functions deploy summarize-article

# AI 크롤러 타입 감지 Edge Function (GPT-5-nano) - 2026-02-14 추가
supabase functions deploy detect-crawler-type
npx supabase functions deploy detect-api-endpoint

# 또는 MCP (Supabase MCP 설정 시)
# → mcp__supabase__deploy_edge_function

# Secret 확인 (OPENAI_API_KEY는 두 함수 공유)
# Supabase Dashboard → Edge Functions → Secrets
# - OPENAI_API_KEY: sk-... (이미 설정됨)
```

### 5. Git + 배포

```bash
# Git
git add <files>
git commit -m "feat: 설명"
git push origin main

# Vercel 자동 배포 (Git push 시)
# Cron: 매일 00:00 UTC (09:00 KST) → /api/crawl/run
```

---

## 디버깅 가이드

### 크롤링 실패 시

```bash
# 1. Dry-run으로 로그 확인
npm run crawl:dry -- --source=<id> --verbose

# 2. SPA 크롤러 디버깅 (Puppeteer)
# lib/crawlers/strategies/spa.ts 수정:
const browser = await puppeteer.launch({
  headless: false,
  devtools: true,
});

# 3. 셀렉터 검증
# Chrome DevTools: document.querySelectorAll('selector')
```

### AI 요약 실패 시

```bash
# 1. Edge Function 경로 확인
USE_EDGE_FUNCTION=true  →  Edge Function 호출 중인지 로그 확인
# "[AI] Using Edge Function for: ..." 로그 존재 시 Edge Function 사용 중
# "[AI] Edge Function failed, falling back to local: ..." → fallback 발생

# 2. Edge Function 직접 테스트
curl -X POST "${SUPABASE_URL}/functions/v1/summarize-article" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트", "content": "테스트 본문"}'

# 3. 로컬 OpenAI 확인
echo $OPENAI_API_KEY  # 키 설정 확인

# 4. Supabase Secret 확인
# Dashboard → Edge Functions → Secrets → OPENAI_API_KEY 존재 확인
```

### summary NULL 값 문제

```bash
# ai_summary가 NULL인 이유:
# → 배치 요약이 아직 처리하지 못한 아티클
# → 배치 크기: 20~30개씩 처리 (processPendingSummaries)
# → /api/crawl/run 실행 시 크롤링 후 자동 배치 요약

# 수동 배치 실행:
curl -X POST "http://localhost:3000/api/summarize/batch" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### Middleware / Rate Limit 문제

```bash
# /api/crawl/trigger 429 에러 시:
# → 30초 쿨다운 대기 후 재시도
# → middleware.ts TRIGGER_COOLDOWN_MS 값 확인

# CORS 문제 시:
# → middleware.ts ALLOWED_ORIGINS에 도메인 추가
```

---

## 성능 최적화 팁

### 1. 이미지 최적화

```typescript
// Lazy Loading + 이미지 프록시
<img loading="lazy" />

// 프록시 URL (Hotlinking 방지)
const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;

// 에러 시 Fallback
<img onError={() => setImageError(true)} />
```

### 2. 무한 스크롤

```typescript
// 페이지 단위로 데이터 추가 (교체 아님)
const handleLoadMore = () => {
  fetchArticles(page + 1, true); // append=true
};
```

### 3. 검색 디바운싱

```typescript
const handleSearchChange = useCallback((value: string) => {
  setSearch(value);
}, []);

useEffect(() => {
  fetchArticles(1, false);
}, [search]);
```

---

## 트러블슈팅 FAQ

### Q1. 크롤링은 되는데 DB에 저장이 안 됩니다.
**원인**: `source_id` 중복 또는 RLS 정책 문제
**해결**: `npm run crawl:dry -- --source=<id> --verbose` → "[DB] SKIP" 로그 확인

### Q2. AI 요약이 생성되지 않습니다.
**원인**: Edge Function 미배포, OPENAI_API_KEY 미설정, content_preview 없음
**해결**:
1. `USE_EDGE_FUNCTION` 환경변수 확인 (기본 `true`)
2. Supabase Secrets에 `OPENAI_API_KEY` 확인
3. `content_preview` 컬럼 NULL이면 크롤러 본문 추출 로직 확인 → Q6 참조

### Q6. content_preview가 NULL이거나 너무 짧습니다 (SPA 사이트).
**원인**: SPA 페이지는 Cheerio 정적 파싱 불가 (HTTP 404 또는 빈 body). API 타입 소스의 경우 `crawlContent`가 `'{}'` 같은 2자 fallback을 반환하기도 함.
**해결 (자동)**: `lib/crawlers/index.ts`의 본문 미리보기 추출 루프는 다음 2단계 fallback을 자동 적용:
1. Cheerio 1차 시도 (빠름, 정적 페이지)
2. Cheerio 실패 또는 `content_preview < 50자`이면 → Puppeteer (SPA 렌더링)
**수동 확인**:
```bash
npm run crawl:dry -- --source=<id> --verbose
# "🔄 Cheerio 실패 → Puppeteer 시도..." 로그 확인
# "✅ Puppeteer 추출 완료 (N자)" 로그 확인
```
**추가 원인 - API 소스 linkTemplate 오류**:
- `crawler_type=API` 소스의 `config.crawl_config.urlTransform.linkTemplate`이 잘못된 URL 패턴이면 404 페이지가 렌더링됨
- 예: `/insight/{id}` (잘못됨) → `/insight/detail/{id}` (올바름)
- Supabase Dashboard → `crawl_sources` → `config.crawl_config.urlTransform` 확인

### Q3. Vercel에서 Puppeteer가 작동하지 않습니다.
**원인**: Vercel Serverless는 Chrome 바이너리 포함 불가
**해결**: `puppeteer-core` + `@sparticuz/chromium` 사용 또는 외부 Crawler 서버

### Q4. image-proxy가 특정 이미지를 불러오지 못합니다.
**원인**: 해당 도메인이 화이트리스트에 없음
**해결**: `app/api/image-proxy/route.ts`의 `ALLOWED_DOMAINS` 배열에 도메인 추가

### Q5. /api/crawl/trigger 호출 시 429 에러
**원인**: 30초 Rate Limit 쿨다운
**해결**: 30초 대기 후 재시도. 변경 필요 시 `middleware.ts`의 `TRIGGER_COOLDOWN_MS`

---

## 작업 유형별 가이드

### 1. 버그 수정
1. 에러 로그 확인 (브라우저 콘솔 / 서버 로그)
2. 관련 파일 읽기 (API Route → lib → components 순)
3. `npm run dev` 테스트
4. 크롤링 버그: `npm run crawl:dry -- --source=<id> --verbose`

### 2. 신규 기능 추가
1. `types/index.ts` 또는 `types/database.ts` 타입 정의
2. API Route 생성 (`app/api/{feature}/route.ts`)
3. lib 유틸 함수 작성
4. 컴포넌트 생성 → `components/index.ts` barrel export 추가
5. 인증 필요 시 `lib/auth.ts`의 `verifyCronAuth` 또는 `verifySameOrigin` 적용

### 3. UI 수정
1. CSS Variables 확인 (`app/globals.css`)
2. Tailwind 클래스 사용 (인라인 style 최소화)
3. 반응형: `sm:`, `lg:` 브레이크포인트
4. 트랜지션: `transition-colors` 또는 `transition-all`

### 4. 크롤러 추가/수정
1. 대상 사이트 분석 (HTML 구조, API 유무)
2. 적합한 전략 선택 또는 `inferCrawlerType()` 활용
3. `lib/crawlers/strategies/` 또는 `lib/crawlers/sites/` 작성
4. `npm run crawl:dry -- --source=<id> --verbose` 테스트

### 5. Edge Function 수정
1. `supabase/functions/summarize-article/index.ts` 수정
2. `supabase functions deploy summarize-article` 배포
3. Supabase Dashboard → Functions → Logs 확인

### 6. 배포
1. `npm run build` 빌드 확인
2. Git push → Vercel 자동 배포
3. Cron: `vercel.json` → `0 0 * * *` (매일 09:00 KST)

---

## DB 스키마 요약

### articles 테이블

| 컬럼 | 타입 | 채워지는 시점 |
|------|------|--------------|
| `id` | uuid (PK) | INSERT 시 자동 생성 |
| `title` | text | 크롤링 시 |
| `url` | text | 크롤링 시 |
| `source_id` | text (UNIQUE) | 크롤링 시 (URL 기반 해시, 중복 방지) |
| `content_preview` | text | 크롤링 시 (Readability 추출, 최대 500자) |
| `image_url` | text | 크롤링 시 (썸네일) |
| `published_at` | timestamptz | 크롤링 시 (원문 게시일) |
| `crawled_at` | timestamptz | 크롤링 시 (수집 시각) |
| `summary` | text | AI 배치 처리 시 (레거시 3줄 요약) |
| `ai_summary` | text | AI 배치 처리 시 (1줄 요약, 80자 이내) |
| `summary_tags` | text[] | AI 배치 처리 시 (태그 3개) |
| `category` | text | 크롤링 시 (소스의 카테고리) |
| `crawl_source_id` | integer (FK) | 크롤링 시 (crawl_sources.id) |
| `is_active` | boolean | 기본 true |

### crawl_sources 테이블
| 컬럼 | 설명 |
|------|------|
| `id` | serial PK |
| `name` | 소스 이름 |
| `base_url` | 크롤링 대상 URL |
| `crawler_type` | STATIC/SPA/RSS/SITEMAP/PLATFORM_NAVER/PLATFORM_KAKAO/NEWSLETTER/API |
| `config` | jsonb — selectors, pagination, content_selectors 등 |
| `category` | 카테고리 |
| `is_active` | 활성화 여부 |
| `priority` | 크롤링 우선순위 |
| `last_crawled_at` | 마지막 크롤링 시각 |

---

## 파일 구조 규칙

```
파일명: PascalCase (컴포넌트) / kebab-case (유틸)
컴포넌트: components/{Name}.tsx → components/index.ts barrel export
API Route: app/api/{feature}/route.ts
타입: types/index.ts (공통) / types/database.ts (DB)
크롤러: lib/crawlers/strategies/{name}.ts (전략) / lib/crawlers/sites/{name}.ts (사이트별)
Supabase: lib/supabase/client.ts (브라우저) / lib/supabase/server.ts (서버)
인증: lib/auth.ts (verifyCronAuth, verifySameOrigin)
```

---

## Git 커밋 컨벤션

```
feat: 새 기능 추가
fix: 버그 수정
refactor: 리팩토링
style: UI/스타일 변경
docs: 문서 수정
chore: 설정/빌드 변경
crawl: 크롤러 관련 변경
```

---

## 핵심 문서 이정표

| 문서 | 참고 시점 |
|------|-----------|
| [PROJECT_CONTEXT.md](./key_docs/PROJECT_CONTEXT.md) | 아키텍처 이해, 디버깅 |
| [DECISIONS.md](./key_docs/DECISIONS.md) | 설계 의도 확인 |
| [DATABASE_SCHEMA.md](./key_docs/DATABASE_SCHEMA.md) | DB 쿼리 작성 |
| [components-inventory.md](./key_docs/components-inventory.md) | 컴포넌트 위치 확인 |
| [supabase/EDGE_FUNCTIONS_GUIDE.md](./key_docs/supabase/EDGE_FUNCTIONS_GUIDE.md) | Edge Function 작업 |
| [supabase/DATABASE_TRIGGERS_AND_FUNCTIONS.md](./key_docs/supabase/DATABASE_TRIGGERS_AND_FUNCTIONS.md) | DB 자동화 로직 |
| [supabase/RLS_POLICIES.md](./key_docs/supabase/RLS_POLICIES.md) | 권한 문제 디버깅 |

---

## 참고 자료

### 공식 문서
- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Puppeteer Docs](https://pptr.dev/)

### 프로젝트 특화
- [Cheerio Selectors](https://cheerio.js.org/docs/basics/selecting)
- [RSS Parser](https://www.npmjs.com/package/rss-parser)
- [Mozilla Readability](https://github.com/mozilla/readability)

---

## 버전 히스토리

### v1.5.2 (2026-02-19)
- **STATIC 타이틀 셀렉터 수정** (`lib/crawlers/strategies/static.ts`): `DEFAULT_SELECTORS.title`에서 `a` 제거 → 제목+소제목 붙는 오탐 수정
- **RSS 0건 STATIC fallback 복원** (`lib/crawlers/index.ts`): RSS 0건 early return 제거 → STATIC 폴백 정상 동작
- **AI 셀렉터 프롬프트 개선** (`lib/crawlers/infer-type.ts`): 뉴스레터/채널 디렉토리 오탐 방지 규칙 + 아티클 우선순위 기준 추가
- **SPA 셀렉터 재감지 Step 8.5** (`lib/crawlers/strategy-resolver.ts`, `spa.ts`)
  - `getRenderedHTML(url)`: Puppeteer로 JS 렌더링 후 HTML 반환 (load + 3s wait)
  - SPA + confidence < 0.5 → Puppeteer HTML로 `detectContentSelectors` 재실행 → 신뢰도 높을 때만 채택

### v1.5.1 (2026-02-19)
- **AI 셀렉터 감지 고도화** (`lib/crawlers/infer-type.ts`)
  - HTML 전처리: `<head>` + 200자 이상 인라인 `<script>`/`<style>` 제거 후 50KB 제한
    - 해결: `<head>` CSS/JS 번들(~35KB)이 아티클 카드를 50KB 밖으로 밀어내는 문제
  - `trySemanticDetection` 조건 강화: `<article>` 태그 3개+ 있을 때만 신뢰도 0.8 반환
    - 이전: `<main>` 태그만으로 신뢰도 0.9 반환 → AI 우회 문제 발생
  - Tailwind CSS 콜론 이스케이프 추가: `.dark:text-slate-200` → `.dark\:text-slate-200`
    - Cheerio CSS 파서가 `:` 를 pseudo-class로 해석하는 문제 방지
  - JSON 수리: AI가 생성한 `\:` → `\\:` 변환 후 JSON.parse (Bad escaped character 방지)
  - AI 프롬프트 전면 재작성: 아티클 카드 정의, REJECT 패턴(필터탭/네비/통계), URL 검증 요구사항 명시
  - 결과에 `date`, `thumbnail` 필드 추가
- **전략 탐지 병렬화** (`lib/crawlers/strategy-resolver.ts`)
  - Stage 6 (Rule-based CSS 셀렉터 분석 `detectByRules`) 파이프라인에서 제거
  - Stage 7+8 (AI 타입 감지 + AI 셀렉터 감지) `Promise.all` 병렬 실행
  - `discoverRSS`: 6개 경로 순차 탐색 → `Promise.all` 동시 탐색 (최악 18초→3초)
  - `discoverSitemap`: 2개 후보 순차 확인 → `Promise.all` 동시 확인 (최악 10초→5초)
- **범용 크롤러 원칙** CLAUDE.md에 추가 (하드코딩 금지, 파이프라인 개선 방향 명시)

### v1.5.0 (2026-02-19)
- **SITEMAP 크롤러 전략 추가** (`lib/crawlers/strategies/sitemap.ts`)
  - RSS 피드가 없는 사이트를 위한 sitemap.xml 기반 크롤링
  - `crawlList()`: sitemap 파싱 → 날짜 필터(14일) → URL 필터 → 최대 15개 → 5개씩 병렬 fetch
  - 각 URL에서 title + thumbnail + content를 1회 fetch로 동시 추출 (이중 fetch 방지)
  - Sitemap Index 재귀 처리 지원 (depth ≤ 1, 최대 3개 서브 sitemap)
- **자동 감지 파이프라인 Step 2.5 추가** (`lib/crawlers/strategy-resolver.ts`)
  - RSS 발견 실패 시 `/sitemap.xml` 자동 탐색 → `SITEMAP` 전략 선택
  - 발견된 sitemap URL은 `config.crawl_config.rssUrl`에 저장
- **SITEMAP 타입 등록**: `types.ts`, `types/index.ts`, `strategies/index.ts`, `infer-type.ts`, `SourcesPageClient.tsx`

### v1.4.1 (2026-02-19)
- **레거시 크롤러 Puppeteer fallback 추가** (`lib/crawlers/index.ts`)
  - 본문 미리보기 추출 루프: Cheerio 1차 → Puppeteer 2차 자동 전환
  - 조건: `!content_preview || content_preview.length < 50` (2자짜리 `'{}'` 등 무의미한 값 포함)
  - `spaStrategy.crawlContent()` 호출 후 `closeBrowser()` 정리
  - 와이즈앱 외 다른 SPA/API 소스도 자동 혜택
- **spa.crawlContent `load` + 3s wait 전략** (`lib/crawlers/strategies/spa.ts`)
  - `networkidle2` → `load` + `setTimeout(3000)` 변경
  - 폴링/WebSocket 유지 사이트(와이즈앱 등)에서 30초 타임아웃 방지
- **와이즈앱 linkTemplate URL 수정** (DB, crawl_sources source 82)
  - `/insight/{insightNid}` → `/insight/detail/{insightNid}`
  - 감지 오류: AI가 `insightNid`를 `urlKeyword`처럼 SEO URL로 오판

### v1.4.0 (2026-02-19)
- **getCrawler() 우선순위 수정**: LEGACY_CRAWLER_REGISTRY가 URL 추론보다 먼저 확인
- **API 엔드포인트 자동 감지 (Step 7.5)**: SPA 확정 후 `detect-api-endpoint` Edge Function 호출
- **AI 셀렉터 감지 SPA shell 규칙 강화**: 네비게이션 메뉴 오인식 방지
- **크롤링 윈도우 14일 확장**: `isWithinDays()` 7일 → 14일
- **이미지 프록시 도메인 추가**: `www.wiseapp.co.kr`
- **vercel.json maxDuration**: `app/api/sources/route.ts` 60→300초

### v1.3.0 (2026-02)
- CSS 셀렉터 자동 탐지 모듈 추가 (`lib/crawlers/auto-detect.ts`)
  - Rule-based: cheerio로 테이블/리스트/반복요소 패턴 매칭 (confidence 점수)
  - AI fallback: GPT-5-nano → GPT-4o-mini (confidence < 0.5일 때만)
  - SPA 감지: body 텍스트 + root div 기반 판별
- POST `/api/sources` 응답에 `analysis` 배열 추가 (method, confidence, crawlerType)
- 소스 저장 시 `config.selectors`에 자동 탐지 결과 저장
- 토스트 메시지에 분석 결과 표시 ("3개 소스 저장 (자동분석: 2 rule / 1 AI)")

### v1.2.0 (2026-02)
- AI 요약 배치 병렬 처리 (5개씩 동시 호출, Promise.allSettled)
- AI 요약 API 호출 실패 시 최대 3회 재시도 (백오프: 1s→2s→3s)
- jsdom 27→24 다운그레이드 (Vercel ESM/CJS 호환성)
- trigger 라우트 정적→동적 import 전환 (Vercel 405 수정)

### v1.1.0 (2025-02)
- Edge Function 기본 활성화 (USE_EDGE_FUNCTION 기본값 true)
- Supabase Edge Function에 OPENAI_API_KEY Secret 설정
- lib/auth.ts 인증 모듈 추가 (verifyCronAuth, verifySameOrigin)
- middleware.ts 추가 (Rate Limiting, CORS, Security Headers)
- /api/crawl/trigger 프록시 엔드포인트 추가
- 이미지 프록시 SSRF 방어 강화
- vercel.json Security Headers 추가

### v1.0.0 (2025-01-25)
- 7가지 크롤러 전략 구현
- OpenAI 기반 AI 요약 및 태그 생성
- 무한 스크롤 + 검색/필터링
- Vercel Cron 자동 크롤링
- 이미지 프록시 (Hotlinking 방지)
- 반응형 UI (Tailwind CSS)
