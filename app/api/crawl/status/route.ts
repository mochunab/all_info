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

    // 소스별 진행률 집계
    let completedSources = 0;
    let totalSources = 0;
    let newArticles = 0;

    if (isRunning) {
      const runningLog = runningLogs[0] as { started_at: string };

      // 현재 배치의 로그 집계 (running + completed + failed)
      // running log 기준 1시간 이내 시작된 로그 = 같은 배치
      const batchCutoff = new Date(
        new Date(runningLog.started_at).getTime() - 60 * 60 * 1000
      ).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchLogs } = await (supabase as any)
        .from('crawl_logs')
        .select('articles_new, status')
        .gte('started_at', batchCutoff)
        .in('status', ['running', 'completed', 'failed']);

      const batchLogList = (batchLogs || []) as { articles_new: number; status: string }[];
      totalSources = batchLogList.length;
      completedSources = batchLogList.filter(l => l.status === 'completed' || l.status === 'failed').length;
      newArticles = batchLogList.reduce(
        (sum: number, log: { articles_new: number }) => sum + (log.articles_new || 0),
        0
      );
    }

    const status: CrawlStatus = {
      isRunning,
      lastRun,
      recentLogs,
      completedSources,
      totalSources,
      newArticles,
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
