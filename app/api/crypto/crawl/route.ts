import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { invalidateCacheByPrefix, invalidateCache, CACHE_KEYS } from '@/lib/cache';
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
  const qp = new URL(request.url).searchParams.get('phase');
  if (qp) return qp;
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

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    await fetch(`${siteUrl}/api/crypto/crawl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase }),
      signal: controller.signal,
    });
  } catch {
    // 5초 타임아웃 또는 네트워크 에러 — fire-and-forget이므로 무시
    // 서버에서는 요청을 받았으므로 처리됨
  }
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

    // ── Phase 1: 크롤링 (Reddit/Telegram/Threads) ──
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
        const elapsed = Date.now() - startTime;
        const telegramBudget = Math.max(200_000 - elapsed, 30_000);
        const { results } = await crawlAllTelegramChannels(supabase, telegramBudget);
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

      // CoinGecko Trending (무료, 매 크롤마다 실행)
      try {
        const { crawlCoinGeckoTrending } = await import('@/lib/crypto/coingecko-trending');
        const cgResult = await crawlCoinGeckoTrending(supabase);
        allResults.push(cgResult);
        if (cgResult.errors.length > 0) {
          console.warn(`[CoinGecko] 오류: ${cgResult.errors.join('; ')}`);
        } else {
          console.log(`✅ [CoinGecko] Trending ${cgResult.postsFound}개 발견, ${cgResult.mentionsExtracted}개 멘션`);
        }
      } catch (e) {
        console.warn(`[CoinGecko] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      // 4chan /biz/ (무료, API 키 불필요)
      try {
        const { crawlFourchan } = await import('@/lib/crypto/fourchan-crawler');
        const elapsed4ch = Date.now() - startTime;
        const fourchanBudget = Math.max(200_000 - elapsed4ch, 30_000);
        const { results: fourchanResults } = await crawlFourchan(supabase, fourchanBudget);
        allResults.push(...fourchanResults);
      } catch (e) {
        console.warn(`[4chan] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      if (process.env.APIFY_API_TOKEN) {
        const TWITTER_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간 간격 (10키워드 × 20결과 × 4회/일 = ~$4.80/월, Apify 무료 $5 내)
        const { data: lastTwitter } = await supabase
          .from('crypto_posts')
          .select('crawled_at')
          .eq('source', 'twitter')
          .order('crawled_at', { ascending: false })
          .limit(1)
          .single() as { data: { crawled_at: string } | null };

        const sinceLastTwitter = lastTwitter
          ? Date.now() - new Date(lastTwitter.crawled_at).getTime()
          : Infinity;

        if (sinceLastTwitter >= TWITTER_INTERVAL_MS) {
          try {
            const { crawlAllTwitterKeywords } = await import('@/lib/crypto/twitter-crawler');
            const results = await crawlAllTwitterKeywords(supabase);
            allResults.push(...results);
          } catch (e) {
            console.warn(`[Twitter] 스킵: ${e instanceof Error ? e.message : 'unknown'}`);
          }
        } else {
          const nextIn = Math.round((TWITTER_INTERVAL_MS - sinceLastTwitter) / 60000);
          console.log(`[Twitter] 스킵 — 다음 크롤까지 ${nextIn}분 남음 (6시간 간격, Apify 무료 플랜)`);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const totalNew = allResults.reduce((s, r) => s + r.postsNew, 0);
      const totalMentions = allResults.reduce((s, r) => s + r.mentionsExtracted, 0);
      console.log(`[크롤링 완료] ${elapsed}초, 신규: ${totalNew}개, 멘션: ${totalMentions}개`);

      // 센티먼트 + 시그널은 독립 크론(crypto-sentiment.yml, 5분 주기)이 처리

      return NextResponse.json({
        success: true,
        phase: 'crawl',
        crawl: {
          totalChannels: allResults.length,
          postsNew: totalNew,
          mentionsExtracted: totalMentions,
          details: allResults.map((r) => ({
            source: r.source,
            channel: r.channel,
            found: r.postsFound,
            new: r.postsNew,
            mentions: r.mentionsExtracted,
            errors: r.errors,
          })),
        },
        elapsed: `${elapsed}s`,
      });
    }

    // ── Phase 2: 센티먼트 분석 ──
    // ── Phase 2: 센티먼트 분석 (독립 크론 crypto-sentiment.yml, 5분 주기) ──
    if (phase === 'sentiment') {
      let sentimentResult = { processed: 0, success: 0, failed: 0 };

      try {
        const { processCryptoSentiments } = await import('@/lib/crypto/batch-sentiment');
        const result = await processCryptoSentiments(supabase, 200, 250_000);
        sentimentResult = { processed: result.processed, success: result.success, failed: result.failed };
      } catch (e) {
        console.warn(`[센티먼트] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
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

    // ── Phase 3: FOMO + FUD 시그널 + 지식그래프 (raw data 1회 fetch로 양쪽 생성) ──
    if (phase === 'signals' || phase === 'signals_fud') {
      let signalResult = { generated: 0 };

      try {
        const { generateAllSignals } = await import('@/lib/crypto/signal-generator');
        signalResult = await generateAllSignals(supabase);
        console.log(`[시그널] FOMO+FUD 총 ${signalResult.generated}개 생성`);
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

      invalidateCacheByPrefix(CACHE_KEYS.CRYPTO_SIGNALS_PREFIX);
      invalidateCache(CACHE_KEYS.CRYPTO_SSR);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      await triggerNextPhase('prices');

      return NextResponse.json({
        success: true,
        phase: 'signals',
        signals: signalResult,
        elapsed: `${elapsed}s`,
        nextPhase: 'prices',
      });
    }

    // ── Phase 4: 코인 동기화 + 가격 수집 ──
    if (phase === 'prices') {
      let syncResult = { synced: 0 };
      let priceResult = { fetched: 0, stored: 0 };

      try {
        const { syncCoinList } = await import('@/lib/crypto/coin-sync');
        syncResult = await syncCoinList(supabase);
      } catch (e) {
        console.warn(`[코인싱크] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      try {
        const { fetchAndStorePrices } = await import('@/lib/crypto/price-fetcher');
        priceResult = await fetchAndStorePrices(supabase);
      } catch (e) {
        console.warn(`[가격] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      invalidateCache(CACHE_KEYS.CRYPTO_PRICES);
      invalidateCacheByPrefix(CACHE_KEYS.CRYPTO_SIGNALS_PREFIX);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[가격 완료] ${elapsed}초, 동기화: ${syncResult.synced}개, 가격: ${priceResult.stored}개`);

      await triggerNextPhase('battle');

      return NextResponse.json({
        success: true,
        phase: 'prices',
        sync: syncResult,
        prices: priceResult,
        elapsed: `${elapsed}s`,
        nextPhase: 'battle',
      });
    }

    // ── Phase 5: 배틀 거래 ──
    if (phase === 'battle') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let battleResult: any = { evaluated: false };

      try {
        const { executeBattle } = await import('@/lib/crypto/battle-trader');
        battleResult = await executeBattle(supabase);
        console.log(`[배틀] 평가: ${battleResult.evaluated}`);
      } catch (e) {
        console.warn(`[배틀] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[배틀 완료] ${elapsed}초`);

      await triggerNextPhase('backtest');

      return NextResponse.json({
        success: true,
        phase: 'battle',
        battle: battleResult,
        elapsed: `${elapsed}s`,
        nextPhase: 'backtest',
      });
    }

    // ── Phase 6: 백테스트 (시그널 vs 가격 비교) ──
    if (phase === 'backtest') {
      let backtestResult = { recorded: 0, evaluated: 0 };

      try {
        const { runBacktest, evaluatePending } = await import('@/lib/crypto/backtester');
        backtestResult = await runBacktest(supabase);
        const pending = await evaluatePending(supabase);
        backtestResult.evaluated += pending.evaluated;
      } catch (e) {
        console.warn(`[백테스트] 오류: ${e instanceof Error ? e.message : 'unknown'}`);
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[백테스트 완료] ${elapsed}초, 기록: ${backtestResult.recorded}개, 평가: ${backtestResult.evaluated}개`);

      return NextResponse.json({
        success: true,
        phase: 'backtest',
        backtest: backtestResult,
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
