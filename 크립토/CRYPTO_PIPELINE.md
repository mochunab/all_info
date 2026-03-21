# 크립토 데이터 파이프라인

> 3-Phase → 7-Phase 분리 (2026-03-17~21)
> 타임아웃 방지: 단일 호출에서 전체 파이프라인 실행 시 Vercel 300초 제한 초과 → 독립 HTTP 호출로 분리. 각 페이즈 완료 후 fire-and-forget으로 다음 페이즈 트리거.

---

## 백엔드 파이프라인

```
GitHub Actions Cron (15분마다) → POST /api/crypto/crawl {phase: "crawl"}

Phase 1 (crawl): 크롤링만 — 완료 후 자동으로 Phase 2 트리거
  ├─ Reddit (✅ 동작 중, 공개 JSON 엔드포인트 — API 키 불필요)
  │   → reddit.com/r/{sub}/{sort}.json 직접 호출 (OAuth 미사용)
  │   → 서브레딧별 hot + new fetch (limit=100, 최대 3페이지)
  │   → crypto_posts upsert → coin-extractor → crypto_mentions
  │
  ├─ Telegram (✅ 동작 중, API 키 불필요)
  │   → 23개 공개 채널 웹 프리뷰 스크래핑 (t.me/s/, 15초 fetch 타임아웃)
  │   → Cheerio HTML 파싱 → crypto_posts upsert → crypto_mentions
  │
  ├─ Threads (❌ 비활성화 — 자기 게시물만 반환, Tech Provider 인증 보류)
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

Phase 3a (signals): FOMO 시그널 생성
  → crypto_prices에서 최신 market_cap 조회 → 시총 기반 dampening 계산
  → 시간 윈도우별(1h/6h/24h/7d) FOMO 시그널 생성 → crypto_signals upsert
  ↓ fire-and-forget: {phase: "signals_fud"}

Phase 3b (signals_fud): FUD 시그널 + 지식그래프
  → FUD 시그널 생성 → crypto_signals upsert
  → 코인/인플루언서 엔티티 upsert
  → 코인 상관관계 + 인플루언서→코인 관계 업데이트
  ↓ fire-and-forget: {phase: "prices"}

Phase 4 (prices): CoinGecko 코인 동기화 + 가격 수집
  → syncCoinList: CoinGecko /coins/list → crypto_coins upsert (66개)
  → fetchAndStorePrices: /coins/markets → crypto_prices insert (65개, null 가격 스킵)
  → crypto_coins에 image_url, market_cap_rank 메타데이터 업데이트
  ↓ fire-and-forget: {phase: "battle"}

Phase 5 (battle): 배틀 거래 평가
  ↓ fire-and-forget: {phase: "backtest"}

Phase 6 (backtest): 백테스팅 — 시그널 vs 실제 가격 비교
  → runBacktest: 최근 7일 시그널 → 가격 매칭 → crypto_backtest_results upsert
  → evaluatePending: 미평가 건 재평가 (가격 데이터 새로 쌓인 것으로 매칭)
  → 적중 기준: hot(extremely_hot/hot)→상승, cold(cool/cold)→하락, warm→2%미만

별도 Cron (5분마다, crypto-battle.yml): prices + battle
  → 파이프라인 전체를 안 거치고 가격만 독립 갱신
```

---

## 프론트엔드 플로우

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
