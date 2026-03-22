// 경량 코인 멘션 추출기 (discord-bot 독립 실행용, lib/crypto/coin-extractor.ts와 동일 로직)

type CoinEntry = { symbol: string; name: string; aliases: string[] };

const COIN_LIST: CoinEntry[] = [
  { symbol: 'BTC', name: 'Bitcoin', aliases: ['bitcoin', 'btc'] },
  { symbol: 'ETH', name: 'Ethereum', aliases: ['ethereum', 'eth', 'ether'] },
  { symbol: 'SOL', name: 'Solana', aliases: ['solana', 'sol'] },
  { symbol: 'XRP', name: 'Ripple', aliases: ['ripple', 'xrp'] },
  { symbol: 'ADA', name: 'Cardano', aliases: ['cardano', 'ada'] },
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
  { symbol: 'AI16Z', name: 'ai16z', aliases: ['ai16z'] },
  { symbol: 'VIRTUAL', name: 'Virtuals Protocol', aliases: ['virtuals', 'virtual'] },
  { symbol: 'AIXBT', name: 'aixbt', aliases: ['aixbt'] },
  { symbol: 'AAVE', name: 'Aave', aliases: ['aave'] },
  { symbol: 'UNI', name: 'Uniswap', aliases: ['uniswap', 'uni'] },
  { symbol: 'JUP', name: 'Jupiter', aliases: ['jupiter', 'jup'] },
  { symbol: 'LINK', name: 'Chainlink', aliases: ['chainlink', 'link'] },
  { symbol: 'AVAX', name: 'Avalanche', aliases: ['avalanche', 'avax'] },
  { symbol: 'ARB', name: 'Arbitrum', aliases: ['arbitrum', 'arb'] },
  { symbol: 'OP', name: 'Optimism', aliases: ['optimism'] },
  { symbol: 'SUI', name: 'Sui', aliases: ['sui'] },
  { symbol: 'TAO', name: 'Bittensor', aliases: ['bittensor', 'tao'] },
  { symbol: 'FET', name: 'Fetch.ai', aliases: ['fetch', 'fet'] },
  { symbol: 'RENDER', name: 'Render', aliases: ['render', 'rndr'] },
  { symbol: 'INJ', name: 'Injective', aliases: ['injective', 'inj'] },
  { symbol: 'NEAR', name: 'NEAR Protocol', aliases: ['near'] },
  { symbol: 'DOT', name: 'Polkadot', aliases: ['polkadot', 'dot'] },
  { symbol: 'CAKE', name: 'PancakeSwap', aliases: ['pancakeswap', 'cake'] },
  { symbol: 'SUSHI', name: 'SushiSwap', aliases: ['sushiswap', 'sushi'] },
  { symbol: 'WLD', name: 'Worldcoin', aliases: ['worldcoin', 'wld'] },
  { symbol: 'MELANIA', name: 'Melania Meme', aliases: ['melania'] },
  { symbol: 'GIGA', name: 'Giga Chad', aliases: ['giga', 'gigachad'] },
  { symbol: 'SPX', name: 'SPX6900', aliases: ['spx6900', 'spx'] },
  { symbol: 'NEIRO', name: 'Neiro', aliases: ['neiro'] },
  { symbol: 'MEW', name: 'cat in a dogs world', aliases: ['mew'] },
  { symbol: 'MYRO', name: 'Myro', aliases: ['myro'] },
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
  'ETF', 'SEC', 'FBI', 'CIA', 'USA', 'AI', 'ML', 'API', 'SDK',
  'PSA', 'TIL', 'ELI', 'AMA', 'CMV', 'JUST', 'LONG', 'SHORT',
  'PUMP', 'DUMP', 'MOON', 'BEAR', 'BULL', 'WHALE', 'RUG', 'GAS',
]);

export type MentionResult = {
  symbol: string;
  name: string | null;
  count: number;
  context: string | null;
};

export function extractCoinMentions(title: string, body: string | null): MentionResult[] {
  const text = `${title}\n${body || ''}`;
  const counts = new Map<string, number>();
  const contexts = new Map<string, string>();

  // $DOGE / #PEPE 패턴
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

  // alias 매칭
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

  // ALL-CAPS 단어 매칭 (title only)
  const WORD_PATTERN = /\b([A-Z]{3,6})\b/g;
  while ((match = WORD_PATTERN.exec(title)) !== null) {
    const word = match[1];
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
