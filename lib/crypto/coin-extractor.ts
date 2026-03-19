/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { COIN_LIST, COIN_MAP } from '@/lib/crypto/config';
import type { CoinEntry } from '@/types/crypto';

type MentionResult = {
  symbol: string;
  name: string | null;
  count: number;
  context: string | null;
};

const TICKER_PATTERN = /(?:\$|#)([A-Z]{2,10})\b/gi;
const WORD_BOUNDARY_PATTERN = /\b([A-Z]{2,10})\b/g;

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

// DB 코인 목록 캐시 (프로세스 수명 동안 유지, 최대 1시간)
let cachedCoinList: CoinEntry[] | null = null;
let cachedCoinMap: Map<string, CoinEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function loadCoinList(supabase?: SupabaseClient<any>): Promise<{ list: CoinEntry[]; map: Map<string, CoinEntry> }> {
  if (cachedCoinList && cachedCoinMap && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return { list: cachedCoinList, map: cachedCoinMap };
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('crypto_coins')
        .select('symbol, name')
        .eq('is_active', true);

      if (data && data.length > 0) {
        const list: CoinEntry[] = data.map((c: any) => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          aliases: [c.name.toLowerCase(), c.symbol.toLowerCase()],
        }));
        const map = new Map<string, CoinEntry>(list.map((c) => [c.symbol, c]));
        cachedCoinList = list;
        cachedCoinMap = map;
        cacheTimestamp = Date.now();
        return { list, map };
      }
    } catch {
      // fallback to hardcoded
    }
  }

  return { list: COIN_LIST, map: COIN_MAP };
}

export function extractCoinMentions(title: string, body: string | null): MentionResult[] {
  return extractWithMaps(title, body, COIN_LIST, COIN_MAP);
}

export async function extractCoinMentionsFromDB(
  title: string,
  body: string | null,
  supabase: SupabaseClient<any>
): Promise<MentionResult[]> {
  const { list, map } = await loadCoinList(supabase);
  return extractWithMaps(title, body, list, map);
}

function extractWithMaps(
  title: string,
  body: string | null,
  coinList: CoinEntry[],
  coinMap: Map<string, CoinEntry>
): MentionResult[] {
  const text = `${title}\n${body || ''}`;
  const counts = new Map<string, number>();
  const contexts = new Map<string, string>();

  let match: RegExpExecArray | null;
  TICKER_PATTERN.lastIndex = 0;
  while ((match = TICKER_PATTERN.exec(text)) !== null) {
    const symbol = match[1].toUpperCase();
    if (coinMap.has(symbol)) {
      counts.set(symbol, (counts.get(symbol) || 0) + 1);
      if (!contexts.has(symbol)) {
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        contexts.set(symbol, text.slice(start, end).replace(/\n/g, ' ').trim());
      }
    }
  }

  const lowerText = text.toLowerCase();
  for (const coin of coinList) {
    for (const alias of coin.aliases) {
      if (alias.length < 3) continue;
      const idx = lowerText.indexOf(alias);
      if (idx !== -1) {
        const sym = coin.symbol;
        counts.set(sym, (counts.get(sym) || 0) + 1);
        if (!contexts.has(sym)) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(text.length, idx + alias.length + 30);
          contexts.set(sym, text.slice(start, end).replace(/\n/g, ' ').trim());
        }
      }
    }
  }

  WORD_BOUNDARY_PATTERN.lastIndex = 0;
  while ((match = WORD_BOUNDARY_PATTERN.exec(title)) !== null) {
    const word = match[1];
    if (word.length < 3 || word.length > 6) continue;
    if (BLACKLIST.has(word)) continue;
    if (coinMap.has(word)) {
      if (!counts.has(word)) {
        counts.set(word, 1);
        const start = Math.max(0, match.index - 30);
        const end = Math.min(title.length, match.index + word.length + 30);
        contexts.set(word, title.slice(start, end).trim());
      }
    }
  }

  return Array.from(counts.entries()).map(([symbol, count]) => ({
    symbol,
    name: coinMap.get(symbol)?.name || null,
    count,
    context: contexts.get(symbol) || null,
  }));
}
