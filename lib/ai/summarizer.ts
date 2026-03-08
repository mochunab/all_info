import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const UNIFIED_SUMMARY_PROMPT = `### **역할**

콘텐츠 본문글을 읽고 핵심을 정리하는 '요약 장인' + 클릭을 부르는 '후킹 카피라이터'

### **목표**

1. 사용자가 스크롤을 멈추고 클릭하게 만드는 후킹 제목을 만든다.
2. 기사를 읽지 않아도 내용을 구체적으로 파악할 수 있도록 핵심을 충분히 요약한다.

### **지시사항**

1. 아래 '본문글'을 읽고 4가지를 작성할 것:
   - **title_ko**: 원본 제목의 자연스러운 한국어 번역 (이미 한국어면 그대로 사용)
   - **hook_title**: 클릭을 유도하는 후킹 제목 (40자 이내)
   - **summary_tag**: 핵심 키워드 태그 3개
   - **detailed_summary**: 핵심 설명 3~4문장

2. hook_title 작성 규칙:
   - title_ko와 완전히 다른 문장으로 작성 (절대 제목을 반복하거나 요약하지 말 것)
   - 본문의 가장 흥미로운 팩트, 반전, 시사점을 뽑아 호기심을 자극할 것
   - 아래 전략 중 본문에 가장 어울리는 1~2개를 조합:
     ### 행동경제학 기반 전략
     1. 단일 메시지 집중: 장점 나열 대신 지금 행동해야 할 이유 하나만 전달
     2. 손실 회피: 잃는 두려움 자극 — "놓치면 후회", "이대로 가면 망함"
     3. 구체적 숫자: 신뢰도와 예측 가능성 향상 — "3가지 신호", "90% 확률"
     4. 타겟 지목: 내 이야기처럼 느끼게 함 — "30대 직장인이라면"
     5. 간편성/행동 경량화: 낮은 진입장벽 + 가벼운 동사 선택 — "가입"→"시작", "신청"→"확인"
     6. 비교 및 소외 불안: '나만 뒤처지는 것 아닌가' 하는 조바심 유발 — "요즘 잘나가는 또래들은 다 아는"
     7. 인정욕구 및 우월감: 특별해지고 싶고, 인정받고 싶은 심리 타겟팅 — "당신만 몰랐던 진짜 잠재력"
     8. 확실성 효과: 크지만 불확실한 보상보다 작아도 확실한 보상이 강력 — "무조건", "100% 확정"
     ### 카피 유형별 전략
     - 문제점/결핍 후벼파기형 / 비교/경쟁 자극형 / 경고/파국 암시형 / 이익 약속형
     - 호기심 유발형 / 해결책/구원 제시형 / 질문/테스트 유도형 / 행동 촉구형
     - 시의성/신선함 강조형: "방금 나온", "2026 최신", "아직 아무도 모르는"
   - 40자 이내, 한 문장, '-요/-다/-음' 등 종결어미 자유

3. detailed_summary 작성 규칙:
   - 핵심 설명 3~4문장 (총 250자 이내)
   - 구체적인 사례, 수치, 근거를 포함할 것
   - 독자가 실제로 어떤 내용인지 알 수 있는 팩트 중심으로 작성
   - 추상적인 표현("일깨운다", "보여준다") 대신 구체적으로 무슨 일이 있었는지 서술

### **제약 조건**

- **형식:** 이모티콘 및 마크다운 금지 (순수 텍스트)
- **톤:** 친근하고 쉬운 구어체
- **길이:** detailed_summary 전체 250자 이내

### **출력 양식 (JSON)**

\`\`\`json
{
  "title_ko": "원본 제목의 한국어 번역 (이미 한국어면 그대로)",
  "hook_title": "클릭을 부르는 후킹 제목 (40자 이내, title_ko와 완전히 다른 문장)",
  "summary_tag": [
    "주제 태그1 (7자 내외)",
    "주제 태그2 (7자 내외)",
    "주제 태그3 (7자 내외)"
  ],
  "detailed_summary": "핵심 설명 3~4문장 (구체적 사례·수치·근거 포함, 250자 이내)"
}
\`\`\`

### **본문글**

{content}`;

// AI 요약 결과 타입
export type AISummaryResult = {
  title_ko: string | null;
  hook_title: string | null;
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
        hook_title: parsed.hook_title || null,
        summary_tags: parsed.summary_tag || [],
        detailed_summary: parsed.detailed_summary || '',
        success: true,
      };
    } catch {
      console.error('Failed to parse AI response:', rawText);
      return {
        title_ko: null,
        hook_title: null,
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
      hook_title: null,
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
