# Insight Hub - Development Guide

> AI 기반 비즈니스 인사이트 콘텐츠 크롤링 및 큐레이션 플랫폼

## 프로젝트 개요

**Insight Hub**는 다양한 비즈니스 콘텐츠 소스를 크롤링하고, OpenAI API를 활용해 요약 및 태그를 생성하는 자동화된 인사이트 큐레이션 플랫폼입니다.

### 핵심 기능
- 📰 다중 소스 자동 크롤링 (정적 페이지, SPA, RSS, 플랫폼 특화)
- 🤖 OpenAI 기반 AI 요약 및 태그 자동 생성
- 🔍 실시간 검색 및 카테고리 필터링
- 📱 반응형 UI (Desktop, Tablet, Mobile)
- ⏰ 매일 아침 9시 자동 크롤링 (Vercel Cron)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v3 + CSS Variables |
| State | React 18 Hooks (useState, useEffect, useCallback) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase SSR (@supabase/ssr) |
| AI | OpenAI API (GPT-4o-mini / GPT-5-nano) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Crawling | Cheerio, Puppeteer, rss-parser, @mozilla/readability |
| Deployment | Vercel (Cron: 매일 00:00 UTC = 09:00 KST) |
| Font | Pretendard (본문), Outfit (로고) |

---

## 프로젝트 구조

```
insight-hub/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── articles/      # 아티클 조회 API
│   │   ├── sources/       # 크롤링 소스 관리
│   │   ├── crawl/         # 크롤링 트리거
│   │   ├── summarize/     # AI 요약 생성
│   │   └── categories/    # 카테고리 관리
│   ├── sources/           # 소스 관리 페이지
│   ├── layout.tsx         # 전역 레이아웃
│   └── page.tsx           # 메인 페이지
│
├── components/            # React 컴포넌트
│   ├── ArticleCard.tsx    # 아티클 카드
│   ├── ArticleGrid.tsx    # 아티클 그리드 + 무한스크롤
│   ├── FilterBar.tsx      # 검색/필터 UI
│   ├── Header.tsx         # 헤더 (자료 불러오기 버튼)
│   ├── Toast.tsx          # 토스트 알림
│   └── Skeleton.tsx       # 로딩 스켈레톤
│
├── lib/                   # 유틸리티 및 비즈니스 로직
│   ├── supabase/          # Supabase 클라이언트
│   │   ├── client.ts      # 브라우저 클라이언트
│   │   └── server.ts      # 서버 클라이언트 (SSR)
│   ├── crawlers/          # 크롤링 로직
│   │   ├── base.ts        # 공통 유틸 (저장, 날짜 파싱)
│   │   ├── types.ts       # 크롤러 타입 정의
│   │   ├── strategies/    # 크롤러 전략 (Strategy Pattern)
│   │   │   ├── index.ts   # 전략 팩토리 (getStrategy)
│   │   │   ├── static.ts  # 정적 페이지 크롤러
│   │   │   ├── spa.ts     # SPA 크롤러 (Puppeteer)
│   │   │   ├── rss.ts     # RSS 피드 크롤러
│   │   │   ├── naver.ts   # 네이버 블로그 특화
│   │   │   ├── kakao.ts   # 카카오 브런치 특화
│   │   │   ├── newsletter.ts # 뉴스레터 크롤러
│   │   │   └── api.ts     # API 크롤러
│   │   └── sites/         # 사이트별 커스텀 크롤러
│   └── utils.ts           # 공통 유틸 함수
│
├── types/                 # TypeScript 타입 정의
│   ├── database.ts        # Supabase Database 타입
│   └── index.ts           # 공통 타입 (Article, CrawlSource 등)
│
├── scripts/               # CLI 스크립트
│   └── crawl.ts           # 크롤링 CLI (npx tsx)
│
├── supabase/              # Supabase 설정
│   └── functions/         # Edge Functions
│       └── summarize-article/ # AI 요약 Edge Function
│
└── .env.local             # 환경변수 (로컬)
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

**지원 크롤러 타입**:
- `STATIC`: 정적 페이지 (Cheerio)
- `SPA`: SPA/동적 페이지 (Puppeteer)
- `RSS`: RSS 피드 (rss-parser)
- `PLATFORM_NAVER`: 네이버 블로그
- `PLATFORM_KAKAO`: 카카오 브런치
- `NEWSLETTER`: 뉴스레터 플랫폼
- `API`: REST API 엔드포인트

### 2. 중복 방지 및 날짜 필터링

- **중복 방지**: `source_id` (URL 기반 해시)로 이미 존재하는 아티클 필터링
- **날짜 필터링**: 최근 N일 이내의 콘텐츠만 수집 (기본 7일)
- **한글 상대 날짜 지원**: "3시간 전", "2일 전" 등 한국어 날짜 표현 파싱

### 3. AI 요약 생성 (2단계)

1. **크롤링 시**: 본문 추출 → OpenAI API 요약 생성
2. **배치 처리**: 요약 없는 기존 아티클 일괄 요약 (`/api/summarize/batch`)

**요약 형식**:
- 1줄 핵심 요약 (`ai_summary`)
- 3개 태그 (`summary_tags`)

---

## 개발 규칙 (MUST FOLLOW)

### 1. TypeScript 코딩 컨벤션

#### ✅ 반드시 지켜야 할 규칙

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

#### ✅ 네이밍 컨벤션

```typescript
// 파일명: kebab-case
article-card.tsx
crawl-sources.ts

// 컴포넌트: PascalCase
export default function ArticleCard() {}

// 함수/변수: camelCase
const fetchArticles = async () => {}
const isLoading = true;

// 타입/인터페이스: PascalCase
type CrawlerType = 'STATIC' | 'SPA';
type CrawlResult = { found: number; new: number };

// 상수: UPPER_SNAKE_CASE
const USER_AGENT = 'Mozilla/5.0...';
const DEFAULT_HEADERS = { ... };
```

### 2. React 컴포넌트 규칙

#### ✅ Client Components

```typescript
'use client'; // 항상 맨 위에 선언

import { useState, useEffect, useCallback } from 'react';

export default function MyComponent() {
  // 1. useState (상태)
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 2. useCallback (함수 메모이제이션)
  const handleChange = useCallback((value: string) => {
    setValue(value);
  }, []);

  // 3. useEffect (사이드 이펙트)
  useEffect(() => {
    fetchData();
  }, [dependency]);

  // 4. 렌더링
  return <div>...</div>;
}
```

#### ✅ Server Components (기본값)

```typescript
// 'use client' 선언 없음
import { createClient } from '@/lib/supabase/server';

export default async function ServerPage() {
  const supabase = await createClient();
  const { data } = await supabase.from('articles').select('*');

  return <div>{/* ... */}</div>;
}
```

### 3. Supabase 사용 규칙

#### ✅ Client vs Server vs Admin 구분

```typescript
// 브라우저 환경 (Client Components, API Routes)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// 서버 환경 (Server Components, SSR)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Admin 작업 (크롤링, 배치 요약 등 RLS 우회 필요 시)
import { createServiceClient } from '@/lib/supabase/server';
const supabase = createServiceClient(); // Service Role Key 사용
```

#### ✅ 타입 안전성

```typescript
import type { Database } from '@/types/database';

// 타입 추론 활성화
const supabase = createClient<Database>();

// 타입 안전한 쿼리
const { data } = await supabase
  .from('articles')
  .select('*')
  .eq('is_active', true);
```

### 4. 크롤러 개발 규칙

#### ✅ 새 크롤러 전략 추가 시

1. `lib/crawlers/strategies/` 에 새 전략 파일 생성
2. `CrawlStrategy` 인터페이스 구현
3. `lib/crawlers/strategies/index.ts` 에 전략 등록

```typescript
// 1. 새 전략 파일 생성 (example.ts)
export const exampleStrategy: CrawlStrategy = {
  type: 'EXAMPLE',
  async crawlList(source: CrawlSource): Promise<RawContentItem[]> {
    // 크롤링 로직
    return items;
  },
};

// 2. index.ts에 등록
import { exampleStrategy } from './example';

const strategies: Record<string, CrawlStrategy> = {
  // ...
  EXAMPLE: exampleStrategy,
};
```

#### ✅ 크롤링 시 필수 체크

```typescript
// 1. Timeout 설정 (15초 기본)
const response = await fetchWithTimeout(url, {}, 15000);

// 2. 중복 체크
const { data: existing } = await supabase
  .from('articles')
  .select('id')
  .eq('source_id', article.source_id)
  .single();

if (existing) {
  console.log('[DB] SKIP (already exists)');
  continue;
}

// 3. 날짜 필터링
if (!isWithinDays(article.published_at, 7, article.title)) {
  console.log('[Filter] EXCLUDE (too old)');
  continue;
}

// 4. 에러 핸들링
try {
  const items = await strategy.crawlList(source);
} catch (error) {
  console.error('[Crawler] Error:', error);
  errors.push(error.message);
}
```

### 5. API Routes 규칙

#### ✅ 에러 핸들링 패턴

```typescript
export async function GET(request: NextRequest) {
  try {
    // 비즈니스 로직
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

// 인증 필요한 API (crawl/run, summarize/batch):
// → verifyCronSecret() 사용
// → Authorization: Bearer {CRON_SECRET}
```

#### ✅ 페이지네이션

```typescript
// 쿼리 파라미터 파싱
const page = parseInt(searchParams.get('page') || '1', 10);
const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50);
const offset = (page - 1) * limit;

// Supabase 페이지네이션
const { data, count } = await supabase
  .from('articles')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1);

const hasMore = offset + limit < (count || 0);
```

### 6. 날짜 처리 규칙

#### ✅ 한글 상대 날짜 파싱

```typescript
// "3시간 전", "2일 전" 등 한국어 날짜 표현 지원
const date = parseKoreanRelativeDate('3시간 전');

// 다양한 날짜 형식 지원
const date = parseDate('2024-01-15');       // ISO 8601
const date = parseDate('2024.01.15');       // Dot format
const date = parseDate('2024년 1월 15일');  // Korean format
```

#### ✅ 날짜 필터링

```typescript
// 최근 N일 이내 확인
if (!isWithinDays(dateString, 7, title)) {
  console.log('[Filter] EXCLUDE (too old)');
  continue;
}
```

---

## 금지 사항 (NEVER DO)

### AI 요약 프롬프트 (절대 변경 금지)

```
Edge Function 프롬프트 위치: supabase/functions/summarize-article/index.ts
- 1줄 요약: 80자 이내, 이모지/마크다운 금지, 구어체
- 태그 3개: 7자 내외
- 출력: JSON { "summary": "...", "summary_tag": ["...", "...", "..."] }
```

### ❌ 절대 하지 말아야 할 것들

```typescript
// ❌ interface 사용 금지 (type 사용)
interface MyType { ... }

// ❌ console.log 남발 금지 (의미 있는 로그만)
console.log('test'); // 디버깅 후 제거 필수

// ❌ any 타입 무분별 사용 금지
const data: any = {}; // eslint-disable 주석 필수

// ❌ 상대 경로 import 금지
import { ... } from '../../lib/...'; // @ alias 사용

// ❌ Supabase 클라이언트 혼용 금지
// Client Component에서 server import 하거나
// Server Component에서 client import 하는 것 금지

// ❌ 하드코딩된 URL 금지
const url = 'http://localhost:3000/api/...'; // 환경변수 사용

// ❌ 민감 정보 코드에 포함 금지
const apiKey = 'sk-...'; // 환경변수로만 관리

// ❌ Puppeteer 브라우저 닫기 누락 금지
const browser = await puppeteer.launch();
// ... 작업
// browser.close() 호출 필수!
await browser.close();

// ❌ fetch timeout 미설정 금지
const response = await fetch(url); // fetchWithTimeout 사용

// ❌ 크롤링 시 User-Agent 미설정 금지
// DEFAULT_HEADERS 사용 필수
```

### ❌ 성능 관련 금지사항

```typescript
// ❌ 무한 루프 가능성 있는 크롤링 금지
while (hasMore) {
  // maxPages 제한 없음 → 위험!
}

// ✅ GOOD: maxPages 제한 필수
const maxPages = config.pagination?.maxPages || 5;
for (let page = 1; page <= maxPages; page++) {
  // ...
}

// ❌ 동기식 대량 요청 금지
for (const url of urls) {
  await fetch(url); // 순차 처리 → 느림
}

// ✅ GOOD: 병렬 처리 (제한된 concurrency)
const chunks = chunkArray(urls, 5);
for (const chunk of chunks) {
  await Promise.all(chunk.map(url => fetch(url)));
}
```

### 금지 사항 요약 테이블

| 금지 | 이유 |
|------|------|
| `interface` 사용 | `type` 통일 |
| `any` 주석 없이 사용 | eslint-disable 필수 |
| 상대 경로 import | `@/*` alias 사용 |
| Supabase client/server 혼용 | 환경 분리 필수 |
| 하드코딩 URL/API Key | 환경변수 사용 |
| fetch timeout 미설정 | `fetchWithTimeout()` 사용 |
| Puppeteer browser.close() 누락 | 메모리 누수 |
| AI 요약 프롬프트 수정 | 기획 확정된 프롬프트 |
| console.log 디버깅 잔류 | 의미 있는 로그만 |
| maxPages 제한 없는 크롤링 | 무한 루프 위험 |

---

## 환경변수 관리

### .env.local (로컬 개발)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # 서버 전용

# OpenAI
OPENAI_API_KEY=sk-...

# Cron 보안
CRON_SECRET=random_secret_string

# Edge Function 사용 여부
USE_EDGE_FUNCTION=false # true면 Supabase Edge Function 사용
```

### Vercel 환경변수 (프로덕션)

```bash
# Vercel Dashboard → Settings → Environment Variables 등록
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
CRON_SECRET
USE_EDGE_FUNCTION
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
# → 소스 ID 1만 크롤링
```

### 2. 새 크롤링 소스 추가

1. **Supabase Dashboard**에서 `crawl_sources` 테이블에 새 레코드 추가
2. 필요 시 커스텀 크롤러 전략 구현 (`lib/crawlers/strategies/`)
3. 로컬에서 테스트: `npm run crawl:dry -- --source=<new_id> --verbose`
4. 성공 시 활성화: `is_active = true`

### 3. AI 요약 생성

```bash
# 1. 요약 없는 아티클 일괄 처리
POST /api/summarize/batch
# → OpenAI API로 모든 요약 없는 아티클 처리

# 2. 특정 아티클만 요약
POST /api/summarize
Body: { "articleId": "..." }
```

### 4. 배포 (Vercel)

```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. Vercel 프로젝트 연결
vercel link

# 3. 환경변수 설정 (Vercel Dashboard)
# → Settings → Environment Variables

# 4. 배포
vercel --prod
# 또는 Git Push (자동 배포)

# 5. Cron Job 설정 (Vercel Dashboard)
# → Settings → Cron Jobs
# → 매일 9:00 AM (Asia/Seoul): /api/crawl/run
```

---

## 디버깅 가이드

### 크롤링 실패 시

```bash
# 1. Dry-run으로 로그 확인
npm run crawl:dry -- --source=<id> --verbose

# 2. Puppeteer 디버깅 (SPA 크롤러)
# lib/crawlers/strategies/spa.ts 수정:
const browser = await puppeteer.launch({
  headless: false, // 브라우저 UI 표시
  devtools: true,  # DevTools 자동 열기
});

# 3. 셀렉터 검증
# Chrome DevTools에서 document.querySelectorAll('selector') 테스트
```

### AI 요약 실패 시

```bash
# 1. OpenAI API 키 확인
echo $OPENAI_API_KEY

# 2. API 요청 로그 확인
# app/api/summarize/route.ts 또는
# supabase/functions/summarize-article/index.ts

# 3. 토큰 제한 확인
# 최대 8000 토큰 (GPT-4o-mini)
# 본문이 너무 길면 자동 잘림
```

### Supabase 연결 실패 시

```bash
# 1. 환경변수 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 2. Supabase 프로젝트 상태 확인
# https://supabase.com/dashboard/project/YOUR_PROJECT

# 3. RLS (Row Level Security) 확인
# Supabase Dashboard → Authentication → Policies
```

---

## 성능 최적화 팁

### 1. 이미지 최적화

```typescript
// ✅ Lazy Loading 적용
<img loading="lazy" />

// ✅ 이미지 프록시 사용 (Hotlinking 방지)
const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;

// ✅ 에러 시 Fallback
<img onError={() => setImageError(true)} />
```

### 2. 무한 스크롤

```typescript
// ✅ 페이지 단위로 데이터 추가 (교체 아님)
const handleLoadMore = () => {
  fetchArticles(page + 1, true); // append=true
};

// ✅ 중복 방지
const [hasMore, setHasMore] = useState(false);
if (!hasMore) return; // 더 이상 로드 안 함
```

### 3. 검색 디바운싱

```typescript
// ✅ useCallback으로 함수 메모이제이션
const handleSearchChange = useCallback((value: string) => {
  setSearch(value);
}, []);

// ✅ useEffect에서 dependency로 search 사용
useEffect(() => {
  fetchArticles(1, false);
}, [search]); // search 변경 시만 재호출
```

---

## 트러블슈팅 FAQ

### Q1. 크롤링은 되는데 DB에 저장이 안 됩니다.

**원인**: `source_id` 중복 또는 RLS 정책 문제

**해결**:
```bash
# 1. 중복 확인
npm run crawl:dry -- --source=<id> --verbose
# → "[DB] SKIP (already exists)" 로그 확인

# 2. RLS 정책 확인
# Supabase Dashboard → Database → articles → Policies
# → Service Role은 모든 권한 필요
```

### Q2. Puppeteer 크롤링이 너무 느립니다.

**원인**: Headless 브라우저는 리소스 소비가 큼

**해결**:
```typescript
// 1. 이미지/CSS 로딩 차단
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (['image', 'stylesheet'].includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});

// 2. 대안: STATIC 크롤러로 전환 가능한지 확인
// SPA가 아니면 Cheerio가 훨씬 빠름
```

### Q3. OpenAI API 요금이 너무 많이 나옵니다.

**원인**: GPT-4o-mini 대신 비싼 모델 사용 또는 요청 과다

**해결**:
```typescript
// 1. 모델 확인 (gpt-4o-mini 권장)
model: 'gpt-4o-mini' // 가장 저렴

// 2. 배치 요약 대신 선택적 요약
// 요약 없는 아티클만 처리
const { data } = await supabase
  .from('articles')
  .select('*')
  .is('ai_summary', null)
  .limit(100); // 한 번에 100개만

// 3. Edge Function 사용 (GPT-5-nano, 더 저렴)
USE_EDGE_FUNCTION=true
```

### Q4. Vercel에서 Puppeteer가 작동하지 않습니다.

**원인**: Vercel Serverless는 Chrome 바이너리 포함 불가

**해결**:
```bash
# 1. Vercel Functions 대신 외부 Crawler 서버 사용
# → AWS EC2, GCP Compute Engine, Fly.io 등

# 2. 또는 puppeteer-core + @sparticuz/chromium 사용
npm install puppeteer-core @sparticuz/chromium

# lib/crawlers/strategies/spa.ts 수정:
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath: await chromium.executablePath(),
});
```

---

## 작업 유형별 가이드

### 1. 버그 수정

1. 에러 로그 확인 (브라우저 콘솔 / 서버 로그)
2. 관련 파일 읽기 (API Route → lib → components 순)
3. 수정 후 `npm run dev` 테스트
4. 크롤링 버그: `npm run crawl:dry -- --source=<id> --verbose`

### 2. 신규 기능 추가

1. `types/index.ts` 또는 `types/database.ts` 타입 정의
2. API Route 생성 (`app/api/{feature}/route.ts`)
3. 필요 시 lib 유틸 함수 작성
4. 컴포넌트 생성 → `components/index.ts` barrel export 추가
5. 페이지에서 사용

### 3. UI 수정

1. CSS Variables 확인 (`app/globals.css`)
2. Tailwind 클래스 사용 (인라인 style 최소화)
3. 반응형 확인: `sm:`, `lg:` 브레이크포인트
4. `transition-colors` 또는 `transition-all` 적용

### 4. DB 작업

1. `types/database.ts` 타입 수정
2. 관련 API Route 업데이트
3. RLS 정책 확인 (Supabase Dashboard)
4. Service Role 필요 시 `createServiceClient()` 사용

### 5. 크롤러 추가/수정

1. 대상 사이트 분석 (HTML 구조, API 유무)
2. 적합한 전략 선택 (STATIC/SPA/RSS/API 등)
3. `lib/crawlers/strategies/` 또는 `lib/crawlers/sites/` 작성
4. `npm run crawl:dry -- --source=<id> --verbose` 테스트

### 6. 배포

1. `npm run build` 빌드 확인
2. Git push → Vercel 자동 배포
3. Vercel Dashboard에서 환경변수 확인
4. Cron Job: `vercel.json` → `0 0 * * *` (매일 09:00 KST)

---

## 핵심 시나리오

### 시나리오 1: 새 크롤링 소스 추가

```
1. Supabase > crawl_sources 테이블에 레코드 삽입
2. crawler_type 설정 (STATIC/SPA/RSS/PLATFORM_NAVER/PLATFORM_KAKAO/NEWSLETTER/API)
3. config JSON에 selectors, pagination 등 설정
4. npm run crawl:dry -- --source=<id> --verbose 테스트
5. is_active = true로 활성화
```

### 시나리오 2: AI 요약이 안 될 때

```
1. USE_EDGE_FUNCTION 환경변수 확인
2. true → Supabase Edge Function 확인 (supabase functions deploy)
3. false → OPENAI_API_KEY 확인
4. 본문 추출 확인 (content_preview 컬럼)
5. lib/ai/batch-summarizer.ts 로직 확인
```

### 시나리오 3: 이미지가 안 보일 때

```
1. Hotlinking 차단 여부 확인
2. 네이버 이미지 → /api/image-proxy 프록시 경유
3. components/ArticleCard.tsx > getProxiedImageUrl() 확인
4. 새 도메인 → needsProxy 배열에 추가
```

### 시나리오 4: 카테고리 추가

```
1. UI: FilterBar 또는 AddSourcePage 드롭다운
2. API: POST /api/categories { name: "새 카테고리" }
3. DB: categories 테이블 자동 삽입
4. 기본 카테고리: ['비즈니스', '소비 트렌드']
```

### 시나리오 5: Vercel 배포 후 크롤링 실패

```
1. Vercel Functions 타임아웃 확인 (maxDuration: 300초)
2. Puppeteer → Vercel에서 미지원, puppeteer-core + @sparticuz/chromium 필요
3. CRON_SECRET 환경변수 확인
4. Vercel Logs에서 에러 확인
```

---

## 파일 구조 규칙

```
파일명: PascalCase (컴포넌트) / kebab-case (유틸)
컴포넌트: components/{Name}.tsx → components/index.ts barrel export
API Route: app/api/{feature}/route.ts
타입: types/index.ts (공통) / types/database.ts (DB)
크롤러: lib/crawlers/strategies/{name}.ts (전략) / lib/crawlers/sites/{name}.ts (사이트별)
Supabase: lib/supabase/client.ts (브라우저) / lib/supabase/server.ts (서버)
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

### v1.0.0 (2025-01-25)
- 7가지 크롤러 전략 구현
- OpenAI 기반 AI 요약 및 태그 생성
- 무한 스크롤 + 검색/필터링
- Vercel Cron 자동 크롤링
- 이미지 프록시 (Hotlinking 방지)
- 반응형 UI (Tailwind CSS)
