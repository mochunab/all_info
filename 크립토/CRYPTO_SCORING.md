# 크립토 시그널 스코어링 + 시각화

---

## 코인 멘션 추출 전략

- **$DOGE / #PEPE** (고신뢰): 정규식 `/(?:\$|#)([A-Z]{2,10})\b/gi`
- **dogecoin, ethereum** (중신뢰): COIN_LIST alias 순회, 3자 미만 alias 스킵
- **DOGE** (저신뢰): ALL-CAPS 단어 매칭, 80+ 단어 블랙리스트 (THE, BUY, HODL, FOMO 등)
- 문맥 추출: 멘션 전후 30자 캡처 → crypto_mentions.context

---

## 시그널 가중치 공식 V2

```
rawScore (0~100) =
  mention_velocity_norm × 25% +
  avg_sentiment_norm × 30% +
  sentiment_trend_norm × 15% +
  engagement_norm × 20% +
  fomo_avg_norm × 10%

mentionConfidence = clamp(mention_count / 5, 0, 1)
marketCapDampening = log10(rank) / log10(200), clamp(0.3, 1.0)

# V2 추가
zScoreMultiplier = z_score > 2.0 ? 1.0 + (z-2)*0.25 : 1.0, max 1.5
crossPlatformMultiplier = sources==1 ? 0.7 : sources==2 ? 1.0 : 1.3
eventModifier = sum of matched event keywords, clamp(-30, +25)

baseWeightedScore = rawScore × mentionConfidence × marketCapDampening
                            × zScoreMultiplier × crossPlatformMultiplier
                            + eventModifier

# KG Boost (Phase I)
kgMultiplier = hasRecommends ? 1.15 : 1.0
kgBoost = correlatedHot×5 (max 3) + narrativeMomentum×4 + eventImpacts×±3, clamp(-15, +15)

weighted_score = clamp(baseWeightedScore × kgMultiplier + kgBoost, 0, 100)

contrarianWarning = bullish% > 85% → 'potential_reversal'
                  | bullish% < 15% → 'potential_bounce'
                  | null (별도 지표, 스코어 미반영)

signal_label (Heat 스케일):
  ≥80 → extremely_hot  (🔥 Extremely Hot)
  ≥60 → hot             (🟠 Hot)
  ≥40 → warm            (🟡 Warm)
  ≥20 → cool            (🔵 Cool)
  <20 → cold            (❄️ Cold)

trending 조건: velocity > 0.5 AND weighted_score ≥ 50
```

### FOMO/FUD 분리
- `signal_type` 컬럼: `'fomo'` | `'fud'`
- FOMO: `sentiment_score >= 0` 게시물 기반
- FUD: `sentiment_score <= 0` 게시물 기반 (중립은 양쪽 포함)
- FUD Hot = 부정 멘션 폭증 → 가격 하락이 적중

### 이벤트 타입 키워드 스코어링
| 이벤트 | 점수 |
|--------|------|
| exchange_listing | +15 |
| partnership | +8 |
| whale_buy | +10 |
| airdrop | +5 |
| regulatory_positive | +10 |
| whale_sell | -10 |
| regulatory_negative | -15 |
| security_incident | -20 |

총합 clamp(-30, +25)

### KG Boost 상수
| 부스트 | 값 |
|--------|-----|
| INFLUENCER_RECOMMENDS | ×1.15 (승수) |
| CORRELATED_HOT_BOOST | +5/코인 (최대 3개, +15) |
| NARRATIVE_MOMENTUM_BOOST | +4 (내러티브 평균 score ≥ 50) |
| EVENT_IMPACT_POSITIVE/NEGATIVE | ±3 |
| MAX_TOTAL_BOOST | ±15 (상한) |

---

## Signal Network 시각화

- **라이브러리**: `react-force-graph-3d` (lazy import via useState, `dynamic()` 사용 안 함 — ref 전달 문제)
- **nodeThreeObject 커스텀**: THREE.SphereGeometry + MeshPhongMaterial (shininess 80, specular, emissive) + glow halo (×1.3, opacity 0.06) + SpriteText 라벨
- **커스텀 라이팅**: AmbientLight(0.6) + DirectionalLight×2(0.8/0.3) + PointLight(0.4)
- **아코디언**: 초기 닫힘, 300ms MD3 easing
- **레이아웃**: 좌측 60% 3D Force Graph + 우측 40% WHY Trending Panel (모바일: 상하 스택)
- **노드 크기**: `getNodeSize(mentions, max) * 0.8` — 센티먼트 색상, 타입별 색상 (influencer=보라, narrative=amber, event=rose)
- **엣지**: correlates_with(파란) / part_of(amber) / impacts(rose) / recommends(초록) / mentions(보라), weight 비례 굵기
- **d3 force**: charge=-300, link=60, center=2, warmupTicks=150, cooldownTicks=0
- **zoomToFit**: useEffect 500ms/2000ms + onEngineStop 200ms 후 호출 (3중 보장)
- **칩 전환 깜빡임 방지**: nodeThreeObject에서 selectedChip/activeNeighborSet 의존성 제거
- **자체 시간 필터**: SignalNetwork 내부에 TimeWindowSelector 배치
- **WHY 패널**: ScoreBreakdown + AiReasoningQuotes + SourceBreakdown + PhraseCloud + NarrativeContext + EventTimeline
- **Lazy fetch**: 코인 칩 클릭 시에만 API 호출, coin+window 키로 결과 캐시
- **테마**: `useIsDark()` 공유 훅
