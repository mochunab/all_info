# 크립토 데이터 파이프라인

> 6-Phase 파이프라인 (2026-03-21 최적화)
> Vercel 300초 제한 → 독립 HTTP 호출로 분리. `triggerNextPhase`는 5초 await fetch (요청 수신 확인 후 진행).

---

## 백엔드 파이프라인

```
GitHub Actions Cron (*/15, crypto-crawl.yml)
  ├─ Step 1: npx tsx scripts/crypto-reddit-crawl.ts (Reddit RSS — Vercel IP 차단 우회)
  └─ Step 2: POST /api/crypto/crawl {phase: "crawl"} (Telegram + Twitter + 나머지 체이닝)

Phase 1 (crawl): 크롤링 → sentiment 트리거
  ├─ Reddit (GitHub Actions에서 RSS로 메인 실행, Vercel route는 fallback)
  │   → .rss (Atom XML, GitHub Actions — hot만 반환) 또는 .json (Vercel — hot+new)
  │   → 10개 서브레딧 × hot+new → crypto_posts upsert → crypto_mentions
  │
  ├─ Telegram (✅ 23개 공개 채널, 매번 셔플 + 시간예산)
  │   → t.me/s/채널명 웹 프리뷰 스크래핑 (15초 fetch 타임아웃)
  │
  ├─ Threads (❌ 비활성화)
  │
  └─ Twitter/X (✅ Apify, 12시간 간격, 자동 스킵)
      → 5키워드 × 20결과 = 100트윗/크롤
  ↓ triggerNextPhase('sentiment') — 5s await

Phase 2 (sentiment): 센티먼트 — 미완료 시 자기 재호출
  → 멘션≥1 + 길이≥30자 필터 (RPC), 최대 200건
  → Gemini 2.5 Flash, 10건/배치, 200초 시간 예산
  ↓ triggerNextPhase('signals')

Phase 3 (signals): FOMO + FUD 시그널 + 지식그래프 (단일 페이즈)
  → generateAllSignals() — targetSignalType 없이 호출
  → fetchWindowData 윈도우당 1회 → 같은 raw data로 FOMO+FUD 둘 다 계산
  → 4윈도우 × 2타입 = 8개 조합, DB 쿼리 ~16개 (기존 32개에서 절반)
  → 지식그래프 업데이트 (엔티티/관계/감쇠)
  ↓ triggerNextPhase('prices')

Phase 4 (prices): CoinGecko 동기화 + 가격 수집
  → syncCoinList (66개) → fetchAndStorePrices
  ↓ triggerNextPhase('battle')

Phase 5 (battle): 배틀 거래 평가 (원숭이 vs 로봇)
  ↓ triggerNextPhase('backtest')

Phase 6 (backtest): 백테스팅 — 시그널 vs 실제 가격 비교
  → runBacktest + evaluatePending
  → 적중: hot→상승, cold→하락, warm→2%미만

별도 Cron (*/5, crypto-battle.yml): prices + battle
  → 파이프라인 전체를 안 거치고 가격+배틀만 독립 갱신
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
