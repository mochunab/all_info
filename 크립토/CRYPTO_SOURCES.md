# 크립토 데이터 소스

---

## 현재 활성 소스

### Reddit (✅ 동작 중)
- **방식**: RSS (Atom XML) — `scripts/crypto-reddit-crawl.ts` (GitHub Actions에서 실행)
- Vercel IP가 Reddit에 차단됨 → GitHub Actions에서 RSS로 크롤링하여 우회
- Vercel route에도 JSON fallback 코드 존재 (로컬 테스트용)
- API 키 불필요, 10개 서브레딧 × hot+new

### Twitter/X (✅ 동작 중, Apify)
- **방식**: Apify `scrape.badger/twitter-tweets-scraper` Actor의 Advanced Search 모드
- **비용**: Apify 무료 $5/월, $0.0002/결과, 12시간 간격 = 월 ~$1.20
- **키워드**: `memecoin`, `$DOGE OR $PEPE OR $SHIB`, `$BONK OR $WIF OR $FLOKI`, `crypto pump OR altcoin gem`, `$SOL OR $ETH memecoin`
- **결과**: 5키워드 × 20결과 = 100트윗/크롤, 172 코인 멘션 추출 확인
- **12시간 간격**: `crawl/route.ts`에서 DB의 마지막 twitter crawled_at 체크
- **센티먼트**: 기존 `analyze-crypto-sentiment` Edge Function 재활용
- **sanitize 필수**: `sanitizeObject()` (JSON round-trip) — lone surrogate + HTML source 필드 정화. hashtags `[{tag: "..."}]` → `string[]` 정규화
- **Apify 계정**: `predictable_magazine` (한결), User ID: `6ndnAzPtwdxborJRu`
- API: `POST https://api.apify.com/v2/acts/scrape.badger~twitter-tweets-scraper/run-sync-get-dataset-items?token=TOKEN`
- `created_at` 형식: `"Fri Mar 20 15:39:08 +0000 2026"`, permalink: `https://x.com/${username}/status/${id}`
- score: `favorite_count + retweet_count * 2`

### Telegram (✅ 동작 중)
- **방식**: 23개 공개 채널 웹 프리뷰 스크래핑 (`t.me/s/채널명`)
- 봇 초대 없이 웹 스크래핑, API 키 불필요
- 15초 fetch 타임아웃 (AbortController)
- config.ts에 채널 목록: binance_announcements, cryptoVIPsignalTA, whale_alert_io 등

---

## 비활성화 소스

### Threads (❌ 코드 존재, 비활성화)
- **방식**: Meta Threads API `keyword_search`
- **문제**: 자기 게시물만 반환. 공개 검색은 Tech Provider 인증 필요 (비즈니스 인증 = 사업자등록증 → 보류)
- Meta App: `acainfo` (App ID: `949873810905349`), Threads 앱 ID: `744117611965629`
- 토큰 발급 완료 (만료: ~2026-05-18), 앱 라이브 모드

### 4chan /biz/ (보류)
- 크립토 비율 ~28%, 나머지는 노이즈
- 익명(인플루언서 감지 불가), score 없음, NSFW → 보류

---

## 확장 예정

### Discord 봇 (다음 우선순위)
- **방식**: Discord Bot API + discord.js (공식 API만 ToS 준수)
- **제약**: 봇이 서버에 초대되어야 메시지 접근 가능 (관리자 협조 필수)
- **MESSAGE_CONTENT 특권 인텐트**: 75개 서버 미만이면 자동 승인
- **아키텍처**: REST API 배치 수집 (Cron) → Supabase DB → 기존 센티먼트 파이프라인 재활용
- **타겟 서버**: 5-30k 규모의 중소 크립토 커뮤니티
- **DM 피칭 현황** (2026-03-15):
  - SolanaMemeCoins (38k) — 서포트 티켓
  - Insider Watchers (2,323명) — Owner "tumblr boi" (kushfr)
  - MemeCoin Discord (12,184명) — Owner "Frank" (frank.s0l)
  - MemeCoinCalls (5,113명) — Admin ".Manutobuizumaki."
  - **응답 대기 중**
- **피칭 전략**: 대학 캡스톤 프로젝트 + 무료 대시보드 제공 + read-only 봇 zero risk 강조
- **ToS 주의**: 수집 데이터로 ML 학습 금지 (추론/분석은 OK), 개인 메시지 저장 금지
