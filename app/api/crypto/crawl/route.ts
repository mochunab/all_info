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

async function parsePhase(request: NextRequest): Promise<string> {
  try {
    const body = await request.clone().json();
    return body.phase || 'crawl';
  } catch {
    return 'crawl';
  }
}

async function triggerNextPhase(phase: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aca-info.com';
  const cronSecret = process.env.CRON_SECRET;

  console.log(`🔄 다음 페이즈 트리거: ${phase}`);

  fetch(`${siteUrl}/api/crypto/crawl`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phase }),
  }).catch((err) => console.error(`❌ ${phase} 트리거 실패:`, err));

  await new Promise((r) => setTimeout(r, 2000));
}

async function handleCrawl(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const phase = await parsePhase(request);
    const supabase = createServiceClient();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[크립토] Phase: ${phase} — ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`${'='.repeat(60)}\n`);

    // ── Phase 1: 크롤링만 (Telegram/Reddit/Threads) ──
    if (phase === 'crawl') {
      const allResults: CryptoCrawlResult[] = [];

      try {
        const { crawlAllSubreddits } = await import('@/lib/crypto/reddit-crawler');
        const results = await crawlAllSubreddits(supabase);
        allResults.push(...results);
      } catch (e) {
        console.warn(`[Reddit] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      try {
        const { crawlAllTelegramChannels } = await import('@/lib/crypto/telegram-crawler');
        const { results } = await crawlAllTelegramChannels(supabase);
        allResults.push(...results);
      } catch (e) {
        console.warn(`[Telegram] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      if (process.env.THREADS_ACCESS_TOKEN) {
        try {
          const { crawlAllThreadsKeywords } = await import('@/lib/crypto/threads-crawler');
          const results = await crawlAllThreadsKeywords(supabase);
          allResults.push(...results);
        } catch (e) {
          console.warn(`[Threads] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const totalNew = allResults.reduce((s, r) => s + r.postsNew, 0);
      const totalMentions = allResults.reduce((s, r) => s + r.mentionsExtracted, 0);
      console.log(`[크롤링 완료] ${elapsed}초, 신규: ${totalNew}개, 멘션: ${totalMentions}개`);

      // 크롤링 끝나면 센티먼트 페이즈 트리거
      await triggerNextPhase('sentiment');

      return NextResponse.json({
        success: true,
        phase: 'crawl',
        crawl: {
          totalChannels: allResults.length,
          postsNew: totalNew,
          mentionsExtracted: totalMentions,
        },
        elapsed: `${elapsed}s`,
        nextPhase: 'sentiment',
      });
    }

    // ── Phase 2: 센티먼트 분석 ──
    if (phase === 'sentiment') {
      let sentimentResult = { processed: 0, success: 0, failed: 0 };

      try {
        const { processCryptoSentiments } = await import('@/lib/crypto/batch-sentiment');
        const result = await processCryptoSentiments(supabase, 30, 200_000);
        sentimentResult = { processed: result.processed, success: result.success, failed: result.failed };

        if (!result.completed) {
          console.log(`[센티먼트] 시간 제한 — 추가 호출 트리거`);
          await triggerNextPhase('sentiment');
        } else {
          await triggerNextPhase('signals');
        }
      } catch (e) {
        console.warn(`[센티먼트] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
        await triggerNextPhase('signals');
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[센티먼트 완료] ${elapsed}초, ${sentimentResult.success}/${sentimentResult.processed}개`);

      return NextResponse.json({
        success: true,
        phase: 'sentiment',
        sentiment: sentimentResult,
        elapsed: `${elapsed}s`,
      });
    }

    // ── Phase 3: 시그널 + 지식그래프 ──
    if (phase === 'signals') {
      let signalResult = { generated: 0 };

      try {
        const { generateAllSignals } = await import('@/lib/crypto/signal-generator');
        signalResult = await generateAllSignals(supabase);
        console.log(`[시그널] ${signalResult.generated}개 생성`);
      } catch (e) {
        console.warn(`[시그널] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      try {
        const { updateKnowledgeGraph } = await import('@/lib/crypto/knowledge-graph');
        await updateKnowledgeGraph(supabase);
        console.log(`[지식그래프] 업데이트 완료`);
      } catch (e) {
        console.warn(`[지식그래프] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[시그널+KG 완료] ${elapsed}초`);

      return NextResponse.json({
        success: true,
        phase: 'signals',
        signals: signalResult,
        elapsed: `${elapsed}s`,
      });
    }

    return NextResponse.json({ error: `Unknown phase: ${phase}` }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRYPTO CRAWL ERROR]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
