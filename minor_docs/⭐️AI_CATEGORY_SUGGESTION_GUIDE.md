# AI 기반 카테고리 자동 제안 시스템 - 구현 가이드

> URL 입력만으로 AI가 최적의 카테고리를 자동 추천하는 기능
> 작성일: 2026-02-15

## 📋 목차

1. [기능 개요](#기능-개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [API 설계](#api-설계)
4. [AI 프롬프트 설계](#ai-프롬프트-설계)
5. [코드 구현 예시](#코드-구현-예시)
6. [UI/UX 설계](#uiux-설계)
7. [테스트 시나리오](#테스트-시나리오)
8. [비용 및 성능](#비용-및-성능)

---

## 기능 개요

### 목표
URL만 입력하면 AI가 자동으로 가장 적합한 카테고리를 제안하고, 적합한 카테고리가 없으면 새 카테고리를 생성 제안

### 사용 시나리오

```
[시나리오 1] 기존 카테고리 매칭
사용자: https://www.wiseapp.co.kr/insight/ 입력
AI 분석: 제목 "와이즈앱 리포트", 내용 "모바일 시장 분석..."
기존 카테고리: ['시장 조사', '정부 지원 사업', 'AI 트렌드']
→ 제안: '시장 조사' (confidence: 0.92, 이유: "모바일 앱 시장 데이터 분석 콘텐츠")

[시나리오 2] 신규 카테고리 제안
사용자: https://www.mois.go.kr/startup/ 입력
AI 분석: 제목 "창업 지원 정책", 내용 "예비창업자 지원..."
기존 카테고리: ['시장 조사', 'AI 트렌드']
→ 제안: '창업 지원' (isNew: true, 이유: "정부 창업 지원 정책 전문 콘텐츠")
```

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│  소스 추가 페이지 (app/sources/add/page.tsx)                 │
│                                                              │
│  1. 사용자 URL 입력: https://example.com/blog               │
│     ↓                                                        │
│  2. "카테고리 자동 제안" 버튼 클릭                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  POST /api/categories/suggest                                │
│  (app/api/categories/suggest/route.ts)                       │
│                                                              │
│  Step 1: URL 메타데이터 추출                                 │
│  ├─ fetchPageMetadata(url)                                  │
│  │   └─ fetch(url) + Cheerio 파싱                           │
│  │       - <title>                                           │
│  │       - <meta name="description">                         │
│  │       - <meta property="og:*">                            │
│  │       - <meta name="keywords">                            │
│  │       - 본문 일부 (500자)                                 │
│  │                                                           │
│  Step 2: 기존 카테고리 조회                                  │
│  └─ Supabase: SELECT DISTINCT category FROM categories      │
│                                                              │
│  Step 3: AI 카테고리 제안 (lib/ai/category-suggester.ts)    │
│  └─ suggestCategory(metadata, existingCategories)           │
│      ├─ Edge Function (GPT-5-nano) 우선                     │
│      └─ fallback: 로컬 OpenAI (GPT-4o-mini)                 │
│                                                              │
│  Response:                                                   │
│  {                                                           │
│    "suggestedCategory": "시장 조사",                         │
│    "confidence": 0.85,                                       │
│    "isNew": false,                                           │
│    "reasoning": "모바일 시장 분석 관련 콘텐츠"                │
│  }                                                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  UI 업데이트                                                  │
│  - 제안된 카테고리 드롭다운에 자동 선택                        │
│  - confidence 표시 (예: 85% 확신도)                          │
│  - reasoning 툴팁 표시                                        │
│  - isNew=true면 "신규 카테고리" 배지 표시                     │
└─────────────────────────────────────────────────────────────┘
```

---

## API 설계

### Endpoint

```typescript
POST /api/categories/suggest
```

### Request Body

```typescript
{
  "url": "https://www.wiseapp.co.kr/insight/",
  "existingCategories"?: string[]  // 선택적, 없으면 DB 조회
}
```

### Response

```typescript
{
  "success": true,
  "data": {
    "suggestedCategory": "시장 조사",
    "confidence": 0.85,           // 0.0 ~ 1.0
    "isNew": false,               // true면 신규 카테고리 제안
    "reasoning": "모바일 앱 시장 데이터 분석 콘텐츠로, '시장 조사' 카테고리와 가장 관련성이 높습니다.",
    "metadata": {                 // 디버깅용
      "title": "와이즈앱 리포트",
      "description": "대한민국 모바일 시장 분석..."
    }
  }
}
```

### Error Response

```typescript
{
  "success": false,
  "error": "Failed to fetch page metadata",
  "details": "URL 접근 불가 또는 타임아웃"
}
```

---

## AI 프롬프트 설계

### 프롬프트 구조

```typescript
const CATEGORY_SUGGESTION_PROMPT = `
당신은 콘텐츠 큐레이션 전문가입니다. 주어진 웹페이지의 메타데이터를 분석하여 가장 적합한 카테고리를 제안해주세요.

# 기존 카테고리 목록
${existingCategories.join(', ')}

# 웹페이지 정보
- URL: ${url}
- 제목: ${metadata.title}
- 설명: ${metadata.description}
- 키워드: ${metadata.keywords}
- 본문 샘플: ${metadata.contentSample}

# 제약 조건
1. 기존 카테고리 중에 적합한 것이 있으면 그것을 선택하세요
2. 기존 카테고리가 모두 부적합하면 새로운 카테고리를 제안하세요 (최대 2단어, 한글)
3. confidence는 0.0~1.0 사이로, 0.7 이상이면 신뢰할 만한 제안입니다
4. reasoning은 한 문장으로 명확하게 작성하세요

# 카테고리 선택 가이드
- '시장 조사': 시장 분석, 통계, 트렌드 리포트
- '정부 지원 사업': 정부 정책, 지원금, 공공 사업
- 'AI 트렌드': AI/ML 기술, ChatGPT, 생성형 AI
- '비즈니스': 일반 비즈니스 전략, 경영 인사이트
- '스타트업': 창업, 벤처, 스타트업 생태계

# 출력 형식 (JSON만 반환)
{
  "suggestedCategory": "카테고리명",
  "confidence": 0.85,
  "isNew": false,
  "reasoning": "선택 이유"
}
`;
```

### 프롬프트 최적화 팁

1. **Few-shot Learning**: 예시 추가로 정확도 향상
   ```
   ## 예시 1
   입력: URL=https://www.wiseapp.co.kr/insight/, 제목="모바일 앱 시장 분석"
   출력: {"suggestedCategory": "시장 조사", "confidence": 0.9, ...}

   ## 예시 2
   입력: URL=https://example.com/ai-news, 제목="ChatGPT 활용법"
   출력: {"suggestedCategory": "AI 트렌드", "confidence": 0.95, ...}
   ```

2. **Confidence 임계값**: 0.7 미만이면 사용자에게 직접 선택 요청

3. **카테고리 가이드 업데이트**: 새 카테고리 추가 시 프롬프트에 반영

---

## 코드 구현 예시

### 1. API Route (`app/api/categories/suggest/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchPageMetadata } from '@/lib/crawlers/metadata-extractor';
import { suggestCategory } from '@/lib/ai/category-suggester';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30초 타임아웃

type SuggestRequestBody = {
  url: string;
  existingCategories?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body: SuggestRequestBody = await request.json();
    const { url, existingCategories } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Step 1: URL 메타데이터 추출 (15초 타임아웃)
    const metadata = await fetchPageMetadata(url);

    // Step 2: 기존 카테고리 조회 (제공되지 않은 경우)
    let categories = existingCategories;
    if (!categories || categories.length === 0) {
      const supabase = await createClient();
      const { data } = await supabase
        .from('categories')
        .select('name')
        .order('display_order', { ascending: true });

      categories = data?.map((c) => c.name) || [];
    }

    // Step 3: AI 카테고리 제안
    const suggestion = await suggestCategory(url, metadata, categories);

    return NextResponse.json({
      success: true,
      data: {
        ...suggestion,
        metadata, // 디버깅용
      },
    });
  } catch (error) {
    console.error('[API] Category suggestion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to suggest category',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### 2. 메타데이터 추출 (`lib/crawlers/metadata-extractor.ts`)

```typescript
import * as cheerio from 'cheerio';
import { fetchWithTimeout } from '@/lib/utils';

export type PageMetadata = {
  title: string;
  description: string;
  keywords: string;
  contentSample: string;
  ogTitle?: string;
  ogDescription?: string;
};

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  try {
    // 15초 타임아웃
    const response = await fetchWithTimeout(url, {}, 15000);
    const html = await response.text();
    const $ = cheerio.load(html);

    // 메타데이터 추출
    const title = $('title').text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  '';

    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') ||
                       '';

    const keywords = $('meta[name="keywords"]').attr('content') || '';

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');

    // 본문 샘플 추출 (첫 500자)
    let contentSample = '';
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    contentSample = bodyText.substring(0, 500);

    return {
      title,
      description,
      keywords,
      contentSample,
      ogTitle,
      ogDescription,
    };
  } catch (error) {
    console.error('[Metadata] Extraction error:', error);
    throw new Error(`Failed to fetch metadata from ${url}`);
  }
}
```

### 3. AI 카테고리 제안 로직 (`lib/ai/category-suggester.ts`)

```typescript
import OpenAI from 'openai';
import type { PageMetadata } from '@/lib/crawlers/metadata-extractor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type CategorySuggestion = {
  suggestedCategory: string;
  confidence: number;
  isNew: boolean;
  reasoning: string;
};

const CATEGORY_SUGGESTION_PROMPT = (
  url: string,
  metadata: PageMetadata,
  existingCategories: string[]
) => `
당신은 콘텐츠 큐레이션 전문가입니다. 주어진 웹페이지의 메타데이터를 분석하여 가장 적합한 카테고리를 제안해주세요.

# 기존 카테고리 목록
${existingCategories.length > 0 ? existingCategories.join(', ') : '(없음 - 새 카테고리 제안 필요)'}

# 웹페이지 정보
- URL: ${url}
- 제목: ${metadata.title || '(없음)'}
- 설명: ${metadata.description || '(없음)'}
- 키워드: ${metadata.keywords || '(없음)'}
- 본문 샘플: ${metadata.contentSample.substring(0, 300)}...

# 제약 조건
1. 기존 카테고리 중에 적합한 것이 있으면 그것을 선택하세요
2. 기존 카테고리가 모두 부적합하면 새로운 카테고리를 제안하세요 (최대 2단어, 한글)
3. confidence는 0.0~1.0 사이로, 0.7 이상이면 신뢰할 만한 제안입니다
4. reasoning은 한 문장으로 명확하게 작성하세요

# 카테고리 선택 가이드
- '시장 조사': 시장 분석, 통계, 산업 트렌드, 리서치 리포트
- '정부 지원 사업': 정부 정책, 지원금, 공공 사업, 규제
- 'AI 트렌드': AI/ML 기술, ChatGPT, 생성형 AI, 딥러닝
- '비즈니스': 일반 비즈니스 전략, 경영, 마케팅
- '스타트업': 창업, 벤처, 투자, 스타트업 생태계
- '개발자': 프로그래밍, 개발 도구, 기술 블로그

# 출력 형식 (JSON만 반환, 설명 없음)
{
  "suggestedCategory": "카테고리명",
  "confidence": 0.85,
  "isNew": false,
  "reasoning": "선택 이유 한 문장"
}
`;

export async function suggestCategory(
  url: string,
  metadata: PageMetadata,
  existingCategories: string[]
): Promise<CategorySuggestion> {
  try {
    // Edge Function 우선 시도 (GPT-5-nano)
    if (process.env.USE_EDGE_FUNCTION !== 'false') {
      try {
        const edgeResult = await suggestCategoryViaEdgeFunction(
          url,
          metadata,
          existingCategories
        );
        if (edgeResult) return edgeResult;
      } catch (edgeError) {
        console.warn('[AI] Edge Function failed, falling back to local:', edgeError);
      }
    }

    // 로컬 OpenAI (GPT-4o-mini)
    const prompt = CATEGORY_SUGGESTION_PROMPT(url, metadata, existingCategories);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 콘텐츠 카테고리 분류 전문가입니다. JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 일관성 있는 결과
      max_tokens: 200,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // JSON 파싱
    const suggestion: CategorySuggestion = JSON.parse(content);

    // 유효성 검증
    if (!suggestion.suggestedCategory || typeof suggestion.confidence !== 'number') {
      throw new Error('Invalid response format');
    }

    return suggestion;
  } catch (error) {
    console.error('[AI] Category suggestion error:', error);

    // Fallback: 기존 카테고리 중 첫 번째 또는 "기타"
    return {
      suggestedCategory: existingCategories[0] || '기타',
      confidence: 0.5,
      isNew: existingCategories.length === 0,
      reasoning: 'AI 분석 실패로 기본 카테고리 반환',
    };
  }
}

// Edge Function 호출 (선택적)
async function suggestCategoryViaEdgeFunction(
  url: string,
  metadata: PageMetadata,
  existingCategories: string[]
): Promise<CategorySuggestion | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/suggest-category`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ url, metadata, existingCategories }),
    }
  );

  if (!response.ok) {
    throw new Error(`Edge Function error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}
```

### 4. Edge Function (선택적, `supabase/functions/suggest-category/index.ts`)

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  try {
    const { url, metadata, existingCategories } = await req.json();

    const prompt = `
당신은 콘텐츠 큐레이션 전문가입니다.
기존 카테고리: ${existingCategories.join(', ')}
웹페이지: ${metadata.title} - ${metadata.description}
가장 적합한 카테고리를 JSON으로 제안하세요.
{
  "suggestedCategory": "카테고리명",
  "confidence": 0.85,
  "isNew": false,
  "reasoning": "이유"
}
`;

    // GPT-5-nano 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: '카테고리 분류 전문가' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    const data = await response.json();
    const suggestion = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(suggestion), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## UI/UX 설계

### 소스 추가 페이지 수정 (`app/sources/add/page.tsx`)

#### 1. 상태 추가

```typescript
const [categorySuggestion, setCategorySuggestion] = useState<{
  category: string;
  confidence: number;
  isNew: boolean;
  reasoning: string;
} | null>(null);
const [isSuggesting, setIsSuggesting] = useState(false);
```

#### 2. 카테고리 제안 함수

```typescript
const handleSuggestCategory = async (url: string) => {
  if (!url) return;

  setIsSuggesting(true);
  setCategorySuggestion(null);

  try {
    const response = await fetch('/api/categories/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const result = await response.json();

    if (result.success) {
      const { suggestedCategory, confidence, isNew, reasoning } = result.data;

      setCategorySuggestion({
        category: suggestedCategory,
        confidence,
        isNew,
        reasoning,
      });

      // 자동으로 카테고리 선택
      setSelectedCategory(suggestedCategory);

      // 신규 카테고리면 카테고리 목록에 추가
      if (isNew && !categories.includes(suggestedCategory)) {
        setCategories((prev) => [...prev, suggestedCategory]);
      }
    }
  } catch (error) {
    console.error('Category suggestion error:', error);
  } finally {
    setIsSuggesting(false);
  }
};
```

#### 3. UI 컴포넌트

```tsx
{/* URL 입력 필드 */}
<div className="space-y-2">
  <label className="text-sm font-medium">URL</label>
  <div className="flex gap-2">
    <input
      type="url"
      value={newLink.url}
      onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
      placeholder="https://example.com/blog"
      className="input flex-1"
    />

    {/* 카테고리 자동 제안 버튼 */}
    <button
      onClick={() => handleSuggestCategory(newLink.url)}
      disabled={!newLink.url || isSuggesting}
      className="btn-secondary whitespace-nowrap"
    >
      {isSuggesting ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>분석 중...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>카테고리 추천</span>
        </>
      )}
    </button>
  </div>

  {/* 제안 결과 표시 */}
  {categorySuggestion && (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-900">
              추천: {categorySuggestion.category}
            </span>
            {categorySuggestion.isNew && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                신규
              </span>
            )}
            <span className="text-xs text-blue-600">
              {Math.round(categorySuggestion.confidence * 100)}% 확신
            </span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            {categorySuggestion.reasoning}
          </p>
        </div>
      </div>
    </div>
  )}
</div>
```

### UI 플로우

```
1. 사용자가 URL 입력
   ↓
2. "카테고리 추천" 버튼 클릭
   ↓
3. 로딩 스피너 표시 ("분석 중...")
   ↓
4. API 호출 (5-10초)
   ↓
5. 제안 결과 표시
   - 추천 카테고리 하이라이트
   - 확신도 % 표시
   - 이유 설명
   - 신규 카테고리면 "신규" 배지
   ↓
6. 자동으로 드롭다운에 카테고리 선택
   (사용자가 수정 가능)
```

---

## 테스트 시나리오

### 1. 기본 시나리오

| 테스트 케이스 | URL | 기존 카테고리 | 예상 결과 | 검증 |
|-------------|-----|-------------|----------|-----|
| 기존 매칭 (높은 확신) | https://www.wiseapp.co.kr/insight/ | ['시장 조사', 'AI 트렌드'] | suggestedCategory: '시장 조사', confidence: 0.9+ | ✅ isNew=false, confidence >= 0.7 |
| 기존 매칭 (낮은 확신) | https://medium.com/@author/post | ['개발자', '비즈니스'] | suggestedCategory: '개발자', confidence: 0.6 | ⚠️ confidence < 0.7, 수동 확인 권장 |
| 신규 제안 | https://startup.gov.kr/ | ['시장 조사', 'AI 트렌드'] | suggestedCategory: '창업 지원', isNew: true | ✅ isNew=true, 새 카테고리 제안 |
| 메타데이터 부족 | https://example.com/404 | ['비즈니스'] | error 또는 fallback | ⚠️ 첫 번째 카테고리 또는 "기타" 반환 |

### 2. Edge Cases

```bash
# 1. URL 접근 불가
curl -X POST http://localhost:3000/api/categories/suggest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://invalid-url-12345.com"}'

# 예상: { "success": false, "error": "Failed to fetch metadata" }

# 2. 카테고리 목록 없음
curl -X POST http://localhost:3000/api/categories/suggest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.wiseapp.co.kr/insight/", "existingCategories": []}'

# 예상: { "suggestedCategory": "시장 조사", "isNew": true }

# 3. 다국어 페이지 (영어)
curl -X POST http://localhost:3000/api/categories/suggest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://techcrunch.com/ai", "existingCategories": ["AI 트렌드"]}'

# 예상: { "suggestedCategory": "AI 트렌드", "confidence": 0.95 }
```

### 3. 성능 테스트

```bash
# 평균 응답 시간 측정
for i in {1..10}; do
  time curl -X POST http://localhost:3000/api/categories/suggest \
    -H "Content-Type: application/json" \
    -d '{"url": "https://www.wiseapp.co.kr/insight/"}'
done

# 목표: 평균 5-10초 이내
```

---

## 비용 및 성능

### 비용 예측 (OpenAI API)

| 항목 | 값 |
|------|-----|
| 모델 | GPT-4o-mini |
| 프롬프트 토큰 | ~500 tokens |
| 응답 토큰 | ~100 tokens |
| 총 토큰 | ~600 tokens/request |
| 가격 (GPT-4o-mini) | $0.150 / 1M input tokens, $0.600 / 1M output tokens |
| **요청당 비용** | **~$0.00015 (약 ₩0.2)** |

**월간 비용 예상:**
- 소스 추가: 20회/월 → ₩4
- 재분석: 10회/월 → ₩2
- **합계: 월 ₩6 미만**

### 성능 특성

| 단계 | 소요 시간 | 최적화 방법 |
|------|---------|-----------|
| 메타데이터 추출 | 1-3초 | fetchWithTimeout 15초 제한 |
| AI 분석 (Edge Fn) | 2-4초 | GPT-5-nano (빠름) |
| AI 분석 (로컬) | 3-5초 | GPT-4o-mini |
| **총 소요 시간** | **5-10초** | 비동기 처리로 UX 개선 |

### 최적화 전략

1. **캐싱**: 같은 URL 재요청 시 24시간 캐시
   ```typescript
   // Redis 또는 메모리 캐시
   const cacheKey = `category-suggest:${url}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);

   const result = await suggestCategory(...);
   await redis.setex(cacheKey, 86400, JSON.stringify(result)); // 24시간
   ```

2. **배치 처리**: 여러 URL 동시 제안
   ```typescript
   POST /api/categories/suggest/batch
   Body: { urls: string[] }
   Response: { url: string, suggestion: CategorySuggestion }[]
   ```

3. **백그라운드 처리**: 소스 저장 후 비동기로 카테고리 제안
   ```typescript
   // 소스 저장 즉시 완료
   await createSource(url);

   // 백그라운드에서 카테고리 제안 (결과는 나중에 반영)
   queueCategorySuggestion(url);
   ```

---

## 배포 체크리스트

### 1. 환경변수 설정

```bash
# .env.local
OPENAI_API_KEY=sk-...
USE_EDGE_FUNCTION=true  # Edge Function 사용 여부

# Supabase Secrets (Edge Function용)
OPENAI_API_KEY=sk-...
```

### 2. Edge Function 배포 (선택적)

```bash
# supabase/functions/suggest-category/index.ts 배포
supabase functions deploy suggest-category

# Secret 확인
# Supabase Dashboard → Edge Functions → Secrets → OPENAI_API_KEY
```

### 3. API 테스트

```bash
# 로컬 테스트
npm run dev
curl -X POST http://localhost:3000/api/categories/suggest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.wiseapp.co.kr/insight/"}'

# 프로덕션 테스트
curl -X POST https://your-domain.com/api/categories/suggest \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.wiseapp.co.kr/insight/"}'
```

### 4. UI 통합 테스트

- [ ] URL 입력 → 카테고리 추천 버튼 클릭
- [ ] 로딩 상태 표시 확인
- [ ] 제안 결과 표시 확인 (카테고리, 확신도, 이유)
- [ ] 신규 카테고리 배지 표시 확인
- [ ] 자동 선택 동작 확인
- [ ] 에러 처리 (잘못된 URL, 타임아웃)

---

## 향후 개선 아이디어

### 1. 멀티 카테고리 제안
```typescript
// 단일 카테고리 대신 상위 3개 제안
{
  "suggestions": [
    { "category": "시장 조사", "confidence": 0.85 },
    { "category": "비즈니스", "confidence": 0.72 },
    { "category": "AI 트렌드", "confidence": 0.65 }
  ]
}
```

### 2. 학습 시스템
- 사용자가 제안을 수락/거부한 데이터를 저장
- 주기적으로 fine-tuning 데이터로 활용

### 3. 카테고리 계층 구조
```
시장 조사
  ├─ 모바일 시장
  ├─ IT 산업
  └─ 소비자 트렌드
```

### 4. 자동 태그 생성
```typescript
{
  "suggestedCategory": "시장 조사",
  "tags": ["모바일", "앱 시장", "데이터 분석"]
}
```

---

## 참고 자료

- [OpenAI API Docs](https://platform.openai.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Cheerio Documentation](https://cheerio.js.org/)
- [CLAUDE.md - AI 요약 시스템](../CLAUDE.md#ai-요약-생성-edge-function-우선)

---

## 문의 및 피드백

이 구현 가이드에 대한 질문이나 개선 아이디어가 있으면 GitHub Issues에 남겨주세요.

**문서 버전**: v1.0.0
**최종 업데이트**: 2026-02-15
