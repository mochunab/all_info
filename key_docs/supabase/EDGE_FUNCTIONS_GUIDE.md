# EDGE_FUNCTIONS_GUIDE.md - Supabase Edge Functions 가이드

> Supabase Edge Functions (Deno Runtime) 상세 문서

---

## Edge Functions 목록

| # | 함수명 | 역할 | 모델 | 상태 |
|---|--------|------|------|------|
| 1 | `summarize-article` | AI 요약 생성 (1줄 요약 + 태그 3개) | GPT-5-nano / GPT-4o-mini (fallback) | 운영 중 |

> 현재 1개의 Edge Function이 배포되어 있습니다. 추후 확장 시 이 문서에 추가합니다.

---

## 1. summarize-article

### 개요

| 항목 | 값 |
|------|-----|
| **파일** | `supabase/functions/summarize-article/index.ts` |
| **런타임** | Deno |
| **모델** | GPT-5-nano (기본) → GPT-4o-mini (fallback) |
| **환경변수** | `OPENAI_API_KEY` |
| **CORS** | 모든 Origin 허용 |

### 요청 (Request)

```
POST /functions/v1/summarize-article
Content-Type: application/json
Authorization: Bearer {SUPABASE_ANON_KEY or SERVICE_ROLE_KEY}
```

```json
{
  "title": "아티클 제목",
  "content": "아티클 본문 내용...",
  "articleId": "optional-article-uuid"
}
```

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `title` | string | O | 아티클 제목 |
| `content` | string | O | 본문 내용 (최대 3000자로 잘림) |
| `articleId` | string | X | 아티클 ID (로깅용) |

### 응답 (Response)

**성공 (200)**:
```json
{
  "success": true,
  "summary": "핵심 내용을 한 줄로 압축한 요약 (80자 이내)",
  "summary_tags": ["태그1", "태그2", "태그3"]
}
```

**실패 (400/500)**:
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

### AI 프롬프트 (절대 변경 금지)

```
역할: 콘텐츠 본문글을 읽고 사람들이 클릭하게 만드는 '1줄 요약 장인'

목표: 사용자의 클릭을 유도하는 결정적인 '잣대' 역할

지시사항:
1. 1줄 요약글 작성
2. 전문 용어 배제, 일상적이고 친근한 말투
3. 구체적인 상황이나 이득 명시
4. 핵심 키워드 3개 태그

제약조건:
- 길이: 공백 포함 80자 이내 (엄수)
- 형식: 이모지 및 마크다운 금지
- 톤: 친근하고 쉬운 구어체

출력: JSON { "summary": "...", "summary_tag": ["...", "...", "..."] }
```

### API 호출 흐름

```
1. GPT-5-nano (responses.create API) 시도
   ├── 성공 → JSON 파싱 후 반환
   └── 404 → Fallback 실행

2. Fallback: GPT-4o-mini (chat.completions API)
   ├── 성공 → JSON 파싱 후 반환
   └── 실패 → 에러 반환
```

### 배포 방법

```bash
# 1. Supabase CLI 설치
npm install -g supabase

# 2. 프로젝트 연결
supabase link --project-ref YOUR_PROJECT_REF

# 3. OpenAI API Key 설정
supabase secrets set OPENAI_API_KEY=sk-...

# 4. 함수 배포
supabase functions deploy summarize-article

# 5. 테스트
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/summarize-article \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트 제목","content":"테스트 본문 내용..."}'
```

### 호출 방식 (앱에서)

```typescript
// 1. Edge Function 직접 호출 (USE_EDGE_FUNCTION=true)
const { data, error } = await supabase.functions.invoke('summarize-article', {
  body: { title, content, articleId }
});

// 2. 로컬 OpenAI API 호출 (USE_EDGE_FUNCTION=false)
// lib/ai/batch-summarizer.ts에서 직접 OpenAI API 호출
```

---

## Edge Function 개발 가이드

### 새 Edge Function 추가 시

```bash
# 1. 함수 생성
supabase functions new function-name

# 2. 코드 작성
# supabase/functions/function-name/index.ts

# 3. 로컬 테스트
supabase functions serve function-name

# 4. 배포
supabase functions deploy function-name
```

### Deno 런타임 주의사항

```typescript
// Supabase Edge Functions는 Deno 런타임
// Node.js 모듈 대신 Deno/Web 표준 API 사용

// ✅ GOOD
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const apiKey = Deno.env.get('OPENAI_API_KEY');
Deno.serve(async (req: Request) => { ... });

// ❌ BAD
import { something } from 'node-module'; // Node.js 모듈 사용 불가
process.env.API_KEY; // process 객체 없음
```

### CORS 설정 (필수)

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CORS Preflight 처리
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// 응답에 CORS 헤더 포함
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});
```

---

## 추가 Edge Function 계획 (미구현)

| 함수명 | 역할 | 우선순위 |
|--------|------|----------|
| `crawl-single-source` | 단일 소스 크롤링 (서버리스) | 낮음 |
| `send-digest-email` | 데일리 다이제스트 이메일 발송 | 낮음 |
| `cleanup-old-articles` | 오래된 아티클 정리 | 낮음 |

> 필요 시 이 문서를 업데이트하고 구현합니다.
