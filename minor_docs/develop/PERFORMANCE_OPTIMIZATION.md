# 페이지 로딩 최적화 가이드

> 적용 스택: Next.js 14 (App Router) + Supabase + Vercel
> 최종 업데이트: 2026-03-12

---

## 문제 진단 체크리스트

새 페이지가 느릴 때 아래 순서로 확인:

1. **미들웨어** — 매 요청마다 네트워크 호출하는 코드가 있는가?
2. **서버 컴포넌트** — 순차 await 체인인가, 캐시 없이 매번 DB 쿼리하는가?
3. **클라이언트 컴포넌트** — auth/API 완료까지 빈 화면인가, 캐시 데이터 활용하는가?
4. **Next.js 설정** — `staleTimes.dynamic`이 0인가?

---

## 1. 미들웨어 경량화

### 원칙
미들웨어는 **모든 페이지 네비게이션에 실행**된다. 여기에 네트워크 호출이 있으면 모든 페이지가 느려진다.

### 금지
```typescript
// middleware.ts — 절대 하지 말 것
await supabase.auth.getUser();   // Supabase로 네트워크 호출 (200-500ms)
await fetch('...');               // 외부 API 호출
```

### 권장
```typescript
// middleware.ts — 순수 로직만
export function middleware(request: NextRequest) {
  // i18n 라우팅, CORS, rate limit 등 순수 로직만
  // 보안 헤더는 next.config.mjs headers()에서 처리
  const response = NextResponse.next();
  response.headers.set('x-locale', locale);
  return response;
}
```

### 적용한 것
- `auth.getUser()` 제거 → auth는 클라이언트 AuthProvider에서 처리
- `@supabase/ssr` import 자체 제거 → 번들 크기도 절약
- 중복 보안 헤더 제거 → next.config.mjs에서 이미 설정

---

## 2. 서버 컴포넌트 인메모리 캐시

### 원칙
서버 컴포넌트는 네비게이션마다 실행된다. 자주 접근하는 페이지는 DB 결과를 인메모리 캐시한다.

### 패턴
```typescript
// app/[locale]/page.tsx
import { getCache, setCache } from '@/lib/cache';

const CACHE_KEY = 'ssr:home';
const CACHE_TTL = 30_000; // 30초

export default async function Page() {
  // 1. 캐시 히트 → DB 스킵, 즉시 렌더
  const cached = getCache<PageData>(CACHE_KEY);
  if (cached) {
    return <ClientComponent initialData={cached} />;
  }

  // 2. 캐시 미스 → DB 조회 + 캐시 저장
  const data = await fetchFromDB();
  setCache(CACHE_KEY, data, CACHE_TTL);

  return <ClientComponent initialData={data} />;
}
```

### 무효화 연동 필수
데이터 변경 API에서 관련 캐시를 무효화:
```typescript
// app/api/crawl/run/route.ts
invalidateCacheByPrefix(CACHE_KEYS.ARTICLES_PREFIX);
invalidateCache(CACHE_KEYS.SSR_HOME);
```

### TTL 기준
| 데이터 | TTL | 이유 |
|--------|-----|------|
| 홈피드 SSR | 30초 | 크롤링 시에만 변경 |
| 카테고리 API | 5분 | 거의 안 바뀜 |
| 아티클 API | 30초 | 크롤링 시에만 변경 |

---

## 3. 클라이언트 캐시 우선 렌더

### 원칙
캐시 데이터가 있으면 **auth 체크, API 응답을 기다리지 않고 즉시 렌더**한다. 블로킹 조건(auth 등)에 캐시 바이패스를 추가한다.

### Before (느림)
```typescript
// auth 완료까지 무조건 스켈레톤
if (!authChecked) {
  return <Skeleton />;
}
```

### After (빠름)
```typescript
// 캐시 없을 때만 스켈레톤
if (!authChecked && !hasCachedData) {
  return <Skeleton />;
}
// 캐시 있으면 auth 대기 없이 바로 메인 UI 렌더
```

### State 초기값에 캐시 로드
```typescript
// 컴포넌트 외부에 캐시 로드 함수
function loadCachedState() {
  try {
    const cached = sessionStorage.getItem('ih:my:articles');
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      return { articles: data.articles, hasCachedData: true, ... };
    }
  } catch { /* ignore */ }
  return { articles: [], hasCachedData: false, ... };
}

export default function MyPage() {
  // useState 초기값으로 캐시 로드 → 첫 렌더부터 데이터 표시
  const [cached] = useState(loadCachedState);
  const [articles, setArticles] = useState(cached.articles);
  const [isLoading, setIsLoading] = useState(!cached.hasCachedData);
  ...
}
```

### 클라이언트 캐시 레이어 순서
```
1. useState 초기값 (in-memory, 같은 세션 내 즉시)
2. useRef Map (카테고리별 아티클 캐시, 탭 전환 즉시)
3. sessionStorage (탭 내 네비게이션 간 유지, 5분 TTL)
4. localStorage (영구 저장, 사용자 설정값)
5. API 호출 (stale-while-revalidate)
```

---

## 4. Next.js 클라이언트 라우터 캐시

### 원칙
`staleTimes.dynamic: 0`이면 매 네비게이션마다 서버에서 페이지를 다시 가져온다. 30초로 설정하면 30초 내 재방문은 **서버 요청 없이 즉시 전환**.

### 설정
```javascript
// next.config.mjs
experimental: {
  staleTimes: {
    dynamic: 30,   // 동적 페이지 30초 캐시
    static: 180,   // 정적 페이지 3분 캐시
  },
},
```

### 체감 효과
- 홈 → 마이피드 → 홈: 서버 요청 0회, 즉시 전환
- 사용자가 느끼는 "메뉴 누를 때마다 로딩" 문제 해결

---

## 5. 비동기 작업 병렬화

### 원칙
독립적인 비동기 작업은 반드시 `Promise.all`로 병렬 실행.

### Before (느림)
```typescript
const masterId = await getMasterUserId();     // 200ms
const authClient = await createClient();       // 100ms
const { data: { user } } = await authClient.auth.getUser(); // 300ms
const [sources, categories] = await Promise.all([...]);       // 200ms
// 총: 800ms (순차)
```

### After (빠름)
```typescript
const [masterId, readOnly, sources, categories] = await Promise.all([
  getMasterUserId(),
  createClient().then(c => c.auth.getUser().then(...)),
  supabase.from('crawl_sources').select('*')...,
  supabase.from('categories').select('*')...,
]);
// 총: ~300ms (병렬, 가장 느린 것 기준)
```

---

## 6. Provider 값 재활용

### 원칙
AuthProvider 등 전역 Provider에서 이미 제공하는 값을 컴포넌트에서 별도 DB 쿼리하지 않는다.

### Before
```typescript
// HomeFeed.tsx — 불필요한 DB 쿼리
const { user } = useAuth();
useEffect(() => {
  supabase.from('users').select('role').eq('id', user.id).single()
    .then(({ data }) => setIsNonMaster(data.role !== 'master'));
}, [user]);
```

### After
```typescript
// HomeFeed.tsx — Provider 값 재활용
const { user, isMaster } = useAuth();
const isNonMasterUser = !!user && !isMaster;
```

---

## 최적화 체크리스트

### 인증 & 세션
- 페이지 이동 간에 세션 정보를 확인하기 위해 Supabase의 Auth State Change 리스너 사용
- 미들웨어에서 `auth.getUser()` 호출 금지 — 모든 네비게이션에 200-500ms 추가됨
- AuthProvider의 `isMaster`, `user` 등 이미 제공되는 값을 컴포넌트에서 중복 쿼리하지 않기

### 캐시 레이어
- 반복 호출되거나 비용이 큰 데이터는 In-Memory → sessionStorage → localStorage → Cache API → HTTP/CDN Cache 순으로 캐시 레이어를 쌓고, 변경 주기에 맞춰 TTL·버저닝·무효화를 함께 정의
- 서버 컴포넌트: `getCache/setCache` 인메모리 캐시 (TTL 30초) + 데이터 변경 API에서 `invalidateCache()` 연동
- 클라이언트 컴포넌트: `useState` 초기값에 sessionStorage 캐시 로드 → 첫 렌더부터 데이터 표시
- Next.js `staleTimes.dynamic: 30` 설정으로 클라이언트 라우터 캐시 활성화 (0이면 매번 서버 fetch)

### 렌더링 & 로딩
- 로딩이 느릴 경우 캐시가 있으면 먼저 렌더링, API 호출 병렬화
- auth/API 블로킹 가드에 캐시 바이패스 조건 추가 (`!authChecked && !hasCachedData`)
- 서버 컴포넌트에서 순차 await 체인 → `Promise.all` 병렬화

### 이미지
- 이미지 로딩 방식 개선을 위해 CDN + HTTP 캐시를 기본으로, WebP 변환 → Progressive Loading → 우선순위 프리로딩(Featured/다음 5개) → 백그라운드 배치 프리페칭 순으로 고도화

### 새 페이지 개발 시
- [ ] 서버 컴포넌트에 인메모리 캐시 필요한가? (자주 접근 + DB 쿼리)
- [ ] 서버 컴포넌트에서 순차 await 있으면 병렬화 가능한가?
- [ ] 클라이언트 컴포넌트에서 sessionStorage 캐시 → state 초기값 패턴 적용했나?
- [ ] auth/API 블로킹 가드에 캐시 바이패스 조건 추가했나?
- [ ] 데이터 변경 시 관련 캐시 무효화 연동했나?
- [ ] Provider에서 이미 제공하는 값을 중복 쿼리하지 않는가?
