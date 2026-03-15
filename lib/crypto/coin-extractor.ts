import { COIN_LIST, ALIAS_MAP, COIN_MAP } from '@/lib/crypto/config';

type MentionResult = {
  symbol: string;
  name: string | null;
  count: number;
  context: string | null;
};

// $DOGE, #PEPE, DOGE 등의 패턴 매칭
const TICKER_PATTERN = /(?:\$|#)([A-Z]{2,10})\b/gi;
const WORD_BOUNDARY_PATTERN = /\b([A-Z]{2,10})\b/g;

// 오탐 방지용 일반 영단어 블랙리스트
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

export function extractCoinMentions(title: string, body: string | null): MentionResult[] {
  const text = `${title}\n${body || ''}`;
  const counts = new Map<string, number>();
  const contexts = new Map<string, string>();

  // 1. $TICKER / #TICKER 패턴 (고신뢰)
  let match: RegExpExecArray | null;
  TICKER_PATTERN.lastIndex = 0;
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

  // 2. 풀네임 / alias 매칭 (대소문자 무시)
  const lowerText = text.toLowerCase();
  for (const coin of COIN_LIST) {
    for (const alias of coin.aliases) {
      if (alias.length < 3) continue; // 2글자 alias는 오탐 방지를 위해 스킵
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

  // 3. ALL-CAPS 단어 매칭 (저신뢰 — 블랙리스트 필터링)
  WORD_BOUNDARY_PATTERN.lastIndex = 0;
  while ((match = WORD_BOUNDARY_PATTERN.exec(title)) !== null) {
    const word = match[1];
    if (word.length < 3 || word.length > 6) continue;
    if (BLACKLIST.has(word)) continue;
    if (COIN_MAP.has(word)) {
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
    name: COIN_MAP.get(symbol)?.name || null,
    count,
    context: contexts.get(symbol) || null,
  }));
}
