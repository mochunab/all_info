import type { SubredditConfig, TelegramChannelConfig, CoinEntry } from '@/types/crypto';

export const CRYPTO_SUBREDDITS: readonly SubredditConfig[] = [
  { name: 'CryptoCurrency', weight: 1.0, minScore: 10 },
  { name: 'memecoin', weight: 1.2, minScore: 5 },
  { name: 'SatoshiStreetBets', weight: 1.1, minScore: 5 },
  { name: 'CryptoMoonShots', weight: 0.8, minScore: 3 },
  { name: 'altcoin', weight: 0.9, minScore: 5 },
  { name: 'memecoinmoonshots', weight: 1.0, minScore: 3 },
  { name: 'CryptoMarkets', weight: 0.9, minScore: 10 },
  { name: 'solana', weight: 1.0, minScore: 5 },
  { name: 'Dogecoin', weight: 0.8, minScore: 5 },
  { name: 'CryptoCurrencies', weight: 0.7, minScore: 5 },
] as const;

export const REDDIT_API_BASE = 'https://oauth.reddit.com';
export const REDDIT_AUTH_URL = 'https://www.reddit.com/api/v1/access_token';
export const REDDIT_RATE_LIMIT_MS = 1000;
export const REDDIT_MAX_PAGES = 3;
export const REDDIT_PAGE_LIMIT = 100;
export const OAUTH_TOKEN_TTL_MS = 55 * 60 * 1000; // 55분

// ── Telegram 설정 ──

export const TELEGRAM_CHANNELS: readonly TelegramChannelConfig[] = [
  // 대형 (10만+)
  { username: 'binance_announcements', weight: 0.7, language: 'en' },
  { username: 'OKXannouncements', weight: 0.7, language: 'en' },
  { username: 'cryptoVIPsignalTA', weight: 1.1, language: 'en' },
  { username: 'CoinTelegraph', weight: 1.0, language: 'en' },
  { username: 'whale_alert_io', weight: 1.2, language: 'en' },
  { username: 'Bitcoin', weight: 1.0, language: 'en' },
  { username: 'crypto', weight: 1.0, language: 'en' },
  // 중형 (1천~10만)
  { username: 'coincodecap', weight: 0.9, language: 'en' },
  { username: 'CryptoSignals', weight: 1.1, language: 'en' },
  { username: 'CryptoSignalAlert', weight: 1.0, language: 'en' },
  // 소형 (밈코인 특화)
  { username: 'Memecoins_Calls', weight: 1.2, language: 'en' },
] as const;

export const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
export const TELEGRAM_FETCH_LIMIT = 100;
export const TELEGRAM_RATE_LIMIT_MS = 500;

export const CRAWL_CONCURRENCY = 2;
export const SENTIMENT_CONCURRENCY = 5;
export const SENTIMENT_MAX_RETRIES = 3;
export const SENTIMENT_RETRY_DELAY_MS = 1000;
export const POST_BODY_TRUNCATE_LENGTH = 2000;

export const TIME_WINDOWS = ['1h', '6h', '24h', '7d'] as const;

export const TIME_WINDOW_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

// 시그널 가중치
export const SIGNAL_WEIGHTS = {
  MENTION_VELOCITY: 0.25,
  AVG_SENTIMENT: 0.30,
  SENTIMENT_TREND: 0.15,
  ENGAGEMENT: 0.20,
  FOMO_AVG: 0.10,
} as const;

// 상위 200개 코인 + 밈코인
export const COIN_LIST: CoinEntry[] = [
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
  { symbol: 'FIL', name: 'Filecoin', aliases: ['filecoin', 'fil'] },
  { symbol: 'NEAR', name: 'NEAR Protocol', aliases: ['near'] },
  { symbol: 'APT', name: 'Aptos', aliases: ['aptos', 'apt'] },
  { symbol: 'ARB', name: 'Arbitrum', aliases: ['arbitrum', 'arb'] },
  { symbol: 'OP', name: 'Optimism', aliases: ['optimism'] },
  { symbol: 'SUI', name: 'Sui', aliases: ['sui'] },
  { symbol: 'SEI', name: 'Sei', aliases: ['sei'] },
  { symbol: 'INJ', name: 'Injective', aliases: ['injective', 'inj'] },
  { symbol: 'TIA', name: 'Celestia', aliases: ['celestia', 'tia'] },
  { symbol: 'RENDER', name: 'Render', aliases: ['render', 'rndr'] },
  { symbol: 'FET', name: 'Fetch.ai', aliases: ['fetch', 'fet'] },
  { symbol: 'TAO', name: 'Bittensor', aliases: ['bittensor', 'tao'] },
  // 밈코인
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
  { symbol: 'MYRO', name: 'Myro', aliases: ['myro'] },
  { symbol: 'BOME', name: 'Book of Meme', aliases: ['bome', 'book of meme'] },
  { symbol: 'MEW', name: 'cat in a dogs world', aliases: ['mew'] },
  { symbol: 'NEIRO', name: 'Neiro', aliases: ['neiro'] },
  { symbol: 'GOAT', name: 'Goatseus Maximus', aliases: ['goat', 'goatseus'] },
  { symbol: 'PNUT', name: 'Peanut the Squirrel', aliases: ['pnut', 'peanut'] },
  { symbol: 'ACT', name: 'Act I', aliases: ['act'] },
  { symbol: 'FARTCOIN', name: 'Fartcoin', aliases: ['fartcoin'] },
  { symbol: 'SPX', name: 'SPX6900', aliases: ['spx6900', 'spx'] },
  { symbol: 'GIGA', name: 'Giga Chad', aliases: ['giga', 'gigachad'] },
  { symbol: 'TRUMP', name: 'OFFICIAL TRUMP', aliases: ['trump'] },
  { symbol: 'MELANIA', name: 'Melania Meme', aliases: ['melania'] },
  // AI 토큰
  { symbol: 'RNDR', name: 'Render Token', aliases: ['render token'] },
  { symbol: 'AGIX', name: 'SingularityNET', aliases: ['singularitynet', 'agix'] },
  { symbol: 'OCEAN', name: 'Ocean Protocol', aliases: ['ocean'] },
  { symbol: 'WLD', name: 'Worldcoin', aliases: ['worldcoin', 'wld'] },
  { symbol: 'AI16Z', name: 'ai16z', aliases: ['ai16z'] },
  { symbol: 'VIRTUAL', name: 'Virtuals Protocol', aliases: ['virtuals', 'virtual'] },
  { symbol: 'AIXBT', name: 'aixbt', aliases: ['aixbt'] },
  // DeFi
  { symbol: 'AAVE', name: 'Aave', aliases: ['aave'] },
  { symbol: 'CRV', name: 'Curve', aliases: ['curve', 'crv'] },
  { symbol: 'MKR', name: 'Maker', aliases: ['maker', 'mkr'] },
  { symbol: 'SNX', name: 'Synthetix', aliases: ['synthetix', 'snx'] },
  { symbol: 'COMP', name: 'Compound', aliases: ['compound', 'comp'] },
  { symbol: 'SUSHI', name: 'SushiSwap', aliases: ['sushiswap', 'sushi'] },
  { symbol: 'CAKE', name: 'PancakeSwap', aliases: ['pancakeswap', 'cake'] },
  { symbol: 'PENDLE', name: 'Pendle', aliases: ['pendle'] },
  { symbol: 'JUP', name: 'Jupiter', aliases: ['jupiter', 'jup'] },
  // L2 / Infra
  { symbol: 'STRK', name: 'Starknet', aliases: ['starknet', 'strk'] },
  { symbol: 'ZK', name: 'ZKsync', aliases: ['zksync', 'zk'] },
  { symbol: 'BLAST', name: 'Blast', aliases: ['blast'] },
  { symbol: 'BASE', name: 'Base', aliases: ['base'] },
];

// 심볼 → 코인 빠른 조회용 맵
export const COIN_MAP = new Map<string, CoinEntry>(
  COIN_LIST.map((c) => [c.symbol.toUpperCase(), c])
);

// alias → 심볼 역조회 맵
export const ALIAS_MAP = new Map<string, string>();
for (const coin of COIN_LIST) {
  for (const alias of coin.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), coin.symbol);
  }
  ALIAS_MAP.set(coin.symbol.toLowerCase(), coin.symbol);
}
