# 문서 사용 가이드

> Insight Hub 프로젝트 문서를 언제, 왜 참고해야 하는지 안내합니다.

---

## 문서 구조

```
CLAUDE.md                          ← AI 작업 규칙 (매 세션 자동 로드)
README.md                          ← 프로젝트 빠른 시작
key_docs/
  PROJECT_CONTEXT.md               ← 전체 아키텍처 & 데이터 플로우
  DECISIONS.md                     ← 설계 결정 기록
  components-inventory.md          ← 컴포넌트 목록
  DATABASE_SCHEMA.md               ← DB 스키마
  supabase/
    EDGE_FUNCTIONS_GUIDE.md        ← Edge Functions 개발/배포
    DATABASE_TRIGGERS_AND_FUNCTIONS.md ← DB 트리거 & 함수
    RLS_POLICIES.md                ← Row Level Security 정책
```

---

## 상황별 참고 문서

### 새 세션 시작할 때
| 문서 | 이유 |
|------|------|
| **CLAUDE.md** | 자동 로드됨. 개발 규칙, 금지 사항, API 라우트 맵 확인 |

### 프로젝트 처음 접할 때
| 문서 | 이유 |
|------|------|
| **README.md** | 설치, 실행, 환경변수 세팅 |
| **PROJECT_CONTEXT.md** | 시스템 전체 구조, 크롤링/요약 플로우 이해 |

### 기능 개발할 때
| 작업 | 참고 문서 |
|------|-----------|
| 프론트엔드 컴포넌트 수정/추가 | **components-inventory.md** |
| 크롤러 전략 추가/수정 | **PROJECT_CONTEXT.md** (크롤러 상세 섹션) |
| API 라우트 작업 | **CLAUDE.md** (API Routes 테이블) |
| DB 테이블/컬럼 변경 | **DATABASE_SCHEMA.md** |
| Edge Function 수정/배포 | **EDGE_FUNCTIONS_GUIDE.md** |
| DB 트리거/함수 변경 | **DATABASE_TRIGGERS_AND_FUNCTIONS.md** |
| RLS 정책 확인/수정 | **RLS_POLICIES.md** |

### 설계 의도가 궁금할 때
| 문서 | 이유 |
|------|------|
| **DECISIONS.md** | "왜 이렇게 했지?" 에 대한 답. 과거 결정과 근거 기록 |

---

## 요약: 3줄 가이드

1. **일반 작업** → CLAUDE.md만으로 충분 (자동 로드)
2. **구조 파악/디버깅** → PROJECT_CONTEXT.md 추가 확인
3. **특정 영역 작업** → 해당 key_docs 문서 참고 (DB, Edge Function, 컴포넌트 등)
