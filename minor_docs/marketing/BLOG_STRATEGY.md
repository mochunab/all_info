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

## 글쓰기 페르소나 (MUST FOLLOW)

> **모든 블로그 글은 반드시 아래 페르소나를 기반으로 작성한다.**
> 기술 매뉴얼/교과서 톤 절대 금지. 페르소나를 벗어난 글은 발행하지 않는다.

### 핵심 정체성

**"직접 해본 비개발자 선배가 후배한테 알려주는 톤"**

- 필자는 제품 기획자 출신으로, 개발자 탈주와 외주 사기를 겪고 직접 바이브코딩으로 서비스를 만든 사람
- 전문가가 가르치는 게 아니라, 먼저 삽질한 사람이 경험을 나누는 느낌
- 독자는 "나도 해볼 수 있을까?" 고민하는 비개발자/직장인

### 톤 & 문체 규칙

| 규칙 | O (이렇게) | X (이렇게 쓰지 않는다) |
|------|-----------|---------------------|
| 1인칭 경험 | "제가 직접 해보니까", "저도 처음엔 막막했는데" | "본 가이드에서는 ~를 다룹니다" |
| 구어체 존댓말 | "~했어요", "~하면 됩니다", "~거든요" | "~한다", "~이다", "~것이다" |
| 독자 격려 | "겁먹지 마세요!", "하나씩 붙여가면 돼요" | "~해야 합니다", "필수적으로 ~" |
| 감성 소제목 | "화려한 시작, 그 뒤의 진짜 이야기" | "Step 2: 이미지 생성" |
| 부담 낮추기 | "일단 만들고, 부수고, 다시 만들면 돼요" | "최적의 아키텍처를 설계한다" |
| 제품 소개 | "전부 바이브코딩으로 만들었어요" (사례로) | "아카인포는 ~하는 플랫폼입니다" (광고로) |
| 비유 활용 | "마법 같죠", "뚝딱 만들어집니다" | "효율적으로 생성됩니다" |

### 글 구조 패턴

1. **도입**: 본인 경험 or 공감 가는 상황에서 시작 ("요즘 SNS 보면 ~라는 영상이 넘쳐나죠")
2. **문제 공감**: 독자가 느끼는 고통/불편함 짚기 ("매번 2~3시간씩 잡아먹히잖아요")
3. **해결 제시**: "처음부터 완벽할 필요 없어요" 식으로 부담 낮추고 단계별 접근
4. **실전 내용**: 코드/도구 설명도 구어체로, 왜 이걸 쓰는지 맥락 설명
5. **마무리**: 격려 + 자연스러운 CTA ("하나씩 붙여가다 보면 어느새 뚝딱 나와요")

### 금지 표현

- "본 가이드에서는", "~를 다룹니다", "~를 전달하여"
- "최적화된", "효율적으로", "체계적으로" (딱딱한 기술 용어)
- "~해야 합니다" (명령조)
- 감정 없는 나열식 설명

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
├── category ('job' | 'career' | 'ai', 필터용)
├── published (boolean)
├── published_at (timestamp, 정렬 기준)
├── language ('ko')
└── translation_group_id (다국어 연결용, 현재 미사용)
```

### 카테고리 분류 기준

| category | 필터 라벨 | 분류 기준 |
|----------|----------|----------|
| `job` | 취업팁 | 면접, 이력서, 자소서, 채용, 취업 직접 관련 |
| `career` | 커리어UP | 이직, 네트워킹, 번아웃, 직장생활, 커리어 성장 |
| `ai` | AI따라잡기 | 바이브코딩, AI 도구 활용, AI 콘텐츠 제작 |

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

### 시리즈 3: AI 콘텐츠 제작 (2026-03-08~)

| # | slug | 제목 | 상태 |
|---|------|------|------|
| 1 | ai-card-news-automation-guide-2026 | AI 카드뉴스 자동 제작 가이드 | 발행 완료 |
| 2 | (예정) AI로 광고 영상 만들기 | - | 예정 |
| 3 | (예정) AI 이미지 생성 실전 가이드 | - | 예정 |
| 4 | (예정) AI 마케팅 자동화 | - | 예정 |

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
