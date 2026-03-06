# 아카인포 SEO 전략

> 최초 작성: 2026-03-02
> 최종 업데이트: 2026-03-06
> 도메인: `https://aca-info.com`

---

## 경쟁사 분석 (2026-03-06)

### Daigest (daige.st) — 핵심 경쟁자

AI 기반 멀티소스 모니터링 & 브리핑 서비스 (RSS, YouTube, Slack, Reddit, Notion 등).

| 항목 | Daigest | 아카인포 | 격차 |
|------|---------|---------|------|
| **Sitemap URL 수** | **500+** | 3개 | 압도적 열세 |
| **블로그/콘텐츠 마케팅** | 30+ SEO 블로그 포스트 | 없음 | 열세 |
| **프로그래매틱 페이지** | 소스별·템플릿별 랜딩 20+ | 없음 | 열세 |
| **다국어 hreflang** | ko/en/ja (URL 분리) | i18n 5개 있으나 hreflang 미적용 | 열세 |
| **FAQ** | 8개 Q&A | 3개 Q&A | 약간 열세 |
| **JSON-LD** | Organization + SoftwareApplication | Organization + WebSite + FAQ + SoftwareApp | 동등 |
| **OG/Twitter 카드** | 완비 (언어별 이미지) | 완비 | 동등 |
| **SSR** | Next.js SSR | SSR 전환 완료 | 동등 |
| **RSS 피드** | 미확인 | RSS 2.0 제공 | 우세 |
| **IndexNow** | 미확인 | 자동 제출 | 우세 |
| **AI 크롤러 차단** | ClaudeBot, GPTBot 등 명시 차단 | 미적용 | 참고 |

**Daigest 핵심 전략**:
- **콘텐츠 볼륨**: 블로그 30+편 + 템플릿 20+ + 소스별 랜딩 → 롱테일 키워드 대량 커버
- **프로그래매틱 SEO**: `/sources/slack`, `/templates/competitor-tracking` 등 자동 생성 페이지로 검색 유입 극대화
- **다국어 URL 분리**: `/ko/`, `/en/`, `/ja/` + hreflang 태그 → 국제 검색 노출

### blink.archive (litt.ly) — 간접 경쟁

링크 바이오 플랫폼 (Linktree 유사). SPA only, SEO 거의 없음. 직접 경쟁 위협 낮음.

---

## SEO 로드맵

### 완료 (Phase 1~8)

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

### 예정 (Phase 9~13) — 격차 해소 전략

| Phase | 내용 | 목표 | 우선순위 |
|-------|------|------|----------|
| Phase 9 | 프로그래매틱 SEO 페이지 | sitemap 3개 → 50+ URL, 카테고리·태그별 자동 생성 랜딩 | **P0 (최우선)** |
| Phase 10 | hreflang 다국어 URL 구조 | `/ko/`, `/en/` 등 URL 분리 + hreflang 태그 | P1 |
| Phase 11 | 블로그/콘텐츠 허브 | 타겟 키워드 블로그 시스템 (마크다운 or DB 기반) | P1 |
| Phase 12 | FAQ 확장 + AI 크롤러 차단 | FAQ 3→10개, robots.txt에 GPTBot/ClaudeBot 차단 | P2 |
| Phase 13 | 아티클 상세 페이지 SEO | `/articles/[slug]` 개별 페이지 + JSON-LD Article 스키마 | P2 |

### Phase 9: 프로그래매틱 SEO 페이지 (상세)

**목표**: DB에 있는 카테고리·태그 데이터를 활용해 검색 가능한 페이지를 자동 생성

**생성할 페이지 유형**:

| URL 패턴 | 내용 | 예시 |
|----------|------|------|
| `/topics/[category]` | 카테고리별 아티클 모음 | `/topics/마케팅`, `/topics/스타트업` |
| `/tags/[tag]` | 태그별 아티클 모음 | `/tags/AI`, `/tags/브랜딩` |
| `/sources/[source]` | 소스별 아티클 모음 | `/sources/와이즈앱`, `/sources/브런치` |

**각 페이지 포함 요소**:
- SSR (서버 컴포넌트, Supabase 직접 조회)
- 페이지별 고유 title/description/OG 메타데이터
- JSON-LD `CollectionPage` 스키마
- 카테고리/태그 설명 텍스트 (SEO용 고유 콘텐츠)
- 최근 아티클 목록 (최대 20개)
- 내부 링크 (관련 카테고리, 태그 상호 링크)
- sitemap.ts에 동적 URL 추가

**기대 효과**:
- sitemap URL: 3개 → 50~100+ (카테고리 수 + 태그 수 + 소스 수)
- 롱테일 키워드 자연 커버: "마케팅 트렌드 요약", "AI 스타트업 뉴스" 등
- 내부 링크 네트워크 강화 → 크롤링 깊이 개선

### Phase 10: hreflang 다국어 URL (상세)

- 기존 i18n 5개 언어 → URL prefix 기반 라우팅 (`/ko/`, `/en/`, `/vi/`, `/zh/`, `/ja/`)
- `<link rel="alternate" hreflang="ko" href="...">` 태그 추가
- sitemap에 hreflang 엔트리 포함
- Daigest 대비 2개 언어 추가 커버 (vi, zh)

### Phase 11: 블로그/콘텐츠 허브 (상세)

- `/blog/[slug]` 라우트
- MDX 또는 DB 기반 콘텐츠 관리
- 타겟 키워드 예시: "AI 면접 준비 방법", "업계 트렌드 파악하는 법", "비즈니스 인사이트 큐레이션"
- JSON-LD `BlogPosting` 스키마
- 블로그 전용 sitemap 섹션

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
