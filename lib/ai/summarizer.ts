import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const UNIFIED_SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 핵심을 정리하는 '요약 장인'

### **목표**

사용자가 기사를 읽지 않아도 내용을 구체적으로 파악할 수 있도록 핵심을 충분히 요약한다.

### **지시사항**

1. 아래 '본문글'을 읽고 3가지를 작성할 것:
   - **title_ko**: 원본 제목의 자연스러운 한국어 번역 (이미 한국어면 그대로 사용)
   - **summary_tag**: 핵심 키워드 태그 3개
   - **detailed_summary**: 헤드라인 + 핵심 설명 3~4문장

2. detailed_summary 작성 규칙:
   - 첫 줄: 핵심 헤드라인 (한 문장, 40자 이내)
     - **반드시** 원본 제목을 그대로 반복하지 말 것 — 새로운 관점이나 핵심 주장을 담을 것
   - 빈 줄 하나
   - 핵심 설명: 3~4문장 (총 250자 이내)
     - 구체적인 사례, 수치, 근거를 포함할 것
     - 독자가 실제로 어떤 내용인지 알 수 있는 팩트 중심으로 작성
     - 추상적인 표현("일깨운다", "보여준다") 대신 구체적으로 무슨 일이 있었는지 서술

### **제약 조건**

- **형식:** 이모티콘 및 마크다운 금지 (순수 텍스트)
- **톤:** 친근하고 쉬운 구어체
- **길이:** 헤드라인 포함 전체 250자 이내

### **출력 양식 (JSON)**

\`\`\`json
{
  "title_ko": "원본 제목의 한국어 번역 (이미 한국어면 그대로)",
  "summary_tag": [
    "주제 태그1 (7자 내외)",
    "주제 태그2 (7자 내외)",
    "주제 태그3 (7자 내외)"
  ],
  "detailed_summary": "헤드라인 (40자 이내, 제목과 다른 관점)\\n\\n핵심 설명 3~4문장 (구체적 사례·수치·근거 포함, 250자 이내)"
}
\`\`\`

### **본문글**

{content}`;

// AI 요약 결과 타입
export type AISummaryResult = {
  title_ko: string | null;
  summary_tags: string[];
  detailed_summary: string;
  success: boolean;
  error?: string;
};

// 1줄 요약 + 태그 3개 + 상세 요약 생성
export async function generateAISummary(
  title: string,
  content: string
): Promise<AISummaryResult> {
  try {
    // 본문 길이 제한 (토큰 절약)
    const truncatedContent =
      content.length > 3000 ? content.substring(0, 3000) + '...' : content;

    const fullContent = `제목: ${title}\n\n${truncatedContent}`;
    const prompt = UNIFIED_SUMMARY_PROMPT.replace('{content}', fullContent);

    // OpenAI API 호출 (gpt-4.1-mini fallback)
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            '당신은 콘텐츠 본문글을 읽고 핵심을 정리하는 요약 장인입니다. 반드시 JSON 형식으로만 응답하세요.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    });

    const rawText = response.choices[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(rawText);
      return {
        title_ko: parsed.title_ko || null,
        summary_tags: parsed.summary_tag || [],
        detailed_summary: parsed.detailed_summary || '',
        success: true,
      };
    } catch {
      console.error('Failed to parse AI response:', rawText);
      return {
        title_ko: null,
        summary_tags: [],
        detailed_summary: '',
        success: false,
        error: 'JSON 파싱 실패',
      };
    }
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return {
      title_ko: null,
      summary_tags: [],
      detailed_summary: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
