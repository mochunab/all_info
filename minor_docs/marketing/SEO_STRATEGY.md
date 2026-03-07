# 아카인포 SEO 전략

> 최초 작성: 2026-03-02
> 최종 업데이트: 2026-03-08
> 도메인: `https://aca-info.com`

---

## 경쟁사 분석 (2026-03-06)

### Daigest (daige.st) — 핵심 경쟁자

AI 기반 멀티소스 모니터링 & 브리핑 서비스 (RSS, YouTube, Slack, Reddit, Notion 등).

| 항목 | Daigest | 아카인포 | 격차 |
|------|---------|---------|------|
| **Sitemap URL 수** | **500+** | 50+ (topics/tags/sources/blog/articles 동적) | 개선됨 |
| **블로그/콘텐츠 마케팅** | 30+ SEO 블로그 포스트 | 9편 SEO 블로그 + 아티클 상세 페이지 | 개선됨 |
| **프로그래매틱 페이지** | 소스별·템플릿별 랜딩 20+ | 없음 | 열세 |
| **다국어 hreflang** | ko/en/ja (URL 분리) | i18n 5개 + hreflang 서브디렉토리 (`/ko/`, `/en/`, `/vi/`, `/zh/`, `/ja/`) | **동등** |
| **FAQ** | 8개 Q&A | 10개 Q&A | 우세 |
| **JSON-LD** | Organization + SoftwareApplication | Organization + WebSite + FAQ + SoftwareApp | 동등 |
| **OG/Twitter 카드** | 완비 (언어별 이미지) | 완비 | 동등 |
| **SSR** | Next.js SSR | SSR 전환 완료 | 동등 |
| **RSS 피드** | 미확인 | RSS 2.0 (아티클 20개 + 블로그 10개) | 우세 |
| **IndexNow** | 미확인 | 자동 제출 (아티클 slug URL + 블로그 포함) | 우세 |
| **AI 크롤러 차단** | ClaudeBot, GPTBot 등 명시 차단 | GPTBot, ClaudeBot, CCBot, Google-Extended 차단 | 동등 |

**Daigest 핵심 전략**:
- **콘텐츠 볼륨**: 블로그 30+편 + 템플릿 20+ + 소스별 랜딩 → 롱테일 키워드 대량 커버
- **프로그래매틱 SEO**: `/sources/slack`, `/templates/competitor-tracking` 등 자동 생성 페이지로 검색 유입 극대화
- **다국어 URL 분리**: `/ko/`, `/en/`, `/ja/` + hreflang 태그 → 국제 검색 노출

### 서핏 (surfit.io) — 핵심 경쟁자

IT/디자이너 커리어 콘텐츠 큐레이션 플랫폼. 1,000+ 채널에서 매일 10~20개 큐레이션, Chrome 확장 프로그램.

| 항목 | 서핏 | 아카인포 | 격차 |
|------|------|---------|------|
| **프로그래매틱 페이지** | 4축 (explore/channel/tag/author) | 4축 (topics/tags/sources/authors) | 동등 |
| **JSON-LD** | Organization만 (최소 구현) | Organization+WebSite+FAQ+SoftwareApp+Article | **아카인포 우세** |
| **OG 태그** | 미구현 | 완비 + 동적 OG 이미지 | **아카인포 우세** |
| **SSR** | CSR 추정 | SSR 완료 | **아카인포 우세** |
| **hreflang 다국어** | 없음 | 5개 언어 | **아카인포 우세** |
| **RSS/IndexNow** | 미확인 | RSS 2.0 + IndexNow | **아카인포 우세** |
| **서브도메인** | jobs/directory/business | 없음 | 서핏 우세 |
| **Chrome 확장** | 있음 (시작페이지) | 없음 | 서핏 우세 |
| **콘텐츠 볼륨** | 수천 큐레이션 | 아티클 + 블로그 9편 | 열세 |
| **외부 블로그** | Medium (surfit-story) | 없음 | 서핏 우세 |

**서핏 핵심 전략**: 4축 프로그래매틱 SEO (explore/channel/tag/author) + Chrome 확장으로 직접 유입 + Medium 백링크

### 뉴닉 (newneek.co) — 간접 경쟁자

MZ세대 시사 뉴스레터 → 지식 플랫폼 확장, 구독자 110만+.

| 항목 | 뉴닉 | 아카인포 | 격차 |
|------|------|---------|------|
| **브랜드 검색량** | 매우 높음 ("뉴닉" 키워드) | 낮음 | 열세 |
| **오리지널 콘텐츠** | 자체 생산 (주 3회 뉴스레터) | 큐레이션 기반 | 열세 |
| **소셜 채널** | 앱+카카오+인스타+X+Facebook | 없음 | 열세 |
| **아티클 URL** | 숫자 ID (`/article/13570`) | 한글 slug (`/articles/면접-준비`) | **아카인포 우세** |
| **JSON-LD/구조화 데이터** | 미확인 | 완비 | **아카인포 우세** |
| **SSR** | 미확인 | SSR 완료 | **아카인포 우세** |
| **hreflang** | 없음 (국내 전용) | 5개 언어 | **아카인포 우세** |
| **뉴스레터 아카이브** | Stibee 외부 아카이브 | 없음 | 뉴닉 우세 |

**뉴닉 핵심 전략**: 오리지널 콘텐츠 + 브랜드 파워 + 멀티채널 소셜 시그널 (기술적 SEO보다 콘텐츠 마케팅 중심)

### blink.archive (litt.ly) — 간접 경쟁

링크 바이오 플랫폼 (Linktree 유사). SPA only, SEO 거의 없음. 직접 경쟁 위협 낮음.

---

## SEO 로드맵

### 완료 (Phase 1~11)

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
| Phase 9 | 프로그래매틱 SEO 페이지 (topics, tags, sources) | ✅ 완료 | 2026-03-06 |
| Phase 10 | hreflang 다국어 (서브디렉토리 방식으로 Phase 15에서 업그레이드) | ✅ 완료 | 2026-03-06 |
| Phase 11 | 블로그 섹션 (DB 기반, `/blog`, `/blog/[slug]`) | ✅ 완료 | 2026-03-07 |

### 완료 (Phase 12)

| Phase | 내용 | 상태 | 배포일 |
|-------|------|------|--------|
| Phase 12 | FAQ 확장 + AI 크롤러 차단 | ✅ 완료 | 2026-03-07 |

### 완료 (Phase 13)

| Phase | 내용 | 상태 | 배포일 |
|-------|------|------|--------|
| Phase 13 | 아티클 상세 페이지 SEO | ✅ 완료 | 2026-03-07 |

### 완료 (Phase 14)

| Phase | 내용 | 상태 | 배포일 |
|-------|------|------|--------|
| Phase 14 | 저자 프로그래매틱 페이지 + 동적 OG 이미지 | ✅ 완료 | 2026-03-07 |

### 완료 (Phase 15)

| Phase | 내용 | 상태 | 배포일 |
|-------|------|------|--------|
| Phase 15 | 서브디렉토리 i18n 마이그레이션 + 블로그 번역 인프라 + Baidu SEO | ✅ 완료 | 2026-03-08 |

### Phase 9: 프로그래매틱 SEO 페이지 (완료)

**구현 완료**: `/topics/[category]`, `/tags/[tag]`, `/sources/[source]` 자동 생성 페이지
- SSR + `revalidate=3600` + `generateStaticParams`
- 페이지별 메타데이터, JSON-LD `CollectionPage`, SeoBreadcrumb
- sitemap URL 50+ 자동 생성
- 내부 링크 네트워크 (카테고리 ↔ 태그 ↔ 소스 상호 링크)

### Phase 10: hreflang 다국어 (완료 → Phase 15에서 서브디렉토리로 업그레이드)

**초기 구현**: `?lang=` 쿼리 파라미터 방식
- Phase 15에서 서브디렉토리 방식(`/ko/`, `/en/`, `/vi/`, `/zh/`, `/ja/`)으로 전환 완료
- 상세 내용은 Phase 15 참조

### Phase 11: 블로그 섹션 (완료)

**구현 완료**: Supabase DB 기반 블로그 시스템

| 파일 | 내용 |
|------|------|
| `blog_posts` 테이블 | UUID PK, slug, title, description, content, tags, published, RLS |
| `lib/blog.ts` | `getBlogPosts()`, `getBlogPost(slug)`, `getBlogSlugs()` — `createServiceClient` 사용 |
| `app/blog/page.tsx` | 목록 페이지 — CollectionPage JSON-LD, SeoBreadcrumb, 카드 그리드 |
| `app/blog/[slug]/page.tsx` | 상세 페이지 — Article JSON-LD, generateStaticParams, 사이드바 (태그+다른글) |
| `components/Header.tsx` | NAV_ITEMS에 블로그 추가 |
| `lib/i18n.ts` | `header.blog` 5개 언어 |
| `app/sitemap.ts` | `/blog` (priority 0.8) + `/blog/{slug}` (priority 0.7) 동적 URL |

**작성 완료 블로그 (9편)**:

| # | slug | 타겟 키워드 | 월간 검색량 |
|---|------|-----------|------------|
| 1 | 면접-준비-방법-완벽-가이드 | 면접 준비 방법 | 4,400 |
| 2 | 자기소개서-잘-쓰는법-합격-비결 | 자기소개서 잘 쓰는법 | 3,600 |
| 3 | 이직-준비-체크리스트 | 이직 준비 | 2,900 |
| 4 | 경력직-면접-질문-답변-모음 | 경력직 면접 질문 | 1,900 |
| 5 | 업계-트렌드-파악하는-법 | 업계 트렌드 파악 | 720 |
| 6 | 연봉-협상-전략-가이드 | 연봉 협상 | 1,600 |
| 7 | 인적성검사-준비-가이드 | 인적성검사 준비 | 1,300 |
| 8 | 면접스터디-모의면접-준비-가이드 | 면접스터디 / 모의면접 | 880 |
| 9 | 40대-이직-성공-전략-가이드 | 40대 이직 | 590 |

**레이아웃**: `@tailwindcss/typography` 플러그인 적용, `prose` 클래스 기반 타이포그래피

---

## 구현 상세

### Phase 1: SEO 기반

| 파일 | 내용 |
|------|------|
| `app/robots.ts` | `/`, `/landing`, `/terms` allow / `/api/`, `/my-feed` 등 disallow |
| `app/sitemap.ts` | 3개 URL (홈, 랜딩, 이용약관) |
| `app/layout.tsx` | `metadataBase`, title template, OG/Twitter 카드, canonical, JSON-LD (Organization + WebSite) |
| `public/og-image.png` | OG 이미지 (1200x630) |

**글로벌 메타데이터** (`app/[locale]/layout.tsx`, Phase 15에서 이동):
- 로케일별 title/description/keywords (ko/en/vi/zh/ja)
- ko 기본: `아카인포 - 나만의 면접 치트키` / `면접 광탈은 이제 그만, 남다른 답변으로 취뽀하자!`

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

- `app/feed.xml/route.ts` — RSS 2.0, 아티클 20개 + 블로그 10개 통합 피드
- `app/layout.tsx` — `<link rel="alternate" type="application/rss+xml">`
- Cache: `max-age=3600, s-maxage=3600`
- 블로그 아이템: `https://aca-info.com/blog/{slug}`, `isPermaLink="true"`

### Phase 8: IndexNow

- `lib/indexnow.ts` — `submitToIndexNow(urls)` 유틸
- `public/be3047d68a3748539765936b2fd658f3.txt` — 키 검증 파일
- `app/api/crawl/run/route.ts` — 크롤링 완료 후 자동 제출: `/`, `/topics`, `/tags`, `/sources`, `/blog` + 신규 아티클 `/articles/{slug}` URL
- Vercel 환경변수: `INDEXNOW_KEY=be3047d68a3748539765936b2fd658f3`
- Google은 IndexNow 미지원 → sitemap + Search Console로 커버

---

## 파일 변경 요약

| 파일 | Phase | 작업 |
|------|-------|------|
| `app/robots.ts` | 1, 12, 13 | 크롤러 접근 규칙 + AI 크롤러 차단 + `/articles`, `/blog` allow |
| `app/sitemap.ts` | 1, 9, 11, 13 | sitemap.xml 생성 (정적 + topics/tags/sources/blog/articles 동적) |
| `public/og-image.png` | 1 | OG 이미지 |
| `app/layout.tsx` | 1, 6, 7 | 메타데이터, JSON-LD, next/font, RSS link |
| `app/globals.css` | 6 | `font-family` CSS 변수 전환 |
| `next.config.mjs` | 6 | CSP font/style 소스 정리 |
### Phase 12: FAQ 확장 + AI 크롤러 차단 (완료)

**FAQ 확장**: JSON-LD `FAQPage` 스키마 Q&A 3→10개 (시각적 UI 없이 구조화 데이터만)
- 추가 7개: 업계 정보 범위, 업데이트 주기, AI 면접 코칭 원리, 모바일 지원, 회원가입 여부, 소스 추가, 데이터 갱신 주기

**AI 크롤러 차단**: `robots.ts` rules 배열 변환, AI 학습용 봇 전면 차단
- GPTBot (OpenAI), ClaudeBot (Anthropic), CCBot (Common Crawl), Google-Extended (Gemini)

| `app/landing/page.tsx` | 2, 3, 12 | 서버 컴포넌트 + 메타데이터 + JSON-LD (FAQ 10개) |
| `app/landing/LandingContent.tsx` | 2 | 서버 컴포넌트 SSR |
| `app/landing/AnimatedSection.tsx` | 2 | framer-motion 클라이언트 래퍼 |
| `app/landing/LandingHeader.tsx` | 2 | Header 클라이언트 래퍼 |
| `app/page.tsx` | 2 | 서버 컴포넌트, 초기 데이터 fetch |
| `components/HomeFeed.tsx` | 2 | 홈피드 클라이언트 로직 |
| `app/feed.xml/route.ts` | 7, 13 | RSS 2.0 피드 (아티클 + 블로그 통합) |
| `lib/indexnow.ts` | 8 | IndexNow 유틸 |
| `public/be3047d68a3748539765936b2fd658f3.txt` | 8 | IndexNow 키 파일 |
| `app/api/crawl/run/route.ts` | 8, 13 | 크롤링 후 IndexNow 자동 호출 (아티클 slug URL 포함) |
| `public/fonts/PretendardVariable.woff2` | 6 | self-hosted 폰트 |
| `lib/seo-queries.ts` | 9 | 프로그래매틱 페이지용 쿼리 함수 |
| `app/topics/page.tsx` | 9 | 카테고리 목록 페이지 |
| `app/topics/[category]/page.tsx` | 9 | 카테고리별 아티클 목록 |
| `app/tags/page.tsx` | 9 | 태그 목록 페이지 |
| `app/tags/[tag]/page.tsx` | 9 | 태그별 아티클 목록 |
| `app/sources/[source]/page.tsx` | 9 | 소스별 아티클 목록 |
| `lib/hreflang.ts` | 10 | `buildAlternateLanguages()` 유틸 |
| `lib/blog.ts` | 11 | 블로그 쿼리 함수 (getBlogPosts, getBlogPost, getBlogSlugs) |
| `app/blog/page.tsx` | 11 | 블로그 목록 페이지 |
| `app/blog/[slug]/page.tsx` | 11 | 블로그 상세 페이지 |
| `types/index.ts` | 11 | `BlogPost` 타입 추가 |
| `components/Header.tsx` | 6, 11 | 중복 fontFamily 제거 + 블로그 NAV 추가 |
| `lib/i18n.ts` | 11 | `header.blog` 5개 언어 번역 추가 |
| `supabase/migrations/014_add_article_slug.sql` | 13 | articles slug 컬럼 + 인덱스 + 백필 |
| `supabase/migrations/015_create_blog_posts.sql` | 11 | blog_posts 테이블 생성 + RLS |
| `lib/article-slug.ts` | 13 | `generateArticleSlug()` 한글 slug 생성 유틸 |
| `lib/seo-queries.ts` | 9, 13 | 프로그래매틱 + 아티클 상세 쿼리 함수 |
| `app/articles/[slug]/page.tsx` | 13 | 아티클 상세 페이지 (Article JSON-LD) |
| `lib/crawlers/index.ts` | 13 | 아티클 insert 시 slug 자동 생성 |
| `types/index.ts` | 11, 13 | BlogPost + Article slug 타입 추가 |
| `tailwind.config.ts` | 13 | `@tailwindcss/typography` 플러그인 추가 |
| `lib/seo-queries.ts` | 14 | `getActiveAuthors()`, `getArticlesByAuthor()` 쿼리 추가 |
| `app/authors/page.tsx` | 14 | 저자 목록 페이지 (CollectionPage JSON-LD) |
| `app/authors/[name]/page.tsx` | 14 | 저자별 아티클 페이지 (Person + CollectionPage JSON-LD) |
| `app/api/og/route.tsx` | 14 | 동적 OG 이미지 생성 (Edge Runtime, next/og) |
| `app/sitemap.ts` | 14 | `/authors` + `/authors/{name}` 동적 URL 추가 |
| `app/robots.ts` | 14 | `/authors` allow 추가 |
| `app/api/crawl/run/route.ts` | 14 | IndexNow에 `/authors` 경로 추가 |
| `app/articles/[slug]/page.tsx` | 14 | 동적 OG 이미지 + 저자 링크 → `/authors/[name]` |
| `app/blog/[slug]/page.tsx` | 14 | 동적 OG 이미지 적용 |
| `app/topics/page.tsx` | 14 | "더 탐색하기"에 저자별 탐색 링크 추가 |
| `app/tags/page.tsx` | 14 | "더 탐색하기"에 저자별 탐색 링크 추가 |
| `app/sources/page.tsx` | 14 | "더 탐색하기"에 저자별 탐색 링크 추가 |

---

## 검증 방법

1. View Source로 HTML에 콘텐츠 포함 확인 (`/`, `/landing`)
2. `/robots.txt`, `/sitemap.xml` 정상 출력 확인
3. `/feed.xml` RSS XML 출력 확인
4. Network 탭에서 폰트 self-hosted 로드 확인
5. [Google Rich Results Test](https://search.google.com/test/rich-results)로 JSON-LD 검증
6. Lighthouse SEO 점수 확인 (목표: 90+)
7. `/blog` 목록 렌더링, `/blog/{slug}` 상세 페이지 렌더링 확인
8. `/sitemap.xml`에 블로그 URL 포함 확인
9. `<link rel="alternate" hreflang="...">` 존재 확인 (blog 포함)
10. `/articles/{slug}` 상세 페이지 렌더링 + Article JSON-LD 확인
11. `/sitemap.xml`에 아티클 URL 포함 확인
12. `/feed.xml`에 블로그 + 아티클 통합 출력 확인
13. `/robots.txt`에 `/articles`, `/blog` allow 확인
14. `/authors` 목록 렌더링, `/authors/{name}` 상세 페이지 렌더링 확인
15. `/sitemap.xml`에 author URL 포함 확인
16. `/api/og?title=테스트&type=article` 동적 OG 이미지 생성 확인
17. 아티클 상세 페이지에서 저자 이름 클릭 → `/authors/[name]` 이동 확인
18. `/ko/`, `/en/`, `/ja/`, `/zh/`, `/vi/` 접속 시 로케일별 메타데이터 확인
19. `/` 접속 시 `Accept-Language` 기반 302 리다이렉트 확인
20. `/?lang=en` → `/en/` 301 리다이렉트 확인
21. 페이지 소스에서 hreflang이 서브디렉토리 형식(`/ko/path`, `/en/path`)인지 확인
22. LanguageSwitcher 전환 시 URL 경로 변경 확인 (쿼리 아닌 서브디렉토리)
23. `/sitemap.xml`에 서브디렉토리 URL + 5개 로케일 엔트리 확인
24. `<html lang="ko">` 등 동적 lang 속성 확인

### Phase 13: 아티클 상세 페이지 SEO (완료)

**구현 완료**: 아티클 개별 상세 페이지 `/articles/[slug]`

| 파일 | 내용 |
|------|------|
| `supabase/migrations/014_add_article_slug.sql` | slug 컬럼 + UNIQUE 인덱스 + UUID 백필 |
| `lib/article-slug.ts` | `generateArticleSlug(title, id)` — 한글 slug화 + ID 4자리 충돌 방지 |
| `types/index.ts` | `Article`에 `slug: string \| null` 추가 |
| `lib/crawlers/index.ts` | 아티클 insert 시 slug 자동 생성 |
| `lib/seo-queries.ts` | `getArticleBySlug()`, `getArticleSlugs()`, `getRelatedArticles()` |
| `app/articles/[slug]/page.tsx` | 상세 페이지 — Article JSON-LD, generateStaticParams, 사이드바 (태그+관련글) |
| `app/sitemap.ts` | `/articles/{slug}` (priority 0.6, daily) 동적 URL |
| `app/robots.ts` | allow에 `/articles` 추가 |

**기능**:
- `generateStaticParams()` + `generateMetadata()` + `revalidate = 3600`
- JSON-LD Article 스키마 (headline, description, datePublished, author, publisher)
- SeoBreadcrumb (홈 → 카테고리 → 아티클)
- 본문: AI 요약 + content_preview + 원문 링크(source_url)
- 사이드바: summary_tags (내부 링크) + 관련 아티클 (같은 카테고리)
- OG 이미지: `https://aca-info.com/og-image.png` (블로그는 cover_image 우선, 없으면 동일 fallback)
- 레이아웃: `@tailwindcss/typography` + `prose` 커스터마이징 (blog, article 모두 적용)

### Phase 14: 저자 프로그래매틱 페이지 + 동적 OG 이미지 (완료)

**경쟁사 분석 기반**: 서핏(surfit.io) `/author/[name]` 패턴 참조

**1. 저자 프로그래매틱 페이지** (`/authors`, `/authors/[name]`):
- `getActiveAuthors()` — articles 테이블에서 distinct author 집계
- `getArticlesByAuthor()` — 저자별 아티클 필터
- `/authors/page.tsx` — 저자 목록 (그리드, CollectionPage JSON-LD)
- `/authors/[name]/page.tsx` — 저자별 아티클 (Person + CollectionPage JSON-LD, generateStaticParams)
- 기존 페이지 내부 링크 네트워크에 통합 (topics/tags/sources "더 탐색하기" + 아티클 상세 저자 링크)
- sitemap, robots, IndexNow, hreflang 모두 적용

**2. 동적 OG 이미지** (`/api/og`):
- `next/og` `ImageResponse` (Edge Runtime)
- 파라미터: `title`, `description`, `type` (article/blog/author/default)
- type별 accent color 분기 (article: Indigo, blog: Purple, author: Cyan)
- 아티클 상세, 블로그 상세 페이지에 동적 OG 적용
- 기존 정적 `og-image.png`는 홈/랜딩 등 범용 페이지용으로 유지

### Phase 15: 서브디렉토리 i18n 마이그레이션 (완료)

**목적**: `?lang=ko` 쿼리 파라미터 → `/ko/`, `/en/`, `/vi/`, `/zh/`, `/ja/` 서브디렉토리 전환 (Google hreflang 정식 방식)

**1. 라우팅 구조 변경**:
- 모든 public 페이지를 `app/[locale]/` 하위로 이동
- `app/layout.tsx` → 최소 셸 (html/body, 폰트, GA, `<html lang>` 설정)
- `app/[locale]/layout.tsx` → 로케일별 메타데이터, JSON-LD, Providers
- `generateStaticParams`로 5개 로케일 × 모든 페이지 조합 정적 생성

**2. middleware.ts i18n 로직**:
- URL 첫 세그먼트가 유효 로케일 → `x-locale` 헤더 설정 후 통과
- `?lang=` 쿼리 → `/{locale}/path` 301 리다이렉트 (레거시 호환)
- 로케일 없는 URL → `Accept-Language` 감지 → `/{detected}/path` 302 리다이렉트

**3. 로케일 인식 링크**:
- `components/LocaleLink.tsx` (client) — `usePathname()`에서 로케일 추출, 자동 prefix
- `lib/locale-path.ts` (server) — `localePath(locale, path)` 유틸
- Header, Footer, SeoBreadcrumb, SeoArticleList 등 14개 파일 내부 링크 전환

**4. hreflang 서브디렉토리 전환**:
- `lib/hreflang.ts` — `?lang=` → `/{locale}{path}` 형식
- `x-default` → `https://aca-info.com/ko{path}`

**5. sitemap 업데이트**:
- 모든 URL을 `/{locale}/path` 형식으로 변경
- 각 페이지마다 5개 로케일 엔트리 생성 (빌드 시 1873 페이지)

**6. 블로그 번역 인프라**:
- DB: `blog_posts`에 `language`, `translation_group_id` 컬럼 추가 (migration 016)
- `lib/blog.ts` — `getBlogPosts(language)`, `getBlogPost(slug, language)` language 필터
- `supabase/functions/translate-blog/` — Gemini 2.5 Flash 번역 Edge Function

**7. Baidu SEO**:
- `app/robots.ts` — Baiduspider 규칙 추가 (`allow: ["/zh/"]`, `crawlDelay: 1`)
- Baidu 인증은 중국 전화번호 필요로 보류

| 파일 | 작업 |
|------|------|
| `lib/locale-config.ts` | (신규) LOCALES, Locale 타입, OG_LOCALES |
| `lib/locale-path.ts` | (신규) 서버용 `localePath()` |
| `components/LocaleLink.tsx` | (신규) 클라이언트용 로케일 링크 래퍼 |
| `app/layout.tsx` | 최소 셸로 축소, `<html lang>` 동적 설정 |
| `app/[locale]/layout.tsx` | (신규) 로케일별 메타데이터 + JSON-LD |
| `app/[locale]/**/*.tsx` | 모든 페이지 `[locale]` 하위로 이동, params에 locale 추가 |
| `app/providers.tsx` | locale prop 수신 |
| `middleware.ts` | i18n 라우팅 (301/302 리다이렉트, Accept-Language 감지) |
| `lib/hreflang.ts` | 서브디렉토리 형식 전환 |
| `lib/language-context.tsx` | `locale` prop 기반으로 전환, `?lang=` 감지 제거 |
| `app/sitemap.ts` | 5개 로케일 × 모든 URL 생성 |
| `app/robots.ts` | 로케일 경로 + Baiduspider 규칙 |
| `components/Header.tsx` | LocaleLink 적용 |
| `components/Footer.tsx` | LocaleLink 적용 |
| `components/SeoBreadcrumb.tsx` | locale prop + localePath 적용 |
| `components/SeoArticleList.tsx` | locale prop + localePath 적용 |
| `types/index.ts` | BlogPost에 `language`, `translation_group_id` 추가 |
| `lib/blog.ts` | language 필터 파라미터 추가 |
| `supabase/migrations/016_blog_posts_i18n.sql` | (신규) language + translation_group_id 컬럼 |
| `supabase/functions/translate-blog/` | (신규) Gemini 블로그 번역 Edge Function |
