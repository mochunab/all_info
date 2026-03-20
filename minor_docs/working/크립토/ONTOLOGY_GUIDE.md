# Insight Hub 크립토 온톨로지 가이드

> 최종 갱신: 2026-03-21
> "온톨로지 없는 시그널은 숫자일 뿐이고, 시그널 없는 온톨로지는 박물관이다."

---

## 1. 도메인 정의

**"소셜 미디어(Reddit · Telegram · Threads)에서 발생하는 크립토 커뮤니티 담론을 구조화하여, 특정 코인이 왜 주목받는지를 관계 기반으로 설명하는 지식그래프."**

단순 점수(0~100)가 아닌 **근거 체인(Explainable Signal)** 이 핵심 차별점.
예: `DOGE score=72` → *왜?* → `Dog Coins(narrative) ← part_of ← DOGE, SHIB, FLOKI` + `u/whale_watcher(influencer) → mentions → DOGE` + `Binance 상장(event) → impacts → DOGE`

---

## 2. 엔티티 (노드)

| entity_type | 의미 | 생성 조건 | 시각화 |
|-------------|------|-----------|--------|
| `coin` | 크립토 코인/토큰 | 24시간 내 1회+ 멘션 | 원형, 센티먼트 색상 (green/gray/red) |
| `influencer` | 고빈도 작성자 | 7일간 score≥50 게시물 3개+ | 다이아몬드, 보라 |
| `narrative` | 코인 그룹 테마 | LLM 감지 (2회+ 등장) 또는 클러스터 내 2개+ 코인 활성 | 원형, 주황 |
| `event` | 시장 이벤트 | LLM 감지 (이벤트명+영향 코인+방향) 또는 key_phrases 이벤트 키워드 매칭 | 사각형, 로즈 |

### 코인 목록
`config.ts` COIN_LIST — 144개 코인. 카테고리별:
- 메이저: BTC, ETH, SOL, BNB, XRP ...
- 밈코인: DOGE, SHIB, PEPE, BONK, WIF, FLOKI ...
- AI 토큰: FET, AGIX, TAO, RNDR, AI16Z, VIRTUAL ...
- DeFi: AAVE, UNI, CRV, PENDLE, JUP ...
- L2: ARB, OP, STRK, ZK, BASE ...

### 내러티브 클러스터
`config.ts` NARRATIVE_CLUSTERS — 7개 그룹:

| 클러스터 | 소속 코인 |
|----------|-----------|
| Dog Coins | DOGE, SHIB, FLOKI, BONK, WIF, MYRO |
| AI Tokens | FET, AGIX, TAO, RNDR, OCEAN, WLD, AI16Z, VIRTUAL, AIXBT |
| Meme Culture | PEPE, BRETT, MOG, POPCAT, MEME, TURBO, BOME, MEW, NEIRO |
| DeFi | AAVE, CRV, MKR, SNX, COMP, SUSHI, CAKE, PENDLE, JUP, UNI |
| L2 & Infra | ARB, OP, STRK, ZK, BLAST, BASE, SUI, SEI |
| Political Coins | TRUMP, MELANIA |
| Solana Ecosystem | SOL, BONK, WIF, JUP, POPCAT, BOME |

### 이벤트 키워드
`config.ts` EVENT_KEYWORDS — 23개:
`listing`, `delisting`, `launch`, `airdrop`, `hack`, `exploit`, `regulation`, `sec`, `etf`, `halving`, `burn`, `partnership`, `upgrade`, `fork`, `mainnet`, `testnet`, `rug pull`, `bankruptcy`, `acquisition`, `integration`, `staking`, `unlock`, `vesting`

---

## 3. 관계 (엣지)

### 관계 타입

| relation_type | source → target | 의미 | 생성 기준 |
|---------------|-----------------|------|-----------|
| `correlates_with` | coin → coin | 동시 언급 상관관계 | 24h 내 3개+ 게시물에서 동시 멘션 |
| `mentions` | influencer → coin | 인플루언서가 코인 언급 | score≥100 게시물에서 코인 멘션 |
| `recommends` | influencer → coin | 인플루언서가 코인 추천 | sentiment=bullish + confidence>0.7 + score≥100 |
| `part_of` | coin → narrative | 코인이 내러티브에 소속 | LLM 감지 또는 NARRATIVE_CLUSTERS 매칭 |
| `impacts` | event → coin | 이벤트가 코인에 영향 | LLM 감지 (impact: +/-/neutral) 또는 EVENT_KEYWORDS 매칭 |

### 메타엣지 규칙 (허용 관계 문법)

```
config.ts META_EDGES:
  correlates_with: coin    → coin
  mentions:        influencer → coin
  part_of:         coin    → narrative
  recommends:      influencer → coin
  impacts:         event   → coin
```

**규칙 위반 시 관계 생성이 거부됨.** 예: `coin → coin`에 `mentions` 관계 시도 → `validateRelation()` 에서 차단.

---

## 4. Active Metadata (품질 계층)

모든 엔티티의 `metadata` JSONB 컬럼에 품질 정보를 저장:

```json
{
  "confidence": 0.85,
  "source_count": 3,
  "last_validated_at": "2026-03-20T09:00:00Z"
}
```

### confidence 계산

| 엔티티 | 공식 |
|--------|------|
| coin | `min(0.3 + (mentions/10)*0.3 + sources*0.2, 1.0)` |
| influencer | `min(0.4 + (posts/10)*0.3 + sources*0.15, 1.0)` |
| narrative | `min(0.5 + active_coins*0.1, 1.0)` |
| event | LLM 감지: `0.75`, 키워드 매칭: `0.6` |

### source_count
해당 엔티티가 확인된 데이터 소스 수 (reddit=1, telegram=2, threads=3). 다수 소스에서 확인될수록 높은 신뢰도.

### 시각화 반영
- confidence가 낮은 노드 → 반투명 렌더링 (alpha = max(0.3, confidence))
- 감쇠된 엔티티(7일+ 미활동) → confidence=0.1, 거의 보이지 않음

---

## 5. Temporal Decay (시간 감쇠)

| 대상 | 감쇠 조건 | 처리 |
|------|-----------|------|
| 관계 (crypto_relations) | `updated_at` < 3일 전 | weight → 0 |
| 이벤트/내러티브 엔티티 | `last_seen_at` < 7일 전 | 점진적 감쇠: `confidence × 0.85^(경과일수 - 7)`, 최소 0.05 |
| 코인/인플루언서 엔티티 | 감쇠 없음 | 크롤링 시마다 갱신 |

### 점진적 감쇠 곡선 (Phase B 개선, 2026-03-21)
- 7일까지는 confidence 유지
- 7일 초과 후 매일 15%씩 감쇠: `newConfidence = originalConfidence × 0.85^(daysSinceLastSeen - 7)`
- 14일(7일 초과 +7일) 후: ~0.32배, 21일 후: ~0.10배
- `decayed: true` 플래그는 confidence < 0.15 이하일 때만 설정
- 최소 바닥: 0.05 (완전히 사라지지 않음)

감쇠는 `updateKnowledgeGraph()` 실행 시 가장 먼저 실행됨 → 이후 새 데이터로 활성 관계/엔티티가 갱신.

Network API에서 `weight > 0` 필터로 감쇠된 관계 자동 제외.

---

## 6. 그래프 생성 파이프라인

```
Phase 3 (signals) 호출 시 실행되는 순서:

1. decayStaleRelations()     — 3일+ 관계 weight=0
2. decayStaleEntities()      — 7일+ event/narrative → 점진적 감쇠 (0.85^일수, 최소 0.05)
3. upsertCoinEntities()      — 24h 멘션 기반 코인 엔티티 + 품질 메타데이터
4. upsertInfluencerEntities() — 7일 고점수 작성자 엔티티
5. upsertNarrativeEntities()  — LLM 감지 내러티브 우선 (2회+ 등장) + 하드코딩 클러스터 fallback + part_of 관계
6. upsertEventEntities()      — LLM 감지 이벤트 우선 (이름+코인+impact) + EVENT_KEYWORDS fallback + impacts 관계
7. updateCoinCorrelations()   — 동시 멘션 3회+ → correlates_with 관계
8. updateInfluencerRelations() — 고점수 게시물 → mentions + recommends 관계 (bullish+confidence>0.7+score≥100)
```

---

## 7. DB 스키마

```sql
crypto_entities (
  id uuid PK,
  entity_type text CHECK ('coin','influencer','event','narrative'),
  name text NOT NULL,
  symbol text,
  metadata jsonb DEFAULT '{}',     -- Active Metadata (confidence, source_count 등)
  mention_count integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  UNIQUE (entity_type, name)
)

crypto_relations (
  id uuid PK,
  source_entity_id uuid FK → crypto_entities,
  target_entity_id uuid FK → crypto_entities,
  relation_type text CHECK ('mentions','recommends','correlates_with','part_of','impacts'),
  weight numeric,                  -- 0이면 감쇠된 관계 (API에서 제외)
  context text,
  metadata jsonb DEFAULT '{}'
)
```

---

## 8. 시각화 설계

### Signal Network (react-force-graph-3d)

| 요소 | 시각적 표현 |
|------|-------------|
| coin 노드 | 원형, 크기=멘션수, 색상=센티먼트 (green/gray/red), 투명도=confidence |
| influencer 노드 | 보라(#8b5cf6), 투명도=confidence |
| narrative 노드 | 주황(#f59e0b), 투명도=confidence |
| event 노드 | 로즈(#f43f5e), 투명도=confidence |
| correlates_with 엣지 | 파란, 굵기=weight |
| mentions 엣지 | 보라 |
| recommends 엣지 | 초록(#22c55e) |
| part_of 엣지 | 주황 |
| impacts 엣지 | 로즈 |

### Force 시뮬레이션 파라미터
```
center strength: 2      — 강한 중심 인력 (분리 방지)
charge strength: -15     — 약한 반발력
charge distanceMax: 40   — 반발 범위 제한
link distance: 15        — 연결 노드 간 짧은 거리
```

---

## 9. 설계 원칙

### 범용성 우선
온톨로지 로직은 특정 코인/이벤트에 하드코딩하지 않음. LLM 동적 감지 우선 + 패턴 기반 fallback:
- 코인 = COIN_LIST 매칭
- 내러티브 = **LLM 동적 감지 (우선)** + NARRATIVE_CLUSTERS 하드코딩 (fallback)
- 이벤트 = **LLM 이벤트 감지 (이름+코인+impact, 우선)** + EVENT_KEYWORDS 매칭 (fallback)
- 인플루언서 = 통계 기준 (3개+ 고점수 게시물)
- 추천 관계 = 센티먼트 기반 (bullish + confidence>0.7 + score≥100)

### 최소 임계값
노이즈 방지를 위한 최소 조건:
- correlates_with: 동시 멘션 **3회+**
- influencer: 고점수(50+) 게시물 **3개+**
- narrative: 클러스터 내 **2개+** 코인 활성
- coin confidence: 1회 멘션 = 0.3 (저신뢰), 5회+ = 0.9 (고신뢰)

### 메타엣지 검증
잘못된 관계 유형 방지. `knowledge-graph.ts`의 `validateRelation()`이 모든 관계 생성 전 검증.

---

## 10. 파일 맵

```
lib/crypto/
  config.ts              META_EDGES, NARRATIVE_CLUSTERS, EVENT_KEYWORDS, RELATION_DECAY_DAYS
  knowledge-graph.ts     온톨로지 파이프라인 전체 (8개 함수) — LLM 내러티브/이벤트 통합, 점진적 감쇠, recommends
  score-utils.ts         normalizeSentimentTrend() 포함 스코어링 유틸
  signal-generator.ts    시계열 센티먼트 트렌드 계산
  batch-sentiment.ts     LLM narratives/events 응답 파싱 → metadata JSONB 저장
  backtester.ts          백테스팅 — 시그널 vs 가격 비교, 적중 평가, 미평가 건 재평가

types/crypto.ts          EntityType, RelationType, CryptoSentimentEvent, BacktestResult/Response 타입 정의

app/api/crypto/
  network/route.ts       그래프 데이터 API (nodes+links+keywords, confidence 포함)
  events/route.ts        이벤트 타임라인 API (coin 필터, days, limit)
  trending-explain/route.ts  코인별 관계 기반 narrative/event 조회
  backtest/route.ts      백테스트 정확도 API (라벨별/코인별 적중률)

components/crypto/
  SignalNetwork.tsx       3D Force Graph — narrative/event 노드 클릭 하이라이트, recommends 엣지
  EventTimeline.tsx       이벤트 타임라인 컴포넌트 (impact 색상, AI 뱃지, 코인 칩)
  WhyTrendingPanel.tsx    WHY 패널 — EventTimeline 통합
  CoinDetail.tsx          FOMO 라인 + 이벤트 ReferenceLine 추가 차트
  BacktestReport.tsx      백테스트 정확도 리포트 (아코디언, 적중률 바, 코인별, 최근 결과)

supabase/functions/
  analyze-crypto-sentiment/index.ts   narratives/events 필드 추가 프롬프트
  analyze-threads-sentiment/index.ts  동일

supabase/migrations/
  018_crypto_tables.sql   초기 스키마 (entity_type, relation_type CHECK)
  022_crypto_ontology_upgrade.sql   impacts 관계 타입 추가
  026_add_sentiments_metadata.sql   crypto_sentiments.metadata JSONB 컬럼 추가
  027_crypto_backtest.sql           crypto_backtest_results 테이블 + crypto_backtest_summary 뷰
```

---

## 11. 완료된 작업 (Phase B + C, 2026-03-21)

### Phase B — 온톨로지 고도화 (완료)

| # | 항목 | 상태 |
|---|------|------|
| 1 | **시계열 트렌드 계산** — `normalizeSentimentTrend()` 추가, 이전 윈도우 대비 센티먼트 변화율 | ✅ |
| 2 | **가중 confidence 감쇠** — 이진(0.1) → 점진적(0.85^일수, 최소 0.05) | ✅ |
| 3 | **recommends 관계 활성화** — bullish+confidence>0.7+score≥100 → recommends 자동 생성 | ✅ |
| 4 | **LLM 내러티브 동적 감지** — Edge Function 프롬프트 확장 + batch-sentiment 파싱 + knowledge-graph 통합 | ✅ |
| 5 | **LLM 이벤트 감지 고도화** — 이벤트명+영향 코인+impact 방향 추출, 키워드 매칭 fallback 유지 | ✅ |
| 6 | **DB 마이그레이션** — `crypto_sentiments.metadata` JSONB 컬럼 추가 (026_add_sentiments_metadata.sql) | ✅ |
| 7 | **Edge Function 배포** — analyze-crypto-sentiment + analyze-threads-sentiment (narratives/events 프롬프트) | ✅ |

### Phase C — 시각화 강화 (완료)

| # | 항목 | 상태 |
|---|------|------|
| 1 | **내러티브/이벤트 클러스터 하이라이트** — 노드 클릭 시 연결 코인 하이라이트 (focusedNode) | ✅ |
| 2 | **이벤트 타임라인** — `/api/crypto/events` API + `EventTimeline.tsx` 컴포넌트 + WhyTrendingPanel 통합 | ✅ |
| 3 | **추론 경로 표시** — narrative/event 노드 클릭 → 관련 코인 경로 하이라이트 | ✅ |
| 4 | **CoinDetail 차트 강화** — FOMO 라인(점선) + 이벤트 ReferenceLine + 범례 확장 | ✅ |
| 5 | **recommends 엣지 시각화** — 초록(#22c55e) 색상 | ✅ |
| 6 | **i18n** — `crypto.eventTimeline` 5개 언어 추가 | ✅ |

---

## 12. 남은 작업

### 프로덕션 검증

| # | 항목 | 설명 |
|---|------|------|
| 1 | **LLM 내러티브/이벤트 생성 확인** | 크롤링 파이프라인 1회 실행 후 crypto_sentiments.metadata에 narratives/events 저장 확인 |
| 2 | **knowledge-graph LLM 통합 확인** | crypto_entities에 LLM 기반 narrative/event 엔티티 + source:'llm' 메타데이터 확인 |
| 3 | **점진적 감쇠 확인** | last_seen_at 7일+ 된 엔티티의 confidence 값이 0.85^일수로 감쇠되는지 확인 |
| 4 | **recommends 관계 확인** | bullish + high-score 게시물 인플루언서 → recommends 관계 생성 확인 |

### 장기 (아키텍처 변경)

| # | 항목 | 설명 |
|---|------|------|
| 5 | **Neo4j 마이그레이션** | Supabase RDBMS의 관계 쿼리 한계 (경로 탐색, 깊이 쿼리) → Neo4j Cypher로 전환 |
| 6 | **ReBAC 권한 체계** | 관계 기반 접근 제어 — 유료/무료 티어별 그래프 탐색 깊이 제한 |
| 7 | **AI 채팅 온톨로지 연동** | chat-insight에 그래프 컨텍스트 주입 → "DOGE가 왜 뜨는지" 관계 기반 설명 |

---

## 12. 로드맵

### Phase A — 데이터 소스 확장 (다음 우선순위)

| 항목 | 상태 | 임팩트 |
|------|------|--------|
| Reddit API 승인 → 크롤링 시작 | 승인 대기 중 | source_count ↑, confidence ↑ |
| Threads 토큰 발급 → 크롤링 시작 | 테스터 등록 블로커 | 3번째 소스 활성화 |
| Discord 봇 연동 | DM 피칭 4건, 응답 대기 | 커뮤니티 심층 데이터 |

### Phase B — 온톨로지 고도화 ✅ 완료 (2026-03-21)

| 항목 | 상태 |
|------|------|
| LLM 내러티브 감지 (Edge Function + knowledge-graph 통합) | ✅ |
| LLM 이벤트 감지 (이벤트명+영향 코인+impact 방향) | ✅ |
| recommends 관계 활성화 (bullish+confidence>0.7+score≥100) | ✅ |
| 시계열 트렌드 (`normalizeSentimentTrend`, 이전 윈도우 대비 변화율) | ✅ |
| 가중 confidence 감쇠 (점진적 0.85^일수, 최소 0.05) | ✅ |

### Phase C — 시각화 강화 ✅ 완료 (2026-03-21)

| 항목 | 상태 |
|------|------|
| 내러티브/이벤트 클러스터 하이라이트 (노드 클릭 → 소속 코인 하이라이트) | ✅ |
| 이벤트 타임라인 (API + EventTimeline 컴포넌트 + WhyTrendingPanel 통합) | ✅ |
| 추론 경로 표시 (narrative/event 노드 클릭 → 관련 경로 하이라이트) | ✅ |
| CoinDetail 차트 강화 (FOMO 라인 + 이벤트 ReferenceLine) | ✅ |

### Phase D — 백테스팅 ✅ 완료 (2026-03-21)

| 항목 | 상태 |
|------|------|
| DB 테이블 `crypto_backtest_results` + 집계 뷰 `crypto_backtest_summary` | ✅ |
| 백테스트 로직 `backtester.ts` (runBacktest + evaluatePending) | ✅ |
| API `/api/crypto/backtest` (라벨별/코인별 적중률, 최근 결과) | ✅ |
| 파이프라인 Phase 6 (battle → backtest 체이닝) | ✅ |
| BacktestReport UI (아코디언, 적중률 바, 코인별, 최근 결과) | ✅ |
| i18n 7키 × 5언어 | ✅ |
| 초기 데이터 788개 레코드 기록 (가격 축적 대기) | ✅ |

### Phase E — 추가 분석 (미완료)

| 항목 | 설명 | 난이도 |
|------|------|--------|
| **알림 시스템** | velocity>2.0 & score≥60 → 이메일/Discord 웹훅 알림 | 중 |
| **AI 채팅 온톨로지 연동** | chat-insight에 그래프 컨텍스트 주입 → "DOGE가 왜 뜨는지" 관계 기반 답변 | 높음 |

### Phase F — 플랫폼 분리

| 항목 | 설명 | 난이도 |
|------|------|--------|
| **독립 도메인** | Insight Hub에서 크립토 전용 앱으로 분리 | 높음 |
| **Neo4j 마이그레이션** | Supabase RDBMS → Neo4j 그래프 DB (Cypher 쿼리, 경로 탐색) | 높음 |
| **ReBAC 권한 체계** | 관계 기반 접근 제어 — 유료/무료 티어별 그래프 깊이 제한 | 높음 |
