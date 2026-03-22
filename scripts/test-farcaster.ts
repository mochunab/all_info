/**
 * Farcaster (Neynar API) 데이터 품질 테스트
 * DB 저장 없음 — API 응답 구조, 볼륨, 크립토 관련도만 확인
 *
 * 사용법:
 *   NEYNAR_API_KEY=neynar_xxx npx tsx scripts/test-farcaster.ts
 */

const API_KEY = process.env.NEYNAR_API_KEY;
if (!API_KEY) {
  console.error('❌ NEYNAR_API_KEY 환경변수 필요\n   https://dev.neynar.com 에서 발급');
  process.exit(1);
}

const BASE = 'https://api.neynar.com/v2/farcaster';

const CHANNELS = ['memes', 'degen', 'crypto', 'base', 'solana', 'trading', 'defi', 'onchain', 'farcaster', 'higher'];

const SEARCH_KEYWORDS = ['memecoin', '$PEPE', '$DOGE', 'crypto pump', 'airdrop'];

const COIN_TICKERS = new Set([
  'BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'SHIB', 'BONK', 'WIF', 'FLOKI',
  'TRUMP', 'DEGEN', 'HIGHER', 'BASE', 'ARB', 'OP', 'BRETT', 'MOG', 'POPCAT',
  'FARTCOIN', 'AI16Z', 'VIRTUAL', 'AIXBT', 'MEME', 'TURBO', 'NEIRO', 'GOAT',
]);

const COIN_NAMES = new Set([
  'bitcoin', 'ethereum', 'solana', 'dogecoin', 'pepe', 'shiba', 'bonk',
  'dogwifhat', 'floki', 'degen', 'memecoin', 'meme coin', 'airdrop',
]);

type Cast = {
  hash: string;
  author: { fid: number; username: string; display_name: string; follower_count?: number };
  text: string;
  timestamp: string;
  reactions: { likes_count: number; recasts_count: number };
  replies: { count: number };
  channel?: { id: string; name: string } | null;
};

async function neynarGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': API_KEY!, accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neynar ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function hasCryptoMention(text: string): boolean {
  const upper = text.toUpperCase();
  for (const t of COIN_TICKERS) {
    if (upper.includes(`$${t}`) || upper.includes(`#${t}`)) return true;
  }
  const lower = text.toLowerCase();
  for (const n of COIN_NAMES) {
    if (lower.includes(n)) return true;
  }
  return false;
}

function engagement(cast: Cast): number {
  return (cast.reactions?.likes_count || 0) + (cast.reactions?.recasts_count || 0) * 2;
}

// ── 1. 채널 피드 테스트 ──
async function testChannelFeeds() {
  console.log('\n═══ 1. 채널 피드 테스트 ═══\n');

  let totalCasts = 0;
  let cryptoRelevant = 0;
  let creditsUsed = 0;

  for (const ch of CHANNELS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await neynarGet('/feed/channels', { channel_ids: ch, limit: '25', with_recasts: 'false' }) as any;
      const casts: Cast[] = data.casts || [];
      creditsUsed += 4 * 25; // feed: 4 credits × limit

      const relevant = casts.filter((c: Cast) => hasCryptoMention(c.text));
      const avgEng = casts.length ? Math.round(casts.reduce((s: number, c: Cast) => s + engagement(c), 0) / casts.length) : 0;
      const maxFollowers = Math.max(...casts.map((c: Cast) => c.author?.follower_count || 0), 0);

      console.log(`  /${ch}: ${casts.length}건, 크립토 관련 ${relevant.length}건 (${casts.length ? Math.round(relevant.length / casts.length * 100) : 0}%), 평균 engagement ${avgEng}, 최대 팔로워 ${maxFollowers}`);

      if (relevant.length > 0) {
        const sample = relevant[0];
        console.log(`    └ 샘플: @${sample.author.username} — "${sample.text.slice(0, 80)}..." (eng: ${engagement(sample)})`);
      }

      totalCasts += casts.length;
      cryptoRelevant += relevant.length;
    } catch (e) {
      console.log(`  /${ch}: ❌ ${(e as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n  📊 채널 합계: ${totalCasts}건, 크립토 관련 ${cryptoRelevant}건 (${totalCasts ? Math.round(cryptoRelevant / totalCasts * 100) : 0}%)`);
  console.log(`  💰 크레딧 소비: ~${creditsUsed}`);
  return { totalCasts, cryptoRelevant, creditsUsed };
}

// ── 2. 키워드 검색 테스트 ──
async function testSearch() {
  console.log('\n═══ 2. 키워드 검색 테스트 ═══\n');

  let totalCasts = 0;
  let creditsUsed = 0;

  for (const kw of SEARCH_KEYWORDS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await neynarGet('/cast/search', { q: kw, limit: '10' }) as any;
      const casts: Cast[] = data.result?.casts || [];
      creditsUsed += 10; // search: 10 credits

      const avgEng = casts.length ? Math.round(casts.reduce((s: number, c: Cast) => s + engagement(c), 0) / casts.length) : 0;
      const ages = casts.map((c: Cast) => {
        const h = (Date.now() - new Date(c.timestamp).getTime()) / 3600_000;
        return Math.round(h);
      });
      const newestH = ages.length ? Math.min(...ages) : -1;
      const oldestH = ages.length ? Math.max(...ages) : -1;

      console.log(`  "${kw}": ${casts.length}건, 평균 eng ${avgEng}, 최신 ${newestH}h전, 최오래 ${oldestH}h전`);

      if (casts.length > 0) {
        const sample = casts[0];
        console.log(`    └ @${sample.author.username}: "${sample.text.slice(0, 80)}..."`);
      }

      totalCasts += casts.length;
    } catch (e) {
      console.log(`  "${kw}": ❌ ${(e as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n  📊 검색 합계: ${totalCasts}건`);
  console.log(`  💰 크레딧 소비: ~${creditsUsed}`);
  return { totalCasts, creditsUsed };
}

// ── 3. 볼륨 추정 ──
function estimateVolume(channelResult: { totalCasts: number; cryptoRelevant: number; creditsUsed: number }, searchResult: { totalCasts: number; creditsUsed: number }) {
  console.log('\n═══ 3. 일간 볼륨 & 크레딧 추정 ═══\n');

  const crawlsPerDay = 96; // 15분 간격
  const channelNewPerCrawl = Math.round(channelResult.cryptoRelevant * 0.4); // 60% 중복 가정
  const searchNewPerCrawl = Math.round(searchResult.totalCasts * 0.3); // 70% 중복 가정

  const dailyNew = (channelNewPerCrawl + searchNewPerCrawl) * crawlsPerDay;
  const dailyCredits = (channelResult.creditsUsed + searchResult.creditsUsed) * crawlsPerDay;
  const monthlyCredits = dailyCredits * 30;

  console.log(`  채널 피드 신규/크롤: ~${channelNewPerCrawl}건 (중복 60% 제거)`);
  console.log(`  검색 신규/크롤: ~${searchNewPerCrawl}건 (중복 70% 제거)`);
  console.log(`  📈 일간 추정: ~${dailyNew}건`);
  console.log(`  💰 일간 크레딧: ~${dailyCredits.toLocaleString()}`);
  console.log(`  💰 월간 크레딧: ~${monthlyCredits.toLocaleString()}`);
  console.log('');

  if (monthlyCredits <= 200_000) console.log('  ✅ Free 티어 (200K) 범위 내');
  else if (monthlyCredits <= 1_000_000) console.log('  ⚠️  Starter (1M) 필요');
  else if (monthlyCredits <= 10_000_000) console.log('  ⚠️  Growth (10M) 필요');
  else console.log('  🚨 Scale 이상 필요');
}

// ── 4. 응답 구조 샘플 ──
async function printSampleStructure() {
  console.log('\n═══ 4. Cast 응답 구조 샘플 ═══\n');
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await neynarGet('/feed/channels', { channel_ids: 'degen', limit: '1' }) as any;
    const cast = data.casts?.[0];
    if (cast) {
      console.log(JSON.stringify(cast, null, 2).slice(0, 1500));
    }
  } catch (e) {
    console.log(`  ❌ ${(e as Error).message}`);
  }
}

async function main() {
  console.log('🔍 Farcaster (Neynar) 데이터 품질 테스트');
  console.log(`   API Key: ${API_KEY!.slice(0, 12)}...`);
  console.log(`   시각: ${new Date().toISOString()}`);

  const ch = await testChannelFeeds();
  const sr = await testSearch();
  estimateVolume(ch, sr);
  await printSampleStructure();

  console.log('\n✅ 테스트 완료 — DB 저장 없음\n');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
