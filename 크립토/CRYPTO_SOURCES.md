# 크립토 데이터 소스

---

## 현재 활성 소스

### Reddit (✅ 동작 중)
- **방식**: RSS (Atom XML) — `scripts/crypto-reddit-crawl.ts` (GitHub Actions에서 실행)
- Vercel IP가 Reddit에 차단됨 → GitHub Actions에서 RSS로 크롤링하여 우회
- Vercel route에도 JSON fallback 코드 존재 (로컬 테스트용)
- API 키 불필요, 10개 서브레딧 × hot+new
- `r/CryptoCurrencies` → `r/wallstreetbetscrypto`로 교체 (2026-03-21): 범용 잡음 ↓, 트레이더 시그널 ↑

### Twitter/X (✅ 동작 중, Apify)
- **방식**: Apify `scrape.badger/twitter-tweets-scraper` Actor의 Advanced Search 모드
- **비용**: Apify 무료 $5/월, $0.0002/결과, 12시간 간격 = 월 ~$1.20
- **키워드 (10개)**: `memecoin`, `$DOGE OR $PEPE OR $SHIB`, `$BONK OR $WIF OR $FLOKI`, `crypto pump OR altcoin gem`, `$SOL OR $ETH memecoin`, `#memecoin OR #memecoins`, `#100xgem OR #moonshot`, `$TRUMP OR $MELANIA OR $VIRTUAL`, `crypto whale OR whale alert`, `$AI16Z OR $AIXBT OR $TAO`
- **결과**: 10키워드 × 20결과 = 200트윗/크롤
- **6시간 간격**: Apify 무료 플랜($5/월), 10키워드 × 20결과 × 4회/일 = ~$4.80/월. `crawl/route.ts`에서 DB의 마지막 twitter crawled_at 체크
- **센티먼트**: 기존 `analyze-crypto-sentiment` Edge Function 재활용
- **sanitize 필수**: `sanitizeObject()` (JSON round-trip) — lone surrogate + HTML source 필드 정화. hashtags `[{tag: "..."}]` → `string[]` 정규화
- **Apify 계정**: `predictable_magazine` (한결), User ID: `6ndnAzPtwdxborJRu`
- API: `POST https://api.apify.com/v2/acts/scrape.badger~twitter-tweets-scraper/run-sync-get-dataset-items?token=TOKEN`
- `created_at` 형식: `"Fri Mar 20 15:39:08 +0000 2026"`, permalink: `https://x.com/${username}/status/${id}`
- score: `favorite_count + retweet_count * 2`

### Telegram (✅ 동작 중)
- **방식**: 23개 공개 채널 웹 프리뷰 스크래핑 (`t.me/s/채널명`)
- 봇 초대 없이 웹 스크래핑, API 키 불필요
- 15초 fetch 타임아웃 (AbortController)
- config.ts에 채널 목록: binance_announcements, cryptoVIPsignalTA, whale_alert_io 등
- **비활성 채널 감지**: 크롤링 완료 후 7일간 게시물 0개 채널을 콘솔 경고로 출력 (`telegram-crawler.ts`)

### CoinGecko Trending (✅ 동작 중)
- **방식**: CoinGecko 무료 API `/api/v3/search/trending` — 검색량 급등 Top 15 코인
- API 키 불필요, 매 크롤마다 실행 (15분 간격)
- `crypto_posts`에 `coingecko` 소스로 저장 → 기존 멘션 추출 파이프라인 재활용
- **시그널 연동 3중 부스트**:
  1. `crossPlatformMultiplier` — 4번째 소스로 교차 검증 (0.7→1.0→1.3 자동 반영)
  2. `cgTrendingModifier` — rank 1~3 → +12, 4~7 → +8, 8~15 → +5 (eventModifier에 합산)
  3. 조기 감지 — trending이면 `mentionConfidence` 최소 0.4 보장 (소셜 멘션 적어도 시그널 억제 방지)
- `source_id`: `cg_trending_{coingecko_id}_{시간}` (시간 단위 중복 방지)

### DexScreener 온체인 (✅ 동작 중)
- **방식**: DexScreener 무료 API — DEX 거래 데이터로 온체인 이벤트 감지
- API 키 불필요, 시그널 생성 Phase에서 1회 fetch (전체 윈도우/signalType 공유)
- **파일**: `lib/crypto/dexscreener.ts`
- **API 엔드포인트**:
  - `GET /token-boosts/latest/v1` — 프로모션 토큰 주소 수집
  - `GET /latest/dex/search?q={symbol}` — 심볼별 최대 유동성 pair 조회 (5 병렬, 250ms 딜레이)
- **DEX_EXCLUDE**: BTC, ETH, BNB, SOL, XRP, ADA 등 21개 CEX 중심 대형 코인 제외 (DEX 거래량 비대표적)
- **4종 이벤트 → eventModifier에 합산**:
  - `volume_spike` (+7): h1 거래량 > h6 평균의 5배
  - `liquidity_drain` (-12): 유동성 < 24h 거래량의 50%
  - `sell_pressure` (-5): sells/buys > 3배
  - `token_boosted` (-3): DexScreener 유료 프로모션 (tokenAddress 매칭)
- **시그널 연동**: `detected_events`에 `dex:` prefix로 추가 → WHY Trending 패널 EventTimeline에 표시

---

## 비활성화 소스

### Threads (❌ 코드 존재, 비활성화)
- **방식**: Meta Threads API `keyword_search`
- **문제**: 자기 게시물만 반환. 공개 검색은 Tech Provider 인증 필요 (비즈니스 인증 = 사업자등록증 → 보류)
- Meta App: `acainfo` (App ID: `949873810905349`), Threads 앱 ID: `744117611965629`
- 토큰 발급 완료 (만료: ~2026-05-18), 앱 라이브 모드

### 4chan /biz/ (✅ 동작 중)
- **방식**: 4chan JSON API (`a.4cdn.org/biz/`) — 무료, API 키 불필요
- **파일**: `lib/crypto/fourchan-crawler.ts`
- catalog.json → 크립토 쓰레드 필터 (`isCryptoRelated`) → 상위 30개 쓰레드 댓글 fetch (1.1초 간격)
- **coin-extractor strictMode**: `$TICKER` + 긴 alias(≥8자)만 매칭 → 일반 영단어 오탐 방지
- 나머지 코인 감지는 LLM 센티먼트 분석이 `mentioned_coins`로 보완
- **볼륨**: 1회 크롤 ~500건, 일 ~1,000건 (중복 제거 후)
- **비용**: $0
- **주의**: /biz/는 일반 금융 게시판이라 크립토 비율 ~21%. 필터링 필수

---

## 확장 예정

### Discord 봇 (다음 우선순위)
- **방식**: Discord Bot API + discord.js (공식 API만 ToS 준수)
- **제약**: 봇이 서버에 초대되어야 메시지 접근 가능 (관리자 협조 필수)
- **MESSAGE_CONTENT 특권 인텐트**: 75개 서버 미만이면 자동 승인
- **아키텍처**: REST API 배치 수집 (Cron) → Supabase DB → 기존 센티먼트 파이프라인 재활용
- **타겟 서버**: 5-30k 규모의 중소 크립토 커뮤니티
- **DM 피칭 현황** (2026-03-15):
  - SolanaMemeCoins (38k) — 서포트 티켓
  - Insider Watchers (2,323명) — Owner "tumblr boi" (kushfr)
  - MemeCoin Discord (12,184명) — Owner "Frank" (frank.s0l)
  - MemeCoinCalls (5,113명) — Admin ".Manutobuizumaki."
  - **응답 대기 중**
- **피칭 전략**: 대학 캡스톤 프로젝트 + 무료 대시보드 제공 + read-only 봇 zero risk 강조
- **ToS 주의**: 수집 데이터로 ML 학습 금지 (추론/분석은 OK), 개인 메시지 저장 금지
