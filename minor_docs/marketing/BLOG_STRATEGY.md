# 아카인포 블로그 작성 전략

> 최초 작성: 2026-03-09
> 도메인: `https://aca-info.com/ko/blog`

---

## 블로그 목적

1. **SEO 유입** — 롱테일 키워드로 검색 트래픽 확보
2. **브랜드 인지도** — "바이브코딩/AI 활용" 분야 전문 블로그로 포지셔닝
3. **제품 연결** — 블로그 → 아카인포 랜딩 자연스러운 CTA 유도
4. **콘텐츠 재활용** — 블로그 글 → 스레드/카드뉴스/영상 등 멀티채널 변환

---

## 기술 스택 & 프로세스

### DB 구조

```
blog_posts 테이블 (Supabase)
├── slug (kebab-case, 영문)
├── title (한글, SEO 최적화)
├── description (150자 이내 메타 설명)
├── content (HTML)
├── tags (string[], 최대 4개)
├── published (boolean)
├── published_at (timestamp, 정렬 기준)
├── language ('ko')
└── translation_group_id (다국어 연결용, 현재 미사용)
```

### 렌더링

- `app/[locale]/blog/page.tsx` — 목록 (published_at DESC)
- `app/[locale]/blog/[slug]/page.tsx` — 상세 (prose + dangerouslySetInnerHTML)
- SEO: JSON-LD (Article/CollectionPage), OG 태그, hreflang, breadcrumb

### 이미지

- Supabase Storage `blog-images` 버킷 (public)
- 경로: `blog-images/{시리즈명}/{파일명}.png`
- URL: `https://tcpvxihjswauwrmcxhhh.supabase.co/storage/v1/object/public/blog-images/...`

### 삽입 방식

- `scripts/insert-vibe-coding-blog.mjs` 참고
- dotenv로 .env.local 읽기 → Supabase REST API로 INSERT
- 이미지 먼저 Storage 업로드 → content HTML에 URL 삽입

---

## 콘텐츠 구조 원칙

### 시리즈 구성

하나의 주제를 **허브 + 서브** 구조로 작성:

```
허브 글 (개요 + 내부 링크)
├── 서브 글 1 (개념/정의)
├── 서브 글 2 (필수 지식)
├── 서브 글 3 (실전 가이드)
└── ...
```

- 허브 글의 `published_at`이 가장 최신 → 목록 최상단
- 서브 글은 1분 간격으로 시간 설정 → 뎁스 순서 유지

### 내부 링크 규칙

- content HTML 내 링크: `href="/blog/{slug}"` (locale prefix 제외)
- Next.js `[locale]` 라우팅이 자동으로 `/ko/blog/...`로 처리

---

## SEO 최적화 체크리스트

### 포스트 작성 시

- [ ] **slug**: 영문 kebab-case, 핵심 키워드 포함 (예: `vibe-coding-complete-guide-2026`)
- [ ] **title**: 핵심 키워드 + 구분자(—) + 부제 (70자 이내)
- [ ] **description**: 키워드 포함 150자 이내 메타 설명
- [ ] **tags**: 4개, 검색 볼륨 있는 키워드 (띄어쓰기 없이)
- [ ] **h2/h3 구조**: 계층적 헤딩, 키워드 자연스럽게 포함
- [ ] **이미지 alt**: 설명적 alt 텍스트 (현재 빈칸 → 개선 필요)
- [ ] **내부 링크**: 관련 포스트 간 상호 링크
- [ ] **외부 링크**: 참고 자료 target="_blank" rel="noopener"

### 포스트별 자동 SEO (page.tsx에서 처리)

- JSON-LD Article 스키마
- Open Graph (title, description, type: article)
- hreflang alternate (5개 언어)
- Breadcrumb (홈 > 블로그 > 포스트)
- canonical URL

---

## HTML 변환 주의사항

마크다운/노션 → HTML 변환 시 확인할 것:

| 문제 | 원인 | 해결 |
|------|------|------|
| 테이블에 `---` 행 표시 | separator row 미필터링 | `<tr>` 내 모든 `<td>`가 `-`만 있으면 제거 |
| `<pre>` 안 줄간격 넓음 | `<p>` 태그가 `<pre>` 안에 삽입됨 | `<pre>` 내 `<p>` 제거 |
| `<pre>` 빈 줄 과다 | 연속 `\n` | `<pre>` 내 `\n{2,}` → `\n` |
| 빈 blockquote `>` 표시 | 빈 `>` 줄이 blockquote로 변환 | 빈 blockquote 제거 |
| ol 번호 전부 1 | 연속 `<ol>` 분리됨 | 인접 `</ol><ol>` 병합 |
| 링크 `/ko/ko/blog` 이중 | locale prefix 하드코딩 | `/blog/slug`로 작성 (locale 제외) |
| 코드블록 자간 넓음 | prose-lg 스타일 | prose-pre/prose-code 커스텀 추가 완료 |

---

## 발행 현황

### 시리즈 1: 취업/면접 (2026-03-07~08)

기존 SEO용 콘텐츠. 면접, 이력서, 자소서 등 취업 관련 30편.

### 시리즈 2: 바이브코딩 가이드북 (2026-03-09)

노션 가이드북 원본을 충실히 변환. 7편 허브+서브 구조.

| # | slug | 제목 |
|---|------|------|
| 1 | vibe-coding-complete-guide-2026 | 바이브코딩 완벽 가이드 2026 (허브) |
| 2 | vibe-coding-what-is-it | 바이브코딩이란? |
| 3 | vibe-coding-essential-knowledge | 필수 지식 |
| 4 | vibe-coding-requirements-planning | 기획법 — 요구사항 정의 5단계 |
| 5 | vibe-coding-track-a-claude-code | Track A: Claude Code 업무 자동화 |
| 6 | vibe-coding-track-b-lovable | Track B: Lovable 예약 시스템 |
| 7 | vibe-coding-track-c-startup | Track C: MVP 창업 아이템 |

### 시리즈 3: AI 콘텐츠 제작 (예정)

| # | 주제 (예정) | 타겟 키워드 |
|---|------------|-----------|
| 1 | AI로 광고 영상 만들기 | AI영상제작, AI광고, Sora, Runway |
| 2 | AI로 카드뉴스 만들기 | AI카드뉴스, AI디자인, Canva AI |
| 3 | AI 이미지 생성 실전 가이드 | AI이미지, Midjourney, DALL-E |
| 4 | AI 마케팅 자동화 | AI마케팅, 콘텐츠자동화 |

---

## 아카인포 CTA 삽입 가이드

블로그 글에 아카인포 제품 언급 시:

```html
<p>직접 사용해보고 싶다면 👇</p>
<p><a href="https://aca-info.com/ko?utm_source=blog&utm_medium={slug}&utm_campaign={시리즈}" target="_blank" rel="noopener">🔗 아카인포 바로가기 (aca-info.com)</a></p>
```

- UTM 파라미터: `utm_source=blog`, `utm_medium={포스트slug}`, `utm_campaign={시리즈명}`
- 자연스러운 맥락에서만 삽입 (강제 광고 X)
- 허브 글 상단 or 관련 기능 설명 후에 배치
