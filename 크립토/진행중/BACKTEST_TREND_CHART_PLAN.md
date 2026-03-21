# 백테스트 추이 차트 + 크롤링 수정 인계서

> 작성일: 2026-03-21
> 다음 세션에서 이어서 작업

---

## 이번 세션에서 완료한 것

### 1. sanitizeText 버그 수정 (근본 원인 발견 + 수정 완료)

**문제**: Reddit/Telegram 크롤러의 `sanitizeText()` 정규식이 유효한 이모지 surrogate pair를 깨뜨려서 PostgreSQL JSON 파싱 에러 발생. 크롤링 데이터의 ~80%가 조용히 버려지고 있었음.

**수정 파일:**
- `lib/crypto/telegram-crawler.ts` — sanitizeText를 char-by-char 루프로 재작성 + safeTruncate 추가 + context 필드도 sanitize
- `lib/crypto/reddit-crawler.ts` — 동일한 sanitizeText 재작성 + context sanitize

**결과:**
| 소스 | Before | After |
|------|--------|-------|
| Reddit | 2/10 서브레딧 성공 | **10/10 (100%)** |
| Telegram | 2/25 채널 성공 | **23/23 (100%)** |
| Twitter | 이미 정상 (sanitizeObject 사용) | 5/5 |

### 2. Telegram 채널 관리

**수정 파일:** `lib/crypto/config.ts`
- 죽은 채널 9개 제거: defimillion, icospeaksnews, memecoinx, ICODrops, cryptoevolution, cryptorank_news, Memecoins_Calls, SolanaMemeCoinss, memecokr
- 활성 채널 6개 추가: coinbureau, WatcherGuru, FatPigSignals, MyCryptoParadise, AltSignals, LunarCrush
- 최종 23개 채널

### 3. Telegram 크롤러 안정성 개선

**수정 파일:** `lib/crypto/telegram-crawler.ts`, `app/api/crypto/crawl/route.ts`
- 채널 순서 매번 셔플 (특정 채널 불이익 방지)
- 시간 예산 기본 120초 + crawl route에서 Reddit 소요시간 뺀 나머지 전달
- 전체 23채널 크롤 29초 소요 (충분히 여유)

### 4. 미커밋 상태

위 수정사항 전부 **아직 커밋/배포 안 됨**. 다음 세션에서 빌드 확인 후 커밋 필요.

---

## 다음 세션에서 할 것

### A. 커밋 + 배포 (최우선)

sanitizeText 수정 + 채널 관리 + 크롤러 안정성 → 커밋 → 배포. 이게 배포되면 데이터 수집량 ~10배 증가.

### B. 백테스트 추이 차트 구현

현재 BacktestReport는 라벨별 적중률 바만 보여줌. 데이터 축적 추이를 확인할 수 없음.

#### B-1. API: `/api/crypto/backtest` 확장

기존 backtest API에 `mode=trend` 쿼리 파라미터 추가.

```
GET /api/crypto/backtest?lookup_window=24h&signal_type=fomo&mode=trend
```

응답에 추가할 필드:
```typescript
type BacktestTrendPoint = {
  date: string;           // YYYY-MM-DD
  label: string;          // signal_label
  total: number;          // 해당 날짜+라벨 평가 건수
  hits: number;           // 적중 건수
  hit_rate: number;       // 적중률 %
  avg_return: number;     // 평균 수익률 %
  cumulative_total: number;   // 누적 평가 건수
  cumulative_hits: number;    // 누적 적중 건수
  cumulative_rate: number;    // 누적 적중률 %
}

// 응답
{
  ...기존 응답,
  trend: BacktestTrendPoint[],   // mode=trend일 때만 포함
  distribution: {                 // 일별 시그널 분포
    date: string;
    extremely_hot: number;
    hot: number;
    warm: number;
    cool: number;
    cold: number;
  }[]
}
```

**구현 방식**: `crypto_backtest_results`에서 `signal_at`을 날짜별로 GROUP BY → 라벨별 집계. DB 뷰 추가 불필요, API에서 JS 집계.

#### B-2. 컴포넌트: `BacktestTrendChart.tsx`

BacktestReport 아코디언 내부, 기존 라벨별 적중률 바 아래에 배치.

3개 탭:
1. **적중률 추이** — Recharts `LineChart`, X=날짜, Y=적중률%, 라인=hot(주황)/warm(노랑)/cold(파랑). `ResponsiveContainer` 사용.
2. **시그널 분포** — Recharts `BarChart` (stacked), X=날짜, Y=건수, 색상=라벨별 (Heat 스케일 팔레트)
3. **누적 정확도** — Recharts `AreaChart`, X=날짜, Y=누적 적중률%, hot/cold 두 라인

**참고 패턴**: CoinDetail.tsx에 이미 Recharts 차트가 있음 (LineChart + ReferenceLine + Legend). 동일한 스타일/테마 사용.

#### B-3. 데이터 플로우

```
CryptoDashboard
  └─ BacktestReport (language, signalType props)
       ├─ 기존: 라벨별 적중률 바 + 코인별 그리드 + 최근 결과
       └─ 신규: BacktestTrendChart (trend + distribution 데이터)
            └─ fetch /api/crypto/backtest?mode=trend&lookup_window=24h
```

- BacktestReport가 이미 `lookupWindow` state 관리 중 → trend 데이터도 같은 window 연동
- Lazy fetch: 아코디언 열릴 때 + lookupWindow 변경 시 fetch
- 데이터 부족(< 3일) 시 차트 대신 "데이터 축적 중" 메시지

#### B-4. i18n 키 추가

```
crypto.backtest.trend — 적중률 추이 / Accuracy Trend / ...
crypto.backtest.distribution — 시그널 분포 / Signal Distribution / ...
crypto.backtest.cumulative — 누적 정확도 / Cumulative Accuracy / ...
crypto.backtest.needMoreData — 데이터 축적 중 (최소 3일 필요) / ...
```

5개 언어 × 4개 키 = 20개 번역

#### B-5. 타입 추가 (types/crypto.ts)

```typescript
type BacktestTrendPoint = {
  date: string;
  label: string;
  total: number;
  hits: number;
  hit_rate: number;
  avg_return: number;
  cumulative_total: number;
  cumulative_hits: number;
  cumulative_rate: number;
}

type BacktestDistribution = {
  date: string;
  extremely_hot: number;
  hot: number;
  warm: number;
  cool: number;
  cold: number;
}
```

`BacktestResponse` 타입에 `trend?: BacktestTrendPoint[]`, `distribution?: BacktestDistribution[]` 옵셔널 필드 추가.

---

## 참고: 현재 데이터 현황

```
백테스트: 4,816건 (평가완료 322건, 대기 4,494건)
시그널: 18,197건 (6.7일치)
가격: 1,495건 (1.5일치)
게시물: 2,326건
센티먼트: 2,086건 (커버리지 89.7%)
```

- 가격 데이터가 1.5일밖에 없어서 24h/7d 백테스트 평가 불가
- sanitize 수정 배포 후 데이터 수집량 ~10배 → 1~2주면 의미 있는 추이 차트 가능
- 현재 백테스트 적중률은 샘플 부족으로 신뢰 불가 (Extremely Hot 5건으로 100% 등)

---

## 상세 설계 (아키텍처 에이전트 출력 반영)

### API 확장 상세

`/api/crypto/backtest/route.ts`에 `mode=trend` 분기 추가:
- 기존 로직은 mode 없을 때 그대로 유지
- mode=trend: `crypto_backtest_results`에서 `signal_at.slice(0,10)`로 날짜별 GROUP BY (JS in-memory)
- 60일 제한: `.gte('signal_at', sixtyDaysAgo.toISOString())`
- 누적 적중률: 날짜 정렬 후 running sum으로 계산

응답 형태:
```typescript
type BacktestTrendPoint = {
  date: string;    // YYYY-MM-DD
  extremely_hot?: number;  // 각 라벨별 hit_rate %
  hot?: number;
  warm?: number;
  cool?: number;
  cold?: number;
}

type BacktestCumulativePoint = {
  date: string;
  hit_rate: number;
  total: number;
}

// GET /api/crypto/backtest?mode=trend&lookup_window=24h&signal_type=fomo
{
  trendData: BacktestTrendPoint[];       // 일별 라벨별 적중률
  distributionData: BacktestTrendPoint[]; // 일별 라벨별 건수
  cumulativeData: BacktestCumulativePoint[]; // 누적 적중률
}
```

### 컴포넌트 상세

`BacktestTrendCharts.tsx`:
- Props: `{ language, lookupWindow, signalType }`
- BacktestReport 내부, recentResults 아래에 배치
- 3개 Recharts 차트 수직 배치:
  1. LineChart (적중률 추이, 라벨별 5개 라인) — height=180
  2. BarChart stacked (시그널 분포) — height=180
  3. LineChart (누적 적중률 1개 라인) — height=120
- 색상: extremely_hot=#f87171, hot=#fb923c, warm=#facc15, cool=#60a5fa, cold=#93c5fd
- XAxis tickFormatter: YYYY-MM-DD → MM/DD
- BacktestReport maxHeight: 800px → 2000px

### 데이터 플로우

```
BacktestReport 아코디언 열림
  → 기존 fetchData (summary/coinSummary/recentResults)
  → BacktestTrendCharts 마운트
      → 별도 fetch: /api/crypto/backtest?mode=trend&...
      → 3개 차트 렌더
  → lookupWindow 변경 시 둘 다 refetch
```

---

## 작업 순서

1. `git diff` 확인 → 커밋 → 배포 (sanitizeText + 채널 관리)
2. `types/crypto.ts`에 BacktestTrendPoint, BacktestCumulativePoint, BacktestTrendResponse 타입 추가
3. `/api/crypto/backtest/route.ts` — mode=trend 분기 추가
4. `lib/i18n.ts`에 3키 × 5언어 추가 (crypto.backtest.trend/distribution/cumulative)
5. `components/crypto/BacktestTrendCharts.tsx` 생성
6. `components/crypto/BacktestReport.tsx`에 차트 통합 + maxHeight 확장
7. 빌드 확인 → 커밋 → 배포
