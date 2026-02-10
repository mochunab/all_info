import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const UNIFIED_SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 핵심을 정리하는 '요약 장인'

### **목표**

사용자는 수많은 콘텐츠 중에서 읽을거리를 빠르게 골라야 한다.
1줄 요약은 클릭을 유도하는 '잣대' 역할을, 상세 요약은 기사를 읽지 않아도 내용을 파악할 수 있는 역할을 해야 한다.

### **지시사항**

1. 아래 '본문글'을 읽고 3가지를 작성할 것:
   - **summary**: 1줄 요약 (클릭 유도용, 80자 이내)
   - **summary_tag**: 핵심 키워드 태그 3개
   - **detailed_summary**: 상세 요약글 (헤드라인 + 2~3문장 설명)
2. summary는 전문 용어를 배제하고, 일상적이고 친근한 말투로 풀어서 쓸 것.
3. 추상적인 표현 대신 구체적인 상황이나 이득을 명시할 것.
4. detailed_summary 작성 규칙:
   - 첫 줄: 핵심 헤드라인 (기사의 핵심을 한 문장으로)
   - 빈 줄 하나
   - 2~3문장으로 기사의 주요 내용, 배경, 의미를 설명
   - 이 요약만으로 기사 내용을 충분히 파악 가능해야 함

### **제약 조건**

- **summary 길이:** 공백 포함 80자 이내 (엄수)
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
  ],
  "detailed_summary": "핵심 헤드라인\\n\\n상세 설명 2~3문장"
}
\`\`\`

### **본문글**

{content}`;

// AI 요약 결과 타입
export type AISummaryResult = {
  summary: string;
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

    // OpenAI API 호출 (gpt-4o-mini 사용, gpt-5-nano가 출시되면 변경)
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const rawText = response.choices[0]?.message?.content || '';

    try {
      const parsed = JSON.parse(rawText);
      return {
        summary: parsed.summary || '',
        summary_tags: parsed.summary_tag || [],
        detailed_summary: parsed.detailed_summary || '',
        success: true,
      };
    } catch {
      console.error('Failed to parse AI response:', rawText);
      return {
        summary: '',
        summary_tags: [],
        detailed_summary: '',
        success: false,
        error: 'JSON 파싱 실패',
      };
    }
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return {
      summary: '',
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
