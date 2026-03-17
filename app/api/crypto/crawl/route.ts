import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { SELF_CONTINUE } from '@/lib/crypto/config';
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

async function parseSelfContinueCount(request: NextRequest): Promise<number> {
  try {
    const body = await request.clone().json();
    return typeof body.selfContinueCount === 'number' ? body.selfContinueCount : 0;
  } catch {
    return 0;
  }
}

async function triggerSelfContinue(nextCount: number): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://aca-info.com';
  const cronSecret = process.env.CRON_SECRET;

  console.log(`🔄 [selfContinue] 자기 재호출 시작 (#${nextCount})`);

  fetch(`${siteUrl}/api/crypto/crawl`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ selfContinueCount: nextCount }),
  }).catch((err) => console.error('❌ [selfContinue] 재호출 실패:', err));

  // 네트워크 전송 보장
  await new Promise((r) => setTimeout(r, 2000));
}

async function handleCrawl(request: NextRequest) {
  const startTime = Date.now();
  const elapsed = () => Date.now() - startTime;
  const remaining = () => SELF_CONTINUE.SAFE_LIMIT_MS - elapsed();

  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const selfContinueCount = await parseSelfContinueCount(request);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[크립토 크롤링] 시작 — ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}${selfContinueCount > 0 ? ` (selfContinue #${selfContinueCount})` : ''}`);
    console.log(`${'='.repeat(60)}\n`);

    const supabase = createServiceClient();
    const allResults: CryptoCrawlResult[] = [];
    let needsContinue = false;

    // ── Phase 1a: Reddit ──
    if (process.env.REDDIT_CLIENT_ID && remaining() > SELF_CONTINUE.SIGNAL_KG_RESERVE_MS + 10_000) {
      try {
        const { crawlAllSubreddits } = await import('@/lib/crypto/reddit-crawler');
        const redditResults = await crawlAllSubreddits(supabase);
        allResults.push(...redditResults);
      } catch (e) {
        console.warn(`[Reddit] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else if (process.env.REDDIT_CLIENT_ID) {
      console.log('[Reddit] 시간 부족 — 다음 실행으로 연기');
      needsContinue = true;
    } else {
      console.log('[Reddit] REDDIT_CLIENT_ID 미설정 — 스킵');
    }

    // ── Phase 1b: Telegram ──
    console.log(`⏱️ [타이밍] Phase 1b 진입: ${(elapsed() / 1000).toFixed(1)}초 경과, 남은: ${(remaining() / 1000).toFixed(1)}초`);
    if (remaining() > SELF_CONTINUE.SIGNAL_KG_RESERVE_MS + 10_000) {
      try {
        const { crawlAllTelegramChannels } = await import('@/lib/crypto/telegram-crawler');
        const crawlBudget = remaining() - SELF_CONTINUE.SIGNAL_KG_RESERVE_MS - 10_000;
        console.log(`⏱️ [타이밍] Telegram 예산: ${(crawlBudget / 1000).toFixed(1)}초`);
        const { results: telegramResults, completed } = await crawlAllTelegramChannels(supabase, crawlBudget);
        allResults.push(...telegramResults);
        if (!completed) needsContinue = true;
        console.log(`⏱️ [타이밍] Telegram 완료: ${(elapsed() / 1000).toFixed(1)}초 경과`);
      } catch (e) {
        console.warn(`[Telegram] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else {
      console.log('[Telegram] 시간 부족 — 다음 실행으로 연기');
      needsContinue = true;
    }

    // ── Phase 1c: Threads ──
    if (process.env.THREADS_ACCESS_TOKEN && remaining() > SELF_CONTINUE.SIGNAL_KG_RESERVE_MS + 10_000) {
      try {
        const { crawlAllThreadsKeywords } = await import('@/lib/crypto/threads-crawler');
        const threadsResults = await crawlAllThreadsKeywords(supabase);
        allResults.push(...threadsResults);
      } catch (e) {
        console.warn(`[Threads] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else if (process.env.THREADS_ACCESS_TOKEN) {
      console.log('[Threads] 시간 부족 — 다음 실행으로 연기');
      needsContinue = true;
    } else {
      console.log('[Threads] THREADS_ACCESS_TOKEN 미설정 — 스킵');
    }

    const totalFound = allResults.reduce((s, r) => s + r.postsFound, 0);
    const totalNew = allResults.reduce((s, r) => s + r.postsNew, 0);
    const totalMentions = allResults.reduce((s, r) => s + r.mentionsExtracted, 0);
    const errors = allResults.flatMap((r) => r.errors);

    // ── Phase 2: 센티먼트 + 시그널 (항상 실행 시도) ──
    console.log(`⏱️ [타이밍] Phase 2 진입: ${(elapsed() / 1000).toFixed(1)}초 경과, 남은: ${(remaining() / 1000).toFixed(1)}초`);
    let sentimentResult = { processed: 0, success: 0, failed: 0 };

    if (remaining() > SELF_CONTINUE.SIGNAL_KG_RESERVE_MS) {
      try {
        const { processCryptoSentiments } = await import('@/lib/crypto/batch-sentiment');
        const sentimentBudget = remaining() - SELF_CONTINUE.SIGNAL_KG_RESERVE_MS;
        const result = await processCryptoSentiments(supabase, 30, sentimentBudget);
        sentimentResult = { processed: result.processed, success: result.success, failed: result.failed };
        if (!result.completed) needsContinue = true;
        console.log(`[센티먼트] ${result.success}/${result.processed}개 완료${!result.completed ? ' (시간 제한)' : ''}`);
      } catch (e) {
        console.warn(`[센티먼트] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    } else {
      console.log('[센티먼트] 시간 부족 — 다음 실행으로 연기');
      needsContinue = true;
    }

    // ── Phase 3: 시그널 생성 (빠름, 항상 실행) ──
    let signalResult = { generated: 0 };

    if (remaining() > 5_000) {
      try {
        const { generateAllSignals } = await import('@/lib/crypto/signal-generator');
        signalResult = await generateAllSignals(supabase);
        console.log(`[시그널] ${signalResult.generated}개 생성`);
      } catch (e) {
        console.warn(`[시그널] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // ── Phase 4: 지식그래프 (빠름, 항상 실행) ──
    if (remaining() > 5_000) {
      try {
        const { updateKnowledgeGraph } = await import('@/lib/crypto/knowledge-graph');
        await updateKnowledgeGraph(supabase);
        console.log(`[지식그래프] 업데이트 완료`);
      } catch (e) {
        console.warn(`[지식그래프] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    const elapsedSec = (elapsed() / 1000).toFixed(1);

    const sourceSummary = allResults.reduce((acc, r) => {
      const key = r.source;
      if (!acc[key]) acc[key] = { channels: 0, posts: 0, new: 0 };
      acc[key].channels++;
      acc[key].posts += r.postsFound;
      acc[key].new += r.postsNew;
      return acc;
    }, {} as Record<string, { channels: number; posts: number; new: number }>);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[크립토 크롤링 완료] ${elapsedSec}초`);
    for (const [src, info] of Object.entries(sourceSummary)) {
      console.log(`   ${src}: ${info.channels}개 채널, ${info.posts}개 발견 → ${info.new}개 저장`);
    }
    console.log(`   멘션: ${totalMentions}개 추출`);
    console.log(`   센티먼트: ${sentimentResult.success}/${sentimentResult.processed}개`);
    console.log(`   시그널: ${signalResult.generated}개`);
    if (errors.length > 0) console.log(`   오류: ${errors.length}건`);
    if (needsContinue) console.log(`   ⏰ 시간 제한으로 미완료 작업 있음`);
    console.log(`${'='.repeat(60)}\n`);

    // ── Self-Continue ──
    if (needsContinue && selfContinueCount < SELF_CONTINUE.MAX_COUNT) {
      await triggerSelfContinue(selfContinueCount + 1);

      return NextResponse.json({
        success: true,
        selfContinue: true,
        selfContinueCount: selfContinueCount + 1,
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
        elapsed: `${elapsedSec}s`,
        message: '시간 제한으로 자동 이어하기 실행됨',
      });
    }

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
      elapsed: `${elapsedSec}s`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRYPTO CRAWL ERROR]:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
