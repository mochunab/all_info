import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { CryptoCrawlResult } from '@/types/crypto';

export const maxDuration = 300;

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  return handleCrawl(request);
}

export async function POST(request: NextRequest) {
  return handleCrawl(request);
}

async function handleCrawl(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[크립토 크롤링] 시작 — ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`${'='.repeat(60)}\n`);

    const supabase = createServiceClient();
    const allResults: CryptoCrawlResult[] = [];

    // Phase 1a: Reddit 크롤링
    if (process.env.REDDIT_CLIENT_ID) {
      try {
        const { crawlAllSubreddits } = await import('@/lib/crypto/reddit-crawler');
        const redditResults = await crawlAllSubreddits(supabase);
        allResults.push(...redditResults);
      } catch (e) {
        console.warn(`[Reddit] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else {
      console.log('[Reddit] REDDIT_CLIENT_ID 미설정 — 스킵');
    }

    // Phase 1b: Telegram 크롤링 (웹 프리뷰 스크래핑 — API 키 불필요)
    try {
      const { crawlAllTelegramChannels } = await import('@/lib/crypto/telegram-crawler');
      const telegramResults = await crawlAllTelegramChannels(supabase);
      allResults.push(...telegramResults);
    } catch (e) {
      console.warn(`[Telegram] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    const totalFound = allResults.reduce((s, r) => s + r.postsFound, 0);
    const totalNew = allResults.reduce((s, r) => s + r.postsNew, 0);
    const totalMentions = allResults.reduce((s, r) => s + r.mentionsExtracted, 0);
    const errors = allResults.flatMap((r) => r.errors);

    // Phase 2: 센티먼트 + 시그널
    let sentimentResult = { processed: 0, success: 0, failed: 0 };
    let signalResult = { generated: 0 };

    try {
      const { processCryptoSentiments } = await import('@/lib/crypto/batch-sentiment');
      sentimentResult = await processCryptoSentiments(supabase, 100);
      console.log(`[센티먼트] ${sentimentResult.success}/${sentimentResult.processed}개 완료`);
    } catch (e) {
      console.warn(`[센티먼트] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    try {
      const { generateAllSignals } = await import('@/lib/crypto/signal-generator');
      signalResult = await generateAllSignals(supabase);
      console.log(`[시그널] ${signalResult.generated}개 생성`);
    } catch (e) {
      console.warn(`[시그널] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    // Phase 3: 지식그래프
    try {
      const { updateKnowledgeGraph } = await import('@/lib/crypto/knowledge-graph');
      await updateKnowledgeGraph(supabase);
      console.log(`[지식그래프] 업데이트 완료`);
    } catch (e) {
      console.warn(`[지식그래프] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const sourceSummary = allResults.reduce((acc, r) => {
      const key = r.source;
      if (!acc[key]) acc[key] = { channels: 0, posts: 0, new: 0 };
      acc[key].channels++;
      acc[key].posts += r.postsFound;
      acc[key].new += r.postsNew;
      return acc;
    }, {} as Record<string, { channels: number; posts: number; new: number }>);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[크립토 크롤링 완료] ${elapsed}초`);
    for (const [src, info] of Object.entries(sourceSummary)) {
      console.log(`   ${src}: ${info.channels}개 채널, ${info.posts}개 발견 → ${info.new}개 저장`);
    }
    console.log(`   멘션: ${totalMentions}개 추출`);
    console.log(`   센티먼트: ${sentimentResult.success}/${sentimentResult.processed}개`);
    console.log(`   시그널: ${signalResult.generated}개`);
    if (errors.length > 0) console.log(`   오류: ${errors.length}건`);
    console.log(`${'='.repeat(60)}\n`);

    return NextResponse.json({
      success: true,
      crawl: {
        sources: sourceSummary,
        totalChannels: allResults.length,
        postsFound: totalFound,
        postsNew: totalNew,
        mentionsExtracted: totalMentions,
      },
      sentiment: sentimentResult,
      signals: signalResult,
      errors: errors.length > 0 ? errors : undefined,
      elapsed: `${elapsed}s`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRYPTO CRAWL ERROR]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
