import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { CrawlStatus, CrawlLog } from '@/types';

export async function GET() {
  try {
    const supabase = await createClient();

    // Check if any crawl is currently running
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: runningLogs } = await (supabase as any)
      .from('crawl_logs')
      .select('*')
      .eq('status', 'running')
      .limit(1);

    const isRunning = (runningLogs?.length || 0) > 0;

    // Get the most recent crawl timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastLogData } = await (supabase as any)
      .from('crawl_logs')
      .select('finished_at')
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1);

    const lastLog = lastLogData as { finished_at: string }[] | null;
    const lastRun = lastLog?.[0]?.finished_at || null;

    // Get recent logs (last 20)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentLogsData, error } = await (supabase as any)
      .from('crawl_logs')
      .select(`
        *,
        crawl_sources (name)
      `)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching crawl status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch crawl status' },
        { status: 500 }
      );
    }

    const recentLogs = (recentLogsData || []) as CrawlLog[];

    const status: CrawlStatus = {
      isRunning,
      lastRun,
      recentLogs,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Crawl status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
