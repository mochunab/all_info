# Insight Hub 크립토 온톨로지 가이드

> 최종 갱신: 2026-03-20
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
| `narrative` | 코인 그룹 테마 | 클러스터 내 2개+ 코인 활성 | 원형, 주황 |
| `event` | 시장 이벤트 | key_phrases에서 이벤트 키워드 매칭 | 사각형, 로즈 |

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
| `part_of` | coin → narrative | 코인이 내러티브에 소속 | NARRATIVE_CLUSTERS 매칭 |
| `impacts` | event → coin | 이벤트가 코인에 영향 | key_phrases에서 EVENT_KEYWORDS 매칭 |
| `recommends` | influencer → coin | 인플루언서가 코인 추천 | (미구현, 향후 센티먼트 기반) |

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
| event | `0.6` (고정, key_phrases 기반이므로) |

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
| 이벤트/내러티브 엔티티 | `last_seen_at` < 7일 전 | confidence → 0.1, decayed=true |
| 코인/인플루언서 엔티티 | 감쇠 없음 | 크롤링 시마다 갱신 |

감쇠는 `updateKnowledgeGraph()` 실행 시 가장 먼저 실행됨 → 이후 새 데이터로 활성 관계/엔티티가 갱신.

Network API에서 `weight > 0` 필터로 감쇠된 관계 자동 제외.

---

## 6. 그래프 생성 파이프라인

```
Phase 3 (signals) 호출 시 실행되는 순서:

1. decayStaleRelations()     — 3일+ 관계 weight=0
2. decayStaleEntities()      — 7일+ event/narrative confidence=0.1
3. upsertCoinEntities()      — 24h 멘션 기반 코인 엔티티 + 품질 메타데이터
4. upsertInfluencerEntities() — 7일 고점수 작성자 엔티티
5. upsertNarrativeEntities()  — 클러스터 기반 내러티브 엔티티 + part_of 관계
6. upsertEventEntities()      — key_phrases → 이벤트 엔티티 + impacts 관계
7. updateCoinCorrelations()   — 동시 멘션 3회+ → correlates_with 관계
8. updateInfluencerRelations() — 고점수 게시물 → mentions 관계
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
온톨로지 로직은 특정 코인/이벤트에 하드코딩하지 않음. 모든 감지는 패턴 기반:
- 코인 = COIN_LIST 매칭
- 내러티브 = NARRATIVE_CLUSTERS 소속
- 이벤트 = EVENT_KEYWORDS 포함
- 인플루언서 = 통계 기준 (3개+ 고점수 게시물)

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
  knowledge-graph.ts     온톨로지 파이프라인 전체 (8개 함수)

types/crypto.ts          EntityType, RelationType 타입 정의

app/api/crypto/
  network/route.ts       그래프 데이터 API (nodes+links+keywords, confidence 포함)

components/crypto/
  SignalNetwork.tsx       3D Force Graph 시각화 (4종 노드 + 5종 엣지 + 품질 투명도)

supabase/migrations/
  018_crypto_tables.sql   초기 스키마 (entity_type, relation_type CHECK)
  022_crypto_ontology_upgrade.sql   impacts 관계 타입 추가
```

---

## 11. 로드맵

### Phase A — 데이터 소스 확장 (다음 우선순위)

| 항목 | 상태 | 임팩트 |
|------|------|--------|
| Reddit API 승인 → 크롤링 시작 | 승인 대기 중 | source_count ↑, confidence ↑ |
| Threads 토큰 발급 → 크롤링 시작 | 테스터 등록 블로커 | 3번째 소스 활성화 |
| Discord 봇 연동 | DM 피칭 4건, 응답 대기 | 커뮤니티 심층 데이터 |

### Phase B — 온톨로지 고도화

| 항목 | 설명 | 난이도 |
|------|------|--------|
| **LLM 내러티브 감지** | 센티먼트 Edge Function에 narrative 필드 추가 → 하드코딩 클러스터 → LLM 동적 감지로 전환 | 중 |
| **LLM 이벤트 감지** | 키워드 매칭 → LLM이 이벤트명+영향 코인+영향 방향(+/-)까지 추출 | 중 |
| **recommends 관계 활성화** | 센티먼트 bullish + confidence>0.7 + score>100 → recommends 관계 자동 생성 | 낮음 |
| **시계열 트렌드** | signal_generator.ts의 sentiment_trend 현재 0 하드코딩 → 이전 윈도우 대비 변화율 계산 | 낮음 |
| **가중 confidence 감쇠** | 현재 이진(활성/감쇠) → 시간 경과에 따른 점진적 감쇠 곡선 | 낮음 |

### Phase C — 시각화 강화

| 항목 | 설명 | 난이도 |
|------|------|--------|
| **내러티브 클러스터 시각화** | narrative 노드 클릭 → 소속 코인만 하이라이트 + 클러스터 바운딩 박스 | 중 |
| **이벤트 타임라인** | 이벤트 엔티티를 시간축 위에 배치 → 코인 가격/센티먼트 변동과 병렬 표시 | 높음 |
| **추론 경로 표시** | "왜 DOGE가 trending인가?" → 그래프에서 관련 경로 하이라이트 (narrative+influencer+event) | 높음 |
| **CoinDetail 차트** | recharts로 시간별 센티먼트/멘션 변화 차트 | 중 |

### Phase D — 고급 분석

| 항목 | 설명 | 난이도 |
|------|------|--------|
| **가격 데이터 연동** | CoinGecko API → 시그널 vs 실제 가격 비교 (crypto_coins + crypto_prices 테이블 이미 정의) | 중 |
| **백테스팅** | 과거 시그널 → 실제 가격 변동 비교 → 정확도 리포트 | 높음 |
| **알림 시스템** | velocity>2.0 & score≥60 → 이메일/Discord 웹훅 알림 | 중 |
| **AI 채팅 온톨로지 연동** | chat-insight에 그래프 컨텍스트 주입 → "DOGE가 왜 뜨는지" 관계 기반 답변 | 높음 |

### Phase E — 플랫폼 분리

| 항목 | 설명 | 난이도 |
|------|------|--------|
| **독립 도메인** | Insight Hub에서 크립토 전용 앱으로 분리 | 높음 |
| **Neo4j 마이그레이션** | Supabase RDBMS → Neo4j 그래프 DB (Cypher 쿼리, 경로 탐색) | 높음 |
| **ReBAC 권한 체계** | 관계 기반 접근 제어 — 유료/무료 티어별 그래프 깊이 제한 | 높음 |
