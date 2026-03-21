# 크립토 인프라 (환경변수 + Edge Functions + DB)

---

## Edge Functions

| 함수 | 모델 | 용도 | 상태 |
|------|------|------|------|
| `analyze-crypto-sentiment` | `gemini-2.5-flash` | Reddit/Telegram/Twitter 센티먼트 — 배치 모드(최대 10건/호출) + 단일 모드 하위 호환 (score/label/fomo/fud/reasoning + narratives/events) | ✅ 배포 완료 |
| `analyze-threads-sentiment` | `gemini-2.5-flash-lite` | Threads 전용 센티먼트 | 미사용 (Threads 비활성화) |

`google_API_KEY` secret 사용 (기존 Edge Function과 공유, Dashboard에 이미 등록됨).

### 배포 명령어
```bash
supabase functions deploy analyze-crypto-sentiment --project-ref tcpvxihjswauwrmcxhhh
```

---

## 환경변수

| 변수 | 위치 | 용도 | 상태 |
|------|------|------|------|
| `REDDIT_CLIENT_ID` | — | Reddit OAuth2 (현재 미사용 — 공개 JSON 사용) | 불필요 |
| `REDDIT_CLIENT_SECRET` | — | Reddit OAuth2 (현재 미사용) | 불필요 |
| `google_API_KEY` | Supabase Secrets | Gemini API | 기존 등록됨 |
| `THREADS_ACCESS_TOKEN` | `.env.local` + Vercel | Threads API 토큰 (60일, 만료: ~2026-05-18) | ✅ 설정 완료 |
| `CRON_SECRET` | `.env.local` + Vercel | 크롤링 Bearer 인증 | 기존 등록됨 |
| `APIFY_API_TOKEN` | `.env.local` + Vercel | Apify API (Twitter/X, 무료 $5/월) | ✅ 설정 완료 |
| `COINGECKO_API_KEY` | — | CoinGecko Demo API 키 (선택) | 미설정 (무료 한도 충분) |

---

## 토큰 발급/갱신

### Reddit API 키
1. https://support.reddithelp.com/hc/requests/new?ticket_form_id=14868593862164 에서 등록 티켓 제출 (2026-03-15 제출 완료)
2. 승인 후 https://www.reddit.com/prefs/apps → script 타입 앱 생성
3. 현재는 공개 JSON 엔드포인트 사용 중이라 불필요

### Threads 토큰 갱신 (60일 만료 시)
1. 브라우저에서 인증 코드 요청:
   ```
   https://threads.net/oauth/authorize?client_id=744117611965629&redirect_uri=https://localhost/&scope=threads_basic,threads_keyword_search&response_type=code
   ```
2. Threads 로그인 → 앱 승인 → `https://localhost/?code=XXXXXX#_` 에서 code 복사
3. Short-lived → Long-lived 토큰 교환
4. `.env.local` + Vercel에 `THREADS_ACCESS_TOKEN` 갱신

**⚠️ 앱 시크릿 재발급 필요**: 대화에서 노출됨 → Meta 개발자 대시보드에서 리셋 필수

---

## DB 스키마 요약

| 테이블 | PK | UNIQUE | 비고 |
|--------|-----|--------|------|
| crypto_posts | id (uuid) | source_id | 크롤링된 게시물 |
| crypto_mentions | id | — | FK: post_id → crypto_posts |
| crypto_sentiments | id | post_id | FK: post_id, metadata JSONB (narratives/events) |
| crypto_signals | id | (coin_symbol, time_window, signal_type, computed_at) | V2: z_score, source_count, contrarian_warning, sentiment_skew, detected_events[], event_modifier |
| crypto_entities | id | (entity_type, name) | 코인/인플루언서/내러티브/이벤트 |
| crypto_relations | id | — | FK: source/target_entity_id → crypto_entities |
| crypto_coins | id (uuid) | coingecko_id | CoinGecko 코인 마스터 |
| crypto_prices | id (uuid) | — | FK: coingecko_id → crypto_coins, IDX: (coingecko_id, fetched_at DESC) |
| crypto_backtest_results | id (uuid) | (coin_symbol, time_window, signal_type, signal_at, lookup_window) | 시그널 vs 가격 비교 |

### 뷰
- `crypto_backtest_summary`: 라벨별 적중률 + 평균 수익률 집계 (signal_type GROUP BY 포함)

### RLS 정책
- 모든 테이블 **읽기 전체 허용**
- 쓰기는 `service_role` 사용 (`createServiceClient`)
