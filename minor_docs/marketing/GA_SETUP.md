# Google Analytics 설정 기록

## 기본 정보

| 항목 | 값 |
|------|-----|
| 측정 ID | `G-1JHEHJCLXN` |
| 도메인 | `aca-info.com` |
| GA4 속성명 | 아카인포 |
| GCP 프로젝트 | `gen-lang-client-0379192677` (Gemini API) |
| 설정일 | 2026-03-04 |

## 구현 위치

- `lib/gtag.ts` — GA 유틸 (pageview, event 함수)
- `components/GTagPageView.tsx` — SPA 라우트 변경 시 페이지뷰 전송
- `app/layout.tsx` — gtag 스크립트 로드 + GTagPageView 삽입
- `types/gtag.d.ts` — window.gtag 타입 선언
- `next.config.mjs` — CSP에 googletagmanager.com, google-analytics.com 허용

## 이벤트 목록

### 인증

| 이벤트 | 카테고리 | 발생 시점 | 파일 |
|--------|---------|----------|------|
| `login` | auth | 로그인 성공 | login/page.tsx |
| `signup` | auth | 회원가입 성공 | signup/page.tsx |
| `logout` | auth | 로그아웃 클릭 | Header.tsx |

### 콘텐츠

| 이벤트 | 카테고리 | 발생 시점 | 파일 |
|--------|---------|----------|------|
| `page_view` | 자동 | 모든 페이지 이동 | GTagPageView.tsx |
| `click` | article | 아티클 카드 클릭 (새 탭 열기) | ArticleCard.tsx |
| `chat_reference` | article | 아티클 채팅 참조 핀 | ArticleCard.tsx |
| `delete` | article | 아티클 삭제 | ArticleCard.tsx |

### 필터/네비게이션

| 이벤트 | 카테고리 | 발생 시점 | 파일 |
|--------|---------|----------|------|
| `load_more` | navigation | 더보기 버튼 | HomeFeed.tsx, my-feed/page.tsx |
| `filter_category` | filter | 카테고리 필터 변경 | HomeFeed.tsx, my-feed/page.tsx |
| `search` | filter | 검색어 입력 | HomeFeed.tsx, my-feed/page.tsx |

### AI / 크롤링

| 이벤트 | 카테고리 | 발생 시점 | 파일 |
|--------|---------|----------|------|
| `send_message` | chat | AI 채팅 메시지 전송 | InsightChat.tsx |
| `crawl_trigger` | crawling | 자료 불러오기 버튼 | HomeFeed.tsx, my-feed/page.tsx |

### 소스 관리

| 이벤트 | 카테고리 | 발생 시점 | 파일 |
|--------|---------|----------|------|
| `save_sources` | source | 소스 저장 | SourcesPageClient.tsx |
| `recommend_sources` | source | AI 소스 추천 | SourcesPageClient.tsx |

### 설정

| 이벤트 | 카테고리 | 발생 시점 | 파일 |
|--------|---------|----------|------|
| `language_change` | settings | 언어 변경 | LanguageSwitcher.tsx |

## CSP 설정

`next.config.mjs`에서 GA 관련 도메인 허용 필수:
- `script-src`: `https://www.googletagmanager.com`
- `connect-src`: `https://www.google-analytics.com https://www.googletagmanager.com https://analytics.google.com`
- `img-src`: `https://www.googletagmanager.com`

## DNS 설정 (Cloudflare)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 76.76.21.21 | DNS only |
| CNAME | www | cname.vercel-dns.com | DNS only |

## GCP API 활성화 목록

- `analyticsdata.googleapis.com` (GA4 Data API)
- `searchconsole.googleapis.com` (Search Console API)
- `analyticsadmin.googleapis.com` (GA Admin API)

## TODO

- [ ] GA4 커스텀 대시보드 구성
- [ ] Search Console 연동
- [ ] GA4 Data API 앱 내 통계 대시보드
