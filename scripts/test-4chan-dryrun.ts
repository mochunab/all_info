/**
 * 4chan /biz/ 크롤러 dry-run — DB 저장 없이 실제 파이프라인 시뮬레이션 + 품질 검증
 * npx tsx scripts/test-4chan-dryrun.ts
 */

import { COIN_LIST } from '../lib/crypto/config';

const FOURCHAN_API = 'https://a.4cdn.org/biz';
const RATE_LIMIT_MS = 1100;
const MAX_THREADS = 30;
const MIN_REPLIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CRYPTO_KEYWORDS = new Set([
  ...COIN_LIST.map((c) => c.symbol.toLowerCase()),
  ...COIN_LIST.flatMap((c) => c.aliases),
  'crypto', 'cryptocurrency', 'blockchain', 'defi', 'nft', 'token',
  'memecoin', 'meme coin', 'shitcoin', 'altcoin', 'pump', 'dump',
  'moon', 'hodl', 'wagmi', 'ngmi', 'degen', 'rug', 'rugpull',
  'airdrop', 'staking', 'yield', 'swap', 'dex', 'cex',
  'binance', 'coinbase', 'uniswap', 'raydium', 'jupiter',
  'solana', 'ethereum', 'bitcoin', 'pump.fun', 'pumpfun',
]);

const TICKER_RE = /\$([A-Z]{2,10})\b/g;
const COIN_TICKERS = new Set(COIN_LIST.map((c) => c.symbol));

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<wbr\s*\/?>/gi, '')
    .replace(/<a[^>]*class="quotelink"[^>]*>[^<]*<\/a>/gi, '')
    .replace(/<s>[^<]*<\/s>/gi, '[spoiler]')
    .replace(/<[^>]+>/g, '')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&[^;]+;/g, ' ')
    .trim();
}

function isCryptoRelated(text: string): boolean {
  if (/\$[A-Z]{2,10}\b/.test(text)) return true;
  const lower = text.toLowerCase();
  for (const kw of CRYPTO_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

const STRICT_ALIAS_BLACKLIST = new Set([
  'trump', 'melania', 'matic', 'ether', 'maker', 'blast', 'ocean', 'render',
  'curve', 'compound', 'fetch', 'pendle', 'sushi', 'staking',
]);

function extractTickers(text: string): string[] {
  const tickers: string[] = [];
  let match;
  // Pass 1: $TICKER만 (strict)
  while ((match = TICKER_RE.exec(text)) !== null) {
    if (COIN_TICKERS.has(match[1])) tickers.push(match[1]);
  }
  TICKER_RE.lastIndex = 0;
  // Pass 2: 긴 alias만 (≥5자, strict mode) + 블랙리스트 제외
  const lower = text.toLowerCase();
  for (const coin of COIN_LIST) {
    for (const alias of coin.aliases) {
      if (alias.length >= 5 && !STRICT_ALIAS_BLACKLIST.has(alias) && lower.includes(alias) && !tickers.includes(coin.symbol)) {
        tickers.push(coin.symbol);
        break;
      }
    }
  }
  return [...new Set(tickers)];
}

// ── 품질 검증 ──

type QualityIssue = { type: string; detail: string; postNo: number };

function checkQuality(postNo: number, text: string, issues: QualityIssue[]) {
  // 1. 너무 짧은 텍스트
  if (text.length < 10) {
    issues.push({ type: 'TOO_SHORT', detail: `${text.length}자`, postNo });
  }
  // 2. HTML 잔여물
  if (/<[a-z]|&[a-z]+;/i.test(text)) {
    issues.push({ type: 'HTML_REMNANT', detail: text.slice(0, 50), postNo });
  }
  // 3. 깨진 유니코드
  if (/[\uFFFD]/.test(text) || /[\uD800-\uDFFF]/.test(text)) {
    issues.push({ type: 'BROKEN_UNICODE', detail: text.slice(0, 50), postNo });
  }
  // 4. 200자 title 잘림 시 서로게이트 쌍 안전성
  if (text.length > 200) {
    const code = text.charCodeAt(199);
    if (code >= 0xD800 && code <= 0xDBFF) {
      issues.push({ type: 'SURROGATE_SPLIT', detail: 'title 경계에서 서로게이트 분리', postNo });
    }
  }
  // 5. 스팸 패턴 (동일 문자 반복, 홍보 링크)
  if (/(.)\1{20,}/.test(text)) {
    issues.push({ type: 'SPAM_REPEAT', detail: text.slice(0, 50), postNo });
  }
  if (/(t\.me\/|discord\.gg\/|bit\.ly\/|join now|presale)/i.test(text)) {
    issues.push({ type: 'SPAM_PROMO', detail: text.slice(0, 80), postNo });
  }
}

async function main() {
  console.log('🧪 4chan /biz/ 크롤러 Dry-Run + 품질 검증\n');

  // 1. 카탈로그 fetch
  const catRes = await fetch(`${FOURCHAN_API}/catalog.json`, { signal: AbortSignal.timeout(10_000) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages: any[] = await catRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allThreads: any[] = pages.flatMap((p) => p.threads || []);

  const cryptoThreads = allThreads
    .filter((t) => {
      const text = stripHtml(`${t.sub || ''} ${t.com || ''}`);
      return isCryptoRelated(text) && t.replies >= MIN_REPLIES;
    })
    .sort((a, b) => b.last_modified - a.last_modified)
    .slice(0, MAX_THREADS);

  console.log(`📋 전체 쓰레드: ${allThreads.length}, 크립토 필터: ${cryptoThreads.length}개\n`);

  // 2. 쓰레드별 댓글 fetch + 품질 검증
  const issues: QualityIssue[] = [];
  let totalPosts = 0;
  let cryptoPosts = 0;
  let totalMentions = 0;
  const tickerCounts: Record<string, number> = {};
  const sourceIds = new Set<string>();
  let duplicateSourceIds = 0;
  const postLengths: number[] = [];
  const samples: { thread: number; postNo: number; text: string; tickers: string[] }[] = [];
  let spamCount = 0;
  const threadStats: { no: number; total: number; crypto: number; mentions: number }[] = [];

  for (const thread of cryptoThreads) {
    await sleep(RATE_LIMIT_MS);

    try {
      const tRes = await fetch(`${FOURCHAN_API}/thread/${thread.no}.json`, { signal: AbortSignal.timeout(10_000) });
      if (!tRes.ok) {
        console.log(`  ❌ thread ${thread.no}: ${tRes.status}`);
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tData: any = await tRes.json();
      const posts = tData.posts || [];

      let threadCrypto = 0;
      let threadMentions = 0;

      for (let i = 0; i < posts.length; i++) {
        const raw = stripHtml(posts[i].com || '');
        if (!raw || raw.length < 10) continue;

        const isOp = i === 0;
        const isCrypto = isOp || isCryptoRelated(raw);
        if (!isCrypto) continue;

        totalPosts++;
        cryptoPosts++;
        threadCrypto++;
        postLengths.push(raw.length);

        // source_id 중복 체크
        const sid = `4chan_biz_${posts[i].no}`;
        if (sourceIds.has(sid)) {
          duplicateSourceIds++;
        }
        sourceIds.add(sid);

        // 품질 체크
        checkQuality(posts[i].no, raw, issues);

        // 스팸 체크
        if (/(t\.me\/|discord\.gg\/|presale|join now)/i.test(raw)) spamCount++;

        // 티커 추출
        const tickers = extractTickers(raw);
        for (const t of tickers) tickerCounts[t] = (tickerCounts[t] || 0) + 1;
        threadMentions += tickers.length;
        totalMentions += tickers.length;

        // 샘플 수집
        if (samples.length < 5 && tickers.length > 0) {
          samples.push({ thread: thread.no, postNo: posts[i].no, text: raw.slice(0, 120), tickers });
        }
      }

      threadStats.push({ no: thread.no, total: posts.length, crypto: threadCrypto, mentions: threadMentions });
      process.stdout.write(`  ✅ #${thread.no} (${posts.length}p, crypto ${threadCrypto}, mentions ${threadMentions})\n`);
    } catch (e) {
      console.log(`  ❌ thread ${thread.no}: ${(e as Error).message}`);
    }
  }

  // ── 결과 출력 ──

  console.log('\n\n════════════════════════════════');
  console.log('📊 크롤링 결과');
  console.log('════════════════════════════════\n');

  console.log(`  쓰레드 처리: ${threadStats.length}개`);
  console.log(`  총 게시물 (크립토): ${cryptoPosts}개`);
  console.log(`  총 멘션: ${totalMentions}개`);
  console.log(`  source_id 중복: ${duplicateSourceIds}개`);

  const avgLen = postLengths.length ? Math.round(postLengths.reduce((a, b) => a + b, 0) / postLengths.length) : 0;
  const medianLen = postLengths.length ? postLengths.sort((a, b) => a - b)[Math.floor(postLengths.length / 2)] : 0;
  console.log(`  게시물 길이: 평균 ${avgLen}자, 중앙값 ${medianLen}자`);

  console.log('\n════════════════════════════════');
  console.log('🏷️  탑 멘션 코인');
  console.log('════════════════════════════════\n');

  const topTickers = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [t, c] of topTickers) {
    const bar = '█'.repeat(Math.min(c, 30));
    console.log(`  ${t.padEnd(8)} ${String(c).padStart(3)} ${bar}`);
  }

  console.log('\n════════════════════════════════');
  console.log('🔍 샘플 게시물');
  console.log('════════════════════════════════\n');

  for (const s of samples) {
    console.log(`  [#${s.thread}/p${s.postNo}] [${s.tickers.join(',')}]`);
    console.log(`    "${s.text}"\n`);
  }

  console.log('════════════════════════════════');
  console.log('⚠️  품질 이슈');
  console.log('════════════════════════════════\n');

  if (issues.length === 0) {
    console.log('  ✅ 이슈 없음');
  } else {
    const byType: Record<string, number> = {};
    for (const i of issues) byType[i.type] = (byType[i.type] || 0) + 1;

    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}건`);
      const example = issues.find((i) => i.type === type);
      if (example) console.log(`    └ 예시 (p${example.postNo}): ${example.detail}`);
    }
  }

  console.log(`\n  스팸 (프로모/링크): ${spamCount}건 (${cryptoPosts ? Math.round(spamCount / cryptoPosts * 100) : 0}%)`);

  console.log('\n════════════════════════════════');
  console.log('📈 일간 볼륨 추정');
  console.log('════════════════════════════════\n');

  // 카탈로그는 활성 쓰레드 스냅샷 — 15분 크롤 시 중복 높음
  const newPerCrawl = Math.round(cryptoPosts * 0.15); // ~85% 중복 가정 (같은 쓰레드 재방문)
  const crawlsPerDay = 96;
  const dailyEstimate = newPerCrawl * crawlsPerDay;

  console.log(`  1회 크롤 총 수집: ${cryptoPosts}건`);
  console.log(`  1회 크롤 신규 추정: ~${newPerCrawl}건 (85% 중복 제거)`);
  console.log(`  일간 추정 (15분 간격): ~${dailyEstimate}건`);
  console.log(`  API 호출/크롤: ${threadStats.length + 1}건 (catalog 1 + threads ${threadStats.length})`);

  console.log('\n✅ Dry-run 완료 — DB 저장 없음\n');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
