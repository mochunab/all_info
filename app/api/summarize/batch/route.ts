import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { processPendingSummaries } from '@/lib/ai/batch-summarizer';

// Verify cron secret for scheduled runs
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

// POST - Process batch summaries (for cron jobs)
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    if (!verifyCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 20;

    const supabase = createServiceClient();

    // Edge Function 호출 시 service role key 사용
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await processPendingSummaries(supabase as any, batchSize, supabaseKey);

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      succeeded: result.success,
      failed: result.failed,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Batch summarize API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
