import type { SubredditConfig, TelegramChannelConfig, CoinEntry, ThreadsSearchKeyword, TwitterSearchKeyword } from '@/types/crypto';

export const CRYPTO_SUBREDDITS: readonly SubredditConfig[] = [
  { name: 'CryptoCurrency', weight: 1.0, minScore: 10 },
  { name: 'memecoin', weight: 1.2, minScore: 5 },
  { name: 'SatoshiStreetBets', weight: 1.1, minScore: 5 },
  { name: 'CryptoMoonShots', weight: 0.8, minScore: 8 },
  { name: 'altcoin', weight: 0.9, minScore: 5 },
  { name: 'memecoinmoonshots', weight: 1.0, minScore: 8 },
  { name: 'CryptoMarkets', weight: 0.9, minScore: 10 },
  { name: 'solana', weight: 1.0, minScore: 5 },
  { name: 'Dogecoin', weight: 0.8, minScore: 5 },
  { name: 'CryptoCurrencies', weight: 0.7, minScore: 5 },
] as const;

export const REDDIT_RATE_LIMIT_MS = 1000;
export const REDDIT_MAX_PAGES = 3;
export const REDDIT_PAGE_LIMIT = 100;

// ── Telegram 설정 ──

export const TELEGRAM_CHANNELS: readonly TelegramChannelConfig[] = [
  // 대형 — 거래소/뉴스 (10만+)
  { username: 'binance_announcements', weight: 0.7, language: 'en' },
  { username: 'OKXannouncements', weight: 0.7, language: 'en' },
  { username: 'CoinTelegraph', weight: 1.0, language: 'en' },
  { username: 'whale_alert_io', weight: 1.2, language: 'en' },
  { username: 'Bitcoin', weight: 1.0, language: 'en' },
  { username: 'crypto', weight: 1.0, language: 'en' },
  { username: 'coinbureau', weight: 1.0, language: 'en' },
  { username: 'WatcherGuru', weight: 1.0, language: 'en' },
  // 대형 — 트레이딩 시그널 (10만+)
  { username: 'cryptoVIPsignalTA', weight: 1.1, language: 'en' },
  { username: 'BinanceKillers', weight: 1.0, language: 'en' },
  { username: 'WallstreetQueenOfficial', weight: 1.0, language: 'en' },
  { username: 'WolfOfTrading', weight: 1.0, language: 'en' },
  { username: 'BitcoinBullets', weight: 1.0, language: 'en' },
  { username: 'FatPigSignals', weight: 1.1, language: 'en' },
  { username: 'MyCryptoParadise', weight: 1.0, language: 'en' },
  { username: 'AltSignals', weight: 1.0, language: 'en' },
  { username: 'LunarCrush', weight: 1.0, language: 'en' },
  // 중형 — 뉴스/마켓 (1만~10만)
  { username: 'coincodecap', weight: 0.9, language: 'en' },
  { username: 'CryptoSignals', weight: 1.1, language: 'en' },
  { username: 'CryptoSignalAlert', weight: 1.0, language: 'en' },
  { username: 'CryptoWorldNews', weight: 0.9, language: 'en' },
  // 밈코인 특화
  { username: 'memecoinz', weight: 1.1, language: 'en' },
  { username: 'DEXTOOLSPUMPS', weight: 1.3, language: 'en' },
] as const;

export const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
export const TELEGRAM_FETCH_LIMIT = 100;
export const TELEGRAM_RATE_LIMIT_MS = 500;

// ── Threads 설정 ──

export const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

export const THREADS_SEARCH_KEYWORDS: readonly ThreadsSearchKeyword[] = [
  { keyword: 'memecoin', weight: 1.2 },
  { keyword: 'meme coin', weight: 1.2 },
  { keyword: '$DOGE', weight: 1.0 },
  { keyword: '$PEPE', weight: 1.0 },
  { keyword: '$SHIB', weight: 1.0 },
  { keyword: '$BONK', weight: 1.0 },
  { keyword: '$WIF', weight: 1.0 },
  { keyword: 'crypto pump', weight: 1.1 },
  { keyword: 'altcoin', weight: 0.9 },
  { keyword: 'to the moon crypto', weight: 1.1 },
] as const;

export const THREADS_SEARCH_LIMIT = 50;
export const THREADS_RATE_LIMIT_MS = 500;

// ── Twitter/X (Apify) 설정 ──

export const TWITTER_SEARCH_KEYWORDS: readonly TwitterSearchKeyword[] = [
  { query: 'memecoin', weight: 1.2 },
  { query: '$DOGE OR $PEPE OR $SHIB', weight: 1.0 },
  { query: '$BONK OR $WIF OR $FLOKI', weight: 1.0 },
  { query: 'crypto pump OR altcoin gem', weight: 1.1 },
  { query: '$SOL OR $ETH memecoin', weight: 0.9 },
] as const;

export const TWITTER_RESULTS_PER_KEYWORD = 20;
export const TWITTER_APIFY_ACTOR = 'scrape.badger/twitter-tweets-scraper';
export const TWITTER_APIFY_TIMEOUT_MS = 60_000;

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

// Self-Continue (타임아웃 방지)
export const SELF_CONTINUE = {
  SAFE_LIMIT_MS: 200_000,
  MAX_COUNT: 5,
  SIGNAL_KG_RESERVE_MS: 30_000,
} as const;

// 시그널 신뢰도 최소 멘션 수 (미만이면 점수 감쇠)
export const MIN_MENTION_CONFIDENCE = 5;

// 시가총액 순위 기반 감쇠 — 대형 코인의 "당연한 언급량" 보정
export const MARKET_CAP_DAMPENING = {
  REFERENCE_CAP_USD: 50_000_000,
  MIN_FACTOR: 0.05,
  POWER: 0.3,
  MAX_RANK: 200,
  RANK_MIN_FACTOR: 0.15,
} as const;

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

// ── 온톨로지 메타엣지 규칙 (허용 관계 문법) ──

export type MetaEdgeRule = { source: string; target: string };

export const META_EDGES: Record<string, MetaEdgeRule> = {
  correlates_with: { source: 'coin', target: 'coin' },
  mentions: { source: 'influencer', target: 'coin' },
  part_of: { source: 'coin', target: 'narrative' },
  recommends: { source: 'influencer', target: 'coin' },
  impacts: { source: 'event', target: 'coin' },
} as const;

// ── 내러티브 클러스터 (코인 그룹 → 자동 내러티브 생성) ──

export const NARRATIVE_CLUSTERS: { name: string; coins: string[] }[] = [
  { name: 'Dog Coins', coins: ['DOGE', 'SHIB', 'FLOKI', 'BONK', 'WIF', 'MYRO'] },
  { name: 'AI Tokens', coins: ['FET', 'AGIX', 'TAO', 'RNDR', 'OCEAN', 'WLD', 'AI16Z', 'VIRTUAL', 'AIXBT'] },
  { name: 'Meme Culture', coins: ['PEPE', 'BRETT', 'MOG', 'POPCAT', 'MEME', 'TURBO', 'BOME', 'MEW', 'NEIRO'] },
  { name: 'DeFi', coins: ['AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'SUSHI', 'CAKE', 'PENDLE', 'JUP', 'UNI'] },
  { name: 'L2 & Infra', coins: ['ARB', 'OP', 'STRK', 'ZK', 'BLAST', 'BASE', 'SUI', 'SEI'] },
  { name: 'Political Coins', coins: ['TRUMP', 'MELANIA'] },
  { name: 'Solana Ecosystem', coins: ['SOL', 'BONK', 'WIF', 'JUP', 'POPCAT', 'BOME'] },
];

// ── 이벤트 감지 키워드 (key_phrases에서 추출) ──

export const EVENT_KEYWORDS = [
  'listing', 'delisting', 'launch', 'airdrop', 'hack', 'exploit',
  'regulation', 'sec', 'etf', 'halving', 'burn', 'partnership',
  'upgrade', 'fork', 'mainnet', 'testnet', 'rug pull', 'bankruptcy',
  'acquisition', 'integration', 'staking', 'unlock', 'vesting',
] as const;

// ── 관계 감쇠 설정 ──

export const RELATION_DECAY_DAYS = 3;
export const ENTITY_DECAY_DAYS = 7;

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

// ── Signal Scoring V2 ──

export const ZSCORE_ROLLING_PERIODS = 10;
export const ZSCORE_SPIKE_THRESHOLD = 2.0;
export const ZSCORE_MAX_BOOST = 1.5;

export const CROSS_PLATFORM_MULTIPLIERS = { SINGLE: 0.7, DUAL: 1.0, MULTI: 1.3 } as const;

export const CONTRARIAN_THRESHOLD = 0.85;

// ── Knowledge Graph → Signal Boost ──

export const KG_BOOST = {
  INFLUENCER_RECOMMENDS_MAX: 0.15,  // 1.0 + 0.15 × recommendsStrength
  CORRELATED_HOT_BOOST: 5,
  CORRELATED_HOT_THRESHOLD: 60,
  CORRELATED_WEIGHT_CAP: 10,       // weight ≥ 10 → 최대 boost
  NARRATIVE_MOMENTUM_MAX_BOOST: 4,  // avg 100 → +4, avg 0 → -4 (양방향 연속)
  EVENT_IMPACT_POSITIVE: 3,
  EVENT_IMPACT_NEGATIVE: -3,
  MAX_TOTAL_BOOST: 15,
} as const;

export const EVENT_TYPE_PATTERNS: Record<string, { keywords: string[]; modifier: number }> = {
  exchange_listing: { keywords: ['listing', 'listed on binance', 'listed on coinbase', 'coinbase listing', 'binance listing', 'upbit listing'], modifier: 15 },
  security_incident: { keywords: ['hacked', 'exploit', 'rug pull', 'rugpull', 'rugged', 'vulnerability', 'breach', 'drained', 'funds stolen'], modifier: -20 },
  whale_buy: { keywords: ['whale buy', 'whale accumulation', 'whale bought', 'whales accumulating', 'large purchase'], modifier: 10 },
  whale_sell: { keywords: ['whale sell', 'whale dump', 'whale sold', 'whales dumping', 'large sell-off'], modifier: -10 },
  regulatory_positive: { keywords: ['etf approved', 'sec approves', 'regulation positive', 'legal win', 'etf approval'], modifier: 10 },
  regulatory_negative: { keywords: ['sec lawsuit', 'sec sues', 'banned', 'delisted', 'crackdown', 'regulation negative'], modifier: -15 },
  partnership: { keywords: ['partnership', 'partners with', 'integrates with', 'collaboration', 'strategic alliance'], modifier: 8 },
  airdrop: { keywords: ['airdrop', 'token distribution', 'free tokens'], modifier: 5 },
};
