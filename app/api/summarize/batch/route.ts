import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processPendingSummaries } from '@/lib/ai/batch-summarizer';

export const maxDuration = 300;

const MAX_SELF_CONTINUE = 5;

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  return handleBatchSummarize(request);
}

export async function POST(request: NextRequest) {
  return handleBatchSummarize(request);
}

async function handleBatchSummarize(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const selfContinueCount: number = body.selfContinueCount || 0;
    const isSelfContinue: boolean = body.selfContinue || false;

    if (isSelfContinue) {
      console.log(`🔄 [Self-Continue #${selfContinueCount + 1}] 배치 요약 이어서 처리`);
    }

    const supabase = createServiceClient();
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await processPendingSummaries(supabase as any, 200, supabaseKey, startTime);

    // Self-Continue: 시간 제한으로 중단 + 재호출 횟수 미초과 → 자기 재호출
    if (result.stoppedByTimeLimit && selfContinueCount < MAX_SELF_CONTINUE) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const cronSecret = process.env.CRON_SECRET;
      console.log(`🔄 [Self-Continue] 남은 요약 처리를 위해 재호출 #${selfContinueCount + 1}...`);
      fetch(`${siteUrl}/api/summarize/batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selfContinue: true,
          selfContinueCount: selfContinueCount + 1,
        }),
      }).catch(err => console.error('❌ [Self-Continue] 재호출 실패:', err));
    }

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      succeeded: result.success,
      failed: result.failed,
      selfContinue: result.stoppedByTimeLimit,
      selfContinueCount: result.stoppedByTimeLimit ? selfContinueCount + 1 : 0,
    });
  } catch (error) {
    console.error('Batch summarize API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
