# 아카인포 SEO 전략 구현 플랜

> 작성일: 2026-03-02
> 참고: 나다운세 SEO 가이드 (Vite SPA + 프리렌더) → Next.js 14 App Router 적용

## Context

아카인포는 현재 **SEO가 전혀 없는 상태**다. sitemap, robots.txt, OG 이미지, JSON-LD, 페이지별 메타데이터 — 아무것도 없다. 랜딩 페이지(`/landing`)는 "취준생", "면접 준비", "AI 코칭" 등 핵심 타겟 키워드가 풍부하지만 `'use client'`로 인해 크롤러에게 빈 HTML만 보인다. 비즈니스 전략에서 SEO는 핵심 고객 획득 채널로 명시되어 있어 조속한 구현이 필요하다.

**도메인**: 현재 `https://archi-info.vercel.app` (임시). 정식 도메인 구매 시 `NEXT_PUBLIC_SITE_URL` 환경변수만 변경하면 모든 canonical/sitemap/OG URL이 자동 전환되도록 설계.

**구현 범위**: Phase 1~8 전체

### 현재 SEO 감사 결과

| 항목 | 현재 상태 |
|------|----------|
| sitemap.xml | 없음 |
| robots.txt | 없음 |
| metadataBase | 미설정 → OG 이미지 URL 깨짐 |
| OG 이미지 | 없음 |
| canonical URL | 없음 |
| 페이지별 메타데이터 | `/terms`에 title만 있음. 나머지 전부 글로벌 메타데이터 상속 |
| JSON-LD 구조화 데이터 | 없음 |
| 홈피드 SSR | `'use client'` → 크롤러에게 빈 HTML |
| 랜딩 페이지 SSR | `'use client'` → 키워드 풍부한 콘텐츠가 크롤러에 안 보임 |
| next/image | 미사용 |
| 폰트 | CDN 렌더 블로킹 (Pretendard + Outfit) |
| 검색엔진 등록 | Google Search Console, 네이버 서치어드바이저 미등록 |

---

## Phase 1: SEO 기반 구축 (즉시 효과, 리스크 제로)

### 1-1. `app/robots.ts` 생성

```typescript
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/landing', '/terms'],
        disallow: ['/api/', '/my-feed', '/sources/', '/login', '/signup', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- `/my-feed`, `/sources/`, `/login`, `/signup` → 크롤링 가치 없음 (인증 필요, 개인 데이터)
- `/api/` → 크롤 버짓 낭비 방지

### 1-2. `app/sitemap.ts` 생성

```typescript
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/landing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/terms`, lastModified: '2026-03-01', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
```

### 1-3. `app/layout.tsx` — 글로벌 메타데이터 강화

**현재 문제점**:
- `metadataBase` 미설정 → OG 이미지 URL 깨짐
- `openGraph.images` 없음 → 카카오톡/트위터 공유 시 이미지 없음
- `alternates.canonical` 없음
- title/description이 비즈니스 타겟 키워드와 불일치

**수정 내용**:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app'),
  title: {
    default: '아카인포 - AI 면접 코칭 & 업계 브리핑',
    template: '%s | 아카인포',
  },
  description: '취준생을 위한 AI 업계 브리핑. 매일 마케팅·IT·스타트업 인사이트를 자동 수집하고 면접 답변까지 코칭합니다.',
  keywords: [
    '면접 준비', '취업 준비', '업계 트렌드', 'AI 면접 코칭',
    '비즈니스 인사이트', '취준생', '면접 치트키',
    '마케팅 트렌드', 'IT 트렌드', '스타트업 뉴스',
  ],
  authors: [{ name: '아카인포' }],
  creator: '아카인포',
  openGraph: {
    title: '아카인포 - AI 면접 코칭 & 업계 브리핑',
    description: '하루 30초로 면접 합격률을 높이세요.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app',
    siteName: '아카인포',
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '아카인포' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '아카인포 - AI 면접 코칭 & 업계 브리핑',
    description: '하루 30초로 면접 합격률을 높이세요.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app',
  },
  robots: { index: true, follow: true },
};
```

- `title.template` → 서브 페이지에서 `'이용약관 | 아카인포'` 형태 자동 적용
- description → 네이버 권장 80자 이내 (약 55자)
- OG 이미지 → Phase 1-4에서 생성

### 1-4. `app/opengraph-image.tsx` 생성 (동적 OG 이미지)

Next.js 14 내장 `@vercel/og`로 코드 기반 OG 이미지 생성. 별도 이미지 파일 관리 불필요.

```typescript
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '아카인포 - AI 면접 코칭 & 업계 브리핑';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-start', justifyContent: 'center',
        padding: '80px',
      }}>
        <div style={{ color: '#93c5fd', fontSize: 28, marginBottom: 24, fontWeight: 600 }}>
          취준생을 위한 AI 업계 브리핑
        </div>
        <div style={{ color: '#ffffff', fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
          아카인포
        </div>
        <div style={{ color: '#bfdbfe', fontSize: 32, lineHeight: 1.4 }}>
          하루 30초로 면접 합격률을 높이세요
        </div>
      </div>
    ),
    { ...size }
  );
}
```

### 1-5. `app/terms/page.tsx` — 메타데이터 보강

현재 `title`만 있고 description 없음. 추가:

```typescript
export const metadata: Metadata = {
  title: '이용약관',
  description: '아카인포 이용약관. 크롤링 opt-out 안내, 저작권 고지, 서비스 이용 조건.',
  robots: { index: true, follow: false },
};
```

### 1-6. Vercel 환경변수 설정

프로덕션에 `NEXT_PUBLIC_SITE_URL=https://archi-info.vercel.app` 설정 (현재 `.env.local`에 `localhost:3000`만 있음).

---

## Phase 2: 랜딩 페이지 SSR 전환 (최대 SEO 효과)

**현재 문제**: `/landing`은 `'use client'`여서 크롤러가 빈 HTML만 봄. 그러나 이 페이지에 핵심 타겟 키워드가 모두 있음 — "취준생", "면접 준비", "AI 코칭", "업계 브리핑" 등 (`lib/i18n.ts` 105~157줄).

**해결**: Server Component 쉘 + Client Animation 래퍼 패턴

### 파일 변경

| 파일 | 작업 |
|------|------|
| `app/landing/page.tsx` | `'use client'` 제거, Server Component로 전환. metadata export 추가. `LandingClient` 렌더링 |
| `app/landing/LandingClient.tsx` | **신규** — 기존 page.tsx 전체 코드 이동 (framer-motion 애니메이션 유지) |

### `app/landing/page.tsx` (Server Component로 전환)

```typescript
import type { Metadata } from 'next';
import LandingClient from './LandingClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app';

export const metadata: Metadata = {
  title: '취준생 면접 준비 AI 코칭',
  description: 'AI가 매일 업계 브리핑을 읽고 면접 답변까지 만들어드립니다. 하루 30초 투자로 면접 합격률을 높이세요.',
  alternates: { canonical: `${SITE_URL}/landing` },
  openGraph: {
    title: '아카인포 - 나만의 면접 치트키',
    description: '30년이 달라진다, 하루 30초로. AI 업계 브리핑 + 면접 코칭.',
    url: `${SITE_URL}/landing`,
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
```

### `app/landing/LandingClient.tsx`

기존 `page.tsx`의 전체 코드를 이동. `'use client'` 유지, `export default function LandingClient()`.

> **참고**: `t(language, key)` i18n 콘텐츠는 클라이언트에서 렌더링됨. Google 크롤러는 JS를 실행하므로 콘텐츠를 볼 수 있음. 네이버 크롤러는 JS 실행 제한적이므로 metadata가 더 중요.

---

## Phase 3: JSON-LD 구조화 데이터

### 3-1. `app/layout.tsx` — Organization + WebSite 스키마

루트 레이아웃 `<head>`에 `<script type="application/ld+json">` 삽입:

```typescript
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: '아카인포',
      alternateName: 'ArcaInfo',
      url: SITE_URL,
      description: 'AI 기반 비즈니스 콘텐츠 큐레이션 & 면접 코칭 플랫폼',
    },
    {
      '@type': 'WebSite',
      url: SITE_URL,
      name: '아카인포',
      inLanguage: ['ko', 'en', 'ja', 'zh'],
    },
  ],
};
```

### 3-2. `app/landing/page.tsx` — FAQPage + SoftwareApplication 스키마

랜딩 페이지의 Pain Points + How it Works를 FAQ로 구조화 → Google 리치 스니펫 노출:

```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "name": "아카인포는 어떤 서비스인가요?",
      "acceptedAnswer": {
        "text": "AI가 매일 업계 브리핑을 읽고 면접 답변까지 만들어드리는 취준생 전용 서비스입니다."
      }
    },
    {
      "name": "어떻게 사용하나요?",
      "acceptedAnswer": {
        "text": "관심 업종을 등록하면 매일 자동으로 업계 브리핑이 수집되고, AI 면접 코칭 기능으로 답변 예시를 생성받을 수 있습니다."
      }
    },
    {
      "name": "비용이 있나요?",
      "acceptedAnswer": { "text": "모든 기능을 무료로 사용할 수 있습니다." }
    }
  ]
}
```

```json
{
  "@type": "SoftwareApplication",
  "name": "아카인포",
  "applicationCategory": "BusinessApplication",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KRW" },
  "operatingSystem": "Web"
}
```

---

## Phase 4: 홈피드 SSR 쉘 (아티클 인덱서빌리티)

**현재 문제**: 홈 페이지(`/`)의 아티클 목록이 클라이언트에서만 `fetch('/api/articles')` → 크롤러에게 보이지 않음.

**해결**: Server Component 쉘에서 첫 12개 아티클을 서버사이드 fetch → SSR HTML에 포함.

### 파일 변경

| 파일 | 작업 |
|------|------|
| `app/page.tsx` | Server Component로 전환. 서버에서 첫 아티클 fetch → `HomeFeedClient`에 props 전달 |
| `app/HomeFeedClient.tsx` | **신규** — 기존 page.tsx 전체 코드 이동. `initialArticles` props 수신 |

### `app/page.tsx` (Server Component 쉘)

```typescript
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';  // 서버용 클라이언트
import { getMasterUserId } from '@/lib/user';
import HomeFeedClient from './HomeFeedClient';

export const revalidate = 300; // 5분 ISR

export const metadata: Metadata = {
  title: '비즈니스 인사이트 홈피드',
  description: '마케팅, IT, 스타트업, 리테일 트렌드를 AI가 자동 수집하고 요약합니다.',
};

export default async function HomePage() {
  let initialArticles = [];
  try {
    const supabase = await createClient();
    const masterId = await getMasterUserId();
    const { data } = await supabase
      .from('articles')
      .select('id, source_name, source_url, title, title_ko, summary, summary_tags, crawled_at, category')
      .eq('is_active', true)
      .eq('user_id', masterId)
      .order('crawled_at', { ascending: false })
      .limit(12);
    initialArticles = data || [];
  } catch { /* fail open — 클라이언트가 재시도 */ }

  return <HomeFeedClient initialArticles={initialArticles} />;
}
```

### `app/HomeFeedClient.tsx`

기존 `app/page.tsx` 코드 전체 이동. 변경점:
- `initialArticles` props 수신 → `useState<Article[]>` 초기값으로 사용
- sessionStorage 캐시 로직과 조화: 서버 데이터 있으면 sessionStorage 스킵

**효과**: 크롤러가 아티클 제목/요약/태그를 HTML에서 직접 봄. ISR 5분으로 서버 부하 최소화.

**리스크**: 중간. `HomeFeedClient`의 상태 관리 로직과 initialArticles 조화 필요. 기존 sessionStorage 캐시, pollingRef, crawlStatus 등과 충돌 없는지 확인.

---

## Phase 5: 검색엔진 등록 (구글 + 네이버)

### 5-1. Google Search Console

1. [search.google.com/search-console](https://search.google.com/search-console) → 속성 추가 (`https://archi-info.vercel.app`)
2. 소유권 인증 → `app/layout.tsx` metadata에 verification 추가:
   ```typescript
   verification: { google: '인증코드' },
   ```
3. sitemap 제출: `https://archi-info.vercel.app/sitemap.xml`
4. URL 검사로 `/`, `/landing` 인덱싱 요청

### 5-2. 네이버 서치어드바이저

1. [searchadvisor.naver.com](https://searchadvisor.naver.com) → 사이트 추가
2. 소유권 인증 → HTML 메타 태그:
   ```typescript
   verification: { other: { 'naver-site-verification': '인증코드' } },
   ```
3. 사이트맵 제출
4. RSS 피드 제출 (Phase 7 완료 후)
5. 사이트 진단 실행 → 결과에 따라 추가 수정

**네이버 SEO 주의사항**:
- description 80자 이내 (네이버 서치어드바이저 권장)
- 네이버 크롤러는 JS 렌더링 제한적 → metadata + SSR 콘텐츠가 핵심
- 정식 도메인 구매 시 네이버 재등록 필요

---

## Phase 6: 폰트 최적화 (Core Web Vitals)

**현재 문제**: `app/layout.tsx`에서 Pretendard (`cdn.jsdelivr.net`) + Outfit (`fonts.googleapis.com`) CDN 로딩 → 렌더 블로킹 → LCP 저하.

### 해결: `next/font`로 마이그레이션

```typescript
// app/layout.tsx
import localFont from 'next/font/local';
import { Outfit } from 'next/font/google';

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-outfit',
  display: 'swap',
});
```

### 작업 항목

1. `PretendardVariable.woff2` 다운로드 → `app/fonts/` 배치
2. `app/layout.tsx` `<head>` CDN `<link>` 태그 제거
3. `<body className={`${pretendard.variable} ${outfit.variable} antialiased min-h-screen`}>`
4. `next.config.mjs` CSP에서 `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` 제거 가능

**효과**: LCP 200~400ms 개선, FOUT 제거, 외부 요청 2개 제거.

---

## Phase 7: RSS 피드

### `app/rss.xml/route.ts` 생성

master 아티클 최신 20건을 RSS 2.0으로 제공. 네이버 서치어드바이저에 RSS 등록 가능.

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMasterUserId } from '@/lib/user';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app';

export async function GET() {
  const supabase = await createClient();
  const masterId = await getMasterUserId();
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, title_ko, summary, source_url, crawled_at, category')
    .eq('is_active', true)
    .eq('user_id', masterId)
    .order('crawled_at', { ascending: false })
    .limit(20);

  const items = (articles || []).map((a) => `
    <item>
      <title><![CDATA[${a.title_ko || a.title}]]></title>
      <link>${a.source_url}</link>
      <description><![CDATA[${a.summary || ''}]]></description>
      <pubDate>${new Date(a.crawled_at).toUTCString()}</pubDate>
      <guid isPermaLink="true">${a.source_url}</guid>
      <category>${a.category || '비즈니스'}</category>
    </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>아카인포 - AI 업계 브리핑</title>
    <link>${SITE_URL}</link>
    <description>취준생을 위한 AI 업계 브리핑. 마케팅, IT, 스타트업 트렌드를 매일 업데이트합니다.</description>
    <language>ko</language>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200',
    },
  });
}
```

`layout.tsx` metadata에 RSS 링크 추가:
```typescript
alternates: {
  canonical: SITE_URL,
  types: { 'application/rss+xml': `${SITE_URL}/rss.xml` },
},
```

---

## Phase 8: IndexNow

Bing + 네이버에 URL 변경 즉시 알림. 매일 크롤링 완료 후 새 아티클 URL을 IndexNow로 제출.

### 8-1. `app/api/indexnow/route.ts` 생성

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://archi-info.vercel.app';
const INDEXNOW_KEY = process.env.INDEXNOW_API_KEY;

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const { urls } = await request.json();
  if (!INDEXNOW_KEY || !urls?.length) {
    return NextResponse.json({ error: 'Missing key or urls' }, { status: 400 });
  }

  const fullUrls = urls.map((u: string) => u.startsWith('http') ? u : `${SITE_URL}${u}`);

  const result = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: fullUrls,
    }),
  });

  return NextResponse.json({ success: result.ok, status: result.status });
}
```

### 8-2. 키 파일 배치

- `public/{INDEXNOW_KEY}.txt` — 내용: API 키 값 (검색엔진 소유권 확인용)
- Vercel 환경변수: `INDEXNOW_API_KEY`

### 8-3. 크롤링 후 자동 호출

`app/api/crawl/run/route.ts`에서 크롤링 완료 후 내부 호출:
```typescript
// 크롤링 완료 후
fetch(`${SITE_URL}/api/indexnow`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ urls: ['/', '/landing'] }),
});
```

**Google은 IndexNow 미지원** → sitemap + Search Console로 커버.

---

## 구현 우선순위

| 순서 | Phase | 예상 시간 | 영향도 | 리스크 |
|------|-------|----------|--------|--------|
| 1 | **Phase 1: SEO 기반** | 2~3h | Critical | Zero |
| 2 | **Phase 5: 검색엔진 등록** | 1~2h | Critical | Zero |
| 3 | **Phase 2: 랜딩 SSR 전환** | 3~4h | High | Low |
| 4 | **Phase 3: JSON-LD** | 2~3h | Medium | Zero |
| 5 | **Phase 4: 홈피드 SSR** | 4~6h | High | Medium |
| 6 | **Phase 6: 폰트 최적화** | 2~3h | Medium | Low |
| 7 | **Phase 7: RSS** | 1~2h | Low-Med | Zero |
| 8 | **Phase 8: IndexNow** | 2~3h | Low | Low |

**권장 배포 순서**: Phase 1 + 5 먼저 배포 → Phase 2 + 3 → Phase 4 + 6 → Phase 7 + 8

---

## 수정 대상 파일 요약

| 파일 | 작업 |
|------|------|
| `app/robots.ts` | **신규** |
| `app/sitemap.ts` | **신규** |
| `app/opengraph-image.tsx` | **신규** |
| `app/layout.tsx` | metadataBase, title.template, OG 이미지, canonical, JSON-LD, verification, 폰트, RSS link |
| `app/landing/page.tsx` | Server Component 전환 + metadata + JSON-LD (FAQ, SoftwareApp) |
| `app/landing/LandingClient.tsx` | **신규** (기존 landing/page.tsx 코드 이동) |
| `app/page.tsx` | Server Component 전환 + ISR + metadata |
| `app/HomeFeedClient.tsx` | **신규** (기존 page.tsx 코드 이동, initialArticles props) |
| `app/terms/page.tsx` | metadata 보강 (description, robots) |
| `app/rss.xml/route.ts` | **신규** |
| `app/api/indexnow/route.ts` | **신규** |
| `public/{indexnow-key}.txt` | **신규** |
| `app/fonts/PretendardVariable.woff2` | **신규** (다운로드) |
| `next.config.mjs` | CSP 업데이트 (폰트 CDN 제거) |

---

## 검증 방법

1. `npm run dev` → 각 페이지 소스 보기 (`View Page Source`)로 메타 태그 확인
2. `/robots.txt`, `/sitemap.xml` 직접 접속하여 정상 출력 확인
3. `/landing` 소스에서 `<title>`, `<meta name="description">`, OG 태그 확인
4. [Google Rich Results Test](https://search.google.com/test/rich-results)로 JSON-LD 유효성 검증
5. [metatags.io](https://metatags.io/)로 OG 이미지/카드 미리보기
6. Lighthouse SEO 점수 확인 (목표: 90+)
7. 배포 후 Google Search Console + 네이버 서치어드바이저에서 사이트맵 제출 및 인덱싱 확인
8. `/rss.xml` 접속하여 RSS 피드 정상 출력 확인

---

## 정식 도메인 전환 시 체크리스트

정식 도메인 구매 후:
1. Vercel `NEXT_PUBLIC_SITE_URL` 환경변수 변경 → 모든 canonical/sitemap/OG 자동 전환
2. Google Search Console 새 속성 추가 + 사이트맵 재제출
3. 네이버 서치어드바이저 새 사이트 등록 + 인증 메타 태그 업데이트
4. IndexNow 키 파일 재배치
5. Vercel 커스텀 도메인 설정 (HTTPS 자동)
