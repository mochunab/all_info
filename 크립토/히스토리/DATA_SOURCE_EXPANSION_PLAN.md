# 데이터소스 확장 제안서

> 작성일: 2026-03-22
> 목적: 현재 일 ~1,000건 → 일 3,000~5,000건 확보, 시그널 신뢰도 향상
> 전제: Discord 봇 초대 4건 무응답 → 대안 필요

---

## 현재 데이터 현황

| 소스 | 일 게시물 | 주기 | 비용 |
|------|----------|------|------|
| Reddit (10개 서브, hot only) | ~150 | 15분 | $0 |
| Telegram (23개 채널) | ~130 | 15분 | $0 |
| Twitter/X (Apify, 10키워드) | ~200 (6h 간격) | 6시간 | ~$4.80/월 |
| CoinGecko Trending | 15코인/크롤 | 15분 | $0 |
| **합계** | **~500** | | **~$5/월** |

문제: 소형 밈코인은 멘션 1~2건으로 시그널 불안정, 교차검증 부족

---

## Phase J: 기존 소스 최적화 (즉시 적용)

### J-1. Reddit hot + new + rising (✅ 코드 수정 완료)

`scripts/crypto-reddit-crawl.ts`에 `SORT_MODES = ['', 'new', 'rising']` 추가 완료.
- 예상: 서브레딧당 ~25개(hot) → ~50~60개(중복 제거 후) = **일 +200~300건**
- 비용: $0
- 소요: 배포만 하면 됨 (git push)

### J-2. Telegram 채널 확대 (23개 → 40개)

`config.ts` TELEGRAM_CHANNELS에 추가할 채널 후보:

```typescript
// 밈코인 특화 (추가)
{ username: 'daborasignals', weight: 1.1, language: 'en' },
{ username: 'MemeCoinsGems', weight: 1.2, language: 'en' },
{ username: 'SolanaFloor', weight: 1.1, language: 'en' },
{ username: 'DEXTrending', weight: 1.2, language: 'en' },
{ username: 'basedmemecoin', weight: 1.0, language: 'en' },
// 온체인 알림
{ username: 'whale_alert', weight: 1.2, language: 'en' },
{ username: 'lookonchain', weight: 1.3, language: 'en' },
{ username: 'arkaborodigital', weight: 0.9, language: 'en' },
// 뉴스/분석
{ username: 'TheBlock__', weight: 0.8, language: 'en' },
{ username: 'CryptoRank_News', weight: 0.9, language: 'en' },
{ username: 'DeFiLlama', weight: 0.9, language: 'en' },
{ username: 'CoinDeskGlobal', weight: 0.8, language: 'en' },
// KOL/인플루언서
{ username: 'cobie', weight: 1.1, language: 'en' },
{ username: 'inversebrah', weight: 1.0, language: 'en' },
{ username: 'CryptoCapo_', weight: 1.0, language: 'en' },
{ username: 'DegenSpartanDAO', weight: 1.0, language: 'en' },
{ username: 'CryptoNewss_', weight: 0.9, language: 'en' },
```

- **확인 필요**: 각 채널이 `t.me/s/채널명`으로 공개 접근 가능한지
- 예상: **일 +100~200건**
- 비용: $0
- 소요: config.ts에 추가 + 공개 여부 검증 (~30분)

### J-3. Reddit 서브레딧 추가 (10개 → 15개)

```typescript
// scripts/crypto-reddit-crawl.ts SUBREDDITS + config.ts CRYPTO_SUBREDDITS 동시 추가
{ name: 'defi', weight: 0.8 },
{ name: 'ethtrader', weight: 0.9 },
{ name: 'BSCcrypto', weight: 0.8 },
{ name: 'memecoins', weight: 1.1 },
{ name: 'shitcoins', weight: 0.9 },
```

- 예상: **일 +100건**
- 비용: $0
- 주의: `crypto-reddit-crawl.ts`와 `config.ts` 두 곳 동기화 필요

---

## Phase K: Farcaster 연동 (신규 소스, 최우선)

### 왜 Farcaster인가

- **크립토 네이티브 SNS** — 유저 대부분이 크립토 투자자/개발자
- **완전 공개 프로토콜** — 모든 데이터가 온체인/허브에 공개, 봇 초대 불필요
- **밈코인 논의 활발** — Degen, Higher, $BUILD 등 Farcaster 발 밈코인 다수
- **무료 API** — Neynar API 무료 티어 (300 req/분), 또는 Hubble 직접 운영

### 아키텍처

```
Neynar API (무료)
  ├─ GET /v2/farcaster/feed/channels?channel_ids=memes,degen,crypto → 채널 피드
  ├─ GET /v2/farcaster/cast/search?q=memecoin → 키워드 검색
  └─ 응답: { casts: [{ text, author, reactions, timestamp, embeds }] }

→ crypto_posts에 source='farcaster' 저장
→ 기존 멘션 추출 + 센티먼트 파이프라인 재활용
```

### 구현 계획

| 파일 | 내용 |
|------|------|
| `lib/crypto/farcaster-crawler.ts` | Neynar API 호출, cast → crypto_posts 변환, 중복 체크 |
| `config.ts` | `FARCASTER_CHANNELS`, `FARCASTER_KEYWORDS` 추가 |
| `types/crypto.ts` | `FarcasterChannelConfig` 타입 추가 |
| `app/api/crypto/crawl/route.ts` | Phase 1에 farcaster 크롤 추가 |

### Farcaster 채널 후보

```
memes, degen, crypto, base, solana, trading,
defi, nft, onchain, farcaster, higher
```

### 상세

- **Neynar API 키**: https://neynar.com → 무료 플랜 (300 req/분, 충분)
- **환경변수**: `NEYNAR_API_KEY` (.env.local + Vercel)
- **크롤 주기**: 매 크롤 (15분), Phase 1에서 Telegram과 병렬 실행
- **engagement score**: `reactions.likes + recasts * 2` (Twitter와 동일 패턴)
- **예상 볼륨**: 10채널 × ~30 casts = 300 casts/크롤, 중복 제거 후 **일 ~500~1,000건**
- **비용**: $0 (무료 티어)
- **소요**: 반나절

---

## Phase L: DexScreener 온체인 시그널 (보조 소스)

### 왜 DexScreener인가

- 소셜 시그널과 **독립적인 온체인 데이터** → 교차검증 최적
- 거래량 급증 = 가격 움직임 선행 지표
- 신규 밈코인 최초 감지 (소셜에 아직 안 올라온 코인)

### 활용 데이터

```
GET https://api.dexscreener.com/token-boosts/latest/v1  → 부스트된 토큰 (프로모션)
GET https://api.dexscreener.com/latest/dex/search?q=pepe → 토큰 검색
GET https://api.dexscreener.com/latest/dex/tokens/{addr} → 토큰 상세 (가격, 거래량, 유동성)
```

### 시그널 연동 방식

- `crypto_posts`에 저장하지 않음 (소셜 데이터 아님)
- 별도 `crypto_onchain_signals` 테이블 또는 기존 시그널의 `eventModifier`에 반영
- 거래량 5배 급증 → `volume_spike` 이벤트 (+10)
- 유동성 50% 이상 감소 → `liquidity_drain` 이벤트 (-15)
- **예상 효과**: 소셜 시그널 단독 대비 적중률 +10~15%p
- **비용**: $0 (무료 API, rate limit 300 req/분)
- **소요**: 반나절

---

## 우선순위 및 일정

| 순서 | 작업 | 예상 소요 | 데이터 증가 | 비용 |
|------|------|----------|------------|------|
| 1 | J-1: Reddit new/rising 배포 | 5분 (push) | +200~300/일 | $0 |
| 2 | J-2: Telegram 채널 확대 | 30분 | +100~200/일 | $0 |
| 3 | J-3: Reddit 서브레딧 추가 | 15분 | +100/일 | $0 |
| 4 | K: Farcaster 연동 | 반나절 | +500~1,000/일 | $0 |
| 5 | L: DexScreener 온체인 | 반나절 | (교차검증) | $0 |

### 예상 결과

```
현재:  일 ~500건 (3개 소스)
J 완료: 일 ~1,000건 (기존 소스 최적화)
K 완료: 일 ~2,000건 (4개 활성 소스 + CoinGecko)
L 완료: 일 ~2,000건 + 온체인 교차검증
```

---

## 체크리스트

- [ ] J-1: Reddit new/rising — git push (코드 수정 완료)
- [ ] J-2: Telegram 채널 후보 공개 접근 검증 → config.ts 추가
- [ ] J-3: Reddit 서브레딧 추가 (crypto-reddit-crawl.ts + config.ts 동기화)
- [ ] K: Neynar API 키 발급 → .env.local + Vercel 등록
- [ ] K: farcaster-crawler.ts 구현
- [ ] K: types/crypto.ts FarcasterChannelConfig 타입 추가
- [ ] K: crawl/route.ts Phase 1에 farcaster 추가
- [ ] K: CRYPTO_SOURCES.md 문서 업데이트
- [ ] L: DexScreener API 연동 + 이벤트 타입 추가
- [ ] L: CRYPTO_SCORING.md에 온체인 이벤트 스코어링 추가
