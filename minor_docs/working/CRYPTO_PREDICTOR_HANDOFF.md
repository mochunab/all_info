# 밈코인 예측기 — 작업 인계 문서

> 최종 작업일: 2026-03-15
> 경로: `/ko/crypto` (Header "밈코인 예측기" 메뉴, master 전용)

---

## 프로젝트 배경 및 방향성

### 왜 만드는가
Insight Hub의 크롤링 인프라(Reddit → DB → AI 분석)를 활용해 밈코인 시장의 **"왜 이 코인이 뜨는가"를 설명 가능한 시그널로 제공**하는 기능. 단순 점수가 아닌 근거 체인(Explainable Signal)이 핵심 차별점.

### 전략적 위치
- **1단계**: master 계정 전용 내부 도구로 시작 (검증 기간)
- **2단계**: 성공 시 크립토 전용 플랫폼으로 피벗 예정
- 기존 Insight Hub 인프라 최대 활용 — 새 크롤러 엔진 없이 Reddit API + 기존 AI 파이프라인(Gemini Edge Function + 배치 패턴) 재활용

### 핵심 기능 3개
1. **Reddit 센티먼트 추적** — 5개 서브레딧 × 30분 크롤링 → 코인 멘션 추출 → LLM 센티먼트 분석
2. **가중 시그널 스코어** — 언급 속도 × 25% + 센티먼트 × 30% + 트렌드 × 15% + 참여도 × 20% + FOMO × 10% → 0~100점 + signal_label
3. **지식그래프** — 코인/인플루언서/내러티브 엔티티 + 상관관계 엣지 → "DOGE가 뜨는 이유"를 연결 관계로 설명

---

## 현재 상태

### 완료된 것 (전 Phase 코드 작성 완료)

**Phase 1 — Reddit 크롤링 + 코인 언급 추적**
1. **DB 마이그레이션** — 6개 테이블 생성 (crypto_posts, mentions, sentiments, signals, entities, relations) + RLS + updated_at 트리거
2. **Reddit OAuth2** — client_credentials grant, in-memory 캐시 55분 TTL
3. **Reddit 크롤러** — 5개 서브레딧 × hot/new × 최대 3페이지, 서브레딧 간 1초 딜레이, minScore 필터
4. **코인 멘션 추출** — 3단계 패턴 매칭: $TICKER/#TICKER(고신뢰) → 풀네임/alias(중신뢰) → ALL-CAPS(저신뢰, 블랙리스트 필터)
5. **코인 목록** — 상위 70+ 코인 (BTC~SOL, 밈코인 20+, AI토큰, DeFi, L2) + alias 역조회 맵
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
17. **서버 페이지** — master 계정 체크 (비로그인 → 로그인, 일반유저 → 홈 리다이렉트), 초기 시그널 SSR
18. **대시보드** — 코인카드 그리드(반응형 3열) + 시그널 타임라인(사이드바) + 검색 + 시간 윈도우 토글
19. **CoinCard** — 심볼, 멘션 수, velocity %, signal_label 뱃지, 센티먼트 게이지, score/engagement
20. **SentimentGauge** — -1~1 바 시각화 (bullish=green, neutral=yellow, bearish=red)
21. **SignalTimeline** — Trending(velocity>0.5 & score≥50) 우선 표시, 최대 10개
22. **CoinDetail 모달** — 코인 상세 (스코어, 멘션수, 센티먼트, 관련 엔티티, 관련 게시물 10개)
23. **TimeWindowSelector** — 1h/6h/24h/7d 토글 버튼
24. **AI 채팅 API** — `/api/crypto/chat` (시그널 컨텍스트 주입, chat-insight Edge Function 활용)
25. **Header 수정** — NAV_ITEMS에 '밈코인 예측기' 추가 (isMaster 조건)
26. **vercel.json** — `/api/crypto/crawl` cron (*/30 * * * *) + maxDuration 300
27. **i18n** — 크립토 번역 키 17개 × 5개 언어 (ko/en/vi/zh/ja)

### 미완료 (To-Do)

#### 우선순위 높음 (기능 동작에 필수)
1. ~~**환경변수 설정**~~ — ✅ Reddit API Access Request 제출 완료 (2026-03-15), 승인 대기 중. 승인 후 `.env.local` + Vercel에 `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` 추가
2. ~~**DB 마이그레이션 적용**~~ — ✅ `018_crypto_tables.sql` 적용 완료 (2026-03-15, `supabase db push`)
3. ~~**Edge Function 배포**~~ — ✅ `analyze-crypto-sentiment` 배포 완료 (2026-03-15)
4. **센티먼트 배치 쿼리 개선** — 현재 NOT IN 서브쿼리 방식이 Supabase JS에서 직접 지원 안 됨 → RPC 함수(`get_posts_without_sentiment`) 생성 또는 LEFT JOIN 방식으로 전환 필요
5. **첫 크롤링 테스트** — Reddit API 승인 후 `curl -X POST https://aca-info.com/api/crypto/crawl -H "Authorization: Bearer $CRON_SECRET"` 실행 후 DB 데이터 확인
6. ~~**서브레딧 목록 확장**~~ — ✅ config.ts에 5개 추가 완료 (2026-03-15): `memecoinmoonshots`, `CryptoMarkets`, `solana`, `Dogecoin`, `CryptoCurrencies` → 총 10개

#### 우선순위 중간 (기능 완성도)
6. **내러티브 엔티티 자동 생성** — 현재 coin/influencer만 자동 생성. LLM이 "AI tokens", "dog coins" 등 내러티브를 감지하여 entity_type='narrative' 생성 + part_of 관계 추가
7. **시계열 트렌드 계산** — `signal-generator.ts`의 `sentiment_trend` 현재 0 하드코딩 → 이전 윈도우 대비 센티먼트 변화율 계산
8. **엔티티 metadata에 일별 스냅샷** — crypto_entities.metadata JSONB에 일별 센티먼트/멘션 수 기록 (30일 보관)
9. **CoinDetail 차트** — 시간별 센티먼트/멘션 변화 차트 (recharts 또는 lightweight-charts)
10. **AI 채팅 개선** — 현재 chat-insight Edge Function에 systemPromptOverride 전달 → 크립토 전용 Edge Function 분리 고려
11. **에러 토스트** — 시그널 로딩 실패 시 사용자 알림 (현재 console.error만)

#### 우선순위 낮음 (확장)
12. **가격 데이터 연동** — CoinGecko/CoinMarketCap API로 실시간 가격 + 시그널 비교
13. **알림 시스템** — trending 알림 (velocity > 2.0 AND score ≥ 60) → 이메일/푸시
14. **백테스팅** — 과거 시그널 대비 실제 가격 변동 검증
15. **코인 그래프 시각화** — D3/force-graph로 지식그래프 인터랙티브 시각화
16. **크립토 전용 플랫폼 분리** — 피벗 시 독립 도메인/앱으로 분리

---

## 개발 플로우

### 데이터 파이프라인
```
Cron (30분마다) → /api/crypto/crawl (Bearer auth)
  │
  ├─ Phase 1: Reddit 크롤링
  │   → Reddit OAuth2 토큰 획득/갱신 (55분 캐시)
  │   → 서브레딧별 hot + new 게시물 fetch (limit=100, 최대 3페이지)
  │   → crypto_posts upsert (reddit_id 기준 중복 방지)
  │   → coin-extractor로 멘션 추출 → crypto_mentions 저장
  │
  ├─ Phase 2: 센티먼트 + 시그널
  │   → crypto_sentiments에 없는 crypto_posts 조회
  │   → analyze-crypto-sentiment Edge Function (Gemini 2.5 Flash Lite)
  │   → 5개 동시 처리 (Promise.allSettled), 3회 재시도
  │   → 시간 윈도우별(1h/6h/24h/7d) 시그널 생성 → crypto_signals upsert
  │
  └─ Phase 3: 지식그래프
      → 코인 엔티티 upsert (24시간 내 멘션 기준)
      → 인플루언서 엔티티 upsert (7일 내 고점수 3회+ 작성자)
      → 코인 상관관계 (동시 언급 3회+ → correlates_with)
      → 인플루언서→코인 관계 (고점수 게시물 → mentions)
```

### 프론트엔드 플로우
```
Header "밈코인 예측기" (master only)
  → /crypto 접근
  → 서버: master 권한 체크 + 초기 시그널 SSR
  → CryptoDashboard (클라이언트)
      ├─ TimeWindowSelector (1h/6h/24h/7d)
      ├─ 검색 input
      ├─ CoinCard Grid (반응형 3열)
      │   └─ 클릭 → CoinDetail 모달
      │       ├─ 스코어, 멘션, 센티먼트 게이지
      │       ├─ 관련 엔티티 태그
      │       └─ 관련 게시물 10개 (Reddit 링크)
      └─ SignalTimeline 사이드바
          └─ Trending / Top Signals
```

---

## 파일 구조

### 새로 생성한 파일
```
lib/crypto/
  config.ts                 서브레딧 설정, 코인 목록(70+), 상수/가중치
  reddit-auth.ts            Reddit OAuth2 토큰 관리 (cache.ts 활용)
  reddit-crawler.ts         Reddit API 크롤러 (hot+new, 중복 제거, upsert)
  coin-extractor.ts         3단계 코인 멘션 추출 ($TICKER, 풀네임, ALL-CAPS)
  batch-sentiment.ts        배치 센티먼트 처리 (Edge Function 우선, 5 concurrent)
  signal-generator.ts       시간 윈도우별 가중 시그널 계산
  knowledge-graph.ts        엔티티/관계 자동 생성 (coin, influencer, correlates_with)

types/crypto.ts             크립토 전체 TypeScript 타입 (DB Row, API, Reddit, Signal)

supabase/migrations/018_crypto_tables.sql    6개 테이블 + RLS + 트리거
supabase/functions/analyze-crypto-sentiment/index.ts   센티먼트 분석 Edge Function

app/api/crypto/
  crawl/route.ts            Cron 크롤링 엔드포인트 (Bearer, 300s, GET+POST)
  posts/route.ts            게시물 조회 API (coin/subreddit 필터)
  signals/route.ts          시그널 조회 API (window/coin 필터)
  coins/route.ts            코인 엔티티 + 관계 + 시그널 조회 API
  chat/route.ts             AI 채팅 API (시그널 컨텍스트 주입)

app/[locale]/crypto/
  page.tsx                  서버 컴포넌트 (master 체크, 초기 시그널 fetch)
  CryptoDashboard.tsx       메인 클라이언트 대시보드

components/crypto/
  CoinCard.tsx              코인 카드 (심볼, 시그널 뱃지, 센티먼트 게이지)
  SentimentGauge.tsx        센티먼트 바 시각화 (-1~1)
  SignalTimeline.tsx        Trending / Top Signals 사이드바
  CoinDetail.tsx            코인 상세 모달 (차트, 관계, 게시물)
  TimeWindowSelector.tsx    1h/6h/24h/7d 토글
```

### 수정한 기존 파일
```
components/Header.tsx       NAV_ITEMS에 '밈코인 예측기' 추가 (line 47, isMaster 조건)
vercel.json                 /api/crypto/crawl cron (*/30 * * * *) + maxDuration 300
lib/i18n.ts                 crypto.* 번역 키 17개 × 5개 언어 (각 언어 섹션 끝에 추가)
```

---

## Edge Functions

| 함수 | 모델 | 용도 | 배포 완료 |
|------|------|------|----------|
| `analyze-crypto-sentiment` | `gemini-2.5-flash-lite` | Reddit 게시물 센티먼트 분석 (score/label/fomo/fud/reasoning) | ✅ 배포 완료 (2026-03-15) |

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
| `CRON_SECRET` | `.env.local` + Vercel | 크롤링 Bearer 인증 | 기존 등록됨 |

### Reddit API 키 발급 방법
1. ~~https://www.reddit.com/prefs/apps 접속~~ — 2026년 기준 앱 생성 전 API Access Request 필수
2. https://support.reddithelp.com/hc/requests/new?ticket_form_id=14868593862164 에서 등록 티켓 제출 (2026-03-15 제출 완료)
3. 승인 후 https://www.reddit.com/prefs/apps → script 타입 앱 생성
4. name: InsightHub, redirect uri: http://localhost
5. 생성된 client_id (앱 이름 아래), client_secret 복사

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

### 시그널 가중치 공식
```
weighted_score (0~100) =
  mention_velocity_norm × 25% +
  avg_sentiment_norm × 30% +
  sentiment_trend_norm × 15% +
  engagement_norm × 20% +
  fomo_avg_norm × 10%

signal_label:
  ≥80 → strong_buy
  ≥60 → buy
  ≥40 → neutral
  ≥20 → sell
  <20 → strong_sell

trending 조건: velocity > 0.5 AND weighted_score ≥ 50
```

### DB 스키마 요약
| 테이블 | PK | UNIQUE | 주요 FK |
|--------|-----|--------|---------|
| crypto_posts | id (uuid) | reddit_id | — |
| crypto_mentions | id | — | post_id → crypto_posts |
| crypto_sentiments | id | post_id | post_id → crypto_posts |
| crypto_signals | id | (coin_symbol, time_window, computed_at) | — |
| crypto_entities | id | (entity_type, name) | — |
| crypto_relations | id | — | source/target_entity_id → crypto_entities |

### 주의사항
- `batch-sentiment.ts`의 NOT IN 서브쿼리가 Supabase JS에서 직접 지원 안 될 수 있음 → fallback으로 RPC 함수 또는 LEFT JOIN 방식 구현 필요 (코드에 fallback 분기 있음)
- `signal-generator.ts`의 JOIN 쿼리가 복잡해서 Supabase JS의 nested select가 정확히 동작하지 않을 수 있음 → fallback으로 simple mention count 방식 구현되어 있음
- `crypto_signals`의 UNIQUE 제약 `(coin_symbol, time_window, computed_at)` — computed_at이 동일 시각이어야 upsert 동작. 크롤링 실행마다 새 computed_at 생성됨
- Reddit API `after` 파라미터: null이면 마지막 페이지 → 루프 종료
- RLS 정책: 모든 테이블 읽기 전체 허용, 쓰기는 service_role 사용 (createServiceClient)

---

## 검증 체크리스트

### Phase 1
- [ ] `.env.local`에 `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` 설정 (승인 대기 중)
- [x] DB 마이그레이션 `018_crypto_tables.sql` 실행 (2026-03-15)
- [ ] `curl -X POST /api/crypto/crawl -H "Authorization: Bearer $CRON_SECRET"` 성공
- [ ] Supabase Dashboard에서 `crypto_posts`, `crypto_mentions` 데이터 확인
- [ ] `GET /api/crypto/posts?coin=DOGE` 응답 확인

### Phase 2
- [x] `supabase functions deploy analyze-crypto-sentiment` 배포 (2026-03-15)
- [ ] 크롤링 재실행 후 `crypto_sentiments` 테이블에 분석 결과 확인
- [ ] `GET /api/crypto/signals?window=24h` 응답에 weighted_score, signal_label 확인

### Phase 3
- [ ] `crypto_entities`에 코인/인플루언서 엔티티 자동 생성 확인
- [ ] `crypto_relations`에 correlates_with 엣지 생성 확인
- [ ] `GET /api/crypto/coins?search=DOGE` 관련 엔티티 포함 확인

### Phase 4
- [ ] Master 로그인 → Header에 "밈코인 예측기" 메뉴 노출
- [ ] 일반 유저 → 메뉴 미노출 + `/crypto` 직접 접근 시 홈 리다이렉트
- [ ] CoinCard 그리드 + SignalTimeline 렌더링
- [ ] CoinDetail 모달 열림 + 관련 게시물 표시
