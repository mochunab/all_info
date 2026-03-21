# 크립토 문서 가이드

## 문서 구조

```
크립토/
├── CRYPTO_OVERVIEW.md       ← 온보딩 진입점 (배경 + 상태 요약 + 문서 라우팅)
├── CRYPTO_GUIDE.md          ← 이 문서 (문서 관리 규칙)
├── CRYPTO_DECISIONS.md      ← Phase별 히스토리 + 설계 결정 + 교훈
├── CRYPTO_PIPELINE.md       ← 6-Phase 데이터 파이프라인 + 프론트엔드 플로우
├── CRYPTO_FILES.md          ← 파일 구조 (생성/수정 파일 목록)
├── CRYPTO_INFRA.md          ← 환경변수 + Edge Functions + 토큰 + DB 스키마 + RLS
├── CRYPTO_SCORING.md        ← 시그널 가중치 V2 + 시각화 상세
├── CRYPTO_SOURCES.md        ← 데이터 소스 상세 (Reddit/Twitter/Telegram/Discord)
├── CRYPTO_CHECKLIST.md      ← Phase별 검증 체크리스트
├── ONTOLOGY_GUIDE.md        ← 온톨로지 아키텍처 심화 (기존)
├── BATTLE_TRADING_RULES.md  ← AI 배틀 트레이딩 룰 (기존)
├── PROJECT_VALIDITY.md      ← 프로젝트 타당성 + 학술 근거 (기존)
```

## 온보딩 규칙

1. **세션 시작 시 CRYPTO_OVERVIEW.md만 읽는다**
2. 작업 내용에 따라 OVERVIEW 하단 라우팅 테이블을 보고 필요한 문서를 추가로 읽는다
3. 전체 문서를 한 번에 읽지 않는다 — 컨텍스트 낭비

## 문서 작성 규칙

### 새 Phase 완료 시
1. **CRYPTO_DECISIONS.md** — Phase 상세 내용 추가 (번호, 제목, 구현 내용, 설계 근거)
2. **CRYPTO_OVERVIEW.md** — 현재 상태 요약 테이블에 한 줄 추가
3. **CRYPTO_FILES.md** — 새로 생성/수정한 파일 추가
4. **CRYPTO_CHECKLIST.md** — 검증 항목 추가

### 어디에 쓸지 판단 기준
| 내용 | 문서 |
|------|------|
| "왜 이 방식을 선택했는가" | DECISIONS |
| "어떤 순서로 실행되는가" | PIPELINE |
| "어떤 파일이 관여하는가" | FILES |
| "환경변수/시크릿/DB 변경" | INFRA |
| "점수 계산 로직 변경" | SCORING |
| "새 데이터소스 추가" | SOURCES |
| "배포 전 확인할 것" | CHECKLIST |

### 문서 크기 관리
- 단일 문서가 500줄을 넘으면 분리 검토
- DECISIONS.md는 예외 — 히스토리 누적이므로 길어질 수 있음
- 완료되어 더 이상 변경 없는 체크리스트는 주기적으로 정리 (✅ 항목 축소)
