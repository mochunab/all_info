# 크립토 설계 결정 + Phase 히스토리

> Phase별 구현 상세와 "왜 이렇게 했는가" 기록. 복기용.

---

## Phase 1 — Reddit 크롤링 + 코인 멘션 추적

1. **DB 마이그레이션** — 6개 테이블 생성 (crypto_posts, mentions, sentiments, signals, entities, relations) + RLS + updated_at 트리거
2. **Reddit OAuth2** — client_credentials grant, in-memory 캐시 55분 TTL
3. **Reddit 크롤러** — 10개 서브레딧 × hot/new × 최대 3페이지, 서브레딧 간 1초 딜레이, minScore 필터
4. **코인 멘션 추출** — 3단계 패턴 매칭: $TICKER/#TICKER(고신뢰) → 풀네임/alias(중신뢰) → ALL-CAPS(저신뢰, 블랙리스트 필터)
5. **코인 목록** — ~~144개 하드코딩~~ → DB 기반 (`crypto_coins` 테이블, CoinGecko 동기화 66개) + 하드코딩 fallback
6. **Cron 엔드포인트** — `/api/crypto/crawl` (Bearer auth, 300s maxDuration, 30분 간격)
7. **게시물 조회 API** — `/api/crypto/posts` (coin/subreddit 필터, 페이지네이션)

## Phase 2 — 센티먼트 분석 + 시그널 생성

8. **센티먼트 Edge Function** — `analyze-crypto-sentiment` (Gemini 2.5 Flash Lite → 이후 Flash로 업그레이드)
9. **배치 센티먼트** — 5개 동시 처리, 3회 재시도 (exponential backoff)
10. **시그널 생성** — 4개 시간 윈도우(1h/6h/24h/7d), 코인별 가중 스코어 → signal_label
11. **시그널 조회 API** — `/api/crypto/signals`

## Phase 3 — 지식그래프

12. **코인 엔티티 자동 생성** — 멘션된 코인 → crypto_entities upsert
13. **인플루언서 감지** — 7일간 고점수(50+) 게시물 3개 이상 작성자
14. **코인 상관관계** — 같은 게시물에 3회+ 동시 언급 → correlates_with
15. **인플루언서→코인 관계** — 고점수(100+) 게시물에서 코인 언급 → mentions

## Phase 4 — 대시보드 UI

17. **서버 페이지** — ~~master 전용~~ → 공개 접근 (인증 불필요), 초기 시그널 SSR
18. **대시보드** — 코인카드 그리드(반응형 3열) + 시그널 타임라인(사이드바) + 검색 + 시간 윈도우 토글
19-25. CoinCard, SentimentGauge, SignalTimeline, CoinDetail, TimeWindowSelector, AI 채팅, Header 수정
26. **GitHub Actions Cron** — Hobby 플랜이라 vercel.json 대신 GitHub Actions 사용
27. **i18n** — 크립토 번역 키 22개 × 5개 언어

## Phase 5 — Signal Network 그래프 시각화 (2026-03-15)

28. **SignalNetwork** — `react-force-graph-2d` 기반 (이후 3D로 전환)
    - 코인 = 원형 노드, 인플루언서 = 다이아몬드, 엣지 = correlates_with/mentions
    - 필터 칩: 상위 8개 코인 클릭 시 이웃만 하이라이트
29. **키워드 클라우드** — AI key_phrases 표시 (이후 PhraseCloud로 대체)
30. **Network API** — `/api/crypto/network`

## Phase 6 — Threads 연동 (2026-03-15 코드, 2026-03-20 토큰)

31. **Threads 크롤러** — Meta Threads API keyword_search 기반
32. **전용 센티먼트 Edge Function** — Threads 특성 반영 (500자, 이모지 해석, NFA/DYOR)
33. **Meta App 설정** — `acainfo` 앱, 앱 라이브 모드, OAuth Long-lived 토큰

**결정**: `keyword_search`가 자기 게시물만 반환 → Tech Provider 인증(사업자등록증) 필요 → 보류. 코드는 유지하되 크롤링에서 제외.

## Phase 7 — 타임아웃 방지 + 시그널 보정 (2026-03-17)

34. **3-Phase 파이프라인 분리** — 단일 호출 전체 실행 → crawl/sentiment/signals 3개 독립 호출
    - **왜**: Vercel 300초 타임아웃 근본 해결. 각 페이즈가 독립적으로 300초 확보.
    - 센티먼트: 200초 시간 예산, 미완료 시 자기 재호출
35. **멘션 신뢰도 감쇠** — `mentionConfidence = clamp(mentions / 5, 0, 1)`
    - **왜**: 1회 언급만으로 만점 나오는 문제 해결
36. **Telegram fetch 타임아웃** — 15초 AbortController

## Phase 8 — CoinGecko 가격 연동 (2026-03-20)

37-41. crypto_coins + crypto_prices 테이블, CoinGecko 동기화 66개, 30분 cron
42. **코인 멘션 추출 DB 전환** — 하드코딩 → DB 기반 (1시간 캐시, fallback 유지)
    - **왜**: 코인 목록 하드코딩은 확장성 없음. CoinGecko 매칭으로 66개 자동 동기화.
43-45. 가격 API, CoinCard 가격 표시, Dashboard 연동

## Phase 9 — Why Trending 추론 시각화 (2026-03-21)

46. **score-utils.ts 추출** — signal-generator.ts에서 공유 유틸 분리
    - **왜**: trending-explain API에서도 같은 정규화 로직 필요
47. **trending-explain API** — 점수 분해 + AI reasoning + 소스 분포 + 키프레이즈 + 내러티브
48-53. WHY 패널 하위 컴포넌트 5개, SignalNetwork 아코디언 + 좌우 분할

## Phase 10 — X/Twitter 크롤링 (2026-03-21)

69. **Twitter 크롤러** — Apify Actor 기반
    - **왜**: X/Twitter가 크립토 시그널에서 가장 빠른 소스. Reddit API 승인 없이도 가능.
    - 12시간 간격: Apify 무료 $5/월 내 운영 ($0.04/일 = $1.20/월)
70. **sanitizeObject** — Apify 응답에 lone surrogate/제어문자 포함 → JSON round-trip 정화
    - **교훈**: 외부 API 응답은 항상 sanitize 필요. 특히 소셜 미디어 텍스트.

## Phase B — 온톨로지 고도화 (2026-03-21)

54. **시계열 트렌드** — 이전 윈도우 대비 센티먼트 변화율
55. **점진적 감쇠** — 이진(0.1) → `0.85^(경과일수-7)`, 최소 0.05
    - **왜**: 7일 지난 데이터가 갑자기 0.1로 뚝 떨어지는 건 비현실적
56. **recommends 관계** — bullish+confidence>0.7+score≥100 → influencer→coin
57-58. LLM 내러티브/이벤트 동적 감지 — Edge Function 프롬프트에 추가

## Phase C — 시각화 강화 (2026-03-21)

62-68. 내러티브/이벤트 클릭 하이라이트, EventTimeline, CoinDetail FOMO+이벤트 차트, recommends 엣지

## Phase D — 백테스팅 (2026-03-21)

72-79. crypto_backtest_results 테이블, 적중 평가 로직, BacktestReport UI
- **적중 기준**: hot → 가격 상승, cold → 가격 하락, warm → 2% 미만 변동
- **교훈**: 초기 788개 레코드 모두 pending — 가격 데이터 축적 후 evaluatePending으로 자동 채움

## Phase E — Signal Label Heat 스케일 전환 (2026-03-21)

80-82. `strong_buy/buy/neutral/sell/strong_sell` → `extremely_hot/hot/warm/cool/cold`
- **왜**: 금융 규제 회피. "매매 지시"가 아닌 "커뮤니티 열기" 지표로 포지셔닝.
- **선례**: LunarCrush(Galaxy Score), Santiment(Social Volume)

## Phase F — 센티먼트 배치 + AI 배틀 완화 + UI 정리 (2026-03-21)

83. **Flash 업그레이드** — Flash Lite → Flash (reasoning 품질↑, 비용 차이 미미)
84. **배치 모드** — 1건1호출 → 10건1호출 (API 호출 90% 감소)
85. **룰베이스 필터** — 멘션 없는 글 + 30자 미만 제외 → 불필요한 AI 호출 방지
86. **배틀 전략 완화** — 데이터 부족 환경 대응 (포지션 5개/12%, 임계값 하향, 24h 폴백)
87-90. UI 정리, trending-explain 시점 통일, Threads 비활성화

## Phase G — Signal Scoring V2 (2026-03-21)

91-98. Z-score, 크로스플랫폼, 역행감지, 이벤트 스코어링, 3D 그래프 커스텀 렌더링
- **Z-score**: 과거 10개 윈도우 대비 비정상 급증 감지 (×1.0~1.5 부스트)
- **크로스플랫폼**: 1소스=×0.7, 2소스=×1.0, 3+소스=×1.3
- **역행감지**: bullish>85% → potential_reversal, <15% → potential_bounce (스코어 미반영, 경고만)
- **온체인 데이터**: Whale Alert API 유료($29.95/월) → 기존 텔레그램 whale_alert_io 채널로 대체 (비용 0)

## Phase H — FOMO/FUD 분리 + CoinDetail 가격 차트 (2026-03-21)

99-111. signal_type 컬럼, FOMO/FUD 독립 스코어, UI 토글, CoinDetail 가격 라인
- **왜**: 시그널 가중치 70%가 볼륨 기반 → 부정 멘션 폭증해도 "Hot" → 가격 예측 실패
- **해결**: FOMO(긍정 기반)/FUD(부정 기반) 분리, FUD Hot = 가격 하락이 적중

## Phase I — 온톨로지 → 시그널 피드백 루프 (2026-03-21)

112-122. KG Boost 상수, computeKGBoost(), 2-pass 시그널 계산, ScoreBreakdown UI
- **2-pass 계산**: Pass 1에서 기본 점수 → Pass 2에서 상관 코인 hot 여부 확인 후 KG 부스트 적용
- **왜**: 지식그래프 관계가 시그널에 반영되지 않으면 그래프가 장식에 불과

---

## 주의사항 (교훈 모음)

- **sanitizeText**: 모든 크롤러에 적용 필수. 제어 문자 + lone surrogate 미제거 시 `invalid input syntax for type json` 에러 발생
- **504 타임아웃**: 3-Phase 분리로 근본 해결. 각 페이즈 독립 300초.
- **센티먼트 배치 모드**: 배치 실패 시 개별 폴백 필수. `get_posts_without_sentiment` RPC 조정 시 `030_sentiment_filter_rpc.sql` 수정
- **Reddit 공개 JSON**: OAuth 미사용. IP 기반 rate limit (~60 req/min), 서브레딧 간 1초 딜레이로 대응
- **signal-generator.ts JOIN**: Supabase JS nested select 부정확 → fallback simple mention count 구현됨
- **crypto_signals UNIQUE**: `(coin_symbol, time_window, computed_at)` — computed_at 동일 시각이어야 upsert 동작
- **린터 주의**: SignalNetwork.tsx 수정 시 린터가 훅/prop을 되돌리는 경향. 수정 후 즉시 커밋 필요.
- **Twitter sanitize**: Apify 응답에 lone surrogate + HTML source 필드 포함 → `sanitizeObject()` (JSON round-trip) 전체 row 정화 필수
- **Twitter 12시간 간격**: Apify 무료 $5/월 크레딧 절약. `TWITTER_INTERVAL_MS = 12 * 60 * 60 * 1000`
