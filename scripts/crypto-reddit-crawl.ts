#!/usr/bin/env npx tsx
/**
 * Reddit 크립토 크롤러 (GitHub Actions 전용, RSS 방식)
 *
 * Reddit JSON API는 클라우드 IP 차단 → RSS (.rss)는 허용.
 * Atom XML 파싱 후 DB 저장, 센티먼트 phase 트리거.
 *
 * Usage:
 *   npx tsx scripts/crypto-reddit-crawl.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — DB 접근
 *   CRON_SECRET — 센티먼트 phase 트리거용
 *   SITE_URL — Vercel 사이트 URL
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ──

const SUBREDDITS = [
  { name: 'CryptoCurrency', weight: 1.0 },
  { name: 'memecoin', weight: 1.2 },
  { name: 'SatoshiStreetBets', weight: 1.1 },
  { name: 'CryptoMoonShots', weight: 0.8 },
  { name: 'altcoin', weight: 0.9 },
  { name: 'memecoinmoonshots', weight: 1.0 },
  { name: 'CryptoMarkets', weight: 0.9 },
  { name: 'solana', weight: 1.0 },
  { name: 'Dogecoin', weight: 0.8 },
  { name: 'CryptoCurrencies', weight: 0.7 },
];

const RATE_LIMIT_MS = 1500;
const USER_AGENT = 'InsightHub:MemePredictor:1.0 (by /u/insighthub)';

// ── Coin list ──

const COIN_LIST = [
  { symbol: 'BTC', name: 'Bitcoin', aliases: ['bitcoin', 'btc'] },
  { symbol: 'ETH', name: 'Ethereum', aliases: ['ethereum', 'eth', 'ether'] },
  { symbol: 'BNB', name: 'BNB', aliases: ['binance', 'bnb'] },
  { symbol: 'SOL', name: 'Solana', aliases: ['solana', 'sol'] },
  { symbol: 'XRP', name: 'Ripple', aliases: ['ripple', 'xrp'] },
  { symbol: 'ADA', name: 'Cardano', aliases: ['cardano', 'ada'] },
  { symbol: 'AVAX', name: 'Avalanche', aliases: ['avalanche', 'avax'] },
  { symbol: 'DOT', name: 'Polkadot', aliases: ['polkadot', 'dot'] },
  { symbol: 'MATIC', name: 'Polygon', aliases: ['polygon', 'matic'] },
  { symbol: 'LINK', name: 'Chainlink', aliases: ['chainlink', 'link'] },
  { symbol: 'UNI', name: 'Uniswap', aliases: ['uniswap', 'uni'] },
  { symbol: 'ATOM', name: 'Cosmos', aliases: ['cosmos', 'atom'] },
  { symbol: 'LTC', name: 'Litecoin', aliases: ['litecoin', 'ltc'] },
  { symbol: 'NEAR', name: 'NEAR Protocol', aliases: ['near'] },
  { symbol: 'APT', name: 'Aptos', aliases: ['aptos', 'apt'] },
  { symbol: 'ARB', name: 'Arbitrum', aliases: ['arbitrum', 'arb'] },
  { symbol: 'OP', name: 'Optimism', aliases: ['optimism'] },
  { symbol: 'SUI', name: 'Sui', aliases: ['sui'] },
  { symbol: 'INJ', name: 'Injective', aliases: ['injective', 'inj'] },
  { symbol: 'RENDER', name: 'Render', aliases: ['render', 'rndr'] },
  { symbol: 'FET', name: 'Fetch.ai', aliases: ['fetch', 'fet'] },
  { symbol: 'TAO', name: 'Bittensor', aliases: ['bittensor', 'tao'] },
  { symbol: 'DOGE', name: 'Dogecoin', aliases: ['dogecoin', 'doge'] },
  { symbol: 'SHIB', name: 'Shiba Inu', aliases: ['shiba', 'shib', 'shiba inu'] },
  { symbol: 'PEPE', name: 'Pepe', aliases: ['pepe'] },
  { symbol: 'BONK', name: 'Bonk', aliases: ['bonk'] },
  { symbol: 'WIF', name: 'dogwifhat', aliases: ['dogwifhat', 'wif'] },
  { symbol: 'FLOKI', name: 'Floki', aliases: ['floki'] },
  { symbol: 'MEME', name: 'Memecoin', aliases: ['memecoin'] },
  { symbol: 'TURBO', name: 'Turbo', aliases: ['turbo'] },
  { symbol: 'BRETT', name: 'Brett', aliases: ['brett'] },
  { symbol: 'MOG', name: 'Mog Coin', aliases: ['mog'] },
  { symbol: 'POPCAT', name: 'Popcat', aliases: ['popcat'] },
  { symbol: 'BOME', name: 'Book of Meme', aliases: ['bome', 'book of meme'] },
  { symbol: 'GOAT', name: 'Goatseus Maximus', aliases: ['goat', 'goatseus'] },
  { symbol: 'PNUT', name: 'Peanut the Squirrel', aliases: ['pnut', 'peanut'] },
  { symbol: 'FARTCOIN', name: 'Fartcoin', aliases: ['fartcoin'] },
  { symbol: 'TRUMP', name: 'OFFICIAL TRUMP', aliases: ['trump'] },
  { symbol: 'AGIX', name: 'SingularityNET', aliases: ['singularitynet', 'agix'] },
  { symbol: 'WLD', name: 'Worldcoin', aliases: ['worldcoin', 'wld'] },
  { symbol: 'AI16Z', name: 'ai16z', aliases: ['ai16z'] },
  { symbol: 'VIRTUAL', name: 'Virtuals Protocol', aliases: ['virtuals', 'virtual'] },
  { symbol: 'AAVE', name: 'Aave', aliases: ['aave'] },
  { symbol: 'MKR', name: 'Maker', aliases: ['maker', 'mkr'] },
  { symbol: 'SUSHI', name: 'SushiSwap', aliases: ['sushiswap', 'sushi'] },
  { symbol: 'CAKE', name: 'PancakeSwap', aliases: ['pancakeswap', 'cake'] },
  { symbol: 'JUP', name: 'Jupiter', aliases: ['jupiter', 'jup'] },
];

const COIN_MAP = new Map(COIN_LIST.map((c) => [c.symbol.toUpperCase(), c]));

const BLACKLIST = new Set([
  'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
  'WAS', 'ONE', 'OUR', 'OUT', 'HAS', 'HIS', 'HOW', 'MAN', 'NEW', 'NOW',
  'OLD', 'SEE', 'WAY', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY',
  'SHE', 'TOO', 'USE', 'DAD', 'MOM', 'GET', 'GOT', 'HIM', 'HIT', 'HOT',
  'BIG', 'END', 'WHY', 'RUN', 'DIP', 'BUY', 'ATH', 'ATL', 'CEO', 'NFT',
  'DEX', 'APR', 'APY', 'TVL', 'IMO', 'LOL', 'HODL', 'FOMO', 'FUD',
  'DYOR', 'DD', 'TA', 'FA', 'OTC', 'ICO', 'IDO', 'IEO', 'DCA', 'ROI',
  'PNL', 'USD', 'EUR', 'GBP', 'JPY', 'KRW', 'CNY', 'CAD', 'AUD',
  'ETF', 'SEC', 'FBI', 'CIA', 'USA', 'UK', 'EU', 'UN', 'AI', 'ML',
  'API', 'SDK', 'GPU', 'CPU', 'RAM', 'SSD', 'HDD', 'USB', 'URL',
  'PSA', 'TIL', 'ELI', 'AMA', 'CMV', 'JUST', 'LONG', 'SHORT',
  'PUMP', 'DUMP', 'MOON', 'BEAR', 'BULL', 'WHALE', 'RUG', 'GAS',
]);

// ── Helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

function extractCoinMentions(title: string, body: string | null) {
  const text = `${title}\n${body || ''}`;
  const counts = new Map<string, number>();
  const contexts = new Map<string, string>();

  const TICKER_PATTERN = /(?:\$|#)([A-Z]{2,10})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = TICKER_PATTERN.exec(text)) !== null) {
    const symbol = match[1].toUpperCase();
    if (COIN_MAP.has(symbol)) {
      counts.set(symbol, (counts.get(symbol) || 0) + 1);
      if (!contexts.has(symbol)) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        contexts.set(symbol, text.slice(start, end).replace(/\n/g, ' ').trim());
      }
    }
  }

  const lowerText = text.toLowerCase();
  for (const coin of COIN_LIST) {
    for (const alias of coin.aliases) {
      if (alias.length < 3) continue;
      const idx = lowerText.indexOf(alias);
      if (idx !== -1) {
        counts.set(coin.symbol, (counts.get(coin.symbol) || 0) + 1);
        if (!contexts.has(coin.symbol)) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(text.length, idx + alias.length + 30);
          contexts.set(coin.symbol, text.slice(start, end).replace(/\n/g, ' ').trim());
        }
      }
    }
  }

  const WORD_PATTERN = /\b([A-Z]{2,10})\b/g;
  while ((match = WORD_PATTERN.exec(title)) !== null) {
    const word = match[1];
    if (word.length < 3 || word.length > 6) continue;
    if (BLACKLIST.has(word)) continue;
    if (COIN_MAP.has(word) && !counts.has(word)) {
      counts.set(word, 1);
      const start = Math.max(0, match.index - 30);
      const end = Math.min(title.length, match.index + word.length + 30);
      contexts.set(word, title.slice(start, end).trim());
    }
  }

  return Array.from(counts.entries()).map(([symbol, count]) => ({
    symbol,
    name: COIN_MAP.get(symbol)?.name || null,
    count,
    context: contexts.get(symbol) || null,
  }));
}

// ── RSS 파싱 (정규식, 외부 의존성 없음) ──

type RssPost = {
  id: string;
  title: string;
  author: string;
  link: string;
  published: string;
  content: string | null;
};

function parseAtomFeed(xml: string): RssPost[] {
  const posts: RssPost[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entry = entryMatch[1];

    const id = entry.match(/<id>([^<]+)<\/id>/)?.[1] || '';
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const author = entry.match(/<name>([^<]*)<\/name>/)?.[1]?.replace(/^\/u\//, '') || 'unknown';
    const link = entry.match(/<link\s+href="([^"]+)"/)?.[1] || '';
    const published = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] || '';
    const contentMatch = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const rawContent = contentMatch?.[1] || null;
    // HTML 태그 제거하여 텍스트만 추출
    const content = rawContent
      ? rawContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
      : null;

    if (id && title) {
      posts.push({ id, title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), author, link, published, content });
    }
  }

  return posts;
}

// ── Reddit RSS fetch ──

async function fetchSubredditRss(subreddit: string): Promise<RssPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/.rss`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Reddit RSS ${response.status} for r/${subreddit}`);
  }

  const xml = await response.text();
  return parseAtomFeed(xml);
}

// ── Main ──

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const siteUrl = process.env.SITE_URL || 'https://aca-info.com';

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const startTime = Date.now();

  let totalFound = 0;
  let totalNew = 0;
  let totalMentions = 0;
  let totalErrors = 0;

  for (const config of SUBREDDITS) {
    console.log(`\n📌 r/${config.name}`);

    try {
      const rssPosts = await fetchSubredditRss(config.name);
      totalFound += rssPosts.length;

      if (rssPosts.length === 0) {
        console.log(`  → 0개`);
        continue;
      }

      // RSS에는 score가 없으므로 source_id로 Reddit post ID 추출
      const rows = rssPosts.map((p) => {
        // id 형태: t3_xxxxx (URL에서 추출)
        const postId = p.link.match(/comments\/([a-z0-9]+)/)?.[1] || p.id;
        return {
          source: 'reddit' as const,
          source_id: `reddit_t3_${postId}`,
          channel: config.name,
          title: sanitizeText(p.title),
          body: p.content ? sanitizeText(p.content) : null,
          author: p.author,
          permalink: p.link.replace('https://www.reddit.com', ''),
          upvotes: 0,
          upvote_ratio: 0,
          num_comments: 0,
          num_awards: 0,
          score: 0,
          flair: null,
          posted_at: new Date(p.published).toISOString(),
          crawled_at: new Date().toISOString(),
        };
      });

      const { data: upserted, error: upsertError } = await supabase
        .from('crypto_posts')
        .upsert(rows, { onConflict: 'source_id', ignoreDuplicates: false })
        .select('id, source_id');

      if (upsertError) {
        console.error(`  ❌ upsert: ${upsertError.message}`);
        totalErrors++;
        continue;
      }

      const upsertedPosts = upserted || [];
      totalNew += upsertedPosts.length;

      const sourceIdToDbId = new Map<string, string>();
      for (const row of upsertedPosts) {
        sourceIdToDbId.set(row.source_id, row.id);
      }

      const mentionRows: { post_id: string; coin_symbol: string; coin_name: string | null; mention_count: number; context: string | null }[] = [];

      for (const row of rows) {
        const dbId = sourceIdToDbId.get(row.source_id);
        if (!dbId) continue;
        const mentions = extractCoinMentions(row.title, row.body);
        for (const m of mentions) {
          mentionRows.push({ post_id: dbId, coin_symbol: m.symbol, coin_name: m.name, mention_count: m.count, context: m.context });
        }
      }

      if (mentionRows.length > 0) {
        const postIds = [...new Set(mentionRows.map((m) => m.post_id))];
        await supabase.from('crypto_mentions').delete().in('post_id', postIds);
        const { error: mentionError } = await supabase.from('crypto_mentions').insert(mentionRows);
        if (mentionError) {
          console.error(`  ❌ mentions: ${mentionError.message}`);
        } else {
          totalMentions += mentionRows.length;
        }
      }

      console.log(`  ✅ ${rssPosts.length}개 발견, ${upsertedPosts.length}개 저장, ${mentionRows.length}개 멘션`);
    } catch (e) {
      console.error(`  ❌ ${e instanceof Error ? e.message : 'unknown'}`);
      totalErrors++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Reddit RSS 크롤링 완료: ${elapsed}초`);
  console.log(`  발견: ${totalFound}개, 저장: ${totalNew}개, 멘션: ${totalMentions}개, 에러: ${totalErrors}개`);

  if (cronSecret) {
    console.log(`\n🔄 센티먼트 phase 트리거...`);
    try {
      const res = await fetch(`${siteUrl}/api/crypto/crawl`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'sentiment' }),
      });
      console.log(`  → HTTP ${res.status}`);
    } catch (e) {
      console.error(`  ❌ 트리거 실패: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
