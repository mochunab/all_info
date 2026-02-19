# Supabase Edge Functions 가이드

> Insight Hub의 Supabase Edge Function 설정, 배포, 테스트 방법

---

## 개요

Insight Hub는 2개의 Supabase Edge Function을 사용합니다:

| Function | 용도 | 모델 | 호출 시점 |
|----------|------|------|----------|
| `summarize-article` | 아티클 AI 요약 생성 (1줄 요약 + 태그 3개) | GPT-5-nano (Responses API) | 크롤링 후 배치 요약 시 |
| `detect-crawler-type` | 크롤러 타입 자동 감지 (STATIC/SPA 판별) | GPT-5-nano (Responses API) | 소스 저장 시 (Auto 선택 시) |

**왜 Edge Functions?**
- Deno 런타임이 OpenAI Responses API (GPT-5-nano) 네이티브 지원
- GPT-5-nano: $0.05/1M tokens (GPT-4o-mini 대비 10배 저렴)
- Vercel Serverless (CJS)에서는 `@deno/shim-deno` 패키지 없이 Responses API 사용 불가

---

## 1. summarize-article Edge Function

### 위치
```
supabase/functions/summarize-article/index.ts
```

### 기능
- 아티클 제목 + 본문(content_preview)을 받아 AI 요약 생성
- 1줄 핵심 요약 (80자 이내) + 태그 3개 (7자 내외)
- OpenAI Responses API (GPT-5-nano) 사용
- fallback: GPT-4o-mini (Responses API 실패 시)

### 입력 (JSON)
```json
{
  "title": "아티클 제목",
  "content": "본문 텍스트 (500자 이내)"
}
```

### 출력 (JSON)
```json
{
  "summary": "1줄 핵심 요약 (80자 이내, 구어체, 이모지/마크다운 금지)",
  "summary_tag": ["태그1", "태그2", "태그3"]
}
```

### 프롬프트 전략
```typescript
const SUMMARY_PROMPT = `
다음 아티클을 분석하여 JSON 형식으로 요약해주세요:

제목: {title}
내용: {content}

출력 형식 (JSON):
{
  "summary": "80자 이내 1줄 요약 (구어체, 이모지/마크다운 금지)",
  "summary_tag": ["7자내외", "7자내외", "7자내외"]
}

규칙:
- summary: 핵심만 1줄로 압축
- summary_tag: 3개, 각 7자 내외, 핵심 키워드
`;
```

### 호출 예시
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/summarize-article" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2024년 트렌드 분석",
    "content": "올해는 AI와 클라우드 기술이 급성장..."
  }'
```

### 로컬 OpenAI Fallback
- Edge Function 실패 시 `lib/ai/summarizer.ts`의 로컬 OpenAI API (GPT-4o-mini) 호출
- 환경변수 `USE_EDGE_FUNCTION=false`로 강제 로컬 모드 가능

---

## 2. detect-crawler-type Edge Function (2026-02-14 추가)

### 위치
```
supabase/functions/detect-crawler-type/index.ts
```

### 기능
- 웹페이지 URL + HTML을 받아 최적 크롤러 타입 결정 (STATIC/SPA/RSS 등)
- GPT-5-nano가 HTML 구조, JavaScript 프레임워크, 렌더링 방식 분석
- 도메인 하드코딩 제거 → 확장 가능한 자동 감지 시스템
- 8단계 파이프라인의 7단계에서 호출 (Rule-based confidence < 0.7일 때만)

### 입력 (JSON)
```json
{
  "url": "https://example.com",
  "html": "<html>... (5000자 truncate)</html>"
}
```

### 출력 (JSON)
```json
{
  "crawlerType": "SPA",
  "confidence": 0.85,
  "reasoning": "React 기반 SPA 감지됨. JS 렌더링 필요.",
  "fallbackStrategies": ["STATIC"]
}
```

### 프롬프트 전략
```typescript
const CRAWLER_TYPE_DETECTION_PROMPT = `
다음 웹페이지를 분석하여 최적의 크롤러 타입을 결정해주세요:

URL: {url}
HTML (첫 5000자):
{html}

분석 기준:
1. JavaScript 프레임워크 감지 (React, Vue, Angular)
   → id="root", __NEXT_DATA__, ng-app 등
   → SPA 가능성

2. Server-rendered 컨텐츠 패턴
   → 완전한 HTML 구조, 메타태그 충실
   → STATIC 가능성

3. RSS/Atom feed 링크
   → <link rel="alternate" type="application/rss+xml">
   → RSS

4. 플랫폼 특화 패턴
   → blog.naver.com → PLATFORM_NAVER
   → brunch.co.kr → PLATFORM_KAKAO

출력 형식 (JSON):
{
  "crawlerType": "STATIC|SPA|RSS|...",
  "confidence": 0.0~1.0,
  "reasoning": "판단 근거",
  "fallbackStrategies": ["대안1", "대안2"]
}

confidence >= 0.6일 때만 채택됩니다.
`;
```

### 호출 예시
```bash
curl -X POST "${SUPABASE_URL}/functions/v1/detect-crawler-type" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://nipa.kr/board/list",
    "html": "<html><head>...</head><body>...</body></html>"
  }'
```

### 8단계 파이프라인 통합
```
Step 1-6: Rule-based 분석 (70% 케이스 해결)
Step 7: confidence < 0.7 → detect-crawler-type 호출 (30% 케이스)
Step 8: AI selector detection fallback
```

### 비용 최적화
- Rule-based 분석이 70% 케이스 해결 (무료)
- AI 호출은 confidence < 0.7일 때만 (30%)
- HTML 5000자 truncate (토큰 비용 절감)
- GPT-5-nano: $0.05/1M tokens (GPT-4o-mini 대비 10배 저렴)

---

## 배포 방법

### 사전 요구사항
```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 연결 (최초 1회)
npx supabase link --project-ref <your-project-ref>
```

### 개별 배포
```bash
# summarize-article 배포
npx supabase functions deploy summarize-article

# detect-crawler-type 배포
npx supabase functions deploy detect-crawler-type
```

### 전체 배포
```bash
# 모든 Edge Functions 배포
npx supabase functions deploy
```

### 배포 확인
```bash
# Supabase Dashboard
# → Edge Functions 탭
# → summarize-article, detect-crawler-type 상태 확인
```

---

## Secret 설정

Edge Functions에서 OpenAI API Key를 사용하려면 Supabase Secret 설정 필요.

### 방법 1: Supabase Dashboard
```
1. Supabase Dashboard → Edge Functions → Secrets
2. "Add Secret" 클릭
3. Name: OPENAI_API_KEY
4. Value: sk-...
5. Save
```

### 방법 2: Supabase Management API (자동)
```typescript
// 이미 설정됨 — OPENAI_API_KEY는 두 함수가 공유
// summarize-article, detect-crawler-type 모두 동일 Secret 사용
```

### Secret 확인
```bash
# CLI로 확인 (공식 지원 X, Dashboard 사용 권장)
# Supabase Dashboard → Edge Functions → Secrets
```

---

## 테스트 방법

### 로컬 테스트 (Deno 런타임)

```bash
# Deno 설치
curl -fsSL https://deno.land/install.sh | sh

# summarize-article 로컬 실행
deno run --allow-net --allow-env \
  supabase/functions/summarize-article/index.ts

# detect-crawler-type 로컬 실행
deno run --allow-net --allow-env \
  supabase/functions/detect-crawler-type/index.ts
```

### 프로덕션 테스트 (배포 후)

**summarize-article 테스트**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/summarize-article" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "테스트 제목",
    "content": "테스트 본문 내용입니다."
  }'

# 기대 응답:
# {
#   "summary": "...",
#   "summary_tag": ["태그1", "태그2", "태그3"]
# }
```

**detect-crawler-type 테스트**
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/detect-crawler-type" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "html": "<html><body><h1>Test</h1></body></html>"
  }'

# 기대 응답:
# {
#   "crawlerType": "STATIC",
#   "confidence": 0.85,
#   "reasoning": "...",
#   "fallbackStrategies": [...]
# }
```

### 로그 확인
```
Supabase Dashboard
→ Edge Functions
→ summarize-article 또는 detect-crawler-type
→ Logs 탭
→ 실시간 로그 확인
```

---

## 트러블슈팅

### Q1. Edge Function 배포 시 "Cannot find project ref" 에러
**원인**: Supabase CLI가 프로젝트에 연결되지 않음
**해결**:
```bash
npx supabase link --project-ref <your-project-ref>
```

### Q2. OpenAI API 호출 시 401 Unauthorized
**원인**: OPENAI_API_KEY Secret이 설정되지 않음
**해결**:
1. Supabase Dashboard → Edge Functions → Secrets
2. OPENAI_API_KEY 추가 (sk-...)
3. Edge Function 재배포

### Q3. Responses API 호출 시 400 Bad Request
**원인**: GPT-5-nano가 일부 요청을 거부
**해결**: 자동 fallback (GPT-4o-mini 사용)
```typescript
// Edge Function 내부 자동 처리:
// Responses API 실패 시 → chat.completions API (GPT-4o-mini)
```

### Q4. Edge Function 응답이 느림 (5초 이상)
**원인**: Cold start + AI API 호출 시간
**해결**:
- 소스 저장은 1회성이므로 허용 가능
- 크롤링 배치는 비동기 처리로 사용자 경험 영향 없음

### Q5. Deno 런타임 에러 (Uncaught TypeError: ...)
**원인**: Deno 모듈 import 경로 문제
**해결**:
```typescript
// ❌ Node.js 스타일 금지
import OpenAI from 'openai';

// ✅ Deno 스타일 (JSR 또는 npm: 프리픽스)
import OpenAI from 'npm:openai@latest';
```

### Q6. Edge Function에서 환경변수 접근 불가
**원인**: Deno.env.get() 사용 필요
**해결**:
```typescript
// ✅ GOOD
const apiKey = Deno.env.get('OPENAI_API_KEY');

// ❌ BAD (Node.js 스타일)
const apiKey = process.env.OPENAI_API_KEY;
```

---

## 비용 추정

### summarize-article
- 모델: GPT-5-nano ($0.05/1M input tokens)
- 입력: 제목(50자) + 본문(500자) ≈ 200 tokens
- 출력: 요약(80자) + 태그(21자) ≈ 30 tokens
- 비용: ~$0.00001/요약 (1천 요약 = $0.01)
- 월 예상: 1만 아티클 = $0.10

### detect-crawler-type
- 모델: GPT-5-nano ($0.05/1M input tokens)
- 입력: HTML 5000자 ≈ 1500 tokens
- 출력: 타입 판정 ≈ 50 tokens
- 비용: ~$0.00008/분석 (1천 분석 = $0.08)
- 사용 패턴: 소스 추가 시 1회만 (월 10-20회)
- 월 예상: 20 소스 = $0.002

**총 월 비용**: ~$0.10-0.15 (1만 아티클 + 20 소스 추가 기준)

---

## 관련 문서

- [DECISIONS.md → ADR-004](../key_docs/DECISIONS.md#adr-004-openai-gpt-4o-mini--gpt-5-nano-선택) — GPT 모델 선택 근거
- [DECISIONS.md → ADR-015](../key_docs/DECISIONS.md#adr-015-ai-기반-크롤러-타입-자동-감지-시스템) — 크롤러 타입 자동 감지 설계
- [PROJECT_CONTEXT.md → AI 기반 크롤러 타입 자동 감지 시스템](../key_docs/PROJECT_CONTEXT.md#ai-기반-크롤러-타입-자동-감지-시스템) — 전체 아키텍처
- [CLAUDE.md → Edge Function 배포](../CLAUDE.md#4-edge-function-배포) — 개발 워크플로우

---

## 버전 히스토리

### v1.1.0 (2026-02-14)
- **detect-crawler-type Edge Function 추가** — AI 기반 크롤러 타입 자동 감지
- 8단계 파이프라인 통합 (Rule-based + AI)
- 비용 최적화: confidence < 0.7일 때만 AI 호출

### v1.0.0 (2025-01)
- summarize-article Edge Function 출시
- GPT-5-nano Responses API 연동
- GPT-4o-mini fallback 구현
