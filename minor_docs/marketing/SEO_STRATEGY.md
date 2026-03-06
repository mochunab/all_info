# 아카인포 SEO 전략 — 구현 완료

> 최초 작성: 2026-03-02
> 최종 업데이트: 2026-03-06
> 도메인: `https://aca-info.com`

---

## 구현 현황

| Phase | 내용 | 상태 | 배포일 |
|-------|------|------|--------|
| Phase 1 | SEO 기반 (robots, sitemap, 메타데이터, OG, JSON-LD) | ✅ 완료 | 2026-03-02 |
| Phase 2 | 랜딩 + 홈피드 SSR 전환 | ✅ 완료 | 2026-03-06 |
| Phase 3 | JSON-LD 구조화 데이터 (FAQPage, SoftwareApplication) | ✅ 완료 | 2026-03-06 |
| Phase 4 | 홈피드 SSR (Phase 2에 통합) | ✅ 완료 | 2026-03-06 |
| Phase 5 | Google Search Console + 네이버 서치어드바이저 등록 | ✅ 완료 | 2026-03-06 |
| Phase 6 | 폰트 최적화 (next/font self-hosting) | ✅ 완료 | 2026-03-06 |
| Phase 7 | RSS 2.0 피드 | ✅ 완료 | 2026-03-06 |
| Phase 8 | IndexNow (크롤링 후 자동 제출) | ✅ 완료 | 2026-03-06 |

---

## 구현 상세

### Phase 1: SEO 기반

| 파일 | 내용 |
|------|------|
| `app/robots.ts` | `/`, `/landing`, `/terms` allow / `/api/`, `/my-feed` 등 disallow |
| `app/sitemap.ts` | 3개 URL (홈, 랜딩, 이용약관) |
| `app/layout.tsx` | `metadataBase`, title template, OG/Twitter 카드, canonical, JSON-LD (Organization + WebSite) |
| `public/og-image.png` | OG 이미지 (1200x630) |

**글로벌 메타데이터** (`app/layout.tsx`):
- title: `아카인포 - 나만의 면접 치트키`
- description: `면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!`
- keywords: `AI 면접 코칭`, `업계 브리핑`, `비즈니스 인사이트`, `마케팅 트렌드`, `스타트업`, `아카인포`

### Phase 2: SSR 전환

**랜딩 페이지** (`/landing`):
- `app/landing/page.tsx` → 서버 컴포넌트 + 페이지별 메타데이터
- `app/landing/LandingContent.tsx` → 서버 컴포넌트, `t('ko', key)` 직접 사용
- `app/landing/AnimatedSection.tsx` → `'use client'`, framer-motion 래퍼
- `app/landing/LandingHeader.tsx` → `'use client'`, Header 언어 상태 관리

**홈피드** (`/`):
- `app/page.tsx` → 서버 컴포넌트, Supabase에서 초기 articles + categories fetch
- `components/HomeFeed.tsx` → `'use client'`, `initialArticles`/`initialCategories` props 수신

**빌드 결과**:
- `/` → `ƒ Dynamic` (매 요청 SSR)
- `/landing` → `○ Static` (빌드 시 프리렌더)

### Phase 3: JSON-LD 구조화 데이터

| 위치 | 스키마 |
|------|--------|
| `app/layout.tsx` | `Organization` + `WebSite` |
| `app/landing/page.tsx` | `FAQPage` (3개 Q&A) + `SoftwareApplication` (무료, Web) |

### Phase 5: 검색엔진 등록

- Google Search Console: 등록 완료, sitemap 제출됨
- 네이버 서치어드바이저: 등록 완료

### Phase 6: 폰트 최적화

| 변경 전 | 변경 후 |
|---------|---------|
| CDN `<link>` 5개 (렌더 블로킹) | `next/font` self-hosting |
| Pretendard: jsDelivr CDN | `next/font/local` — `public/fonts/PretendardVariable.woff2` (2MB) |
| Outfit: Google Fonts | `next/font/google` — `Outfit` (600, 700) |
| CSP에 CDN 도메인 허용 | CSP `font-src`/`style-src`에서 CDN 제거 |
| `font-family: 'Pretendard'` | `font-family: var(--font-pretendard)` |

### Phase 7: RSS

- `app/feed.xml/route.ts` — RSS 2.0, master 최근 20개 아티클
- `app/layout.tsx` — `<link rel="alternate" type="application/rss+xml">`
- Cache: `max-age=3600, s-maxage=3600`

### Phase 8: IndexNow

- `lib/indexnow.ts` — `submitToIndexNow(urls)` 유틸
- `public/be3047d68a3748539765936b2fd658f3.txt` — 키 검증 파일
- `app/api/crawl/run/route.ts` — 크롤링 완료 후 새 콘텐츠 있으면 자동 제출 (`/`, `/landing`)
- Vercel 환경변수: `INDEXNOW_KEY=be3047d68a3748539765936b2fd658f3`
- Google은 IndexNow 미지원 → sitemap + Search Console로 커버

---

## 파일 변경 요약

| 파일 | Phase | 작업 |
|------|-------|------|
| `app/robots.ts` | 1 | 크롤러 접근 규칙 |
| `app/sitemap.ts` | 1 | sitemap.xml 생성 |
| `public/og-image.png` | 1 | OG 이미지 |
| `app/layout.tsx` | 1, 6, 7 | 메타데이터, JSON-LD, next/font, RSS link |
| `app/globals.css` | 6 | `font-family` CSS 변수 전환 |
| `next.config.mjs` | 6 | CSP font/style 소스 정리 |
| `app/landing/page.tsx` | 2, 3 | 서버 컴포넌트 + 메타데이터 + JSON-LD |
| `app/landing/LandingContent.tsx` | 2 | 서버 컴포넌트 SSR |
| `app/landing/AnimatedSection.tsx` | 2 | framer-motion 클라이언트 래퍼 |
| `app/landing/LandingHeader.tsx` | 2 | Header 클라이언트 래퍼 |
| `app/page.tsx` | 2 | 서버 컴포넌트, 초기 데이터 fetch |
| `components/HomeFeed.tsx` | 2 | 홈피드 클라이언트 로직 |
| `components/Header.tsx` | 6 | 중복 fontFamily 제거 |
| `app/feed.xml/route.ts` | 7 | RSS 2.0 피드 |
| `lib/indexnow.ts` | 8 | IndexNow 유틸 |
| `public/be3047d68a3748539765936b2fd658f3.txt` | 8 | IndexNow 키 파일 |
| `app/api/crawl/run/route.ts` | 8 | 크롤링 후 IndexNow 자동 호출 |
| `public/fonts/PretendardVariable.woff2` | 6 | self-hosted 폰트 |

---

## 검증 방법

1. View Source로 HTML에 콘텐츠 포함 확인 (`/`, `/landing`)
2. `/robots.txt`, `/sitemap.xml` 정상 출력 확인
3. `/feed.xml` RSS XML 출력 확인
4. Network 탭에서 폰트 self-hosted 로드 확인
5. [Google Rich Results Test](https://search.google.com/test/rich-results)로 JSON-LD 검증
6. Lighthouse SEO 점수 확인 (목표: 90+)
