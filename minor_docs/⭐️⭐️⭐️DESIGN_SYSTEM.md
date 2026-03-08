# Design System Guide — Insight Hub

> Material You (MD3) 기반 디자인 시스템. 블루 accent 컬러 유지.
> 이 문서를 읽고 **동일한 시각 언어로** UI를 작성할 것.

---

## 1. Design Tokens (`globals.css :root`)

### Colors

| Token | Value | 용도 |
|-------|-------|------|
| `--bg-primary` | `#FAFAFA` | 페이지 배경 (순수 #FFF 금지) |
| `--bg-secondary` | `#FFFFFF` | 앱 내부 카드 배경 (`.card`) |
| `--bg-tertiary` | `#F3F4F6` | 톤 서피스, 섹션 배경, `.landing-card` |
| `--text-primary` | `#111827` | 제목, 본문 |
| `--text-secondary` | `#4B5563` | 부제목, 설명 |
| `--text-tertiary` | `#9CA3AF` | 캡션, 메타 |
| `--accent` | `#2563EB` | CTA, 링크, 아이콘 — **seed color** |
| `--accent-light` | `#DBEAFE` | 배지, 아이콘 박스, 톤 서피스 |
| `--accent-hover` | `#1D4ED8` | 버튼 hover |
| `--border` | `#E5E7EB` | 앱 카드 보더 (랜딩에서는 보더 미사용) |

### Semantic Color Rules

- **배경에 순수 `#FFFFFF` 금지** — `--bg-primary`(#FAFAFA) 또는 `--bg-tertiary`(#F3F4F6) 사용
- 톤 서피스 depth 순서: `--bg-primary` → `--bg-tertiary` → `--accent-light`
- 강조 그래디언트: `#1E3A8A → #2563EB → #3B82F6` (CTA 섹션)
- 보조 컬러: `#047857` (초록 태그), `#6D28D9` (보라 태그), `#DC2626` (빨강/경고)

### Radius

| Token | Value | 용도 |
|-------|-------|------|
| `--radius-sm` | `8px` | 소형 UI |
| `--radius-md` | `12px` | 앱 카드 (`.card`) |
| `--radius-lg` | `16px` | — |
| `rounded-2xl` | `16px` | 아이콘 박스, 내부 카드 |
| `rounded-3xl` | `24px` | 랜딩 카드 (`.landing-card`) |
| `rounded-[32px]` | `32px` | glass-morphism 컨테이너 |
| `rounded-[48px]` | `48px` | CTA 히어로 섹션 |
| `rounded-full` | pill | 버튼, 배지, 칩 |

### Shadows

| Token | Value | 용도 |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | 카드 기본 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | 카드 hover |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.08)` | 강조 컨테이너 |

Progressive shadow: `shadow-sm` (rest) → `shadow-md` (hover) → `shadow-lg` (important)

---

## 2. Typography

- **Font**: Pretendard (한글 기본) → system fallback
- **Headings**: `font-bold` (700)
- **Body**: `font-medium` (500) 또는 기본 (400)
- **Line height**: body `1.6~1.7`, heading `1.15~1.3`

| 용도 | 클래스 |
|------|--------|
| Hero headline | `text-4xl sm:text-5xl md:text-[3.5rem] font-bold leading-[1.15]` |
| Section title | `text-3xl md:text-4xl font-bold` |
| Card title | `text-lg font-bold` |
| Body | `text-sm` + `lineHeight: 1.7` |
| Caption | `text-xs` |
| Badge | `text-xs font-medium` |

---

## 3. Motion & Transitions

### MD3 Easing (필수)

```
cubic-bezier(0.2, 0, 0, 1)
```

모든 transition과 framer-motion 애니메이션에 이 easing 사용.

### Duration

| 용도 | Duration |
|------|----------|
| Micro-interaction (hover color) | 200ms |
| Card hover, surface | 300ms |
| Page entrance | 500ms |

### Framer Motion Variants (AnimatedSection.tsx)

| Animation | 효과 |
|-----------|------|
| `fadeUp` | opacity 0→1, y 24→0 (stagger: `custom * 0.12s`) |
| `scaleIn` | opacity 0→1, scale 0.92→1 (stagger: `custom * 0.1s`) |
| `slideLeft` | opacity 0→1, x -30→0 |
| `slideRight` | opacity 0→1, x 30→0 (delay 0.1s) |
| `fadeIn` | opacity 0→1, y 20→0 |

- Hero 요소: `useViewport={false}` (즉시 재생)
- 스크롤 섹션: `useViewport={true}` (뷰포트 진입 시 재생, `once=true`)

### Tactile Feedback

```tsx
// 클릭 가능한 모든 요소에 적용
active:scale-95       // 버튼
active:scale-[0.98]   // 카드
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .landing-card:hover,
  .card-hover:hover {
    transform: none;
  }
}
```

---

## 4. Component Patterns

### 4-1. Buttons

**랜딩 페이지 (MD3 스타일)**

```tsx
// Primary CTA — pill, accent bg, tactile feedback
<LocaleLink
  href="/"
  className="inline-flex items-center gap-2.5 px-8 py-4 text-base font-medium
    rounded-full text-white active:scale-95
    shadow-md hover:shadow-lg
    transition-all duration-300 cursor-pointer"
  style={{
    backgroundColor: 'var(--accent)',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
  }}
  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
>
```

**앱 내부 (기존 스타일)**

```tsx
// .btn .btn-primary — rounded-lg (앱 카드 내)
<button className="btn btn-primary">...</button>
```

| Context | Shape | Size |
|---------|-------|------|
| 랜딩 CTA | `rounded-full` (pill) | `px-8 py-4` |
| 앱 내부 | `rounded-lg` | `px-4 py-2` |
| 칩/필터 | `rounded-full` | `px-4 py-2` |

### 4-2. Cards

**랜딩 카드 (`.landing-card`)**
- 배경: `--bg-tertiary` (tonal surface, 보더 없음)
- Radius: `rounded-3xl` (24px)
- Shadow: `shadow-sm` → hover `shadow-md`
- Hover: `scale(1.02)` + shadow 상승
- Active: `scale(0.98)`

**앱 카드 (`.card`)**
- 배경: `--bg-secondary` (#FFF)
- Border: `1px solid --border`
- Radius: `--radius-md` (12px)
- Shadow: `--shadow-sm`

### 4-3. Icon Box

```tsx
<div className="landing-icon-box">  {/* w-12 h-12 rounded-2xl, accent-light bg */}
  <IconName />                       {/* w-5 h-5, accent color stroke */}
</div>
```

### 4-4. Step Number

```tsx
<div className="landing-step-num">{num}</div>
// w-8 h-8 rounded-full, accent bg, white text, font-bold
```

### 4-5. Badges / Pills

```tsx
<span
  className="text-xs font-medium px-3 py-1 rounded-full"
  style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
>
  {text}
</span>
```

### 4-6. Glass-morphism

```css
.landing-glass {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
```

Radius: `rounded-[32px]`

---

## 5. Layout Patterns

### Section Structure

```
py-24 px-6                           ← 섹션 패딩 (generous)
  max-w-5xl mx-auto (or max-w-6xl)  ← 콘텐츠 폭
    text-center mb-16                ← 섹션 헤더 (제목 + 설명)
    grid md:grid-cols-3 gap-8        ← 카드 그리드
```

### Background Alternation

```
Hero         → --bg-primary + organic blur shapes
Pain Points  → --bg-tertiary
Before/After → --bg-primary + organic blur
How it Works → --bg-tertiary + organic blur
Features     → --bg-primary + organic blur
Final CTA    → gradient surface (1E3A8A → 2563EB → 3B82F6)
```

### Organic Blur Shapes (MD3 시그니처)

```tsx
<div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
  <div
    className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-[0.15]"
    style={{ backgroundColor: '#2563EB' }}
  />
  <div
    className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full blur-3xl opacity-[0.08]"
    style={{ backgroundColor: '#3B82F6' }}
  />
</div>
```

Rules:
- 히어로/CTA에 2~3개, 일반 섹션에 1개
- 색상: `#2563EB`, `#3B82F6`, `#93C5FD` (accent 계열)
- opacity: `0.05 ~ 0.15`
- size: `300px ~ 500px`
- `blur-3xl` (64px)
- 반드시 `pointer-events-none` + `aria-hidden="true"`
- 부모에 `overflow-hidden` 필수

---

## 6. Icons

**이모지 사용 금지** — 모든 아이콘은 inline SVG로 작성.

```tsx
// 표준 아이콘 포맷
<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" strokeWidth="2"
  strokeLinecap="round" strokeLinejoin="round">
  ...
</svg>
```

- 아이콘 스타일: Lucide (stroke-based, 24x24 viewBox)
- `landing-icon-box` 내부: `w-5 h-5`, color는 `currentColor` (accent 상속)
- 독립 사용: `w-6 h-6` 기본

### i18n 텍스트 내 이모지도 금지

번역 키에 이모지 포함하지 않음. 필요하면 SVG 아이콘을 JSX에서 별도 렌더링.

---

## 7. Spacing Scale

| 용도 | 값 |
|------|-----|
| 섹션 상하 | `py-24` (96px) |
| 섹션 헤더 → 콘텐츠 | `mb-16` (64px) |
| 카드 내부 패딩 | `p-8` (32px) 랜딩 / `p-6` (24px) 앱 |
| 카드 간 간격 | `gap-6` (24px) ~ `gap-8` (32px) |
| 아이콘 → 텍스트 | `mb-5` ~ `mb-6` |
| 제목 → 설명 | `mb-2` ~ `mb-3` |
| 리스트 아이템 간격 | `space-y-5` |

---

## 8. Hover & Interaction States

### State Layer (MD3 핵심)

| 요소 | Rest | Hover | Active |
|------|------|-------|--------|
| Primary button | `--accent` bg | `--accent-hover` bg | `scale-95` |
| Inverted button | `bg-white` | `bg-gray-50` | `scale-95` |
| Landing card | `shadow-sm` | `shadow-md` + `scale(1.02)` | `scale(0.98)` |
| App card | `shadow-sm` | `translateY(-2px)` + `shadow-md` | — |
| Inner card | — | `shadow-sm` | `scale(0.98)` |

### Tailwind에서 CSS 변수 + opacity 사용 주의

```tsx
// ❌ 잘못됨 — Tailwind이 파싱 실패
className="hover:bg-[var(--accent)]/90"

// ✅ 올바른 방법 — style prop + onMouseEnter/Leave
style={{ backgroundColor: 'var(--accent)' }}
onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}

// ✅ 또는 Tailwind 컬러 리터럴 사용
className="bg-white hover:bg-gray-50"
```

---

## 9. Accessibility Checklist

- [ ] 텍스트 대비 4.5:1 이상 (text-primary on bg-primary: 통과)
- [ ] 모든 클릭 요소에 `cursor-pointer`
- [ ] `prefers-reduced-motion` 존재 (transform 비활성화)
- [ ] 장식 요소에 `aria-hidden="true"` + `pointer-events-none`
- [ ] 아이콘 전용 버튼에 `aria-label`
- [ ] `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` (키보드 포커스)
- [ ] 이미지에 alt 텍스트
- [ ] 모바일 375px, 768px, 1024px, 1440px 반응형 테스트

---

## 10. Anti-Patterns (금지)

| 금지 | 이유 | 올바른 방법 |
|------|------|-------------|
| 이모지를 UI 아이콘으로 사용 | 비전문적, 일관성 없음 | inline SVG (Lucide 스타일) |
| `#FFFFFF` 페이지 배경 | MD3 tonal surface 위반 | `--bg-primary` (#FAFAFA) |
| 보더로 카드 구분 (랜딩) | MD3는 tonal bg로 depth 표현 | `.landing-card` (bg-tertiary, no border) |
| `hover:bg-[var(...)]/N` | Tailwind 파싱 실패 | style prop + JS handler |
| 급격한 색상 변경 hover | MD3는 state layer(opacity) 사용 | shadow 상승 + subtle scale |
| `transform: translateY` hover (랜딩) | 레이아웃 시프트 유발 | `scale(1.02)` 사용 |
| 과도한 그림자 | MD3는 subtle elevation | progressive shadow 체계 사용 |
| 500ms 초과 transition | 느림, 답답함 | 최대 300ms |

---

## 11. Logo (/Ai 레터마크)

컨셉: ACA INFO → AI. "/" 슬래시 + 짧은 바 + "i" (줄기+도트) 조합.

### SVG (viewBox 0 0 32 32)

```svg
<path d="M3.5 27L11 5" strokeWidth="6.5" strokeLinecap="round" />   <!-- / 슬래시 -->
<path d="M16.5 27V17" strokeWidth="6.5" strokeLinecap="round" />    <!-- 짧은 바 -->
<path d="M26 27V14" strokeWidth="6.5" strokeLinecap="round" />      <!-- i 줄기 -->
<circle cx="26" cy="5.5" r="3.8" />                                  <!-- i 도트 -->
```

### 사용처별 크기

| 위치 | 렌더링 크기 | 색상 |
|------|-------------|------|
| Header | 28x28 | 그라디언트 `#1E3A8A → #3B82F6` |
| Favicon (`app/icon.svg`) | 32x32 | 그라디언트 `#1E3A8A → #3B82F6` |
| OG 이미지 | 40x40 | 단색 `#2563EB` |

### 규칙

- "i" 도트와 줄기 사이 최소 2px 간격 유지 (붙으면 "i"로 안 읽힘)
- 에셋 원본: `minor_docs/asset/` (PNG 1024x1024, OG 1200x630)

---

## 12. File Reference

| 파일 | 내용 |
|------|------|
| `app/globals.css` | Design tokens, 앱 컴포넌트 (.btn .card), 랜딩 유틸리티 |
| `app/[locale]/landing/LandingContent.tsx` | 랜딩 페이지 (MD3 레퍼런스 구현) |
| `app/[locale]/landing/AnimatedSection.tsx` | Framer Motion variants + MD3 easing |
| `components/Header.tsx` | 글로벌 헤더 (sticky, z-50, backdrop-blur) |
| `components/LocaleLink.tsx` | i18n 링크 래퍼 |
| `components/InsightChat.tsx` | AI 채팅 (디자인 토큰 적용) |
| `components/SeoBreadcrumb.tsx` | 브레드크럼 (SVG chevron) |
| `app/icon.svg` | 파비콘 (/Ai SVG) |
| `app/api/og/route.tsx` | OG 이미지 (Edge Runtime) |
| `lib/i18n.ts` | 번역 키 (이모지 금지) |

---

## 13. New Page Checklist

새 페이지/컴포넌트 작성 시:

1. **토큰 사용** — 하드코딩 색상 대신 CSS 변수
2. **카드 선택** — 앱 내부: `.card` / 랜딩/마케팅: `.landing-card`
3. **아이콘** — inline SVG, Lucide 스타일, 이모지 금지
4. **버튼** — 랜딩: pill (`rounded-full`) / 앱: `rounded-lg`
5. **배경 교차** — 섹션마다 bg-primary ↔ bg-tertiary 교대
6. **블러 도형** — 히어로/CTA급 섹션에 organic blur 1~3개
7. **애니메이션** — AnimatedSection 사용, MD3 easing, 300ms 이하
8. **호버** — progressive shadow + subtle scale, tactile active
9. **접근성** — cursor-pointer, aria-hidden, reduced-motion
10. **반응형** — mobile-first, grid collapse
