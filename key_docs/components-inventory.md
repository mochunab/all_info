# components-inventory.md - 컴포넌트 목록

> 프로젝트 내 모든 React 컴포넌트 분류별 정리

---

## 컴포넌트 요약

| 분류 | 수량 | 위치 |
|------|------|------|
| 페이지 컴포넌트 | 2개 | `app/` |
| 공통 UI 컴포넌트 | 8개 | `components/` |
| Barrel Export | 1개 | `components/index.ts` |
| **합계** | **10개** | |

---

## 1. 페이지 컴포넌트

### Home (메인 페이지)

| 항목 | 값 |
|------|-----|
| **파일** | `app/page.tsx` |
| **타입** | Client Component (`'use client'`) |
| **역할** | 메인 페이지 - 아티클 목록, 검색, 필터, 무한 스크롤 |
| **상태** | articles, isLoading, search, category, categories, page, hasMore, totalCount, lastUpdated, showToast, toastMessage |
| **API 호출** | GET /api/articles, GET /api/categories, POST /api/crawl/run |
| **자식 컴포넌트** | Header, FilterBar, ArticleGrid, Toast |

### AddSourcePage (소스 추가)

| 항목 | 값 |
|------|-----|
| **파일** | `app/sources/add/page.tsx` |
| **타입** | Client Component (`'use client'`) |
| **역할** | 크롤링 소스 URL 추가 페이지 |
| **상태** | category, categories, sources (SourceLink[]), isSaving, showToast |
| **API 호출** | GET /api/sources, GET /api/categories, POST /api/sources |
| **자식 컴포넌트** | Toast |

---

## 2. 공통 UI 컴포넌트

### Header

| 항목 | 값 |
|------|-----|
| **파일** | `components/Header.tsx` |
| **타입** | Client Component |
| **역할** | 상단 헤더 - 로고, 업데이트 뱃지, "자료 불러오기" 버튼 |
| **Props** | `lastUpdated?: string`, `onRefresh?: () => Promise<void>` |
| **특징** | sticky 헤더, backdrop-blur, 로고 폰트 Outfit |

### FilterBar

| 항목 | 값 |
|------|-----|
| **파일** | `components/FilterBar.tsx` |
| **타입** | Client Component |
| **역할** | 검색바 + 카테고리 드롭다운 + 소스 추가 버튼 + 결과 카운트 |
| **Props** | `search`, `onSearchChange`, `category`, `onCategoryChange`, `categories`, `onAddCategory?`, `totalCount?` |
| **특징** | 카테고리 드롭다운 (외부 클릭 닫기), 인라인 카테고리 추가 |

### ArticleGrid

| 항목 | 값 |
|------|-----|
| **파일** | `components/ArticleGrid.tsx` |
| **타입** | Client Component |
| **역할** | 아티클 카드 그리드 레이아웃 + 더 보기 버튼 + Empty State |
| **Props** | `articles: Article[]`, `isLoading?`, `hasMore?`, `onLoadMore?` |
| **특징** | 반응형 그리드 (1/2/3열), 로딩 시 Skeleton 6개 표시 |

### ArticleCard

| 항목 | 값 |
|------|-----|
| **파일** | `components/ArticleCard.tsx` |
| **타입** | Client Component |
| **역할** | 개별 아티클 카드 - 썸네일, 제목, AI 요약, 태그, 소스 뱃지 |
| **Props** | `article: Article` |
| **특징** | 이미지 프록시 (getProxiedImageUrl), 호버 시 외부 링크 아이콘, 소스별 브랜드 컬러 뱃지, lazy loading |

### Toast

| 항목 | 값 |
|------|-----|
| **파일** | `components/Toast.tsx` |
| **타입** | Client Component |
| **역할** | 하단 토스트 알림 (성공 메시지) |
| **Props** | `message: string`, `isVisible: boolean`, `onClose: () => void`, `duration?: number` |
| **특징** | 자동 닫힘 (기본 2200ms), 슬라이드 업 애니메이션 |

### Skeleton

| 항목 | 값 |
|------|-----|
| **파일** | `components/Skeleton.tsx` |
| **타입** | Server Component (기본 export) |
| **역할** | 아티클 카드 로딩 스켈레톤 |
| **Props** | 없음 |
| **특징** | shimmer 애니메이션, 카드 레이아웃 일치 |

### SkeletonGrid

| 항목 | 값 |
|------|-----|
| **파일** | `components/Skeleton.tsx` (named export) |
| **타입** | Server Component |
| **역할** | 스켈레톤 그리드 (여러 개) |
| **Props** | `count?: number` (기본 6) |
| **특징** | ArticleGrid와 동일한 그리드 레이아웃 |

### LanguageSwitcher

| 항목 | 값 |
|------|-----|
| **파일** | `components/LanguageSwitcher.tsx` |
| **타입** | Client Component |
| **역할** | 언어 선택 드롭다운 (한국어, English, 日本語, 中文) |
| **Props** | `currentLang: Language`, `onLanguageChange: (lang: Language) => void` |
| **특징** | localStorage에 `ih:language` 저장, 국기 이모지 표시, 외부 클릭 닫기 |

---

## 3. Barrel Export

```typescript
// components/index.ts
export { default as Header } from './Header';
export { default as ArticleCard } from './ArticleCard';
export { default as ArticleGrid } from './ArticleGrid';
export { default as FilterBar } from './FilterBar';
export { default as LanguageSwitcher } from './LanguageSwitcher';
export { default as Skeleton, SkeletonGrid } from './Skeleton';
export { default as Toast } from './Toast';
```

**사용법**:
```typescript
import { Header, FilterBar, ArticleGrid, Toast } from '@/components';
```

---

## 4. 컴포넌트 의존 관계

```
page.tsx (Home)
  ├── Header
  │     └── LanguageSwitcher
  ├── FilterBar
  ├── ArticleGrid
  │     ├── ArticleCard (N개)
  │     └── Skeleton (로딩 시)
  └── Toast

sources/add/page.tsx (AddSourcePage)
  ├── LanguageSwitcher
  └── Toast
```

---

## 5. 컴포넌트 추가 가이드

새 컴포넌트를 추가할 때:

1. `components/{Name}.tsx` 파일 생성 (PascalCase)
2. Client Component면 `'use client'` 맨 위 선언
3. Props를 interface가 아닌 **type** 또는 **inline interface**로 정의
4. `export default function Name() {}` 패턴 사용
5. `components/index.ts`에 barrel export 추가
6. 이 문서에 컴포넌트 정보 추가

```typescript
// components/NewComponent.tsx
'use client';

interface NewComponentProps {
  title: string;
  onClick?: () => void;
}

export default function NewComponent({ title, onClick }: NewComponentProps) {
  return <div onClick={onClick}>{title}</div>;
}

// components/index.ts에 추가
export { default as NewComponent } from './NewComponent';
```
