import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

const EDGE_FUNCTION_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-insight`
  : null;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messages, question } = body;

    // 최신 시그널 데이터를 컨텍스트로 주입
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: topSignals } = await (supabase as any)
      .from('crypto_signals')
      .select('coin_symbol, weighted_score, signal_label, mention_count, avg_sentiment, mention_velocity')
      .eq('time_window', '24h')
      .order('weighted_score', { ascending: false })
      .limit(20);

    const signalContext = topSignals
      ? topSignals.map((s: { coin_symbol: string; weighted_score: number; signal_label: string; mention_count: number; avg_sentiment: number }) =>
        `${s.coin_symbol}: score=${s.weighted_score}, signal=${s.signal_label}, mentions=${s.mention_count}, sentiment=${s.avg_sentiment}`
      ).join('\n')
      : '시그널 데이터 없음';

    const systemPrompt = `당신은 밈코인 시장 분석 전문가입니다. Reddit 커뮤니티의 센티먼트 데이터를 기반으로 인사이트를 제공합니다.

현재 시그널 데이터 (24시간 기준):
${signalContext}

규칙:
- 투자 조언이 아닌 데이터 기반 인사이트만 제공
- "이것은 투자 조언이 아닙니다" 면책 문구 포함
- 한국어로 답변
- 간결하게 (3-4문장)`;

    if (!EDGE_FUNCTION_URL) {
      return NextResponse.json({ error: 'Chat service not configured' }, { status: 500 });
    }

    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const chatMessages = [
      { role: 'user', content: question || messages?.[messages.length - 1]?.content || '' },
    ];

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        messages: chatMessages,
        articles: [],
        category: 'crypto',
        language: 'ko',
        systemPromptOverride: systemPrompt,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Chat service error' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
