# 밈코인 예측기 — 작업 인계 문서

> 최종 작업일: 2026-03-21 (Phase H — FOMO/FUD 시그널 분리 + CoinDetail 가격 차트 + 코드 리뷰 디버깅)
> 경로: `/{locale}/crypto` (Header "밈코인 예측기" 메뉴 **master 계정만 노출**, URL 직접 접근은 누구나 가능)
> 프로덕션: https://aca-info.com/en/crypto

---

## 프로젝트 배경 및 방향성

### 왜 만드는가
Insight Hub의 크롤링 인프라(Reddit → DB → AI 분석)를 활용해 밈코인 시장의 **"왜 이 코인이 뜨는가"를 설명 가능한 시그널로 제공**하는 기능. 단순 점수가 아닌 근거 체인(Explainable Signal)이 핵심 차별점.

### 전략적 위치
- **현재**: Header 메뉴는 master 계정 전용, URL 직접 접근은 공개 (Discord 커뮤니티 파트너십 피칭용 데모로 활용)
- **다음 단계**: Discord 봇 연동 → 커뮤니티 데이터 수집 확대 → 크립토 전용 플랫폼 피벗
- 기존 Insight Hub 인프라 최대 활용 — Reddit API + Apify(X/Twitter) + Telegram 스크래핑 + 기존 AI 파이프라인(Gemini Edge Function + 배치 패턴) 재활용

### 핵심 기능 4개
1. **멀티소스 센티먼트 추적** — X/Twitter(Apify) + Reddit + Telegram + Threads → 코인 멘션 추출 → LLM 센티먼트 분석
2. **가중 시그널 스코어 (V2)** — 기본 5요소(velocity 25% + sentiment 30% + trend 15% + engagement 20% + FOMO 10%) × mentionConfidence × marketCapDampening × **zScoreMultiplier** × **crossPlatformMultiplier** + **eventModifier** → 0~100점 + signal_label (Heat 스케일) + **contrarianWarning**
3. **지식그래프** — 코인/인플루언서/내러티브/이벤트 엔티티 + 5종 관계(correlates_with/mentions/recommends/part_of/impacts) → LLM 동적 감지 + 점진적 감쇠
4. **Signal Network 시각화** — Force-directed 3D 그래프 + WHY Trending 추론 패널 (점수 분해·AI 근거·소스 분포·키워드·내러티브·이벤트 타임라인) + 노드 클릭 경로 하이라이트

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
10. **시그널 생성** — 4개 시간 윈도우(1h/6h/24h/7d), 코인별 가중 스코어 → signal_label (extremely_hot~cold, Heat 스케일)
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

**Phase 6 — Threads 연동 (2026-03-15 코드 완료, 2026-03-20 토큰 발급 + 앱 게시)**
31. **Threads 크롤러** — Meta Threads API 키워드 검색 (`keyword_search`) 기반 크립토 게시물 수집
    - `lib/crypto/threads-crawler.ts` — 10개 키워드 × RECENT 검색, since 파라미터로 중복 최소화
    - `types/crypto.ts` — `CryptoSource`에 `'threads'` 추가 + `ThreadsSearchPost`, `ThreadsSearchResponse`, `ThreadsSearchKeyword` 타입
    - `lib/crypto/config.ts` — `THREADS_SEARCH_KEYWORDS` (10개), `THREADS_API_BASE`, rate limit 상수
    - `app/api/crypto/crawl/route.ts` — Phase 1c: Threads 크롤링 (`THREADS_ACCESS_TOKEN` 조건부)
    - `lib/crypto/batch-sentiment.ts` — `source` 필드 기반 Edge Function 라우팅 (threads → `analyze-threads-sentiment`)
    - `lib/i18n.ts` — subtitle 5개 언어 "Reddit · Threads · Telegram" 으로 업데이트
32. **Threads 전용 센티먼트 Edge Function** — `analyze-threads-sentiment` (Gemini 2.5 Flash Lite)
    - Threads 특성 반영: 500자 제한, 이모지 해석(🚀=강세, 📉=약세), 해시태그/멘션, NFA/DYOR 면책 표현
33. **Meta App 설정 + 앱 게시 완료** (2026-03-20)
    - `acainfo` 앱 (App ID: `949873810905349`), Threads 앱 ID: `744117611965629`
    - Threads 테스터 `gyeol_hh` 등록 + 수락 완료
    - OAuth Long-lived 토큰 발급 완료 (60일, 만료: ~2026-05-18)
    - `THREADS_ACCESS_TOKEN` — `.env.local` + Vercel production 환경변수 설정 완료
    - `analyze-threads-sentiment` Edge Function 배포 완료
    - 앱 라이브 모드 전환 완료 (개인정보처리방침 URL: `https://aca-info.com/terms`)
    - **제한**: `keyword_search`가 현재 **자기 게시물만** 반환. 공개 게시물 검색은 **Tech Provider 인증 + 앱 검수** 필요 (비즈니스 인증 → 액세스 인증 → 앱 검수 3단계, 사업자등록증 필요)

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

**Phase 9 — Why Trending 추론 시각화 (2026-03-21)**
46. **score-utils.ts** — `signal-generator.ts`에서 공유 유틸 추출 (clamp, normalize*, computeSignalLabel, computeMentionConfidence, computeMarketCapDampening)
47. **trending-explain API** — `app/api/crypto/trending-explain/route.ts` (GET ?coin=X&window=24h)
    - 점수 분해 (velocity/sentiment/engagement/fomo normalized + mention_confidence + final_score)
    - 상위 5개 게시물 + AI reasoning 인용
    - 소스 분포 (reddit/telegram/threads 건수 + avg_sentiment)
    - 키프레이즈 Top 15 빈도 집계
    - 내러티브/이벤트 태그 (NARRATIVE_CLUSTERS 매칭)
    - 가격 정보 (crypto_coins → crypto_prices JOIN)
48. **WHY 패널 하위 컴포넌트 5개**
    - `ScoreBreakdown.tsx` — 4개 수평 바 (velocity/sentiment/engagement/fomo) + 3단계 라벨 (Strong/Moderate/Weak) + mention_confidence 안내
    - `AiReasoningQuotes.tsx` — 상위 3개 게시물 reasoning 인용 블록 (센티먼트 뱃지, 소스 아이콘, FOMO/FUD 인디케이터)
    - `SourceBreakdown.tsx` — 수평 스택 바 (Twitter 검정/Reddit 주황/Telegram 파랑/Threads 보라) + 소스별 건수 + 평균 센티먼트
    - `PhraseCloud.tsx` — pill 태그, 빈도 기반 2~3단계 크기/투명도
    - `NarrativeContext.tsx` — 내러티브(amber) + 이벤트(rose) 태그
49. **WhyTrendingPanel.tsx** — 위 5개 + 가격 정보 조합하는 오른쪽 패널 컨테이너 (overflow-y-auto, max-height 420px)
50. **SignalNetwork.tsx 대폭 리팩터**
    - 전체를 아코디언 래퍼로 감쌈 (초기 닫힘, max-height + opacity 트랜지션 300ms MD3 easing)
    - 좌우 분할 레이아웃: 왼쪽 60% 3D Force Graph + 오른쪽 40% WhyTrendingPanel
    - 모바일: flex-col 스택
    - 기존 키워드 클라우드 제거 (PhraseCloud로 대체)
    - 코인 칩 클릭 → 그래프 필터 + /api/crypto/trending-explain fetch → WHY 패널 전달
    - 아코디언 열릴 때 첫 번째 칩 자동 선택
    - `useIsDark` 훅 공유 모듈로 추출 (`lib/hooks/useIsDark.ts`)
    - Lazy fetch + 결과 캐시 (coin+window 키)
51. **CryptoDashboard.tsx** — SignalNetwork에 timeWindow prop 추가
52. **i18n** — ~15개 번역 키 × 5개 언어 추가 (scoreBreakdown, buzzSpeed, communityMood, engagement, hypeLevel, aiSays, whereDiscussed, whatTheySay, biggerPicture, mentionConfidenceLow, strong/moderate/weak 등)
53. **types/crypto.ts** — `TrendingExplainResponse` 타입 추가

**Phase B — 온톨로지 고도화 (2026-03-21)**
54. **시계열 트렌드 계산** — `normalizeSentimentTrend()` 추가, 이전 윈도우 대비 센티먼트 변화율 계산
55. **가중 confidence 감쇠** — 이진(0.1) → 점진적(`0.85^(경과일수-7)`, 최소 0.05), decayed 플래그는 confidence<0.15일 때만
56. **recommends 관계 활성화** — bullish+confidence>0.7+score≥100 → influencer→coin `recommends` 자동 생성
57. **LLM 내러티브 동적 감지** — Edge Function 프롬프트에 narratives 필드 추가 → batch-sentiment 파싱 → metadata JSONB 저장 → knowledge-graph LLM 우선 + 하드코딩 fallback
58. **LLM 이벤트 감지 고도화** — Edge Function에 events 필드 추가 (이벤트명+영향 코인+impact 방향) → keyword 매칭 fallback 유지
59. **DB 마이그레이션** — `026_add_sentiments_metadata.sql` (crypto_sentiments.metadata JSONB)
60. **Edge Function 재배포** — analyze-crypto-sentiment + analyze-threads-sentiment (narratives/events 프롬프트, maxOutputTokens 700)
61. **타입 추가** — `CryptoSentimentEvent`, `CryptoSentimentResult`에 narratives/events 옵셔널 필드

**Phase 10 — X/Twitter 크롤링 연동 (2026-03-21)**
69. **Twitter 크롤러** — Apify `scrape.badger/twitter-tweets-scraper` Actor 기반 X 게시물 수집
    - `lib/crypto/twitter-crawler.ts` — Advanced Search 모드, 키워드 5개 × 20결과/키워드
    - `types/crypto.ts` — `CryptoSource`에 `'twitter'` 추가, `ApifyTweet`, `TwitterSearchKeyword` 타입
    - `lib/crypto/config.ts` — `TWITTER_SEARCH_KEYWORDS` (5개), `TWITTER_APIFY_ACTOR`, `TWITTER_RESULTS_PER_KEYWORD=20`
    - `app/api/crypto/crawl/route.ts` — Phase 1d: Twitter 크롤링 (`APIFY_API_TOKEN` 조건부, **12시간 간격 제한** — DB에서 마지막 twitter crawled_at 체크)
    - `lib/i18n.ts` — subtitle 5개 언어 "X · Reddit · Threads · Telegram"
    - 센티먼트: 기존 `analyze-crypto-sentiment` Edge Function 재활용 (Reddit과 유사 구조)
    - `sanitizeObject()` — 전체 row를 JSON round-trip 정화 (Apify 응답의 lone surrogate/제어문자 제거)
    - hashtags 정규화: Apify가 `[{tag: "..."}]` 반환 → `string[]`로 변환
70. **Apify 무료 플랜 운영**
    - Actor: `scrape.badger/twitter-tweets-scraper` — $0.0002/결과 (FREE 티어 동일, tiered 아님)
    - 12시간 간격 × 5키워드 × 20결과 = 200트윗/일 → **$0.04/일 = $1.20/월** ($5 무료 크레딧 내)
    - 프로덕션 테스트 완료: 100트윗 수집 + 172 코인 멘션 추출 (2026-03-21)
71. **환경변수** — `APIFY_API_TOKEN` → `.env.local` + Vercel production 설정 완료

**Phase C — 시각화 강화 (2026-03-21)**
62. **내러티브/이벤트 클러스터 하이라이트** — SignalNetwork.tsx: narrative/event 노드 클릭 → 연결 코인 하이라이트 (focusedNode + focusNeighborSet)
63. **이벤트 타임라인** — `/api/crypto/events` API + `EventTimeline.tsx` 컴포넌트 (impact 색상, AI 뱃지, 코인 칩) + WhyTrendingPanel 통합
64. **추론 경로 표시** — narrative/event 노드 클릭 시 관련 경로 하이라이트, 포커스 노드 1.8배 확대
65. **CoinDetail 차트 강화** — FOMO 라인(오렌지 점선) + 이벤트 ReferenceLine(세로 점선+라벨) + 범례 확장
66. **recommends 엣지 시각화** — 초록(#22c55e) 색상
67. **trending-explain API 개선** — 코인별 관계 기반 narrative/event 조회 + 하드코딩 fallback
68. **i18n** — `crypto.eventTimeline` 5개 언어 추가

**Phase D — 백테스팅 시스템 (2026-03-21)**
72. **DB 마이그레이션 `027_crypto_backtest.sql`** — 백테스트 결과 테이블 + 집계 뷰
    - `crypto_backtest_results`: coin_symbol, signal_label, weighted_score, signal_at, price_at_signal, price_after, price_change_pct, lookup_window, hit, evaluated_at
    - UNIQUE (coin_symbol, time_window, signal_at, lookup_window) — 중복 방지
    - `crypto_backtest_summary` 뷰: 라벨별 적중률 + 평균 수익률 집계
73. **백테스트 로직** — `lib/crypto/backtester.ts`
    - `runBacktest()`: 최근 7일 시그널 → 가격 매칭(12시간 허용 오차) → 적중 평가 → upsert
    - `evaluatePending()`: 미평가 건(가격 미도달)을 재평가 — 가격 쌓이면 자동 채움
    - 적중 기준: hot(extremely_hot/hot) → 가격 상승, cold(cool/cold) → 가격 하락, warm → 2% 미만 변동
74. **백테스트 API** — `app/api/crypto/backtest/route.ts`
    - GET ?lookup_window=24h&coin=DOGE
    - 응답: 라벨별 적중률(win_rate), 코인별 적중률, 평균 수익률, 최근 결과 20개
75. **파이프라인 Phase 6 추가** — `app/api/crypto/crawl/route.ts`
    - battle 완료 → backtest 트리거 (fire-and-forget)
    - runBacktest + evaluatePending 순차 실행
76. **BacktestReport UI** — `components/crypto/BacktestReport.tsx`
    - 아코디언 토글, 1h/6h/24h/7d lookup window 선택
    - 라벨별 적중률 바 (WinRateBar), 코인별 그리드, 최근 결과 리스트
    - CryptoDashboard에 SignalNetwork 위에 배치
77. **타입 추가** — `types/crypto.ts` BacktestResult, BacktestSummary, BacktestCoinSummary, BacktestResponse
78. **i18n** — backtest 번역 키 7개 × 5개 언어 (crypto.backtest, winRate, avgReturn, total, noData, after, recent)
79. **초기 데이터** — 788개 백테스트 레코드 기록 (197개 시그널 × 4 lookup window), 전부 pending (가격 데이터 축적 대기)

**Phase E — Signal Label Heat 스케일 전환 (2026-03-21)**
80. **signal_label 리네이밍** — 금융 규제 회피를 위해 buy/sell 용어 제거, 커뮤니티 열기(Heat) 스케일로 전환
    - `strong_buy` → `extremely_hot`, `buy` → `hot`, `neutral` → `warm`, `sell` → `cool`, `strong_sell` → `cold`
    - 참고: LunarCrush(Galaxy Score), Santiment(Social Volume) 등 선례 — 매매 지시가 아닌 관심도 지표
81. **코드 변경** (8개 파일)
    - `types/crypto.ts` — `SignalLabel` 타입 정의
    - `lib/crypto/score-utils.ts` — `computeSignalLabel()` 반환값
    - `lib/crypto/backtester.ts` — `isBullish()`/`isBearish()` → hot/cold 비교
    - `lib/crypto/battle-trader.ts` — 로봇 진입(`extremely_hot/hot/warm`)/반전(`cool/cold`) 라벨
    - `components/crypto/CoinCard.tsx` — 뱃지 색상+라벨 (빨강→파랑 온도 팔레트, 이모지 포함)
    - `components/crypto/SignalTimeline.tsx` — 이모지 매핑 (🔥/🟠/🟡/🔵/❄️)
    - `components/crypto/BacktestReport.tsx` — 색상+표시명
82. **DB 마이그레이션 `028_signal_label_heat.sql`** — CHECK 제약 제거 → 데이터 변환 → 새 CHECK 추가 → 뷰 DROP+재생성
    - crypto_signals: 기존 데이터 전부 변환 완료
    - crypto_backtest_results: 기존 데이터 전부 변환 완료
    - crypto_backtest_summary 뷰: avg_buy/sell_return_pct → avg_hot/cold_return_pct

**Phase F — 센티먼트 배치 처리 + AI 배틀 전략 완화 + UI 정리 (2026-03-21)**
83. **센티먼트 Gemini 2.5 Flash 업그레이드** — Flash Lite → Flash (reasoning 품질 향상, 비용 차이 미미)
84. **센티먼트 배치 모드** — 1건1호출 → 10건1호출 (API 호출 90% 감소)
    - Edge Function: 배치 입력(`{posts: [...]}`) + 단일 모드 하위 호환
    - `batch-sentiment.ts`: 소스별 그룹핑, 배치 실패 시 개별 폴백
    - `maxOutputTokens`: 700 → 4096 (배치 응답 수용)
85. **센티먼트 룰베이스 필터링** — AI 호출 전 사전 필터
    - `get_posts_without_sentiment` RPC 수정 (DB 마이그레이션 `030_sentiment_filter_rpc.sql`)
    - 코인 멘션 1개 이상 (`INNER JOIN crypto_mentions`) — 멘션 없으면 시그널에 불필요
    - 제목+본문 30자 이상 — 이모지만 있는 글 제외
    - `source` 컬럼 반환 추가 (소스별 Edge Function 라우팅)
    - 기본 배치 크기: 30 → 200 (소스 증가 대응)
86. **AI 배틀 전략 완화** — 데이터 부족 환경 대응
    - 포지션: 3개→5개, 크기 25%→12% (분산 투자)
    - 시그널 임계값: weighted_score 50→30, confidence 65→55, mention_count 3 유지
    - 시간 윈도우: 1h 고정 → 24h→6h→1h 폴백 (데이터 누적 활용)
    - 청산 완화: 반전 cold만, velocity_dead 0.2→0.05, 24h 기준
87. **UI 정리**
    - 트렌딩 사이드바 제거 → 점수순 카드 정렬로 통일
    - "🔥 트렌딩" 타이틀 + 시간 필터 + 검색바 같은 라인
    - SignalNetwork 내부 자체 시간 필터 추가 (코인 칩 우측)
    - 그래프 레전드 → 좌하단 오버레이로 이동
    - 코인 칩 클릭 시 그래프+추론 동시 연동
    - 시간 필터 변경 시 첫 번째 코인 자동 선택
88. **trending-explain API 시점 통일** — `now` 기준 → `crypto_signals.computed_at` 기준 (카드와 정확히 같은 데이터)
89. **Reddit 공개 JSON 확인** — OAuth 미사용, `reddit.com/r/{sub}/{sort}.json` 직접 호출로 이미 동작 중
90. **Threads 비활성화** — 자기 게시물만 반환, 실질 데이터 없어 크롤링에서 제외

**Phase G — Signal Scoring V2 + 3D 그래프 수정 (2026-03-21)**
91. **DB 마이그레이션 `031_signal_scoring_v2.sql`** — `crypto_signals`에 6개 컬럼 추가
    - `z_score` (numeric 6,3): 멘션 볼륨 Z-score
    - `source_count` (integer): 소스 플랫폼 수
    - `contrarian_warning` (text): 'potential_reversal' | 'potential_bounce' | null
    - `sentiment_skew` (numeric 5,2): bullish 비율 (0-100%)
    - `detected_events` (text[]): 감지된 이벤트 타입 배열
    - `event_modifier` (numeric 5,2): 이벤트 기반 점수 보정값
92. **Z-score 볼륨 이상치 감지** — `score-utils.ts: computeZScore() + computeZScoreMultiplier()`
    - 과거 10개 윈도우 히스토리 대비 현재 멘션 수 Z-score 계산
    - z > 2.0 → 1.0~1.5배 부스트 (비정상 급증 감지)
    - `signal-generator.ts: fetchWindowData()`에 historical mentions 쿼리 추가
93. **크로스 플랫폼 시그널 확인** — `computeCrossPlatformMultiplier()`
    - 1 소스 = ×0.7 (약한 시그널), 2 소스 = ×1.0, 3+ 소스 = ×1.3 (강한 시그널)
    - `crypto_posts.source` 기반 distinct count per coin per window
94. **역행 센티먼트 감지 (Contrarian)** — `computeContrarianWarning()`
    - bullish 비율 > 85% → `potential_reversal` (과열 경고)
    - bullish 비율 < 15% → `potential_bounce` (반등 시그널)
    - 스코어에 직접 반영 안 함, 별도 경고 지표
95. **이벤트 타입 키워드 스코어링** — `computeEventModifier()`
    - `key_phrases`에서 이벤트 키워드 매칭 → 점수 가감
    - `exchange_listing` +15, `security_incident` -20, `whale_buy` +10, `whale_sell` -10, `regulatory_positive` +10, `regulatory_negative` -15, `partnership` +8, `airdrop` +5
    - 총합 clamp(-30, +25)
96. **3D 그래프 nodeThreeObject 커스텀 렌더링** — `SignalNetwork.tsx`
    - `react-force-graph-3d`의 `dynamic()` → lazy import으로 전환 (ref 전달 문제 해결)
    - `nodeThreeObject` 콜백: THREE.SphereGeometry + MeshPhongMaterial (shininess, specular, emissive) + glow halo + SpriteText 라벨
    - 커스텀 라이팅: AmbientLight + DirectionalLight×2 + PointLight
    - d3 force 튜닝: charge=-300, link=60, center=2
    - zoomToFit 반복 호출 + onEngineStop 콜백
    - 칩 전환 시 깜빡임 방지: nodeThreeObject에서 selectedChip 의존성 제거
97. **CoinCard 에러 수정** — `badge.bg` undefined fallback 추가 (signal_label이 DB에 구 라벨로 남아있을 때 대응)
98. **온체인 데이터** — Whale Alert API 검토 → 유료($29.95/월) 확인 → **기존 텔레그램 `whale_alert_io` 채널로 대체** (추가 비용 없음, 이벤트 키워드로 자동 매칭)

**Phase H — FOMO/FUD 시그널 분리 + CoinDetail 가격 차트 + 디버깅 (2026-03-21)**
99. **FOMO/FUD 시그널 분리** — 시그널 가중치 70%가 볼륨 기반이라 부정 멘션 폭증해도 "Hot" → 가격 예측 실패 문제 해결
    - `signal_type` 컬럼 추가 (`crypto_signals`, `crypto_backtest_results`)
    - FOMO: `sentiment_score >= 0` 게시물 기반, FUD: `sentiment_score <= 0` 게시물 기반 (중립은 양쪽 포함)
    - `signal-generator.ts`: fetchWindowData 1회 + 필터 2회 패턴 (FOMO/FUD 독립 스코어 생성)
    - `score-utils.ts`: `normalizeSentimentForFud()` (부정 강도만 반영), `normalizeFud()` 추가
    - `backtester.ts`: `evaluateHit()` FUD 분기 — FUD Hot = 가격 하락이 적중
    - `types/crypto.ts`: `SignalType = 'fomo' | 'fud'`, 3개 타입에 `signal_type` 필드 추가
100. **DB 마이그레이션 `029_signal_type_fomo_fud.sql`**
    - `crypto_signals`: signal_type + UNIQUE 재정의 + CHECK 제약 + 인덱스
    - `crypto_backtest_results`: signal_type + UNIQUE 재정의 + CHECK 제약
    - `crypto_backtest_summary` 뷰 재생성 (signal_type GROUP BY 포함)
101. **API signal_type 필터** — 4개 API 모두 `signal_type` 파라미터 추가 (기본값: 'fomo')
    - `signals/route.ts`, `backtest/route.ts`, `trending-explain/route.ts`, `network/route.ts`
102. **trending-explain FUD 분기** — FUD 요청 시 `normalizeSentimentForFud`/`normalizeFud` 사용
103. **UI FOMO/FUD 토글** — CryptoDashboard에 FOMO/FUD 토글 버튼 (emerald/red 색상)
    - 토글이 BacktestReport, SignalNetwork, CoinCard, CoinDetail 모두에 연동
    - `CoinCard.tsx`: FOMO/FUD 별도 색상 맵 (FUD = purple/rose 계열, 🔻 아이콘)
104. **CoinDetail signalType 연동** — 모달에서도 FOMO/FUD에 따라 시그널 데이터 분리 표시
105. **SignalNetwork 디버깅** — fetchOwnSignals/fetchNetwork/fetchExplain에 `signal_type` 파라미터 누락 수정 + 캐시 키에 signalType 포함 + useCallback deps 수정
106. **CoinDetail 가격 차트 추가** — 7일 추이 차트에 가격 라인(노란색 #eab308) 추가
    - `history/route.ts`: `crypto_prices` JOIN으로 `price_usd` 필드 추가
    - `CoinDetail.tsx`: 가격 YAxis (auto 도메인) + Line + 범례 + 툴팁 포맷팅
107. **레이아웃 개선** — 필터 바(트렌딩 타이틀 + FOMO/FUD + 시간 + 검색)를 BacktestReport/SignalNetwork 위로 이동
    - FOMO/FUD 토글: 타이틀 바로 옆 배치
    - 시간 필터 + 검색창: 우측 같은 높이로 배치
    - BacktestReport/SignalNetwork 간격 mb-6 → mb-3으로 축소
    - TimeWindowSelector: `whitespace-nowrap` 추가 (한글 줄바꿈 방지)
108. **force-dynamic 추가** — `backtest/route.ts`, `trending-explain/route.ts` (캐시 방지)
109. **i18n** — `crypto.fomo`, `crypto.fud`, `crypto.price` × 5개 언어 추가
110. **SignalTimeline** — signalType prop + FUD 시각 구분 (📉 아이콘, FUD 태그)
111. **프로젝트 타당성 문서** — `PROJECT_VALIDITY.md` 작성 (학술 논문 25+ 편 출처 포함, 경쟁사 비교)

### 미완료 (To-Do)

#### 우선순위 높음 (기능 동작에 필수)
1. ~~**환경변수 설정**~~ — ✅ Reddit 공개 JSON 사용 중 (API 키 불필요)
2. ~~**DB 마이그레이션 적용**~~ — ✅ `018_crypto_tables.sql` 적용 완료 (2026-03-15)
3. ~~**Edge Function 배포**~~ — ✅ `analyze-crypto-sentiment` 배포 완료 (2026-03-15)
4. ~~**센티먼트 배치 쿼리 개선**~~ — ✅ RPC 함수 + 룰베이스 필터 + 배치 모드 완료 (2026-03-21)
5. ~~**첫 크롤링 테스트**~~ — ✅ Reddit 공개 JSON으로 동작 확인
6. ~~**서브레딧 목록 확장**~~ — ✅ 완료
7. ~~**Threads 토큰 발급**~~ — ✅ 완료 (2026-03-20)
8. ~~**analyze-threads-sentiment Edge Function 배포**~~ — ✅ 배포 완료 (2026-03-20)
9. ~~**Threads 공개 검색 활성화**~~ — ❌ 보류 → 크롤링에서 제외 (2026-03-21)
10. **analyze-crypto-sentiment Edge Function 재배포** — Gemini 2.5 Flash + 배치 모드 (코드 완료, 배포 필요)

#### 우선순위 중간 (기능 완성도)
10. **Discord 봇 연동** — DM 피칭 4개 서버 발송 완료 (2026-03-15), 응답 대기 중
11. ~~**4chan /biz/ 크롤러**~~ — 보류 (Threads로 대체)
12. ~~**내러티브 엔티티 자동 생성**~~ — ✅ Phase B에서 LLM 동적 감지로 구현 완료
13. ~~**시계열 트렌드 계산**~~ — ✅ Phase B에서 `normalizeSentimentTrend()` 구현 완료
14. ~~**CoinDetail 차트**~~ — ✅ Phase C에서 FOMO 라인 + 이벤트 ReferenceLine 추가 완료
15. **AI 채팅 개선** — 크립토 전용 Edge Function 분리 고려

#### 우선순위 낮음 (확장)
16. ~~**가격 데이터 연동**~~ — ✅ CoinGecko 완료 (2026-03-20)
17. **알림 시스템** — trending 알림 (velocity > 2.0 AND score ≥ 60) → 이메일/푸시
18. ~~**백테스팅**~~ — ✅ Phase D에서 구현 완료 (2026-03-21), 788개 레코드 기록, 가격 축적 대기
19. **크립토 전용 플랫폼 분리** — 피벗 시 독립 도메인/앱으로 분리

---

## 개발 플로우

### 데이터 파이프라인 (3-Phase 분리, 2026-03-17)

> **타임아웃 방지**: 단일 호출에서 전체 파이프라인 실행 시 Vercel 300초 제한 초과 → 3개 독립 HTTP 호출로 분리.
> 각 페이즈 완료 후 fire-and-forget으로 다음 페이즈 트리거.

```
GitHub Actions Cron (30분마다) → POST /api/crypto/crawl {phase: "crawl"}

Phase 1 (crawl): 크롤링만 — 완료 후 자동으로 Phase 2 트리거
  ├─ Reddit (✅ 동작 중, 공개 JSON 엔드포인트 — API 키 불필요)
  │   → reddit.com/r/{sub}/{sort}.json 직접 호출 (OAuth 미사용)
  │   → 서브레딧별 hot + new fetch (limit=100, 최대 3페이지)
  │   → crypto_posts upsert → coin-extractor → crypto_mentions
  │
  ├─ Telegram (✅ 동작 중, API 키 불필요)
  │   → 25개 공개 채널 웹 프리뷰 스크래핑 (t.me/s/, 15초 fetch 타임아웃)
  │   → Cheerio HTML 파싱 → crypto_posts upsert → crypto_mentions
  │
  ├─ Threads (❌ 비활성화 — 자기 게시물만 반환, Tech Provider 인증 보류)
  │   → 코드 존재하나 실질 데이터 없어 크롤링에서 제외
  │
  └─ Twitter/X (✅ 동작 중, APIFY_API_TOKEN, 12시간 간격)
      → Apify scrape.badger Actor → Advanced Search 5개 키워드 × 20결과
      → sanitizeObject → crypto_posts upsert → crypto_mentions
      → 12시간 미경과 시 자동 스킵 (Apify 무료 $5/월 절약)
  ↓ fire-and-forget: {phase: "sentiment"}

Phase 2 (sentiment): 센티먼트 분석 — 미완료 시 자기 재호출, 완료 시 Phase 3 트리거
  → crypto_sentiments 없는 crypto_posts 조회 (최대 200건)
  → analyze-crypto-sentiment Edge Function (Gemini 2.5 Flash)
  → 10건씩 배치 처리 (1회 API 호출로 10건 분석), 3회 재시도, 200초 시간 예산
  → 배치 실패 시 개별 처리 폴백
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
  ↓ fire-and-forget: {phase: "battle"}

Phase 5 (battle): 배틀 거래 평가
  ↓ fire-and-forget: {phase: "backtest"}

Phase 6 (backtest): 백테스팅 — 시그널 vs 실제 가격 비교 (2026-03-21)
  → runBacktest: 최근 7일 시그널 → 가격 매칭 → crypto_backtest_results upsert
  → evaluatePending: 미평가 건 재평가 (가격 데이터 새로 쌓인 것으로 매칭)
  → 적중 기준: hot(extremely_hot/hot)→상승, cold(cool/cold)→하락, warm→2%미만

별도 Cron (30분마다): /api/crypto/crawl?phase=prices
  → 파이프라인 전체를 안 거치고 가격만 독립 갱신
```

### 프론트엔드 플로우
```
Header "밈코인 예측기" (master 계정만 노출, i18n 적용)
  → /{locale}/crypto 접근 (URL 직접 접근은 인증 불필요)
  → 서버: 초기 시그널 SSR
  → CryptoDashboard (클라이언트, language prop)
      ├─ MonkeyVsRobot (AI vs 랜덤 배틀)
      ├─ 글로벌 필터 바 (모든 하위 섹션에 적용)
      │   ├─ 🔥 트렌딩 타이틀 + FOMO/FUD 토글 (좌측)
      │   └─ TimeWindowSelector + 검색 input (우측)
      ├─ BacktestReport (아코디언, FOMO/FUD별 적중률, 코인별 요약)
      ├─ SignalNetwork (Force Graph + WHY Trending Panel)
      │   ├─ 필터 칩 (상위 8개 코인) + 자체 시간 필터
      │   ├─ 3D Force-directed 그래프 (nodeThreeObject 커스텀)
      │   └─ WHY Panel (ScoreBreakdown/AiReasoning/Source/Phrase/Narrative/EventTimeline)
      ├─ CoinCard Grid (반응형 3열, FOMO=🔥/🟠 FUD=🔻 뱃지)
      │   └─ 클릭 → CoinDetail 모달 (signalType 연동)
      │       ├─ 스코어, 멘션, 센티먼트 게이지
      │       ├─ 7일 추이 차트 (멘션+센티먼트+FOMO+가격+이벤트)
      │       ├─ 관련 엔티티 태그
      │       └─ 관련 게시물 10개
```

---

## 파일 구조

### 새로 생성한 파일
```
lib/crypto/
  config.ts                 서브레딧 10개 + 텔레그램 25개 + Threads 키워드 10개 + Twitter 키워드 5개, 코인 목록(73개 하드코딩 fallback), 상수/가중치 + V2 상수(ZSCORE_*, CROSS_PLATFORM_*, CONTRARIAN_*, EVENT_TYPE_PATTERNS)
  coin-sync.ts              CoinGecko /coins/list → crypto_coins 동기화 (1일 1회 or Phase 4)
  price-fetcher.ts          CoinGecko /coins/markets → crypto_prices 가격 스냅샷 (30분 cron)
  reddit-auth.ts            Reddit OAuth2 토큰 관리 (cache.ts 활용)
  reddit-crawler.ts         Reddit API 크롤러 (hot+new, 중복 제거, upsert)
  telegram-crawler.ts       Telegram 웹 프리뷰 스크래핑 (t.me/s/, Cheerio 파싱)
  threads-crawler.ts        Threads API 키워드 검색 크롤러 (10개 키워드, since 필터)
  twitter-crawler.ts        Apify scrape.badger Actor 기반 X/Twitter 크롤러 (5개 키워드, 12시간 간격, sanitizeObject)
  coin-extractor.ts         3단계 코인 멘션 추출 ($TICKER, 풀네임, ALL-CAPS) — DB 기반 (extractCoinMentionsFromDB) + 하드코딩 fallback
  batch-sentiment.ts        배치 센티먼트 처리 (소스별 Edge Function 라우팅, 5 concurrent)
  score-utils.ts             공유 스코어링 유틸 V2 (clamp, normalize*, computeSignalLabel, computeMentionConfidence, computeMarketCapDampening, computeZScore, computeZScoreMultiplier, computeCrossPlatformMultiplier, computeContrarianWarning, computeEventModifier)
  signal-generator.ts       시간 윈도우별 가중 시그널 계산 V2 (Z-score 히스토리 쿼리, 크로스플랫폼/이벤트/역행 감지 통합)
  knowledge-graph.ts        엔티티/관계 자동 생성 — LLM 내러티브/이벤트 통합, 점진적 감쇠, recommends 관계
  backtester.ts             백테스팅 — 시그널 vs 가격 비교, 적중 평가, 미평가 건 재평가

lib/hooks/
  useIsDark.ts              다크모드 감지 공유 훅 (SignalNetwork에서 추출)

types/crypto.ts             크립토 전체 TypeScript 타입 (DB Row, API, Reddit, Telegram, Threads, Signal)

supabase/migrations/018_crypto_tables.sql    6개 테이블 + RLS + 트리거
supabase/migrations/021_crypto_prices.sql    crypto_coins + crypto_prices 테이블 + RLS
supabase/migrations/026_add_sentiments_metadata.sql  crypto_sentiments.metadata JSONB 컬럼 추가
supabase/migrations/027_crypto_backtest.sql          crypto_backtest_results 테이블 + crypto_backtest_summary 뷰
supabase/migrations/028_signal_label_heat.sql        signal_label buy/sell → heat 스케일 전환 (CHECK 제약 + 데이터 + 뷰)
supabase/migrations/029_signal_type_fomo_fud.sql      signal_type 컬럼 + CHECK + UNIQUE 재정의 + backtest_summary 뷰 재생성
supabase/migrations/031_signal_scoring_v2.sql        Signal V2 컬럼 추가 (z_score, source_count, contrarian_warning, sentiment_skew, detected_events, event_modifier)
supabase/functions/analyze-crypto-sentiment/index.ts   Reddit/Telegram 센티먼트 분석 — narratives/events 필드 포함
supabase/functions/analyze-threads-sentiment/index.ts  Threads 전용 센티먼트 분석 — narratives/events 필드 포함

app/api/crypto/
  crawl/route.ts            Cron 크롤링 엔드포인트 (Bearer, 300s, GET+POST)
  posts/route.ts            게시물 조회 API (coin/subreddit 필터)
  signals/route.ts          시그널 조회 API (window/coin 필터)
  coins/route.ts            코인 엔티티 + 관계 + 시그널 조회 API
  network/route.ts          그래프 데이터 API (nodes + links + keywords)
  events/route.ts           이벤트 타임라인 API (coin 필터, days, limit)
  trending-explain/route.ts 추론 시각화 API (점수 분해 + AI 근거 + 소스/키워드/내러티브) — 코인별 관계 기반 조회
  prices/route.ts           코인 가격 조회 API (coin/limit 필터, 최신 fetched_at)
  backtest/route.ts         백테스트 정확도 API (라벨별/코인별 적중률, 최근 결과)
  chat/route.ts             AI 채팅 API (시그널 컨텍스트 주입)

app/[locale]/crypto/
  page.tsx                  서버 컴포넌트 (공개 접근, 초기 시그널 fetch)
  CryptoDashboard.tsx       메인 클라이언트 대시보드 (language prop, i18n)

components/crypto/
  CoinCard.tsx              코인 카드 (심볼, 시그널 뱃지, 센티먼트 게이지, i18n)
  SentimentGauge.tsx        센티먼트 바 시각화 (-1~1)
  SignalTimeline.tsx        Trending / Top Signals 사이드바 (i18n)
  SignalNetwork.tsx         아코디언 + 3D Force Graph + WHY Trending Panel (react-force-graph-3d)
  WhyTrendingPanel.tsx      WHY 추론 패널 컨테이너 (5개 하위 컴포넌트 조합)
  ScoreBreakdown.tsx        점수 분해 4개 바 (velocity/sentiment/engagement/fomo)
  AiReasoningQuotes.tsx     AI reasoning 인용 블록 (상위 3개)
  SourceBreakdown.tsx       소스 분포 스택 바 (reddit/telegram/threads)
  PhraseCloud.tsx           키프레이즈 pill 태그 클라우드
  NarrativeContext.tsx      내러티브 + 이벤트 태그
  EventTimeline.tsx         이벤트 타임라인 (impact 색상, AI 뱃지, 코인 칩)
  CoinDetail.tsx            코인 상세 모달 (차트+FOMO+이벤트 ReferenceLine, 관계, 게시물, i18n)
  TimeWindowSelector.tsx    1h/6h/24h/7d 토글 (i18n)
  BacktestReport.tsx        백테스트 정확도 리포트 (아코디언, 적중률 바, 코인별, 최근 결과)
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
lib/i18n.ts                 crypto.* 번역 키 22개 × 5개 언어 + subtitle "X · Reddit · Threads · Telegram" 반영
package.json                react-force-graph-2d → react-force-graph-3d 의존성
types/crypto.ts             CryptoCoin, CryptoPrice, CryptoPricesResponse 타입 추가 (2026-03-20)
components/crypto/CoinCard.tsx        가격/변동률/코인아이콘 표시 (2026-03-20)
components/crypto/SignalNetwork.tsx    2D→3D 전환 + d3 force 튜닝 (center/charge/link 강화)
app/[locale]/crypto/CryptoDashboard.tsx  가격 fetch + priceMap 구성 + CoinCard에 price prop 전달
lib/crypto/coin-extractor.ts          extractCoinMentionsFromDB (DB 기반 + 1시간 캐시 + fallback)
lib/crypto/reddit-crawler.ts          extractCoinMentionsFromDB로 전환
lib/crypto/telegram-crawler.ts        extractCoinMentionsFromDB로 전환
lib/crypto/threads-crawler.ts         extractCoinMentionsFromDB로 전환
app/api/crypto/crawl/route.ts         Phase 4 (prices) + Phase 1d (Twitter, 12시간 간격) + Phase 6 (backtest) 추가 + parsePhase query param 지원
types/crypto.ts                       BacktestResult, BacktestSummary, BacktestCoinSummary, BacktestResponse 타입 추가 (2026-03-21)
lib/i18n.ts                           crypto.backtest.* 번역 키 7개 × 5개 언어 추가 (2026-03-21)
lib/crypto/battle-trader.ts           AI 로봇 전략 완화 — 5포지션/12%/score≥30/confidence≥55/24h→6h→1h 폴백 (2026-03-21)
lib/crypto/batch-sentiment.ts         배치 모드 전환 — 10건/호출, 소스별 그룹핑, 배치 실패→개별 폴백, 200건/배치 (2026-03-21)
app/[locale]/crypto/CryptoDashboard.tsx  트렌딩 사이드바 제거, 시간 필터→트렌딩 라인 이동, SignalTimeline import 제거 (2026-03-21)
components/crypto/SignalNetwork.tsx    자체 시간 필터 추가, 레전드 좌하단 오버레이, 코인칩→그래프+추론 동시 연동 (2026-03-21)
app/api/crypto/trending-explain/route.ts  시점 통일 (now→computed_at), 폴백 윈도우 제거 (2026-03-21)
app/api/crypto/crawl/route.ts         센티먼트 배치 크기 100→200 (2026-03-21)
supabase/functions/analyze-crypto-sentiment/index.ts  Gemini 2.5 Flash + 배치 모드(최대 10건) + maxOutputTokens 4096 (2026-03-21)
supabase/migrations/030_sentiment_filter_rpc.sql      RPC 룰베이스 필터 — 멘션≥1 + 길이≥30자 + source 반환 (2026-03-21)
lib/crypto/signal-generator.ts           FOMO/FUD 분리 — fetchWindowData 1회 + signalType별 필터/스코어 (2026-03-21)
lib/crypto/score-utils.ts                normalizeSentimentForFud + normalizeFud 추가 (2026-03-21)
lib/crypto/backtester.ts                 evaluateHit FUD 분기 + signal_type 컬럼 처리 (2026-03-21)
types/crypto.ts                          SignalType 추가, CryptoSignal/BacktestResult에 signal_type (2026-03-21)
app/api/crypto/signals/route.ts          signal_type 필터 + force-dynamic (2026-03-21)
app/api/crypto/backtest/route.ts         signal_type 필터 + force-dynamic (2026-03-21)
app/api/crypto/trending-explain/route.ts signal_type 필터 + FUD normalization 분기 + force-dynamic (2026-03-21)
app/api/crypto/network/route.ts          signal_type 필터 (2026-03-21)
app/api/crypto/history/route.ts          crypto_prices JOIN → price_usd 필드 추가 (2026-03-21)
components/crypto/CoinCard.tsx           FOMO/FUD 별도 색상 맵 (FUD=purple/rose, 🔻) (2026-03-21)
components/crypto/CoinDetail.tsx         signalType prop + 가격 라인 차트 + signal_type API 전달 (2026-03-21)
components/crypto/SignalNetwork.tsx       signal_type 전달 (fetchOwnSignals/fetchNetwork/fetchExplain) + 캐시 키 수정 + mb-3 (2026-03-21)
components/crypto/BacktestReport.tsx     signalType prop + mb-3 (2026-03-21)
components/crypto/SignalTimeline.tsx      signalType prop + FUD 시각 구분 (2026-03-21)
components/crypto/TimeWindowSelector.tsx whitespace-nowrap 추가 (2026-03-21)
app/[locale]/crypto/CryptoDashboard.tsx  FOMO/FUD 토글 + 필터 바 상단 이동 + CoinDetail signalType 전달 (2026-03-21)
lib/i18n.ts                              crypto.fomo/fud/price × 5개 언어 추가 (2026-03-21)
```

---

## Edge Functions

| 함수 | 모델 | 용도 | 배포 완료 |
|------|------|------|----------|
| `analyze-crypto-sentiment` | `gemini-2.5-flash` | Reddit/Telegram/Twitter 센티먼트 분석 — 배치 모드(최대 10건/호출) + 단일 모드 하위 호환 (score/label/fomo/fud/reasoning + **narratives/events**) | ✅ 배포 완료 (2026-03-21, Flash 업그레이드 + 배치 모드) |
| `analyze-threads-sentiment` | `gemini-2.5-flash-lite` | Threads 센티먼트 분석 — **미사용** (Threads 크롤링 비활성화) | 배포됨 (미사용) |

`google_API_KEY` secret 사용 (기존 Edge Function과 공유, Dashboard에 이미 등록됨).

### 배포 명령어
```bash
supabase functions deploy analyze-crypto-sentiment --project-ref tcpvxihjswauwrmcxhhh
```

---

## 환경변수

| 변수 | 위치 | 용도 | 상태 |
|------|------|------|------|
| `REDDIT_CLIENT_ID` | `.env.local` + Vercel | Reddit OAuth2 클라이언트 ID (현재 미사용 — 공개 JSON 엔드포인트 사용) | 미설정 (불필요) |
| `REDDIT_CLIENT_SECRET` | `.env.local` + Vercel | Reddit OAuth2 클라이언트 시크릿 (현재 미사용) | 미설정 (불필요) |
| `REDDIT_USER_AGENT` | `.env.local` + Vercel | Reddit API User-Agent (현재 미사용) | 미설정 (불필요) |
| `google_API_KEY` | Supabase Secrets | Gemini API (analyze-crypto-sentiment) | 기존 등록됨 |
| `THREADS_ACCESS_TOKEN` | `.env.local` + Vercel | Threads API 장기 액세스 토큰 (60일) | ✅ 설정 완료 (2026-03-20, 만료: ~2026-05-18) |
| `CRON_SECRET` | `.env.local` + Vercel | 크롤링 Bearer 인증 | 기존 등록됨 |
| `APIFY_API_TOKEN` | `.env.local` + Vercel | Apify API 토큰 (Twitter/X 크롤링, 무료 $5/월) | ✅ 설정 완료 (2026-03-21) |
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

**✅ Threads 설정 완료 (2026-03-20)**
- Threads 테스터 `gyeol_hh` 등록 + Threads 웹에서 초대 수락 완료
- OAuth Long-lived 토큰 발급 완료 (60일, 발급일: 2026-03-19, 만료: ~2026-05-18)
- `.env.local` + Vercel production에 `THREADS_ACCESS_TOKEN` 설정 완료
- `analyze-threads-sentiment` Edge Function 배포 완료
- 앱 라이브 모드 전환 완료 (개인정보처리방침 URL: `https://aca-info.com/terms`)

**현재 제한: `keyword_search` 자기 게시물만 반환**
- 앱이 라이브 모드이지만 `threads_keyword_search`가 **표준 액세스** 수준
- 공개 게시물 검색은 **고급 액세스** (Tech Provider 인증 + 앱 검수) 필요
- Tech Provider 요건: 비즈니스 인증 (사업자등록증) → 액세스 인증 → 앱 검수 3단계
- 개인/학생 프로젝트에서는 비즈니스 인증 불가 → **보류**

**토큰 갱신 절차** (60일 만료 시):
1. 브라우저에서 인증 코드 요청:
   ```
   https://threads.net/oauth/authorize?client_id=744117611965629&redirect_uri=https://localhost/&scope=threads_basic,threads_keyword_search&response_type=code
   ```
2. Threads 로그인 → 앱 승인 → `https://localhost/?code=XXXXXX#_` 에서 code 복사
3. Short-lived → Long-lived 토큰 교환 (위 절차 반복)
4. `.env.local` + Vercel에 `THREADS_ACCESS_TOKEN` 갱신

**⚠️ 앱 시크릿 재발급 필요**: 대화에서 앱 시크릿이 노출됨 → Meta 개발자 대시보드 → 앱 설정 → 기본 설정에서 리셋 필수

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

### Threads (코드 완료, 토큰 발급 완료, 공개 검색 보류)
- **방식**: Meta Threads API 공식 `keyword_search` 엔드포인트
- **장점**: 키워드 검색으로 크립토 관련 게시물만 정확 수집, 참여도 지표(views/likes/replies/reposts), 유저 프로필 → 인플루언서 감지
- **Rate limit**: 2,200쿼리/24시간 (30분 크론 = 하루 48회, 충분)
- **코드 완료**: `threads-crawler.ts`, `analyze-threads-sentiment` Edge Function 배포, `batch-sentiment.ts` 소스 라우팅, crawl route Phase 1c
- **토큰 발급 완료**: Long-lived 토큰 (60일, 만료: ~2026-05-18), `.env.local` + Vercel 설정 완료
- **앱 게시 완료**: 라이브 모드, 개인정보처리방침 URL 설정
- **블로커**: `keyword_search`가 자기 게시물만 반환. 공개 검색은 Tech Provider 인증 필요 (비즈니스 인증 = 사업자등록증 필요 → 보류)

### 4chan /biz/ (보류)
- **검토 결과**: 크립토 비율 ~28%, 나머지는 부동산/커리어/개인재무 노이즈
- **단점**: 익명(인플루언서 감지 불가), score 없음(품질 필터링 불가), NSFW 콘텐츠
- **결론**: Threads가 모든 면에서 우위 → **보류**

### Twitter/X (✅ Apify 연동 완료, 2026-03-21)
- **방식**: Apify `scrape.badger/twitter-tweets-scraper` Actor의 Advanced Search 모드
- **장점**: X/Twitter가 크립토 시그널에서 가장 빠른 소스 (인플루언서 트윗 → 가격 변동). Reddit API 승인 없이도 대체 가능
- **비용**: Apify 무료 플랜 $5/월, $0.0002/결과 (FREE 티어 동일), 12시간 간격 = 월 ~$1.20
- **키워드**: `memecoin`, `$DOGE OR $PEPE OR $SHIB`, `$BONK OR $WIF OR $FLOKI`, `crypto pump OR altcoin gem`, `$SOL OR $ETH memecoin`
- **결과**: 5키워드 × 20결과 = 100트윗/크롤, 172 코인 멘션 추출 확인
- **12시간 간격 제한**: `crawl/route.ts`에서 DB의 마지막 twitter crawled_at 체크, 미경과 시 자동 스킵
- **센티먼트**: 기존 `analyze-crypto-sentiment` Edge Function 재활용 (별도 Edge Function 불필요)
- **sanitize**: `sanitizeObject()` — Apify 응답의 lone surrogate/제어문자/HTML source 필드 등 JSON round-trip 정화
- **Apify 계정**: `predictable_magazine` (한결), User ID: `6ndnAzPtwdxborJRu`

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

### Twitter/X (Apify)
- Apify REST API: `POST https://api.apify.com/v2/acts/scrape.badger~twitter-tweets-scraper/run-sync-get-dataset-items?token=TOKEN`
- Input: `{mode: "Advanced Search", query: "memecoin lang:en", query_type: "Latest", max_results: 20}`
- 응답 스키마: `{id, text, full_text, created_at, username, user_name, user_followers_count, favorite_count, retweet_count, reply_count, quote_count, hashtags: [{tag: "..."}], ...}`
- `created_at` 형식: `"Fri Mar 20 15:39:08 +0000 2026"` (Twitter 표준)
- permalink 생성: `https://x.com/${username}/status/${id}`
- score 계산: `favorite_count + retweet_count * 2`
- 12시간 간격: `crypto_posts.crawled_at`에서 `source='twitter'` 최신 레코드 체크
- **sanitizeObject 필수**: Apify 응답에 lone surrogate, HTML source 필드(`<a href="...">Twitter Web App</a>`) 등 포함 → JSON round-trip으로 정화

### 코인 멘션 추출 전략
- **$DOGE / #PEPE** (고신뢰): 정규식 `/(?:\$|#)([A-Z]{2,10})\b/gi`
- **dogecoin, ethereum** (중신뢰): COIN_LIST alias 순회, 3자 미만 alias 스킵
- **DOGE** (저신뢰): ALL-CAPS 단어 매칭, 80+ 단어 블랙리스트 (THE, BUY, HODL, FOMO 등)
- 문맥 추출: 멘션 전후 30자 캡처 → crypto_mentions.context

### 시그널 가중치 공식 V2 (2026-03-21)
```
rawScore (0~100) =
  mention_velocity_norm × 25% +
  avg_sentiment_norm × 30% +
  sentiment_trend_norm × 15% +
  engagement_norm × 20% +
  fomo_avg_norm × 10%

mentionConfidence = clamp(mention_count / 5, 0, 1)
marketCapDampening = log10(rank) / log10(200), clamp(0.3, 1.0)

# V2 추가 (2026-03-21)
zScoreMultiplier = z_score > 2.0 ? 1.0 + (z-2)*0.25 : 1.0, max 1.5
crossPlatformMultiplier = sources==1 ? 0.7 : sources==2 ? 1.0 : 1.3
eventModifier = sum of matched event keywords, clamp(-30, +25)

weighted_score = clamp(
  rawScore × mentionConfidence × marketCapDampening
           × zScoreMultiplier × crossPlatformMultiplier
           + eventModifier
  , 0, 100)

contrarianWarning = bullish% > 85% → 'potential_reversal'
                  | bullish% < 15% → 'potential_bounce'
                  | null (별도 지표, 스코어 미반영)

signal_label (Heat 스케일):
  ≥80 → extremely_hot  (🔥 Extremely Hot)
  ≥60 → hot             (🟠 Hot)
  ≥40 → warm            (🟡 Warm)
  ≥20 → cool            (🔵 Cool)
  <20 → cold            (❄️ Cold)

trending 조건: velocity > 0.5 AND weighted_score ≥ 50
```

### Signal Network 시각화 + WHY Trending 패널 (2026-03-21)
- **라이브러리**: `react-force-graph-3d` (lazy import via useState, `dynamic()` 사용 안 함 — ref 전달 문제 해결)
- **nodeThreeObject 커스텀 렌더링**: THREE.SphereGeometry + MeshPhongMaterial (shininess 80, specular, emissive) + glow halo (SphereGeometry ×1.3, opacity 0.06) + SpriteText 라벨 (three-spritetext)
- **커스텀 라이팅**: 기본 조명 제거 → AmbientLight(0.6) + DirectionalLight×2(0.8/0.3) + PointLight(0.4)
- **아코디언**: 초기 닫힘, 300ms MD3 easing
- **레이아웃**: 좌측 60% 3D Force Graph + 우측 40% WHY Trending Panel (모바일: 상하 스택)
- **노드 크기**: `getNodeSize(mentions, max) * 0.8` — 센티먼트 색상, 타입별 색상 (influencer=보라, narrative=amber, event=rose)
- **엣지**: correlates_with(파란) / part_of(amber) / impacts(rose) / recommends(초록) / mentions(보라), weight 비례 굵기
- **d3 force**: charge=-300, link=60, center=2, warmupTicks=150, cooldownTicks=0
- **zoomToFit**: useEffect 500ms/2000ms + onEngineStop 200ms 후 호출 (3중 보장)
- **graphWidth 변경 대응**: selectedChip 변경 시 zoomToFit 100ms 지연 호출 (깜빡임 방지)
- **칩 전환 깜빡임 방지**: nodeThreeObject에서 selectedChip/activeNeighborSet 의존성 제거 → THREE 오브젝트 재생성 없이 하이라이트 전환
- **자체 시간 필터**: SignalNetwork 내부에 TimeWindowSelector 배치 (코인 칩 우측)
- **WHY 패널**: ScoreBreakdown + AiReasoningQuotes + SourceBreakdown + PhraseCloud + NarrativeContext + EventTimeline
- **Lazy fetch**: 코인 칩 클릭 시에만 API 호출, coin+window 키로 결과 캐시
- **테마**: `useIsDark()` 공유 훅

### DB 스키마 요약
| 테이블 | PK | UNIQUE | 주요 FK |
|--------|-----|--------|---------|
| crypto_posts | id (uuid) | source_id | — |
| crypto_mentions | id | — | post_id → crypto_posts |
| crypto_sentiments | id | post_id | post_id → crypto_posts | metadata JSONB (narratives/events) |
| crypto_signals | id | (coin_symbol, time_window, signal_type, computed_at) | — | signal_type('fomo'/'fud') + V2: z_score, source_count, contrarian_warning, sentiment_skew, detected_events[], event_modifier |
| crypto_entities | id | (entity_type, name) | — |
| crypto_relations | id | — | source/target_entity_id → crypto_entities |
| crypto_coins | id (uuid) | coingecko_id | — |
| crypto_prices | id (uuid) | — | coingecko_id → crypto_coins |
| crypto_backtest_results | id (uuid) | (coin_symbol, time_window, signal_type, signal_at, lookup_window) | — |

### 주의사항
- **센티먼트 배치 모드 (2026-03-21)**: Edge Function이 `{posts: [...]}` 배열을 받아 10건 한 번에 분석. 배치 실패 시 개별 `{title, body}` 호출로 자동 폴백. `get_posts_without_sentiment` RPC가 멘션≥1 + 길이≥30자 필터 적용 중 — 조정 시 `030_sentiment_filter_rpc.sql` 수정
- **Reddit 공개 JSON (2026-03-21)**: OAuth 미사용, `reddit.com/r/{sub}/{sort}.json` 직접 호출. API 키 불필요. rate limit은 IP 기반 (~60 req/min), 서브레딧 간 1초 딜레이로 대응
- **Threads 비활성화 (2026-03-21)**: `THREADS_ACCESS_TOKEN` 있어도 자기 게시물만 반환. 코드는 남아있으나 실질 데이터 없음
- `signal-generator.ts`의 JOIN 쿼리가 복잡해서 Supabase JS의 nested select가 정확히 동작하지 않을 수 있음 → fallback으로 simple mention count 방식 구현되어 있음
- `crypto_signals`의 UNIQUE 제약 `(coin_symbol, time_window, computed_at)` — computed_at이 동일 시각이어야 upsert 동작. 크롤링 실행마다 새 computed_at 생성됨
- Reddit API `after` 파라미터: null이면 마지막 페이지 → 루프 종료
- RLS 정책: 모든 테이블 읽기 전체 허용, 쓰기는 service_role 사용 (createServiceClient)
- **린터 주의**: SignalNetwork.tsx 수정 시 린터가 `useIsDark` 훅/language prop 등을 되돌리는 경향 있음. 수정 후 즉시 커밋 필요.
- **sanitizeText**: 각 크롤러(telegram/reddit/threads)에 `sanitizeText` 함수 적용. 제어 문자 + lone surrogate 제거. 멘션 추출 시에도 sanitized text 사용해야 `invalid input syntax for type json` 에러 방지됨 (2026-03-15 수정 완료)
- **504 타임아웃 해결 (2026-03-17)**: 3-Phase 분리로 근본 해결. 각 페이즈가 독립적으로 300초 확보. 센티먼트는 200초 시간 예산 + 미완료 시 자기 재호출.
- **Telegram fetch 타임아웃**: 개별 채널 fetch에 15초 AbortController 적용 (`fetchChannelPage`)
- **Twitter sanitize (2026-03-21)**: Apify 응답에 lone surrogate + HTML source 필드 포함 → `sanitizeObject()` (JSON round-trip)로 전체 row 정화. hashtags도 `[{tag: "..."}]` → `string[]` 정규화 필수. context 필드에도 `sanitizeText()` 적용.
- **Twitter 12시간 간격**: `crawl/route.ts`에서 DB 체크. Apify 무료 $5/월 크레딧 절약. `TWITTER_INTERVAL_MS = 12 * 60 * 60 * 1000`

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
- [x] Threads 테스터 등록 (`gyeol_hh`) + Threads 웹에서 초대 수락 (2026-03-20)
- [x] `THREADS_ACCESS_TOKEN` 환경변수 설정 (`.env.local` + Vercel) (2026-03-20)
- [x] `analyze-threads-sentiment` Edge Function 배포 (2026-03-20)
- [x] 앱 라이브 모드 전환 (개인정보처리방침 URL 설정) (2026-03-20)
- [x] 크롤링 테스트 — API 연결 성공 (200 OK), 자기 게시물 검색 확인 (2026-03-20)
- [ ] **앱 시크릿 재발급** (노출됨, Meta 개발자 대시보드에서 리셋 필수)
- [ ] **공개 게시물 검색** — Tech Provider 인증 필요 (비즈니스 인증 = 사업자등록증, 보류)

### Phase 9 — Why Trending 추론 시각화 (2026-03-21)
- [x] `score-utils.ts` 생성 + `signal-generator.ts` 리팩터
- [x] `TrendingExplainResponse` 타입 추가
- [x] `trending-explain` API 엔드포인트 생성
- [x] `useIsDark` 훅 공유 모듈 추출
- [x] WHY 패널 하위 컴포넌트 5개 생성 (ScoreBreakdown, AiReasoningQuotes, SourceBreakdown, PhraseCloud, NarrativeContext)
- [x] `WhyTrendingPanel.tsx` 컨테이너 생성
- [x] `SignalNetwork.tsx` 아코디언 + 좌우 분할 + WHY 패널 통합
- [x] `CryptoDashboard.tsx` timeWindow prop 전달
- [x] i18n ~15키 × 5언어 추가
- [x] 프로덕션 배포 성공 (WHY 패널 동작 확인)
- [ ] **그래프 크기 수정** — `nodeThreeObject` 커스텀 THREE.js 렌더링 필요 → `GRAPH_ZOOM_FIX_HANDOFF.md` 참조

### Phase B — 온톨로지 고도화 (2026-03-21)
- [x] `normalizeSentimentTrend()` 추가 + `signal-generator.ts`에서 사용
- [x] 점진적 감쇠 구현 (0.85^일수, 최소 0.05, decayed 플래그 조건부)
- [x] recommends 관계 생성 (bullish+confidence>0.7+score≥100)
- [x] Edge Function 프롬프트에 narratives/events 필드 추가
- [x] batch-sentiment.ts에서 narratives/events 파싱 → metadata JSONB 저장
- [x] knowledge-graph.ts에서 LLM 내러티브/이벤트 우선 사용 + fallback 유지
- [x] DB 마이그레이션 `026_add_sentiments_metadata.sql` 적용
- [x] Edge Function 배포 (analyze-crypto-sentiment + analyze-threads-sentiment)
- [x] TypeScript 0 에러, ESLint 기존 warning만
- [x] API 테스트 통과 (trending-explain, network, events)
- [ ] **프로덕션 검증** — 크롤링 1회 실행 후 LLM 내러티브/이벤트 생성 확인

### Phase C — 시각화 강화 (2026-03-21)
- [x] narrative/event 노드 클릭 → 소속 코인 하이라이트 (focusedNode + focusNeighborSet)
- [x] `/api/crypto/events` API 생성 + 테스트 통과
- [x] EventTimeline 컴포넌트 생성 + WhyTrendingPanel 통합
- [x] CoinDetail 차트에 FOMO 라인 + 이벤트 ReferenceLine 추가
- [x] recommends 엣지 초록 색상 렌더링
- [x] i18n `crypto.eventTimeline` 5개 언어 추가
- [x] 페이지 200 OK 확인

### Phase 10 — X/Twitter 크롤링 (2026-03-21)
- [x] `twitter-crawler.ts` 크롤러 구현 — Apify `scrape.badger` Advanced Search
- [x] `types/crypto.ts` — CryptoSource + ApifyTweet + TwitterSearchKeyword 타입 추가
- [x] `config.ts` — TWITTER_SEARCH_KEYWORDS 5개 + Actor/상수 설정
- [x] `crawl/route.ts` — Phase 1d 추가 (APIFY_API_TOKEN 조건부, 12시간 간격 제한)
- [x] `i18n.ts` — subtitle "X · Reddit · Threads · Telegram" 5개 언어
- [x] `APIFY_API_TOKEN` 환경변수 설정 (`.env.local` + Vercel production)
- [x] Apify API 테스트 — 201 응답, 트윗 수집 성공
- [x] JSON sanitize 수정 — `sanitizeObject()` + hashtags 정규화 + context sanitize
- [x] 프로덕션 테스트 — 100트윗 수집 + 172 코인 멘션 추출 + 에러 0개 (2026-03-21)
- [x] 12시간 간격 제한 동작 확인 (두 번째 크롤 시 자동 스킵)
- [ ] Apify 무료 크레딧 사용량 모니터링 (월 $5 내 유지 확인)

### Phase E — Signal Label Heat 스케일 전환 (2026-03-21)
- [x] `types/crypto.ts` SignalLabel 타입 변경
- [x] `score-utils.ts` computeSignalLabel() 반환값 변경
- [x] `backtester.ts` isBullish/isBearish → hot/cold 비교
- [x] `battle-trader.ts` 로봇 진입/반전 라벨 변경
- [x] `CoinCard.tsx` 뱃지 색상+라벨 (온도 팔레트)
- [x] `SignalTimeline.tsx` 이모지 매핑
- [x] `BacktestReport.tsx` 색상+표시명
- [x] DB 마이그레이션 `028_signal_label_heat.sql` 적용 (CHECK + 데이터 + 뷰)
- [ ] Vercel 배포 후 프로덕션 CoinCard 뱃지 확인

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
