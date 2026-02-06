import OpenAI from 'openai';
import type { SummaryResult } from '@/types';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 사용자 지정 프롬프트 (절대 변경 금지)
const SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 사람들이 클릭하게 만드는 '1줄 요약 장인'

### **목표**

사용자는 수많은 콘텐츠 중에서 읽을거리를 빠르게 골라야 한다.

이 요약글은 사용자의 클릭을 유도하는 결정적인 '잣대' 역할을 해야 한다.

### **지시사항**

1. 아래 '본문글'을 읽고 1줄 요약글을 작성할 것.
2. 내용은 전문 용어를 배제하고, 일상적이고 친근한 말투로 풀어서 쓸 것.
3. 추상적인 표현 대신 구체적인 상황이나 이득을 명시할 것.
4. 핵심 키워드(산업, 직무, 주제 등)를 3개 뽑아 태그로 만들 것.

### **제약 조건**

- **길이:** 공백 포함 80자 이내 (엄수)
- **형식:** 이모티콘 및 마크다운 금지 (순수 텍스트)
- **톤:** 친근하고 쉬운 구어체

### **출력 양식 (JSON)**

\`\`\`json
{
  "summary": "본문 핵심을 후킹 원칙으로 압축한 1줄 요약 (80자 이내)",
  "summary_tag": [
    "주제 태그1 (7자 내외)",
    "주제 태그2 (7자 내외)",
    "주제 태그3 (7자 내외)"
  ]
}
\`\`\`

### **출력 예시 (JSON)**

\`\`\`json
{
  "summary": "수익은 줄이고 혜택은 늘리는 과감한 '선택과 집중'으로, 무리한 확장 대신 취향의 밀도를 높여 컬리만의 차별된 브랜드 가치를 증명한 이야기",
  "summary_tag": [
    "브랜드전략",
    "고객경험",
    "행사기획"
  ]
}
\`\`\`

### **본문글**

{content}`;

// AI 요약 결과 인터페이스
export interface AISummaryResult {
  summary: string;
  summary_tags: string[];
  success: boolean;
  error?: string;
}

// 1줄 요약 + 태그 3개 생성
export async function generateAISummary(
  title: string,
  content: string
): Promise<AISummaryResult> {
  try {
    // 본문 길이 제한 (토큰 절약)
    const truncatedContent =
      content.length > 3000 ? content.substring(0, 3000) + '...' : content;

    const fullContent = `제목: ${title}\n\n${truncatedContent}`;
    const prompt = SUMMARY_PROMPT.replace('{content}', fullContent);

    // OpenAI API 호출 (gpt-4o-mini 사용, gpt-5-nano가 출시되면 변경)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '당신은 콘텐츠 본문글을 읽고 사람들이 클릭하게 만드는 1줄 요약 장인입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    const rawText = response.choices[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(rawText);
      return {
        summary: parsed.summary || '',
        summary_tags: parsed.summary_tag || [],
        success: true,
      };
    } catch {
      console.error('Failed to parse AI response:', rawText);
      return {
        summary: '',
        summary_tags: [],
        success: false,
        error: 'JSON 파싱 실패',
      };
    }
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return {
      summary: '',
      summary_tags: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// 기존 3줄 요약 기능 (하위 호환성 유지)
const LEGACY_SUMMARY_PROMPT = `당신은 비즈니스 인사이트 전문 에디터입니다.
주어진 아티클을 읽고 핵심 내용을 3줄로 요약해주세요.

규칙:
- 각 줄은 한 문장, 40-60자 내외
- 첫 줄: 핵심 주제/문제
- 둘째 줄: 주요 인사이트/데이터
- 셋째 줄: 실무 적용 포인트
- 이모지 금지, 전문적 톤
- 숫자나 데이터가 있다면 포함

아티클 제목: {title}

아티클 본문:
{content}

응답 형식 (반드시 아래 형식으로):
- 줄1
- 줄2
- 줄3`;

export async function summarizeArticle(
  title: string,
  content: string
): Promise<SummaryResult> {
  try {
    const truncatedContent =
      content.length > 3000 ? content.substring(0, 3000) + '...' : content;

    const prompt = LEGACY_SUMMARY_PROMPT.replace('{title}', title).replace(
      '{content}',
      truncatedContent
    );

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 비즈니스 인사이트를 간결하게 요약하는 전문 에디터입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const rawText = response.choices[0]?.message?.content || '';
    const lines = parseSummaryLines(rawText);

    return {
      lines,
      success: true,
    };
  } catch (error) {
    console.error('Summary generation failed:', error);
    return {
      lines: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function parseSummaryLines(rawText: string): string[] {
  const lines: string[] = [];

  for (const line of rawText.trim().split('\n')) {
    let cleaned = line.trim();
    if (!cleaned) continue;

    if (
      cleaned.startsWith('-') ||
      cleaned.startsWith('•') ||
      cleaned.startsWith('*')
    ) {
      cleaned = cleaned.substring(1).trim();
    }
    if (/^\d+\./.test(cleaned)) {
      cleaned = cleaned.replace(/^\d+\.\s*/, '');
    }

    cleaned = cleaned.replace(/^줄\d+[:\s]*/i, '');

    if (cleaned) {
      lines.push(cleaned);
    }
  }

  if (lines.length > 3) {
    return lines.slice(0, 3);
  }
  while (lines.length < 3) {
    lines.push('');
  }

  return lines;
}

export function generateFallbackSummary(
  title: string,
  content: string
): string[] {
  const sentences = content
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+/)
    .filter((s) => s.trim().length > 20)
    .slice(0, 3);

  if (sentences.length === 0) {
    return [title, '', ''];
  }

  return sentences.map((s) => {
    const cleaned = s.trim();
    return cleaned.length > 60 ? cleaned.substring(0, 57) + '...' : cleaned;
  });
}
