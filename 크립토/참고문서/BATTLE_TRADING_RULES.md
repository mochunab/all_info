# 원숭이 vs AI 로봇 — 매매 기준서

> 최종 수정일: 2026-03-21
> 코드: `lib/crypto/battle-trader.ts`, `app/api/crypto/battle/route.ts`
> 초기 자본: 각 $100

---

## 배틀 컨셉

밈코인 시장에서 **완전 랜덤 매매(원숭이)**와 **시그널 기반 매매(로봇)** 중 누가 이기는지 실제 가격 데이터로 검증하는 실험.

- 30분마다 크론 실행 (크롤링 파이프라인 Phase 5)
- 실제 CoinGecko 가격 기준 PnL 계산
- 부분 청산 지원 (포지션 단위 관리)
- 현금 잔액은 **거래 내역 기반 계산** (스냅샷 순환 참조 버그 방지)
- 포지션 청산은 **atomic update** (`remaining_size > 0.01` 조건) — 중복 매도 방지

---

## 원숭이 (Random Monkey)

### 철학
> "YOLO 단타 원숭이". 아무 코인이나 사서 본능적으로 반응한다.
> 밈코인 단타 트레이더의 벤치마크 역할.

### 진입 규칙

| 항목 | 규칙 |
|------|------|
| 판단 주기 | 30분마다 |
| 진입 확률 | **65%** |
| 코인 선택 | `crypto_coins` 활성 코인 중 **완전 랜덤** |
| 포지션 크기 | **$100 기준 5~30%** (랜덤, `STARTING_BALANCE` 기준 고정) |
| 최대 동시 포지션 | **5개** |
| 물타기 | 보유 중 코인이 **-5% 이하**면 중복 진입 허용 |

### 청산 규칙

| 조건 | 기준 |
|------|------|
| 홀드 기간 만료 | 진입 시 **15분~24시간** 중 지수 분포 랜덤 (단타 편향), 도달 시 자동 청산 |
| 패닉셀 | PnL ≤ **-8%** 일 때 **40% 확률** 즉시 전량 청산 |
| 환호 익절 | PnL ≥ **+15%** 일 때 **50% 확률** 즉시 전량 청산 |

- 시그널 확인 없음
- 확률적 손절/익절 — 항상 하진 않기에 "왜 안 팔아?!" 드라마 발생

---

## AI 로봇 (Signal Robot)

### 철학
> "데이터가 말할 때만 산다. 데이터가 꺾이면 즉시 판다. 과열은 피하고, 공포는 이용한다."
> FOMO/FUD 분리 시그널 + contrarian 경고 + 크로스 윈도우 비교로 정밀 매매.

### 진입 규칙

#### 시그널 조회 (타임 윈도우 폴백 + 크로스 윈도우)

`24h → 6h → 1h` 순서로 **FOMO 시그널만** 조회. FUD 시그널은 진입에서 제외.
짧은 윈도우(1h/6h)에서 히트 시, 24h 시그널도 추가 조회하여 크로스 윈도우 비교.

#### 필수 조건 (모두 충족해야 진입)

| 조건 | 기준 | 근거 |
|------|------|------|
| 시그널 타입 | **FOMO만** (FUD 제외) | FUD hot = 부정 멘션 폭증, 매수 금지 |
| 시그널 라벨 | `extremely_hot`, `hot`, 또는 `warm` | Heat 스케일 기준 모멘텀 확인 |
| weighted_score | **≥ 30** | 데이터 부족 환경 대응 |
| 멘션 수 | **≥ 3** | 최소 신뢰도 |
| 컨피던스 | **≥ 55** (아래 공식) | 복합 지표 충족 |
| contrarian | `potential_reversal` 아님 | 과열 구간 진입 회피 |
| 중복 진입 | 같은 코인 중복 불가 | 한 코인에 집중 위험 방지 |

#### 컨피던스 점수 계산

```
confidence = 50 (기본)
  + 15  if weighted_score >= 50     (강한 시그널)
  + 15  if mention_velocity > 0.5   (버즈 급증)
  + 10  if avg_sentiment > 0.2      (bullish 컨센서스)
  + 10  if fomo_avg > 0.3           (FOMO 감지)
  + 10  if event_modifier >= 10     (exchange_listing 등 강한 이벤트)
─────
최대 110, 최소 충족 기준 = 55
```

#### 포지션 관리 (시그널 강도별 동적 사이징)

| 항목 | 규칙 | 근거 |
|------|------|------|
| extremely_hot | 포트폴리오의 **18%** | 강한 시그널에 과감히 |
| hot | 포트폴리오의 **12%** | 기본 사이즈 |
| warm | 포트폴리오의 **8%** | 약한 시그널은 소량 |
| 크로스 윈도우 페널티 | 위 사이즈 × **0.5** | 1h hot + 24h cold → 단기 펌프 의심 |
| 최대 동시 포지션 | **5개** | 최대 투자 제한 |
| 최소 현금 보유 | 포트폴리오의 **20%** | 기회 대기 + 리스크 버퍼 |

### 청산 규칙

#### 가격 기반 청산

| 단계 | 조건 | 액션 |
|------|------|------|
| **손절** | PnL ≤ **-10%** | **전량 청산** |
| **TP1 후 손절** | TP1 이후 현재가 ≤ **진입가** (본전) | **잔량 전부 청산** |
| **TP1** | PnL ≥ **+20%** | 포지션의 **1/3 청산** + 손절을 진입가로 이동 |
| **TP2** | PnL ≥ **+40%** | 포지션의 **1/3 청산** |
| **트레일링 스탑** | TP2 이후, 고점 대비 **-15%** 하락 | **잔량 전부 청산** |

#### 시그널 기반 청산 (24h 윈도우 기준)

| 조건 | 기준 | 이유 |
|------|------|------|
| **시그널 반전** | FOMO 24h 라벨이 `cold` | 모멘텀 소멸 |
| **contrarian 과열** | `potential_reversal` + 수익 중 | 과열 경고, 이익 보전 |
| **센티먼트 급락** | 진입 대비 sentiment **-0.5 이상 하락** | 커뮤니티 분위기 전환 |
| **velocity 소멸** | mention_velocity **< 0.05** | 더 이상 화제가 아님 |
| **FUD 급증** | FUD 시그널이 `hot` 또는 `extremely_hot` | 부정 여론 폭발, 하락 위험 |

→ 이 5개 중 **하나라도** 해당되면 즉시 잔량 전부 청산.

---

## 비교 요약

| | 원숭이 | 로봇 |
|---|---|---|
| 진입 빈도 | 30분마다 65% | 30분마다 조건부 |
| 코인 선택 | 랜덤 (물타기 허용) | FOMO 시그널 최고 점수 (FUD 제외, contrarian 회피) |
| 포지션 크기 | 5~30% 랜덤 | 시그널 강도별: 18%/12%/8% (크로스 윈도우 페널티 ×0.5) |
| 최대 포지션 | 5개 | 5개 |
| 홀드 기간 | 15분~24시간 (단타 편향 지수 분포) | 시그널 유지되는 한 무제한 |
| 손절 | -8%에서 40% 확률 패닉셀 | -10% (TP1 후 본전) |
| 이익 실현 | +15%에서 50% 확률 환호 익절 | +20%/+40% + 트레일링 스탑(고점-15%) + contrarian 익절 + FUD 급증 청산 |
| 현금 관리 | 없음 | 최소 20% 유지 |

---

## 데이터 흐름

```
30분 크론 → Phase 5 (battle)
  │
  ├─ 원숭이
  │   ├─ 오픈 포지션 확인
  │   │   ├─ hold_until 만료? → 청산
  │   │   ├─ PnL ≤ -8%? → 40% 확률 패닉셀
  │   │   └─ PnL ≥ +15%? → 50% 확률 환호 익절
  │   └─ 65% 확률 → 랜덤 코인 매수 (5~30%, 15분~24시간 지수분포 홀드, 물타기 허용)
  │
  └─ 로봇
      ├─ 오픈 포지션 확인 + peak_price 갱신
      │   ├─ 현재가 vs 손절 라인 → -10% 이하? → 전량 청산
      │   ├─ TP1 (+20%) 도달? → 1/3 청산 + 손절→진입가
      │   ├─ TP2 (+40%) 도달? → 1/3 청산
      │   ├─ TP2 이후 고점 대비 -15%? → 트레일링 스탑 전량 청산
      │   ├─ contrarian potential_reversal + 수익 중? → 과열 익절
      │   ├─ FUD hot/extremely_hot? → FUD 급증 청산
      │   └─ FOMO 시그널 반전/센티먼트 급락/velocity 소멸? → 잔량 청산
      │
      └─ FOMO 시그널 평가 (24h→6h→1h 폴백, FUD 제외)
          ├─ extremely_hot/hot/warm + score≥30 + mention≥3
          ├─ contrarian ≠ potential_reversal
          ├─ confidence ≥ 55 (score/velocity/sentiment/fomo/event 보너스)
          ├─ 크로스 윈도우: 1h hot + 24h cold → 사이즈 ×0.5
          ├─ 현금 20% 이상 유지 가능?
          └─ 조건 충족 → 18%/12%/8% 매수 + 시그널 스냅샷 저장
```

---

## 현금 계산 (거래 기반)

```
cash = $100
  - Σ(모든 buy의 trade_size)
  + Σ(모든 sell의 trade_size + pnl)
```

스냅샷 순환 참조 대신 `battle_trades` 테이블에서 직접 계산. 포트폴리오 가치 = cash + Σ(보유 포지션 × 현재가/진입가).

---

## 중복 매도 방지

`closePosition`에서 **atomic update** 사용:

```sql
UPDATE battle_positions
SET status='closed', remaining_size=0, ...
WHERE id = ? AND remaining_size > 0.01
RETURNING id
```

- 반환 0건 = 이미 다른 호출이 청산함 → trade insert 스킵
- 청산은 크롤 파이프라인(`executeBattle`)에서만 실행
- API GET에서는 side-effect 금지 (race condition 방지)

---

## API 응답 구조 (`/api/crypto/battle`)

```
GET /api/crypto/battle?days=30

→ {
    portfolio: { monkey: {current, change_pct, cash, openPositions}, robot: {...} },
    history: { dates: [...], monkey: [...], robot: [...] },
    recentTrades: { monkey: BattleTrade[10], robot: BattleTrade[10] },
    openPositions: { monkey: BattlePosition[], robot: BattlePosition[] },
    stats: { totalTrades, monkeyWins, robotWins, monkeyWinRate, robotWinRate },
    prices: { [symbol]: price }
  }
```

- `recentTrades`: **player별 독립 조회** (각 최근 10건) — 한쪽이 활발해도 상대 거래가 밀리지 않음
- `stats.winRate`: `battle_trades` sell 건 기반 직접 계산 (스냅샷 의존 제거)
- `portfolio.current`: 실시간 계산 (cash + 보유 포지션 × 현재가/진입가)
- `prices`: 현재 CoinGecko 가격 맵 (보유 포지션 PnL 계산용)

---

## DB 테이블

| 테이블 | 용도 |
|--------|------|
| `battle_positions` | 포지션 추적 (open/closed, TP 단계, 시그널 스냅샷, 부분 청산) |
| `battle_trades` | 개별 거래 로그 (진입/청산, reason, position_id 연결) — **현금 계산의 단일 진실** |
| `battle_portfolio` | 일별 포트폴리오 스냅샷 (차트용, 30분 크론에서 갱신) |

---

## UI 탭 구조 (`MonkeyVsRobot.tsx`)

| 탭 | 내용 |
|----|------|
| **스코어** | 원숭이/로봇 Lottie 애니메이션 + 포트폴리오 가치 + 변동률 + 현금/포지션 수 |
| **보유 포지션** | 양쪽 오픈 포지션 그리드 (코인, 진입가→현재가, PnL%, 잔여금, SL/TP 태그, 남은 시간) |
| **추세** | 7/30/90일 포트폴리오 가치 라인 차트 (Recharts) |
| **거래내역** | 양쪽 최근 거래 10건 (매수/매도 뱃지, 코인, 날짜, reason, PnL) |
