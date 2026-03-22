# 크립토 데이터 파이프라인

> 6-Phase 파이프라인 (2026-03-22 최적화)
> 크롤과 센티먼트 완전 분리 — 각각 독립 GitHub Actions 크론으로 실행.

---

## 백엔드 파이프라인

```
── 크론 1: 크롤링 (*/15, crypto-crawl.yml) ──
  ├─ Step 1: npx tsx scripts/crypto-reddit-crawl.ts (Reddit RSS — Vercel IP 차단 우회)
  └─ Step 2: POST /api/crypto/crawl {phase: "crawl"}

Phase 1 (crawl): 데이터 수집만 (센티먼트 트리거 없음)
  ├─ Reddit (GitHub Actions에서 RSS 실행, 15개 서브레딧 × hot+new+rising)
  ├─ Telegram (27개 공개 채널, 셔플 + 시간예산)
  ├─ CoinGecko Trending (무료 API, Top 15)
  ├─ 4chan /biz/ (무료 JSON API, 크립토 쓰레드 30개, strictMode 멘션 추출)
  ├─ Threads (❌ 비활성화)
  └─ Twitter/X (Apify, 6시간 간격, 자동 스킵)

── 크론 2: 센티먼트 + 시그널 (*/5, crypto-sentiment.yml) ──
  Step 1: POST /api/crypto/crawl {phase: "sentiment"}
  Step 2: POST /api/crypto/crawl {phase: "signals"}

Phase 2 (sentiment): 독립 실행, 250초 시간 예산
  → 멘션≥1 + 길이≥30자 필터 (RPC), 최대 200건
  → Gemini 2.5 Flash, 10건/배치
  → 크롤과 독립 → 적체 없이 5분마다 처리

Phase 3 (signals): FOMO + FUD 시그널 + 지식그래프 + 온체인
  → 1차 패스: fetchWindowData 윈도우당 1회 + 멘션 코인 수집
  → DexScreener 온체인 시그널 1회 fetch (대형 CEX 코인 제외)
  → 2차 패스: FOMO+FUD 시그널 계산 (온체인 이벤트 → eventModifier 합산)
  → 지식그래프 업데이트 (엔티티/관계/감쇠)

── 크론 3: 가격 + 배틀 (*/5, crypto-battle.yml) ──
  Phase 4 (prices): CoinGecko 동기화 + 가격 수집
  Phase 5 (battle): 배틀 거래 평가 (원숭이 vs 로봇)

── 백테스트 (Phase 6, signals 내부에서 트리거) ──
  → runBacktest + evaluatePending
  → 적중: hot→상승, cold→하락, warm→2%미만
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
