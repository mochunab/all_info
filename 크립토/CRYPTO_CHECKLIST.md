# 크립토 검증 체크리스트

---

## 미완료 항목

### Phase 1
- [ ] Reddit OAuth API 키 발급 (승인 대기 — 현재 공개 JSON으로 동작 중이라 비필수)

### Phase 6 — Threads
- [ ] **앱 시크릿 재발급** (노출됨, Meta 개발자 대시보드에서 리셋 필수)
- [ ] 공개 게시물 검색 — Tech Provider 인증 필요 (보류)

### Phase 10 — X/Twitter
- [ ] Apify 무료 크레딧 사용량 모니터링 (월 $5 내 유지)

---

## 완료된 항목 (축약)

| Phase | 주요 검증 | 완료일 |
|-------|-----------|--------|
| 1 | DB 마이그레이션, GitHub Actions cron, Telegram 크롤링 (186개 저장) | 2026-03-15 |
| 2 | Edge Function 배포, 센티먼트 30/30, 시그널 82개 | 2026-03-15 |
| 4 | Header 노출, 비로그인 접근, CoinCard/CoinDetail, i18n | 2026-03-15 |
| 5 | SignalNetwork 렌더링, 필터 칩, /api/crypto/network, 라이트 테마 노드 가독성 | 2026-03-21 |
| 6 | Threads 크롤러, Edge Function, Meta App, 토큰, 앱 라이브 모드 | 2026-03-20 |
| 8 | crypto_coins 66개, 가격 65개, Phase 4 체이닝, 30분 cron, 프로덕션 가격 표시 확인 | 2026-03-21 |
| 9 | score-utils, trending-explain API, WHY 패널 5개, 프로덕션 배포 | 2026-03-21 |
| 10 | Twitter 크롤러, 100트윗+172멘션, 12시간 간격, sanitize | 2026-03-21 |
| B | sentimentTrend, 점진적 감쇠, recommends, LLM 내러티브/이벤트, 프로덕션 생성 확인 | 2026-03-21 |
| C | narrative/event 하이라이트, EventTimeline, CoinDetail 차트 강화 | 2026-03-21 |
| D | 백테스트 788건, runBacktest + evaluatePending | 2026-03-21 |
| E | SignalLabel Heat 스케일, DB 전환, 8개 파일 수정, CoinCard 뱃지 확인 | 2026-03-21 |
| F | 센티먼트 배치 10건/호출, 배틀 완화, UI 정리 | 2026-03-21 |
| G | V2 스코어링, Z-score, 크로스플랫폼, 역행감지, 3D nodeThreeObject | 2026-03-21 |
| H | FOMO/FUD 분리, CoinDetail 가격 차트, 4개 API signal_type | 2026-03-21 |
| I | KG Boost, 2-pass 시그널, ScoreBreakdown UI, 프로덕션 검증 | 2026-03-21 |
| L | DexScreener 온체인 시그널, tokenAddress 매칭, DEX_EXCLUDE 대형코인 제외, modifier 밸런스 조정 | 2026-03-22 |
| K | 4chan /biz/ 크롤러, strictMode 멘션 추출, context 검증(AMBIGUOUS_SYMBOLS), dry-run 품질 검증 | 2026-03-22 |
| M | 센티먼트 독립 크론 분리 (crypto-sentiment.yml, 5분), 크롤 route에서 triggerNextPhase 제거 | 2026-03-22 |
