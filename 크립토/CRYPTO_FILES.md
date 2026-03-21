# 크립토 파일 구조

---

## 새로 생성한 파일

### 백엔드 라이브러리
```
lib/crypto/
  config.ts                 서브레딧 10개 + 텔레그램 23개 + Threads 키워드 10개 + Twitter 키워드 10개, 코인 목록(73개 하드코딩 fallback), 상수/가중치 + V2 상수 + KG_BOOST 상수
  coingecko-trending.ts     CoinGecko Trending API 크롤러 (무료, Top 15 코인, 3중 시그널 부스트)
  coin-sync.ts              CoinGecko /coins/list → crypto_coins 동기화
  price-fetcher.ts          CoinGecko /coins/markets → crypto_prices 가격 스냅샷 (30분 cron)
  reddit-auth.ts            Reddit OAuth2 토큰 관리 (cache.ts 활용)
  reddit-crawler.ts         Reddit API 크롤러 (hot+new, 중복 제거, upsert)
  telegram-crawler.ts       Telegram 웹 프리뷰 스크래핑 (t.me/s/, Cheerio 파싱)
  threads-crawler.ts        Threads API 키워드 검색 크롤러 (비활성화)
  twitter-crawler.ts        Apify scrape.badger Actor 기반 X/Twitter 크롤러 (10키워드, 6시간 간격, sanitizeObject)
  coin-extractor.ts         3단계 코인 멘션 추출 — DB 기반 (extractCoinMentionsFromDB) + 하드코딩 fallback
  batch-sentiment.ts        배치 센티먼트 처리 (소스별 Edge Function 라우팅, 10건/배치)
  score-utils.ts            공유 스코어링 유틸 V2 (clamp, normalize*, computeSignalLabel, computeMentionConfidence, computeMarketCapDampening, computeZScore, computeZScoreMultiplier, computeCrossPlatformMultiplier, computeContrarianWarning, computeEventModifier, computeKGBoost)
  signal-generator.ts       시간 윈도우별 가중 시그널 계산 V2 (2-pass: 기본 점수 → KG 부스트)
  knowledge-graph.ts        엔티티/관계 자동 생성 — LLM 내러티브/이벤트 통합, 점진적 감쇠, recommends 관계
  backtester.ts             백테스팅 — 시그널 vs 가격 비교, 적중 평가
  battle-trader.ts          AI vs 랜덤 배틀 트레이딩 (포지션 5개/12%, score≥30, 24h→6h→1h 폴백)
```

### 공유 훅
```
lib/hooks/
  useIsDark.ts              다크모드 감지 공유 훅
```

### 타입
```
types/crypto.ts             크립토 전체 TypeScript 타입 (DB Row, API, Reddit, Telegram, Threads, Twitter, Signal, Backtest)
```

### DB 마이그레이션
```
supabase/migrations/
  018_crypto_tables.sql               6개 테이블 + RLS + 트리거
  021_crypto_prices.sql               crypto_coins + crypto_prices 테이블 + RLS
  026_add_sentiments_metadata.sql     crypto_sentiments.metadata JSONB
  027_crypto_backtest.sql             crypto_backtest_results + crypto_backtest_summary 뷰
  028_signal_label_heat.sql           signal_label buy/sell → heat 스케일 전환
  029_signal_type_fomo_fud.sql        signal_type + UNIQUE 재정의 + backtest_summary 뷰 재생성
  030_sentiment_filter_rpc.sql        RPC 룰베이스 필터 (멘션≥1 + 길이≥30자)
  031_signal_scoring_v2.sql           V2 컬럼 추가 (z_score, source_count, contrarian_warning 등)
```

### Edge Functions
```
supabase/functions/
  analyze-crypto-sentiment/index.ts   Reddit/Telegram/Twitter 센티먼트 — 배치 모드 + narratives/events
  analyze-threads-sentiment/index.ts  Threads 전용 센티먼트 (미사용)
```

### API Routes
```
app/api/crypto/
  crawl/route.ts            Cron 크롤링 (Bearer, 300s, GET+POST, 6-Phase)
  posts/route.ts            게시물 조회 (coin/subreddit 필터)
  signals/route.ts          시그널 조회 (window/coin/signal_type 필터)
  coins/route.ts            코인 엔티티 + 관계 + 시그널 조회
  network/route.ts          그래프 데이터 (nodes + links + keywords)
  events/route.ts           이벤트 타임라인 (coin 필터)
  trending-explain/route.ts 추론 시각화 (점수 분해 + AI 근거 + KG 부스트)
  prices/route.ts           코인 가격 조회
  history/route.ts          시계열 데이터 (멘션+센티먼트+가격)
  backtest/route.ts         백테스트 정확도
  battle/route.ts           AI vs 랜덤 배틀 거래 평가
  chat/route.ts             AI 채팅 (시그널 컨텍스트 주입)
```

### 페이지 + 컴포넌트
```
app/[locale]/crypto/
  page.tsx                  서버 컴포넌트 (공개 접근, 초기 시그널 SSR)
  CryptoDashboard.tsx       메인 클라이언트 대시보드

components/crypto/
  CoinCard.tsx              코인 카드 (시그널 뱃지, 가격, FOMO/FUD 색상)
  SentimentGauge.tsx        센티먼트 바 시각화 (-1~1)
  SignalTimeline.tsx        Trending / Top Signals
  SignalNetwork.tsx         아코디언 + 3D Force Graph + WHY Trending Panel
  WhyTrendingPanel.tsx      WHY 추론 패널 컨테이너
  ScoreBreakdown.tsx        점수 분해 4개 바 + KG 부스트 패널
  AiReasoningQuotes.tsx     AI reasoning 인용 블록
  SourceBreakdown.tsx       소스 분포 스택 바
  PhraseCloud.tsx           키프레이즈 pill 태그
  NarrativeContext.tsx      내러티브 + 이벤트 태그
  EventTimeline.tsx         이벤트 타임라인
  CoinDetail.tsx            코인 상세 모달 (차트+관계+게시물)
  TimeWindowSelector.tsx    1h/6h/24h/7d 토글
  BacktestReport.tsx        백테스트 정확도 리포트
  BacktestTrendCharts.tsx   백테스트 추이 차트
  MonkeyVsRobot.tsx         AI vs 랜덤 배틀 UI
```

### 스크립트
```
scripts/
  crypto-reddit-crawl.ts    Reddit RSS 크롤러 (GitHub Actions 전용 — Vercel IP 차단 우회, Atom XML 파싱)
```

### GitHub Actions
```
.github/workflows/
  crypto-crawl.yml          15분마다 Reddit RSS + Vercel crawl POST 호출
  crypto-battle.yml         5분마다 prices + battle (독립 갱신)
```

---

## 수정한 기존 파일

| 파일 | 변경 내용 |
|------|-----------|
| `components/Header.tsx` | NAV_ITEMS에 밈코인 예측기 추가 (master 전용, i18n) |
| `vercel.json` | /api/crypto/crawl maxDuration 300 + */30 cron (phase=prices) |
| `lib/i18n.ts` | crypto.* 번역 키 전체 + subtitle |
| `package.json` | react-force-graph-3d, three-spritetext 의존성 |
