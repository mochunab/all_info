# 밈코인 예측기 — 프로젝트 오버뷰

> 최종 업데이트: 2026-03-22
> 경로: `/{locale}/crypto` (Header "밈코인 예측기" 메뉴 **master 계정만 노출**, URL 직접 접근은 누구나 가능)
> 프로덕션: https://aca-info.com/en/crypto

---

## 문서 업데이트 규칙

- **이 문서(OVERVIEW)에 새 내용을 추가할 때 200자를 초과하지 않는다.**
- 상세 내용은 아래 "문서 라우팅" 테이블의 연관 문서에 작성한다.
- OVERVIEW는 현황 요약과 문서 간 네비게이션 역할만 한다.

---

## 프로젝트 배경

Insight Hub의 크롤링 인프라(Reddit → DB → AI 분석)를 활용해 밈코인 시장의 **"왜 이 코인이 뜨는가"를 설명 가능한 시그널로 제공**하는 기능. 단순 점수가 아닌 근거 체인(Explainable Signal)이 핵심 차별점.

### 전략적 위치
- **현재**: Header 메뉴는 master 계정 전용, URL 직접 접근은 공개 (Discord 커뮤니티 파트너십 피칭용 데모)
- **다음 단계**: Discord 봇 연동 → 커뮤니티 데이터 수집 확대 → 크립토 전용 플랫폼 피벗
- 기존 Insight Hub 인프라 최대 활용 — Reddit API + Apify(X/Twitter) + Telegram 스크래핑 + 기존 AI 파이프라인 재활용

### 핵심 기능 4개
1. **멀티소스 센티먼트 추적** — X/Twitter(Apify) + Reddit(RSS) + Telegram + 4chan /biz/ + CoinGecko Trending → 코인 멘션 추출 → LLM 센티먼트 분석 (5분 독립 크론)
2. **가중 시그널 스코어 (V2)** — 5요소 가중치 × mentionConfidence × marketCapDampening × zScoreMultiplier × crossPlatformMultiplier + eventModifier + KG Boost → 0~100점 + signal_label (Heat 스케일) + contrarianWarning
3. **지식그래프** — 코인/인플루언서/내러티브/이벤트 엔티티 + 5종 관계 → LLM 동적 감지 + 점진적 감쇠 + 시그널 피드백 루프
4. **Signal Network 시각화** — Force-directed 3D 그래프 + WHY Trending 추론 패널 (점수 분해·AI 근거·소스 분포·키워드·내러티브·이벤트 타임라인)

---

## 현재 상태 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | Reddit 크롤링 + 코인 멘션 추적 | ✅ 완료 |
| 2 | 센티먼트 분석 + 시그널 생성 | ✅ 완료 |
| 3 | 지식그래프 | ✅ 완료 |
| 4 | 대시보드 UI | ✅ 완료 |
| 5 | Signal Network 그래프 시각화 | ✅ 완료 |
| 6 | Threads 연동 | ❌ 비활성화 (자기 게시물만 반환) |
| 7 | 타임아웃 방지 + 시그널 보정 | ✅ 완료 |
| 8 | CoinGecko 가격 연동 | ✅ 완료 |
| 9 | Why Trending 추론 시각화 | ✅ 완료 |
| 10 | X/Twitter 크롤링 (Apify) | ✅ 완료 |
| B | 온톨로지 고도화 | ✅ 완료 |
| C | 시각화 강화 | ✅ 완료 |
| D | 백테스팅 시스템 | ✅ 완료 |
| E | Signal Label Heat 스케일 전환 | ✅ 완료 |
| F | 센티먼트 배치 + AI 배틀 완화 + UI 정리 | ✅ 완료 |
| G | Signal Scoring V2 + 3D 그래프 | ✅ 완료 |
| H | FOMO/FUD 시그널 분리 + CoinDetail 가격 차트 | ✅ 완료 |
| I | 온톨로지 → 시그널 피드백 루프 + KG Boost UI | ✅ 완료 |
| L | DexScreener 온체인 시그널 (교차검증) | ✅ 완료 |
| K | 4chan /biz/ 크롤러 + coin-extractor strictMode | ✅ 완료 |
| M | 센티먼트 파이프라인 독립 크론 분리 (5분 주기) | ✅ 완료 |

### 미완료 (To-Do)

**우선순위 높음**
- (없음 — 핵심 기능 모두 동작 중)

**우선순위 중간**
- Discord 봇 연동 — DM 피칭 4개 서버 발송 완료, 응답 대기 중
- AI 채팅 개선 — 크립토 전용 Edge Function 분리 고려

**우선순위 낮음**
- 알림 시스템 — trending 알림 (velocity > 2.0 AND score ≥ 60) → 이메일/푸시
- 크립토 전용 플랫폼 분리 — 피벗 시 독립 도메인/앱으로 분리

---

## 문서 라우팅

| 작업 | 읽을 문서 |
|------|-----------|
| 프로젝트 온보딩 | 이 문서 (OVERVIEW) |
| 시그널 로직 수정 | [CRYPTO_SCORING.md](./CRYPTO_SCORING.md) |
| 파이프라인 수정 / 새 Phase 추가 | [CRYPTO_PIPELINE.md](./CRYPTO_PIPELINE.md) |
| 새 크롤러 / 데이터소스 추가 | [CRYPTO_SOURCES.md](./CRYPTO_SOURCES.md) + [CRYPTO_PIPELINE.md](./CRYPTO_PIPELINE.md) |
| 환경변수 / Edge Function / DB 스키마 | [CRYPTO_INFRA.md](./CRYPTO_INFRA.md) |
| 파일 위치 파악 | [CRYPTO_FILES.md](./CRYPTO_FILES.md) |
| "왜 이렇게 했지?" 설계 결정 복기 | [CRYPTO_DECISIONS.md](./CRYPTO_DECISIONS.md) |
| 배포 전 검증 | [CRYPTO_CHECKLIST.md](./CRYPTO_CHECKLIST.md) |
| 문서 작성/관리 규칙 | [CRYPTO_GUIDE.md](./CRYPTO_GUIDE.md) |
| 온톨로지 아키텍처 심화 | [ONTOLOGY_GUIDE.md](./진행중/ONTOLOGY_GUIDE.md) |
| AI 배틀 트레이딩 룰 | [BATTLE_TRADING_RULES.md](./참고문서/BATTLE_TRADING_RULES.md) |
| 프로젝트 타당성 / 학술 근거 | [PROJECT_VALIDITY.md](./비즈니스/PROJECT_VALIDITY.md) |
