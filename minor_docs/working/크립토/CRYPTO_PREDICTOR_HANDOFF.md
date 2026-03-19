# 밈코인 예측기 — 작업 인계 문서

> 최종 작업일: 2026-03-20
> 경로: `/{locale}/crypto` (Header "밈코인 예측기" 메뉴 **master 계정만 노출**, URL 직접 접근은 누구나 가능)
> 프로덕션: https://aca-info.com/en/crypto

---

## 프로젝트 배경 및 방향성

### 왜 만드는가
Insight Hub의 크롤링 인프라(Reddit → DB → AI 분석)를 활용해 밈코인 시장의 **"왜 이 코인이 뜨는가"를 설명 가능한 시그널로 제공**하는 기능. 단순 점수가 아닌 근거 체인(Explainable Signal)이 핵심 차별점.

### 전략적 위치
- **현재**: Header 메뉴는 master 계정 전용, URL 직접 접근은 공개 (Discord 커뮤니티 파트너십 피칭용 데모로 활용)
- **다음 단계**: Discord 봇 연동 → 커뮤니티 데이터 수집 확대 → 크립토 전용 플랫폼 피벗
- 기존 Insight Hub 인프라 최대 활용 — 새 크롤러 엔진 없이 Reddit API + 기존 AI 파이프라인(Gemini Edge Function + 배치 패턴) 재활용

### 핵심 기능 4개
1. **Reddit 센티먼트 추적** — 10개 서브레딧 × 30분 크롤링 → 코인 멘션 추출 → LLM 센티먼트 분석
2. **가중 시그널 스코어** — 언급 속도 × 25% + 센티먼트 × 30% + 트렌드 × 15% + 참여도 × 20% + FOMO × 10% → 0~100점 + signal_label
3. **지식그래프** — 코인/인플루언서/내러티브 엔티티 + 상관관계 엣지 → "DOGE가 뜨는 이유"를 연결 관계로 설명
4. **Signal Network 시각화** — Force-directed 그래프 + AI 키워드 클라우드 (react-force-graph-2d)

---

## 현재 상태

### 완료된 것

**Phase 1 — Reddit 크롤링 + 코인 언급 추적**
1. **DB 마이그레이션** — 6개 테이블 생성 (crypto_posts, mentions, sentiments, signals, entities, relations) + RLS + updated_at 트리거
2. **Reddit OAuth2** — client_credentials grant, in-memory 캐시 55분 TTL
3. **Reddit 크롤러** — 10개 서브레딧 × hot/new × 최대 3페이지, 서브레딧 간 1초 딜레이, minScore 필터
4. **코인 멘션 추출** — 3단계 패턴 매칭: $TICKER/#TICKER(고신뢰) → 풀네임/alias(중신뢰) → ALL-CAPS(저신뢰, 블랙리스트 필터)
5. **코인 목록** — ~~144개 하드코딩~~ → DB 기반 (`crypto_coins` 테이블, CoinGecko 동기화 66개) + 하드코딩 fallback
6. **Cron 엔드포인트** — `/api/crypto/crawl` (Bearer auth, 300s maxDuration, 30분 간격)
7. **게시물 조회 API** — `/api/crypto/posts` (coin/subreddit 필터, 페이지네이션)

**Phase 2 — 센티먼트 분석 + 시그널 생성**
8. **센티먼트 Edge Function** — `analyze-crypto-sentiment` (Gemini 2.5 Flash Lite, JSON 출력: score/label/confidence/fomo/fud/reasoning)
9. **배치 센티먼트** — 5개 동시 처리, 3회 재시도 (exponential backoff), Edge Function 우선
10. **시그널 생성** — 4개 시간 윈도우(1h/6h/24h/7d), 코인별 가중 스코어 → signal_label (strong_buy~strong_sell)
11. **시그널 조회 API** — `/api/crypto/signals` (window/coin 필터, 최신 computed_at 자동 선택)

**Phase 3 — 지식그래프**
12. **코인 엔티티 자동 생성** — 멘션된 코인 → crypto_entities upsert
13. **인플루언서 감지** — 7일간 고점수(50+) 게시물 3개 이상 작성자
14. **코인 상관관계** — 같은 게시물에 3회+ 동시 언급 → correlates_with 관계
15. **인플루언서→코인 관계** — 고점수(100+) 게시물에서 코인 언급 → mentions 관계
16. **엔티티/관계 조회 API** — `/api/crypto/coins` (검색, 관계 포함, 시그널 JOIN)

**Phase 4 — 대시보드 UI**
17. **서버 페이지** — ~~master 전용~~ → 공개 접근 (인증 불필요), 초기 시그널 SSR
18. **대시보드** — 코인카드 그리드(반응형 3열) + 시그널 타임라인(사이드바) + 검색 + 시간 윈도우 토글
19. **CoinCard** — 심볼, 멘션 수, velocity %, signal_label 뱃지, 센티먼트 게이지, score/engagement
20. **SentimentGauge** — -1~1 바 시각화 (bullish=green, neutral=yellow, bearish=red)
21. **SignalTimeline** — Trending(velocity>0.5 & score≥50) 우선 표시, 최대 10개
22. **CoinDetail 모달** — 코인 상세 (스코어, 멘션수, 센티먼트, 관련 엔티티, 관련 게시물 10개)
23. **TimeWindowSelector** — 1h/6h/24h/7d 토글 버튼
24. **AI 채팅 API** — `/api/crypto/chat` (시그널 컨텍스트 주입, chat-insight Edge Function 활용)
25. **Header 수정** — NAV_ITEMS에 밈코인 예측기 추가 (**master 계정만 노출**, i18n 적용)
26. **GitHub Actions Cron** — `.github/workflows/crypto-crawl.yml` (*/30 * * * *, Hobby 플랜이라 vercel.json 대신 GitHub Actions 사용)
27. **i18n** — 크립토 번역 키 22개 × 5개 언어 (ko/en/vi/zh/ja) — header.crypto 포함

**Phase 5 — Signal Network 그래프 시각화 (2026-03-15)**
28. **SignalNetwork 컴포넌트** — `react-force-graph-2d` 기반 인터랙티브 지식그래프
    - 코인 = 원형 노드 (색상=센티먼트, 크기=멘션수)
    - 인플루언서 = 다이아몬드 노드 (보라색)
    - 엣지 = correlates_with (파란) / mentions (보라)
    - 필터 칩: 상위 8개 코인 클릭 시 해당 코인 이웃만 하이라이트
    - 라이트/다크 테마 자동 감지 (`useIsDark` 훅)
29. **키워드 클라우드** — 코인 선택 시 AI 추출 key_phrases 표시 (크기=빈도)
    - 하단에 Sentiment/FOMO 수치
30. **Network API** — `/api/crypto/network` (nodes + links + keywords per coin)
    - crypto_entities → nodes, crypto_relations → links
    - crypto_mentions → crypto_sentiments → key_phrases 집계

**Phase 6 — Threads 연동 (2026-03-15, 코드 완료 / 토큰 미발급)**
31. **Threads 크롤러** — Meta Threads API 키워드 검색 (`keyword_search`) 기반 크립토 게시물 수집
    - `lib/crypto/threads-crawler.ts` — 10개 키워드 × RECENT 검색, since 파라미터로 중복 최소화
    - `types/crypto.ts` — `CryptoSource`에 `'threads'` 추가 + `ThreadsSearchPost`, `ThreadsSearchResponse`, `ThreadsSearchKeyword` 타입
    - `lib/crypto/config.ts` — `THREADS_SEARCH_KEYWORDS` (10개), `THREADS_API_BASE`, rate limit 상수
    - `app/api/crypto/crawl/route.ts` — Phase 1c: Threads 크롤링 (`THREADS_ACCESS_TOKEN` 조건부)
    - `lib/crypto/batch-sentiment.ts` — `source` 필드 기반 Edge Function 라우팅 (threads → `analyze-threads-sentiment`)
    - `lib/i18n.ts` — subtitle 5개 언어 "Reddit · Threads · Telegram" 으로 업데이트
32. **Threads 전용 센티먼트 Edge Function** — `analyze-threads-sentiment` (Gemini 2.5 Flash Lite)
    - Threads 특성 반영: 500자 제한, 이모지 해석(🚀=강세, 📉=약세), 해시태그/멘션, NFA/DYOR 면책 표현
33. **Meta App 설정 완료** — `acainfo` 앱, Threads API use case, `threads_basic` + `threads_keyword_search` 테스트 준비 완료
    - Threads 앱 ID: `744117611965629`
    - 리디렉션 콜백 URL: `https://localhost/` 설정 완료

**Phase 7 — 타임아웃 방지 + 시그널 보정 (2026-03-17)**
34. **3-Phase 파이프라인 분리** — 단일 호출 전체 실행 → crawl/sentiment/signals 3개 독립 호출
    - 각 페이즈 완료 후 fire-and-forget으로 다음 페이즈 트리거
    - 센티먼트: 200초 시간 예산, 미완료 시 자기 재호출
    - Vercel 300초 타임아웃 근본 해결
35. **시그널 점수 멘션 신뢰도 감쇠** — `mentionConfidence = clamp(mentions / 5, 0, 1)`
    - 1회 언급 = ×0.2, 3회 = ×0.6, 5회+ = ×1.0
    - 신규 코인(이전 데이터 없음) velocity = 0 (만점 방지)
36. **Telegram fetch 타임아웃** — 개별 채널 fetch에 15초 AbortController 추가

**Phase 8 — CoinGecko 실시간 가격 연동 + 코인 목록 DB화 (2026-03-20)**
37. **DB 마이그레이션 `021_crypto_prices.sql`** — 2개 테이블 추가
    - `crypto_coins`: CoinGecko 코인 마스터 (coingecko_id UNIQUE, symbol, name, image_url, market_cap_rank, is_active)
    - `crypto_prices`: 가격 스냅샷 (coingecko_id FK, price_usd, market_cap, volume_24h, price_change_24h, price_change_pct_24h, circulating_supply, fetched_at)
38. **CoinGecko 코인 동기화** — `lib/crypto/coin-sync.ts`
    - CoinGecko `/coins/list` (15,000+ 코인) → 기존 COIN_LIST와 심볼+이름 매칭 → `crypto_coins` upsert
    - 66개 코인 매칭 성공 (COIN_LIST 73개 중 symbol 중복 제거 후)
39. **CoinGecko 가격 수집** — `lib/crypto/price-fetcher.ts`
    - `/coins/markets` API → active 코인만 조회 (250개/페이지, 현재 66개 = 단일 호출)
    - `current_price == null` 코인 자동 스킵 (가격 미제공 코인 대응)
    - `crypto_coins`에 image_url, market_cap_rank 메타데이터도 함께 업데이트
40. **Phase 4 (prices) 파이프라인 추가** — `app/api/crypto/crawl/route.ts`
    - signals Phase 완료 후 자동 트리거: crawl → sentiment → signals → **prices**
    - `parsePhase`가 URL query param도 지원 (Vercel cron GET 대응)
    - 코인 동기화 → 가격 수집 순차 실행
41. **30분 주기 가격 cron** — `vercel.json`에 `*/30 * * * *` → `/api/crypto/crawl?phase=prices`
    - CoinGecko 무료 한도 (10-30 req/min) 내에서 안전 (2 API 호출/30분)
    - 선택적 `COINGECKO_API_KEY` 지원 (x-cg-demo-key 헤더)
42. **코인 멘션 추출 DB 전환** — `lib/crypto/coin-extractor.ts`
    - 기존: 하드코딩 `COIN_LIST`/`COIN_MAP` 직접 참조
    - 변경: `extractCoinMentionsFromDB(title, body, supabase)` — DB `crypto_coins` 조회 (1시간 인메모리 캐시)
    - DB 조회 실패 시 하드코딩 fallback 유지 (무중단)
    - 3개 크롤러(reddit, telegram, threads) 모두 `extractCoinMentionsFromDB`로 전환
43. **가격 조회 API** — `app/api/crypto/prices/route.ts`
    - GET, coin/limit 필터, 최신 fetched_at 기준 자동 선택
    - `crypto_coins` inner join (symbol, name, image_url, market_cap_rank)
44. **CoinCard UI 가격 표시** — `components/crypto/CoinCard.tsx`
    - 코인 아이콘 (CoinGecko image_url), 현재 가격 (formatPrice: $1+ → 소수점2, $0.01+ → 4자리, 마이크로캡 → 8자리)
    - 24h 변동률 (초록/빨강 색상)
45. **CryptoDashboard 가격 연동** — `app/[locale]/crypto/CryptoDashboard.tsx`
    - `/api/crypto/prices` fetch → priceMap(symbol → price/change/image) 구성
    - CoinCard에 price prop 전달

### 미완료 (To-Do)

#### 우선순위 높음 (기능 동작에 필수)
1. ~~**환경변수 설정**~~ — ✅ Reddit API Access Request 제출 완료 (2026-03-15), 승인 대기 중. 승인 후 `.env.local` + Vercel에 `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` 추가
2. ~~**DB 마이그레이션 적용**~~ — ✅ `018_crypto_tables.sql` 적용 완료 (2026-03-15, `supabase db push`)
3. ~~**Edge Function 배포**~~ — ✅ `analyze-crypto-sentiment` 배포 완료 (2026-03-15)
4. **센티먼트 배치 쿼리 개선** — 현재 NOT IN 서브쿼리 방식이 Supabase JS에서 직접 지원 안 됨 → RPC 함수(`get_posts_without_sentiment`) 생성 또는 LEFT JOIN 방식으로 전환 필요
5. **첫 크롤링 테스트** — Reddit API 승인 후 `curl -X POST https://aca-info.com/api/crypto/crawl -H "Authorization: Bearer $CRON_SECRET"` 실행 후 DB 데이터 확인
6. ~~**서브레딧 목록 확장**~~ — ✅ config.ts에 5개 추가 완료 (2026-03-15) → 총 10개
7. **Threads 토큰 발급** — Threads 테스터 등록 + OAuth 인증 코드 → short-lived token → long-lived token 교환 → `THREADS_ACCESS_TOKEN` 환경변수 설정. 아래 "Threads 토큰 발급" 섹션 참조
8. **analyze-threads-sentiment Edge Function 배포** — `supabase functions deploy analyze-threads-sentiment --project-ref tcpvxihjswauwrmcxhhh`

#### 우선순위 중간 (기능 완성도)
9. **Discord 봇 연동** — Discord Bot API + discord.js로 크립토 서버 메시지 수집. 봇 초대 필수 (서버 관리자 협조 필요). **DM 피칭 4개 서버 발송 완료 (2026-03-15), 응답 대기 중.**
10. ~~**4chan /biz/ 크롤러**~~ — 검토 후 보류. 크립토 비율 ~28%, 나머지 노이즈. 익명/score 없음. **Threads로 대체** (키워드 검색, 참여도 지표, 인플루언서 감지 가능)
11. **내러티브 엔티티 자동 생성** — 현재 coin/influencer만 자동 생성. LLM이 "AI tokens", "dog coins" 등 내러티브를 감지하여 entity_type='narrative' 생성 + part_of 관계 추가
12. **시계열 트렌드 계산** — `signal-generator.ts`의 `sentiment_trend` 현재 0 하드코딩 → 이전 윈도우 대비 센티먼트 변화율 계산
13. **CoinDetail 차트** — 시간별 센티먼트/멘션 변화 차트 (recharts 또는 lightweight-charts)
14. **AI 채팅 개선** — 현재 chat-insight Edge Function에 systemPromptOverride 전달 → 크립토 전용 Edge Function 분리 고려

#### 우선순위 낮음 (확장)
15. ~~**가격 데이터 연동**~~ — ✅ CoinGecko Free API 연동 완료 (2026-03-20). 30분 cron + Phase 4 파이프라인. 66개 코인 가격/시총/24h변동률 수집. CoinCard UI 반영.
16. **알림 시스템** — trending 알림 (velocity > 2.0 AND score ≥ 60) → 이메일/푸시
17. **백테스팅** — 과거 시그널 대비 실제 가격 변동 검증
18. **크립토 전용 플랫폼 분리** — 피벗 시 독립 도메인/앱으로 분리

---

## 개발 플로우

### 데이터 파이프라인 (3-Phase 분리, 2026-03-17)

> **타임아웃 방지**: 단일 호출에서 전체 파이프라인 실행 시 Vercel 300초 제한 초과 → 3개 독립 HTTP 호출로 분리.
> 각 페이즈 완료 후 fire-and-forget으로 다음 페이즈 트리거.

```
GitHub Actions Cron (30분마다) → POST /api/crypto/crawl {phase: "crawl"}

Phase 1 (crawl): 크롤링만 — 완료 후 자동으로 Phase 2 트리거
  ├─ Reddit (REDDIT_CLIENT_ID 필요, 승인 대기 중)
  │   → OAuth2 토큰 획득/갱신 (55분 캐시)
  │   → 서브레딧별 hot + new fetch (limit=100, 최대 3페이지)
  │   → crypto_posts upsert → coin-extractor → crypto_mentions
  │
  ├─ Telegram (API 키 불필요, ✅ 동작 중)
  │   → 11개 공개 채널 웹 프리뷰 스크래핑 (t.me/s/, 15초 fetch 타임아웃)
  │   → Cheerio HTML 파싱 → crypto_posts upsert → crypto_mentions
  │
  └─ Threads (THREADS_ACCESS_TOKEN 필요, 토큰 미발급)
      → 10개 키워드 검색 → crypto_posts upsert → crypto_mentions
  ↓ fire-and-forget: {phase: "sentiment"}

Phase 2 (sentiment): 센티먼트 분석 — 미완료 시 자기 재호출, 완료 시 Phase 3 트리거
  → crypto_sentiments 없는 crypto_posts 조회 (최대 30건)
  → analyze-crypto-sentiment Edge Function (Gemini 2.5 Flash Lite)
  → 5개 동시 처리, 3회 재시도, 200초 시간 예산
  → 미완료 시 자기 재호출 {phase: "sentiment"}, 완료 시 ↓
  ↓ fire-and-forget: {phase: "signals"}

Phase 3 (signals): 시그널 + 지식그래프
  → 시간 윈도우별(1h/6h/24h/7d) 시그널 생성 → crypto_signals upsert
  → 코인/인플루언서 엔티티 upsert
  → 코인 상관관계 + 인플루언서→코인 관계 업데이트
  ↓ fire-and-forget: {phase: "prices"}

Phase 4 (prices): CoinGecko 코인 동기화 + 가격 수집 (2026-03-20)
  → syncCoinList: CoinGecko /coins/list → crypto_coins upsert (66개)
  → fetchAndStorePrices: /coins/markets → crypto_prices insert (65개, null 가격 스킵)
  → crypto_coins에 image_url, market_cap_rank 메타데이터 업데이트

별도 Cron (30분마다): /api/crypto/crawl?phase=prices
  → 파이프라인 전체를 안 거치고 가격만 독립 갱신
```

### 프론트엔드 플로우
```
Header "밈코인 예측기" (master 계정만 노출, i18n 적용)
  → /{locale}/crypto 접근 (URL 직접 접근은 인증 불필요)
  → 서버: 초기 시그널 SSR
  → CryptoDashboard (클라이언트, language prop)
      ├─ TimeWindowSelector (1h/6h/24h/7d, i18n)
      ├─ 검색 input (i18n placeholder)
      ├─ SignalNetwork (Force Graph + Keyword Cloud)
      │   ├─ 필터 칩 (상위 8개 코인)
      │   ├─ Force-directed 그래프 (코인/인플루언서 노드 + 관계 엣지)
      │   └─ 키워드 클라우드 (선택된 코인의 AI 추출 키워드)
      ├─ CoinCard Grid (반응형 3열, i18n)
      │   └─ 클릭 → CoinDetail 모달
      │       ├─ 스코어, 멘션, 센티먼트 게이지
      │       ├─ 관련 엔티티 태그
      │       └─ 관련 게시물 10개 (Reddit 링크)
      └─ SignalTimeline 사이드바 (i18n)
          └─ Trending / Top Signals
```

---

## 파일 구조

### 새로 생성한 파일
```
lib/crypto/
  config.ts                 서브레딧 10개 + 텔레그램 25개 + Threads 키워드 10개, 코인 목록(73개 하드코딩 fallback), 상수/가중치
  coin-sync.ts              CoinGecko /coins/list → crypto_coins 동기화 (1일 1회 or Phase 4)
  price-fetcher.ts          CoinGecko /coins/markets → crypto_prices 가격 스냅샷 (30분 cron)
  reddit-auth.ts            Reddit OAuth2 토큰 관리 (cache.ts 활용)
  reddit-crawler.ts         Reddit API 크롤러 (hot+new, 중복 제거, upsert)
  telegram-crawler.ts       Telegram 웹 프리뷰 스크래핑 (t.me/s/, Cheerio 파싱)
  threads-crawler.ts        Threads API 키워드 검색 크롤러 (10개 키워드, since 필터)
  coin-extractor.ts         3단계 코인 멘션 추출 ($TICKER, 풀네임, ALL-CAPS) — DB 기반 (extractCoinMentionsFromDB) + 하드코딩 fallback
  batch-sentiment.ts        배치 센티먼트 처리 (소스별 Edge Function 라우팅, 5 concurrent)
  signal-generator.ts       시간 윈도우별 가중 시그널 계산
  knowledge-graph.ts        엔티티/관계 자동 생성 (coin, influencer, correlates_with)

types/crypto.ts             크립토 전체 TypeScript 타입 (DB Row, API, Reddit, Telegram, Threads, Signal)

supabase/migrations/018_crypto_tables.sql    6개 테이블 + RLS + 트리거
supabase/migrations/021_crypto_prices.sql    crypto_coins + crypto_prices 테이블 + RLS
supabase/functions/analyze-crypto-sentiment/index.ts   Reddit/Telegram 센티먼트 분석 Edge Function
supabase/functions/analyze-threads-sentiment/index.ts  Threads 전용 센티먼트 분석 Edge Function (미배포)

app/api/crypto/
  crawl/route.ts            Cron 크롤링 엔드포인트 (Bearer, 300s, GET+POST)
  posts/route.ts            게시물 조회 API (coin/subreddit 필터)
  signals/route.ts          시그널 조회 API (window/coin 필터)
  coins/route.ts            코인 엔티티 + 관계 + 시그널 조회 API
  network/route.ts          그래프 데이터 API (nodes + links + keywords)
  prices/route.ts           코인 가격 조회 API (coin/limit 필터, 최신 fetched_at)
  chat/route.ts             AI 채팅 API (시그널 컨텍스트 주입)

app/[locale]/crypto/
  page.tsx                  서버 컴포넌트 (공개 접근, 초기 시그널 fetch)
  CryptoDashboard.tsx       메인 클라이언트 대시보드 (language prop, i18n)

components/crypto/
  CoinCard.tsx              코인 카드 (심볼, 시그널 뱃지, 센티먼트 게이지, i18n)
  SentimentGauge.tsx        센티먼트 바 시각화 (-1~1)
  SignalTimeline.tsx        Trending / Top Signals 사이드바 (i18n)
  SignalNetwork.tsx         Force Graph + Keyword Cloud (react-force-graph-2d, 테마 대응)
  CoinDetail.tsx            코인 상세 모달 (차트, 관계, 게시물, i18n)
  TimeWindowSelector.tsx    1h/6h/24h/7d 토글 (i18n)
```

### GitHub Actions
```
.github/workflows/
  crypto-crawl.yml          30분마다 /api/crypto/crawl POST 호출 (Hobby 플랜 대응)
```

### 수정한 기존 파일
```
components/Header.tsx       NAV_ITEMS에 밈코인 예측기 추가 (master 계정만, isMaster 조건, i18n: header.crypto)
vercel.json                 /api/crypto/crawl maxDuration 300 + */30 cron (phase=prices)
.github/workflows/crypto-crawl.yml   30분마다 /api/crypto/crawl POST 호출 (Hobby 플랜 대응)
lib/i18n.ts                 crypto.* 번역 키 22개 × 5개 언어 + subtitle "Reddit · Threads · Telegram" 반영
package.json                react-force-graph-2d → react-force-graph-3d 의존성
types/crypto.ts             CryptoCoin, CryptoPrice, CryptoPricesResponse 타입 추가 (2026-03-20)
components/crypto/CoinCard.tsx        가격/변동률/코인아이콘 표시 (2026-03-20)
components/crypto/SignalNetwork.tsx    2D→3D 전환 + d3 force 튜닝 (center/charge/link 강화)
app/[locale]/crypto/CryptoDashboard.tsx  가격 fetch + priceMap 구성 + CoinCard에 price prop 전달
lib/crypto/coin-extractor.ts          extractCoinMentionsFromDB (DB 기반 + 1시간 캐시 + fallback)
lib/crypto/reddit-crawler.ts          extractCoinMentionsFromDB로 전환
lib/crypto/telegram-crawler.ts        extractCoinMentionsFromDB로 전환
lib/crypto/threads-crawler.ts         extractCoinMentionsFromDB로 전환
app/api/crypto/crawl/route.ts         Phase 4 (prices) 추가 + parsePhase query param 지원
```

---

## Edge Functions

| 함수 | 모델 | 용도 | 배포 완료 |
|------|------|------|----------|
| `analyze-crypto-sentiment` | `gemini-2.5-flash-lite` | Reddit/Telegram 게시물 센티먼트 분석 (score/label/fomo/fud/reasoning) | ✅ 배포 완료 (2026-03-15) |
| `analyze-threads-sentiment` | `gemini-2.5-flash-lite` | Threads 전용 센티먼트 분석 (이모지 해석, 500자 최적화, NFA/DYOR 처리) | **미배포** (토큰 발급 후 배포) |

`google_API_KEY` secret 사용 (기존 Edge Function과 공유, Dashboard에 이미 등록됨).

### 배포 명령어
```bash
supabase functions deploy analyze-crypto-sentiment --project-ref tcpvxihjswauwrmcxhhh
```

---

## 환경변수

| 변수 | 위치 | 용도 | 상태 |
|------|------|------|------|
| `REDDIT_CLIENT_ID` | `.env.local` + Vercel | Reddit OAuth2 클라이언트 ID | **미설정** (API Access Request 승인 대기 중) |
| `REDDIT_CLIENT_SECRET` | `.env.local` + Vercel | Reddit OAuth2 클라이언트 시크릿 | **미설정** (API Access Request 승인 대기 중) |
| `REDDIT_USER_AGENT` | `.env.local` + Vercel | Reddit API User-Agent (기본값: `InsightHub:MemePredictor:1.0`) | **미설정** (API Access Request 승인 대기 중) |
| `google_API_KEY` | Supabase Secrets | Gemini API (analyze-crypto-sentiment) | 기존 등록됨 |
| `THREADS_ACCESS_TOKEN` | `.env.local` + Vercel | Threads API 장기 액세스 토큰 (60일) | **미설정** (테스터 등록 + OAuth 필요) |
| `CRON_SECRET` | `.env.local` + Vercel | 크롤링 Bearer 인증 | 기존 등록됨 |
| `COINGECKO_API_KEY` | `.env.local` + Vercel | CoinGecko Demo API 키 (선택, 없어도 동작) | 미설정 (무료 한도 충분) |

### Reddit API 키 발급 방법
1. ~~https://www.reddit.com/prefs/apps 접속~~ — 2026년 기준 앱 생성 전 API Access Request 필수
2. https://support.reddithelp.com/hc/requests/new?ticket_form_id=14868593862164 에서 등록 티켓 제출 (2026-03-15 제출 완료)
3. 승인 후 https://www.reddit.com/prefs/apps → script 타입 앱 생성
4. name: InsightHub, redirect uri: http://localhost
5. 생성된 client_id (앱 이름 아래), client_secret 복사

### Threads 토큰 발급 방법

**Meta App 설정 (완료)**:
- 앱 이름: `acainfo` (App ID: `949873810905349`)
- Threads 앱 ID: `744117611965629`
- 이용 사례: Threads API 액세스 → `threads_basic` + `threads_keyword_search` 테스트 준비 완료
- 리디렉션 콜백 URL: `https://localhost/` 설정 완료
- 제거/삭제 콜백 URL: `https://localhost/deauth`, `https://localhost/delete`

**블로커: Threads 테스터 등록**
- Meta 개발자 포탈 → 앱 역할 → Threads 테스터 → `gyeol_hh` 추가 시도했으나 **등록이 반영되지 않음**
- 기존에 `my-theads-insight` 앱이 Threads 계정에 승인되어 있음 (2026-01-25) → 해당 앱이 어느 Meta 개발자 계정에 있는지 확인 필요
- **대안 1**: `my-theads-insight` 앱에 `threads_keyword_search` 퍼미션 추가 → 기존 승인 활용
- **대안 2**: `acainfo` 앱의 Threads 테스터 등록 재시도 (시간 경과 후 또는 Meta 지원 문의)

**토큰 발급 절차** (테스터 등록 성공 후):
1. 브라우저에서 인증 코드 요청:
   ```
   https://threads.net/oauth/authorize?client_id=744117611965629&redirect_uri=https://localhost/&scope=threads_basic,threads_keyword_search&response_type=code
   ```
2. Threads 로그인 → 앱 승인 → `https://localhost/?code=XXXXXX#_` 에서 code 복사
3. Short-lived token 교환:
   ```bash
   curl -s -X POST "https://graph.threads.net/oauth/access_token" \
     -d "client_id=744117611965629" \
     -d "client_secret={Threads앱시크릿}" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=https://localhost/" \
     -d "code={Step2의코드}"
   ```
4. Long-lived token 교환 (60일 유효):
   ```bash
   curl -s "https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret={Threads앱시크릿}&access_token={Step3의토큰}"
   ```
5. `.env.local` + Vercel에 `THREADS_ACCESS_TOKEN` 설정
6. `supabase functions deploy analyze-threads-sentiment --project-ref tcpvxihjswauwrmcxhhh`

**⚠️ 앱 시크릿 노출됨**: 이전 대화에서 앱 시크릿이 노출되었으므로 Meta 개발자 대시보드 → 앱 설정 → 기본 설정에서 **앱 시크릿 재발급** 필요

---

## 데이터 소스 확장 계획

### Discord 봇 (다음 우선순위)
- **방식**: Discord Bot API + discord.js (공식 API만 ToS 준수)
- **제약**: 봇이 서버에 초대되어야 메시지 접근 가능 (관리자 협조 필수)
- **MESSAGE_CONTENT 특권 인텐트**: 75개 서버 미만이면 자동 승인
- **아키텍처**: REST API 배치 수집 (Cron) → Supabase DB → 기존 센티먼트 파이프라인 재활용
- **타겟 서버**: 5-30k 규모의 중소 크립토 커뮤니티 (대형 서버는 승인 어려움)
- **DM 피칭 현황** (2026-03-15):
  - SolanaMemeCoins (38k) — 서포트 티켓으로 피칭 완료
  - Insider Watchers (2,323명) — Owner "tumblr boi" (kushfr)에게 DM 완료
  - MemeCoin Discord (12,184명) — Owner "Frank" (frank.s0l)에게 DM 완료
  - MemeCoinCalls (5,113명) — Admin ".Manutobuizumaki." (manutobuizumaki)에게 DM 완료
  - **응답 대기 중** — 2-3일 후 팔로업 예정
- **피칭 전략**: 대학 캡스톤 프로젝트 + 무료 대시보드 제공 + read-only 봇 zero risk 강조
- **Discord Developer Portal**: https://discord.com/developers → 봇 생성 → MESSAGE_CONTENT intent 활성화
- **ToS 주의**: 수집 데이터로 ML 학습 금지 (추론/분석은 OK), 개인 메시지 저장 금지

### Threads (코드 완료, 토큰 미발급)
- **방식**: Meta Threads API 공식 `keyword_search` 엔드포인트
- **장점**: 키워드 검색으로 크립토 관련 게시물만 정확 수집, 참여도 지표(views/likes/replies/reposts), 유저 프로필 → 인플루언서 감지
- **Rate limit**: 2,200쿼리/24시간 (30분 크론 = 하루 48회, 충분)
- **코드 완료**: `threads-crawler.ts`, `analyze-threads-sentiment` Edge Function, `batch-sentiment.ts` 소스 라우팅, crawl route Phase 1c
- **블로커**: Threads 테스터 등록 + OAuth 토큰 발급 필요 (아래 "Threads 토큰 발급" 섹션 참조)

### 4chan /biz/ (보류)
- **검토 결과**: 크립토 비율 ~28%, 나머지는 부동산/커리어/개인재무 노이즈
- **단점**: 익명(인플루언서 감지 불가), score 없음(품질 필터링 불가), NSFW 콘텐츠
- **결론**: Threads가 모든 면에서 우위 → **보류**

### Telegram 공개 채널
- **config.ts에 이미 11개 채널 설정 완료**: binance_announcements, cryptoVIPsignalTA, whale_alert_io 등
- **공개 채널**: 봇 초대 없이 `t.me/s/채널명` 웹 스크래핑 → `telegram-crawler.ts` 구현 완료

---

## 기술 세부사항

### Reddit API
- OAuth2 client_credentials grant (앱 전용, 유저 로그인 불필요)
- Rate limit: 60 req/min (OAuth), 서브레딧 간 1초 딜레이
- `is_self` 필터: 텍스트 게시물만 (링크/이미지 게시물 제외)
- `raw_json=1`: HTML 엔티티 디코딩된 원문

### 코인 멘션 추출 전략
- **$DOGE / #PEPE** (고신뢰): 정규식 `/(?:\$|#)([A-Z]{2,10})\b/gi`
- **dogecoin, ethereum** (중신뢰): COIN_LIST alias 순회, 3자 미만 alias 스킵
- **DOGE** (저신뢰): ALL-CAPS 단어 매칭, 80+ 단어 블랙리스트 (THE, BUY, HODL, FOMO 등)
- 문맥 추출: 멘션 전후 30자 캡처 → crypto_mentions.context

### 시그널 가중치 공식 (2026-03-17 보정)
```
rawScore (0~100) =
  mention_velocity_norm × 25% +
  avg_sentiment_norm × 30% +
  sentiment_trend_norm × 15% +
  engagement_norm × 20% +
  fomo_avg_norm × 10%

mentionConfidence = clamp(mention_count / MIN_MENTION_CONFIDENCE, 0, 1)
  → MIN_MENTION_CONFIDENCE = 5 (config.ts)
  → 1회 언급 = ×0.2, 3회 = ×0.6, 5회+ = ×1.0

weighted_score = rawScore × mentionConfidence

velocity: 이전 윈도우 데이터 없으면 0 (신규 코인 과대평가 방지)

signal_label:
  ≥80 → strong_buy
  ≥60 → buy
  ≥40 → neutral
  ≥20 → sell
  <20 → strong_sell

trending 조건: velocity > 0.5 AND weighted_score ≥ 50
```

### Signal Network 시각화
- **라이브러리**: `react-force-graph-2d` (dynamic import, SSR 비활성화)
- **노드**: 코인(원, 센티먼트 색상) + 인플루언서(다이아몬드, 보라)
- **크기**: mention_count 비례 (3~15px)
- **엣지**: correlates_with(파란) + mentions(보라), weight 비례 굵기
- **인터랙션**: 드래그/줌/팬, 노드 hover 툴팁, 클릭 시 CoinDetail 모달
- **필터**: 코인 칩 클릭 시 neighborSet만 하이라이트 + 키워드 클라우드 로드
- **테마**: `useIsDark()` 훅으로 Canvas 텍스트/스트로크 색상 자동 전환
- **키워드**: `/api/crypto/network?coin=BTC` → crypto_mentions → crypto_sentiments.key_phrases 집계

### DB 스키마 요약
| 테이블 | PK | UNIQUE | 주요 FK |
|--------|-----|--------|---------|
| crypto_posts | id (uuid) | source_id | — |
| crypto_mentions | id | — | post_id → crypto_posts |
| crypto_sentiments | id | post_id | post_id → crypto_posts |
| crypto_signals | id | (coin_symbol, time_window, computed_at) | — |
| crypto_entities | id | (entity_type, name) | — |
| crypto_relations | id | — | source/target_entity_id → crypto_entities |
| crypto_coins | id (uuid) | coingecko_id | — |
| crypto_prices | id (uuid) | — | coingecko_id → crypto_coins |

### 주의사항
- `batch-sentiment.ts`의 NOT IN 서브쿼리가 Supabase JS에서 직접 지원 안 될 수 있음 → fallback으로 RPC 함수 또는 LEFT JOIN 방식 구현 필요 (코드에 fallback 분기 있음)
- `signal-generator.ts`의 JOIN 쿼리가 복잡해서 Supabase JS의 nested select가 정확히 동작하지 않을 수 있음 → fallback으로 simple mention count 방식 구현되어 있음
- `crypto_signals`의 UNIQUE 제약 `(coin_symbol, time_window, computed_at)` — computed_at이 동일 시각이어야 upsert 동작. 크롤링 실행마다 새 computed_at 생성됨
- Reddit API `after` 파라미터: null이면 마지막 페이지 → 루프 종료
- RLS 정책: 모든 테이블 읽기 전체 허용, 쓰기는 service_role 사용 (createServiceClient)
- **린터 주의**: SignalNetwork.tsx 수정 시 린터가 `useIsDark` 훅/language prop 등을 되돌리는 경향 있음. 수정 후 즉시 커밋 필요.
- **sanitizeText**: 각 크롤러(telegram/reddit/threads)에 `sanitizeText` 함수 적용. 제어 문자 + lone surrogate 제거. 멘션 추출 시에도 sanitized text 사용해야 `invalid input syntax for type json` 에러 방지됨 (2026-03-15 수정 완료)
- **504 타임아웃 해결 (2026-03-17)**: 3-Phase 분리로 근본 해결. 각 페이즈가 독립적으로 300초 확보. 센티먼트는 200초 시간 예산 + 미완료 시 자기 재호출.
- **Telegram fetch 타임아웃**: 개별 채널 fetch에 15초 AbortController 적용 (`fetchChannelPage`)

---

## 검증 체크리스트

### Phase 1
- [ ] `.env.local`에 `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` 설정 (승인 대기 중)
- [x] DB 마이그레이션 `018_crypto_tables.sql` 실행 (2026-03-15)
- [x] GitHub Actions cron으로 30분마다 `/api/crypto/crawl` 자동 실행 확인 (2026-03-15)
- [x] Telegram 크롤링 동작 확인 — 11채널, 206개 발견 → 186개 저장, 멘션 112개 (2026-03-15)
- [ ] Reddit 크롤링 테스트 (API 승인 후)
- [ ] `GET /api/crypto/posts?coin=DOGE` 응답 확인

### Phase 2
- [x] `supabase functions deploy analyze-crypto-sentiment` 배포 (2026-03-15)
- [x] 센티먼트 분석 동작 확인 — 30/30 성공 (2026-03-15)
- [x] 시그널 생성 동작 확인 — 82개 생성 (2026-03-15)
- [ ] `GET /api/crypto/signals?window=24h` 응답에 weighted_score, signal_label 확인

### Phase 3
- [ ] `crypto_entities`에 코인/인플루언서 엔티티 자동 생성 확인
- [ ] `crypto_relations`에 correlates_with 엣지 생성 확인
- [ ] `GET /api/crypto/coins?search=DOGE` 관련 엔티티 포함 확인

### Phase 4
- [x] master 계정 → Header에 "밈코인 예측기" / "Meme Predictor" 메뉴 노출 (2026-03-15)
- [x] 비로그인 유저도 `/crypto` URL 직접 접근 가능 (2026-03-15)
- [x] CoinCard 그리드 + SignalTimeline 렌더링 (2026-03-15)
- [x] CoinDetail 모달 열림 + 관련 게시물 표시 (2026-03-15)
- [x] i18n 5개 언어 적용 (2026-03-15)

### Phase 5 — Signal Network
- [x] SignalNetwork 컴포넌트 렌더링 + Force Graph 표시 (2026-03-15)
- [x] 필터 칩 클릭 시 코인 이웃 하이라이트 (2026-03-15)
- [x] `/api/crypto/network` 엔드포인트 동작 (2026-03-15)
- [ ] 프로덕션에서 라이트 테마 노드 라벨 가독성 확인 (Vercel 재배포 후 확인 필요)
- [ ] 키워드 클라우드 데이터 표시 (센티먼트 데이터 쌓인 후 확인)

### Phase 6 — Threads 연동
- [x] `threads-crawler.ts` 크롤러 구현 (2026-03-15)
- [x] `analyze-threads-sentiment` Edge Function 생성 (2026-03-15)
- [x] `batch-sentiment.ts` 소스별 Edge Function 라우팅 (2026-03-15)
- [x] `crawl/route.ts` Phase 1c 추가 (2026-03-15)
- [x] `types/crypto.ts` CryptoSource + Threads 타입 추가 (2026-03-15)
- [x] `config.ts` Threads 키워드/상수 추가 (2026-03-15)
- [x] `i18n.ts` subtitle 5개 언어 업데이트 (2026-03-15)
- [x] Meta App 설정 (acainfo, Threads API use case, 리디렉션 URL) (2026-03-15)
- [ ] Threads 테스터 등록 (`gyeol_hh`) — 개발자 포탈에서 등록 시도했으나 미반영
- [ ] `THREADS_ACCESS_TOKEN` 환경변수 설정 (`.env.local` + Vercel)
- [ ] `analyze-threads-sentiment` Edge Function 배포
- [ ] 크롤링 테스트 후 Threads 소스 게시물 DB 확인
- [ ] **앱 시크릿 재발급** (노출됨, Meta 개발자 대시보드에서 리셋 필수)

### Phase 8 — CoinGecko 가격 연동 (2026-03-20)
- [x] DB 마이그레이션 `021_crypto_prices.sql` 적용 (crypto_coins + crypto_prices)
- [x] CoinGecko 코인 동기화 — 66개 매칭/저장 확인
- [x] CoinGecko 가격 수집 — 65개 코인 가격 저장 확인 (null 가격 1개 자동 스킵)
- [x] Phase 4 (prices) 파이프라인 — signals → prices 자동 체이닝 동작
- [x] 30분 cron `vercel.json` 등록 (`*/30 * * * *`, phase=prices)
- [x] coin-extractor DB 전환 — 3개 크롤러 모두 `extractCoinMentionsFromDB` 사용
- [x] `/api/crypto/prices` API — BTC $69,840 등 정상 응답 확인
- [x] CoinCard UI — 코인 아이콘 + 가격 + 24h 변동률 표시
- [ ] Vercel 배포 후 프로덕션 가격 표시 확인
- [ ] 30분 cron 프로덕션 동작 확인
