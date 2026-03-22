/**
 * 4개 신규 소스 데이터 품질 테스트 — DB 저장 없음
 * npx tsx scripts/test-sources.ts
 */

const COIN_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'SHIB', 'BONK', 'WIF', 'FLOKI',
  'TRUMP', 'DEGEN', 'BASE', 'ARB', 'OP', 'BRETT', 'MOG', 'POPCAT',
  'FARTCOIN', 'AI16Z', 'VIRTUAL', 'AIXBT', 'MEME', 'TURBO', 'NEIRO', 'GOAT',
  'PNUT', 'SPX', 'GIGA', 'JUP', 'PENDLE', 'AAVE', 'UNI', 'LINK',
  'AVAX', 'DOT', 'ADA', 'XRP', 'BNB', 'RENDER', 'FET', 'TAO', 'WLD',
]);

const COIN_NAMES = new Set([
  'bitcoin', 'ethereum', 'solana', 'dogecoin', 'pepe', 'shiba', 'bonk',
  'dogwifhat', 'floki', 'degen', 'memecoin', 'meme coin', 'pump.fun',
  'raydium', 'uniswap', 'pancakeswap', 'airdrop', 'rugpull', 'rug pull',
  'moonshot', '100x', 'altcoin', 'defi', 'nft',
]);

function hasCryptoMention(text: string): { found: boolean; tickers: string[] } {
  const tickers: string[] = [];
  const upper = text.toUpperCase();
  for (const t of COIN_TICKERS) {
    if (upper.includes(`$${t}`) || upper.includes(`#${t}`) || new RegExp(`\\b${t}\\b`).test(upper)) {
      tickers.push(t);
    }
  }
  const lower = text.toLowerCase();
  for (const n of COIN_NAMES) {
    if (lower.includes(n)) tickers.push(n);
  }
  return { found: tickers.length > 0, tickers: [...new Set(tickers)] };
}

function hoursAgo(ts: string | number): number {
  const d = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime();
  return Math.round((Date.now() - d) / 3600_000);
}

// ═══════════════════════════════════════
// 1. 4chan /biz/
// ═══════════════════════════════════════
async function test4chan() {
  console.log('\n═══ 1. 4chan /biz/ ═══\n');

  try {
    const res = await fetch('https://a.4cdn.org/biz/catalog.json', {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages: any[] = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allThreads: any[] = [];
    for (const page of pages) {
      for (const thread of page.threads || []) {
        allThreads.push(thread);
      }
    }

    console.log(`  총 쓰레드: ${allThreads.length}개`);

    let cryptoThreads = 0;
    let totalReplies = 0;
    const tickerCounts: Record<string, number> = {};
    const samples: string[] = [];
    let newest = Infinity;
    let oldest = 0;

    for (const t of allThreads) {
      const text = `${t.sub || ''} ${t.com || ''}`.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ');
      const { found, tickers } = hasCryptoMention(text);
      if (found) {
        cryptoThreads++;
        totalReplies += t.replies || 0;
        for (const tk of tickers) tickerCounts[tk] = (tickerCounts[tk] || 0) + 1;
        if (samples.length < 3) samples.push(`[${t.replies}r] ${text.slice(0, 100)}`);
      }
      const age = hoursAgo(t.time);
      if (age < newest) newest = age;
      if (age > oldest) oldest = age;
    }

    const pct = Math.round(cryptoThreads / allThreads.length * 100);
    console.log(`  크립토 관련: ${cryptoThreads}/${allThreads.length} (${pct}%)`);
    console.log(`  총 댓글 수 (크립토 쓰레드): ${totalReplies}`);
    console.log(`  게시물 나이: 최신 ${newest}h ~ 최오래 ${oldest}h`);

    const topTickers = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`  탑 멘션: ${topTickers.map(([k, v]) => `${k}(${v})`).join(', ')}`);

    console.log('  샘플:');
    for (const s of samples) console.log(`    └ ${s}`);

    // 댓글 하나 가져와보기
    const sampleThread = allThreads.find((t: { replies: number }) => t.replies > 5);
    if (sampleThread) {
      await new Promise(r => setTimeout(r, 1100));
      const tRes = await fetch(`https://a.4cdn.org/biz/thread/${sampleThread.no}.json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (tRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tData: any = await tRes.json();
        const posts = tData.posts || [];
        const cryptoPosts = posts.filter((p: { com?: string }) => {
          const txt = (p.com || '').replace(/<[^>]+>/g, '');
          return hasCryptoMention(txt).found;
        });
        console.log(`  쓰레드 #${sampleThread.no} 댓글: ${posts.length}개, 크립토 관련 ${cryptoPosts.length}개`);
      }
    }

    console.log(`\n  📊 일간 추정: 쓰레드 ${cryptoThreads}개 × 평균 ${cryptoThreads ? Math.round(totalReplies / cryptoThreads) : 0}댓글 = ~${totalReplies + cryptoThreads}건 (카탈로그 스냅샷 기준)`);

  } catch (e) {
    console.log(`  ❌ ${(e as Error).message}`);
  }
}

// ═══════════════════════════════════════
// 2. Bluesky
// ═══════════════════════════════════════
async function testBluesky() {
  console.log('\n═══ 2. Bluesky ═══\n');

  const keywords = ['memecoin', 'crypto pump', '$PEPE', '$DOGE', 'airdrop crypto', 'solana memecoin'];

  let totalPosts = 0;
  let totalCrypto = 0;

  for (const kw of keywords) {
    try {
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(kw)}&limit=25&sort=latest`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.log(`  "${kw}": ❌ ${res.status} ${body.slice(0, 100)}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const posts = data.posts || [];

      const cryptoPosts = posts.filter((p: { record?: { text?: string } }) => {
        const text = p.record?.text || '';
        return hasCryptoMention(text).found;
      });

      const ages = posts.map((p: { record?: { createdAt?: string } }) => hoursAgo(p.record?.createdAt || ''));
      const newestH = ages.length ? Math.min(...ages) : -1;
      const oldestH = ages.length ? Math.max(...ages) : -1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const avgLikes = posts.length ? Math.round(posts.reduce((s: number, p: any) => s + (p.likeCount || 0), 0) / posts.length) : 0;

      console.log(`  "${kw}": ${posts.length}건, 크립토 ${cryptoPosts.length}건, 평균 likes ${avgLikes}, ${newestH}h~${oldestH}h전`);

      if (cryptoPosts.length > 0) {
        const sample = cryptoPosts[0];
        const text = sample.record?.text || '';
        console.log(`    └ @${sample.author?.handle}: "${text.slice(0, 80)}..." (likes: ${sample.likeCount || 0})`);
      }

      totalPosts += posts.length;
      totalCrypto += cryptoPosts.length;
    } catch (e) {
      console.log(`  "${kw}": ❌ ${(e as Error).message}`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n  📊 합계: ${totalPosts}건 중 크립토 ${totalCrypto}건 (${totalPosts ? Math.round(totalCrypto / totalPosts * 100) : 0}%)`);
}

// ═══════════════════════════════════════
// 3. PullPush (Reddit 강화)
// ═══════════════════════════════════════
async function testPullPush() {
  console.log('\n═══ 3. PullPush (Reddit 풀텍스트 검색) ═══\n');

  const queries = ['memecoin', 'solana pump', 'rug pull crypto', '100x gem', 'airdrop'];

  let totalPosts = 0;

  for (const q of queries) {
    try {
      const url = `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(q)}&size=25&sort=desc&sort_type=created_utc`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

      if (!res.ok) {
        console.log(`  "${q}": ❌ ${res.status}`);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const posts = data.data || [];

      const ages = posts.map((p: { created_utc: number }) => hoursAgo(p.created_utc));
      const newestH = ages.length ? Math.min(...ages) : -1;
      const oldestH = ages.length ? Math.max(...ages) : -1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const avgScore = posts.length ? Math.round(posts.reduce((s: number, p: any) => s + (p.score || 0), 0) / posts.length) : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs = [...new Set(posts.map((p: any) => p.subreddit))].slice(0, 5);

      console.log(`  "${q}": ${posts.length}건, 평균 score ${avgScore}, ${newestH}h~${oldestH}h전`);
      console.log(`    서브레딧: ${subs.join(', ')}`);

      if (posts.length > 0) {
        const sample = posts[0];
        console.log(`    └ r/${sample.subreddit}: "${(sample.title || '').slice(0, 80)}" (score: ${sample.score})`);
      }

      totalPosts += posts.length;
    } catch (e) {
      console.log(`  "${q}": ❌ ${(e as Error).message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n  📊 합계: ${totalPosts}건`);
}

// ═══════════════════════════════════════
// 4. CryptoPanic
// ═══════════════════════════════════════
async function testCryptoPanic() {
  console.log('\n═══ 4. CryptoPanic ═══\n');

  // API 키 없이 공개 페이지 테스트
  const filters = ['rising', 'hot', 'bullish', 'bearish'];

  try {
    // 무료 public API (키 없이)
    const url = 'https://cryptopanic.com/api/free/v1/posts/?auth_token=free&public=true';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'InsightHub/1.0' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.log(`  Public API: ❌ ${res.status}`);

      // 대안: RSS 피드 테스트
      console.log('  RSS 피드 테스트...');
      const rssRes = await fetch('https://cryptopanic.com/news/rss/', {
        headers: { 'User-Agent': 'InsightHub/1.0' },
        signal: AbortSignal.timeout(10_000),
      });

      if (rssRes.ok) {
        const rssText = await rssRes.text();
        const itemCount = (rssText.match(/<item>/g) || []).length;
        const titles: string[] = [];
        const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/g;
        let match;
        while ((match = titleRegex.exec(rssText)) !== null && titles.length < 5) {
          titles.push(match[1]);
        }

        console.log(`  RSS: ${itemCount}건`);
        if (titles.length > 0) {
          console.log('  샘플:');
          for (const t of titles.slice(0, 3)) {
            const { tickers } = hasCryptoMention(t);
            console.log(`    └ "${t.slice(0, 80)}" [${tickers.join(',')}]`);
          }
        }

        const cryptoItems = titles.filter(t => hasCryptoMention(t).found).length;
        console.log(`\n  📊 RSS 크립토 관련: ${cryptoItems}/${titles.length}`);
      } else {
        console.log(`  RSS도 실패: ${rssRes.status}`);
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const results = data.results || [];
      console.log(`  Public API: ${results.length}건`);

      for (const item of results.slice(0, 5)) {
        const { tickers } = hasCryptoMention(item.title || '');
        console.log(`    └ "${(item.title || '').slice(0, 80)}" [${tickers.join(',')}] votes: ${item.votes?.positive || 0}↑ ${item.votes?.negative || 0}↓`);
      }
    }
  } catch (e) {
    console.log(`  ❌ ${(e as Error).message}`);
  }

  // 별도: CryptoPanic 무료 API 키 발급 안내
  console.log('\n  ℹ️  CryptoPanic 무료 API 키: https://cryptopanic.com/developers/api/ 에서 발급 가능');
}

// ═══════════════════════════════════════
// 실행
// ═══════════════════════════════════════
async function main() {
  console.log('🔍 신규 소스 4개 데이터 품질 테스트');
  console.log(`   시각: ${new Date().toISOString()}\n`);

  await test4chan();
  await testBluesky();
  await testPullPush();
  await testCryptoPanic();

  console.log('\n\n════════════════════════════════');
  console.log('✅ 전체 테스트 완료 — DB 저장 없음');
  console.log('════════════════════════════════\n');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
